/**
 * pillarService.ts — Generic pillar-based CRUD service factory.
 *
 * Creates dedicated service instances for each content pillar
 * (Sarkari Naukri, Sarkari Bharti, University Exams, Board Exams).
 * 
 * Each instance operates on the shared `exams` + `exam_editions` tables
 * but filters exclusively by its pillar value.
 * 
 * Same architecture as entranceExamService.ts but generalized.
 */
import { db } from "@/lib/supabase/client";
import { revalidateExams } from "@/lib/revalidate";
import { normalizeUrlOrThrow } from "@/lib/utils";
import type { Pillar } from "@/types/exam";
import type { ExamIdentity, ExamEdition, EntranceExamListItem, EditionStatus, CycleFrequency, CycleSession } from "@/services/entranceExamService";

// Re-export types for convenience
export type { ExamIdentity, ExamEdition, EntranceExamListItem as PillarListItem, EditionStatus, CycleFrequency, CycleSession };

// ── Row Mappers (shared with entranceExamService) ──────────────────────────

const DETAIL_SELECT = `*, cat:categories!category_id(slug), subcat:categories!subcategory_id(slug)`;

const LIST_SELECT = `
  id, slug, name, short_name, category_id, conducting_body, is_published,
  cycle_frequency, is_featured,
  cat:categories!category_id(slug),
  current_edition:exam_editions!current_edition_id(
    id, year, edition_label, status, important_dates
  )
`;

function mapIdentity(row: any): ExamIdentity {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name ?? "",
    pillar: row.pillar,
    category: row.cat?.slug ?? "",
    subcategory: row.subcat?.slug ?? "",
    categoryId: row.category_id ?? null,
    subcategoryId: row.subcategory_id ?? null,
    entityType: row.entity_type ?? "exam",
    conductingBody: row.conducting_body ?? "",
    officialWebsite: row.official_website ?? "",
    cycleFrequency: row.cycle_frequency ?? "annual",
    selectionProcess: row.selection_process ?? [],
    syllabusHighlights: row.syllabus_highlights ?? [],
    tags: row.tags ?? [],
    searchKeywords: row.search_keywords ?? [],
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    isFeatured: row.is_featured ?? false,
    isPublished: row.is_published ?? false,
    isVerified: row.is_verified ?? false,
    faqs: row.faqs ?? [],
    currentEditionId: row.current_edition_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEdition(row: any): ExamEdition {
  return {
    id: row.id,
    examId: row.exam_id,
    year: row.year,
    session: row.session ?? "main",
    editionLabel: row.edition_label ?? "",
    isCurrent: row.is_current ?? false,
    status: row.status ?? "upcoming",
    notificationDate: row.notification_date ?? null,
    importantDates: row.important_dates ?? [],
    eligibility: row.eligibility ?? {},
    vacancy: row.vacancy ?? null,
    applicationFee: row.application_fee ?? {},
    ageLimit: row.age_limit ?? null,
    hasNotification: row.has_notification ?? false,
    hasApplication: row.has_application ?? false,
    hasAdmitCard: row.has_admit_card ?? false,
    hasSyllabus: row.has_syllabus ?? false,
    hasAnswerKey: row.has_answer_key ?? false,
    hasResult: row.has_result ?? false,
    hasCutoff: row.has_cutoff ?? false,
    hasCounselling: row.has_counselling ?? false,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    resultSummary: row.result_summary ?? null,
    counsellingData: row.counselling_data ?? null,
    contentModules: row.content_modules ?? {},
    faqs: row.faqs ?? [],
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? null,
  };
}

// ── Service Factory ────────────────────────────────────────────────────────

export function createPillarService(pillar: Pillar) {
  return {
    pillar,

    async getList(opts?: { search?: string; categoryId?: string }) {
      let q = db.from("exams").select(LIST_SELECT).eq("pillar", pillar).order("is_featured", { ascending: false }).order("name");
      if (opts?.search) q = q.or(`name.ilike.%${opts.search}%,short_name.ilike.%${opts.search}%`);
      if (opts?.categoryId) q = q.eq("category_id", opts.categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row: any) => {
        const edition = row.current_edition;
        const dates = edition?.important_dates as any[] | null;
        const now = new Date();
        const nextDate = dates?.find((d: any) => new Date(d.date) > now) ?? null;
        return {
          id: row.id,
          slug: row.slug,
          name: row.name,
          shortName: row.short_name ?? "",
          category: row.cat?.slug ?? "",
          categoryId: row.category_id ?? null,
          conductingBody: row.conducting_body ?? "",
          cycleFrequency: row.cycle_frequency ?? "annual",
          isFeatured: row.is_featured ?? false,
          isPublished: row.is_published ?? false,
          currentEdition: edition ? { id: edition.id, year: edition.year, editionLabel: edition.edition_label, status: edition.status, nextDate } : null,
        };
      });
    },

    async getById(id: string) {
      const { data: examRow, error: examErr } = await db.from("exams").select(DETAIL_SELECT).eq("id", id).single();
      if (examErr) throw examErr;
      const exam = mapIdentity(examRow);

      const { data: editionRows, error: edErr } = await db.from("exam_editions").select("*").eq("exam_id", id).order("year", { ascending: false });
      if (edErr) throw edErr;
      const editions = (editionRows ?? []).map(mapEdition);
      const currentEdition = editions.find((e: any) => e.isCurrent) ?? null;

      return { exam, currentEdition, editions };
    },

    async create(input: { name: string; shortName: string; slug?: string; categoryId?: string; conductingBody: string; officialWebsite?: string; cycleFrequency?: CycleFrequency; firstEditionYear: number }) {
      const slug = input.slug || input.shortName.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 60) || input.name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);

      const { data: existing } = await db.from("exams").select("id").eq("slug", slug).maybeSingle();
      if (existing) throw new Error(`Slug "${slug}" already exists.`);

      const { data: examRow, error: examErr } = await db.from("exams").insert({
        slug, name: input.name, short_name: input.shortName,
        pillar: pillar, category_id: input.categoryId || null,
        entity_type: "exam", conducting_body: input.conductingBody,
        official_website: normalizeUrlOrThrow(input.officialWebsite), cycle_frequency: input.cycleFrequency ?? "annual",
        status: "upcoming", is_featured: false, is_published: true,
      }).select(DETAIL_SELECT).single();
      if (examErr) throw examErr;

      const { data: edRow, error: edErr } = await db.from("exam_editions").insert({
        exam_id: examRow.id, year: input.firstEditionYear, session: "main",
        edition_label: String(input.firstEditionYear), is_current: true, status: "upcoming",
      }).select("*").single();
      if (edErr) throw edErr;

      revalidateExams().catch(() => {});
      return { exam: mapIdentity(examRow), edition: mapEdition(edRow) };
    },

    async updateIdentity(examId: string, input: Record<string, any>) {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.shortName !== undefined) updates.short_name = input.shortName;
      if (input.slug !== undefined) updates.slug = input.slug;
      if (input.categoryId !== undefined) updates.category_id = input.categoryId || null;
      if (input.conductingBody !== undefined) updates.conducting_body = input.conductingBody;
      if (input.officialWebsite !== undefined) updates.official_website = normalizeUrlOrThrow(input.officialWebsite);
      if (input.cycleFrequency !== undefined) updates.cycle_frequency = input.cycleFrequency;
      if (input.isFeatured !== undefined) updates.is_featured = input.isFeatured;
      if (input.seoTitle !== undefined) updates.seo_title = input.seoTitle;
      if (input.seoDescription !== undefined) updates.seo_description = input.seoDescription;
      if (input.tags !== undefined) updates.tags = input.tags;
      if (input.faqs !== undefined) updates.faqs = input.faqs;

      const { data, error } = await db.from("exams").update(updates).eq("id", examId).select(DETAIL_SELECT).single();
      if (error) throw error;
      revalidateExams().catch(() => {});
      return mapIdentity(data);
    },

    async updateEdition(editionId: string, input: Record<string, any>) {
      const updates: Record<string, unknown> = {};
      if (input.status !== undefined) updates.status = input.status;
      if (input.notificationDate !== undefined) updates.notification_date = input.notificationDate;
      if (input.importantDates !== undefined) updates.important_dates = input.importantDates;
      if (input.vacancy !== undefined) updates.vacancy = input.vacancy;
      if (input.hasNotification !== undefined) updates.has_notification = input.hasNotification;
      if (input.hasApplication !== undefined) updates.has_application = input.hasApplication;
      if (input.hasAdmitCard !== undefined) updates.has_admit_card = input.hasAdmitCard;
      if (input.hasSyllabus !== undefined) updates.has_syllabus = input.hasSyllabus;
      if (input.hasAnswerKey !== undefined) updates.has_answer_key = input.hasAnswerKey;
      if (input.hasResult !== undefined) updates.has_result = input.hasResult;
      if (input.hasCutoff !== undefined) updates.has_cutoff = input.hasCutoff;
      if (input.hasCounselling !== undefined) updates.has_counselling = input.hasCounselling;
      if (input.contentModules !== undefined) updates.content_modules = input.contentModules;
      if (input.faqs !== undefined) updates.faqs = input.faqs;
      if (input.eligibility !== undefined) updates.eligibility = input.eligibility;
      if (input.applicationFee !== undefined) updates.application_fee = input.applicationFee;

      const { data, error } = await db.from("exam_editions").update(updates).eq("id", editionId).select("*").single();
      if (error) throw error;
      revalidateExams().catch(() => {});
      return mapEdition(data);
    },
  };
}

// ── Pre-built service instances ────────────────────────────────────────────

export const sarkariNaukriService = createPillarService("sarkari-naukri");
export const sarkariBhartiService = createPillarService("sarkari-bharti" as Pillar);
export const universityExamService = createPillarService("university-exam" as Pillar);
export const boardExamService = createPillarService("board-university");
