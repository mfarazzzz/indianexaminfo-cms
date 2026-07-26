/**
 * examService.ts — CRUD for the `exams` table.
 * This is the table the frontend reads from directly.
 * Field mapping mirrors frontend types/exam.ts ExamEntity exactly.
 */
import { db } from "@/lib/supabase/client";
import type { ExamEntity, ExamStatus, Pillar } from "@/types/exam";

// ── Row mapper: Supabase snake_case → camelCase ────────────────────────────

function mapRow(row: Record<string, unknown>): ExamEntity {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    shortName: (row.short_name as string) ?? "",
    pillar: row.pillar as Pillar,
    category: (row as any).cat?.slug ?? "",
    subcategory: (row as any).subcat?.slug ?? "",
    entityType: (row.entity_type as ExamEntity["entityType"]) ?? "exam",
    conductingBody: (row.conducting_body as string) ?? "",
    officialWebsite: (row.official_website as string) ?? "",
    status: (row.status as ExamStatus) ?? "upcoming",
    hasAdmitCard: (row.has_admit_card as boolean) ?? false,
    hasResult: (row.has_result as boolean) ?? false,
    hasAnswerKey: (row.has_answer_key as boolean) ?? false,
    hasSyllabus: (row.has_syllabus as boolean) ?? false,
    hasDateSheet: (row.has_date_sheet as boolean) ?? false,
    hasMockTest: (row.has_mock_test as boolean) ?? false,
    hasPreviousPapers: (row.has_previous_papers as boolean) ?? false,
    hasStudyMaterial: (row.has_study_material as boolean) ?? false,
    hasApplication: (row.has_application as boolean) ?? false,
    hasNotification: (row.has_notification as boolean) ?? false,
    hasCutoff: (row.has_cutoff as boolean) ?? false,
    dates: ((row.important_dates as unknown[]) ?? []) as ExamEntity["dates"],
    eligibility: (row.eligibility as ExamEntity["eligibility"]) ?? undefined,
    vacancy: (row.vacancy as number) ?? undefined,
    applicationFee: (row.application_fee as ExamEntity["applicationFee"]) ?? undefined,
    selectionProcess: (row.selection_process as string[]) ?? [],
    syllabusHighlights: (row.syllabus_highlights as string[]) ?? [],
    academicYear: (row.academic_year as string) ?? undefined,
    semester: (row.semester as string) ?? undefined,
    admissionTo: (row.admission_to as string) ?? undefined,
    tags: (row.tags as string[]) ?? [],
    lastUpdated: (row.last_updated as string) ?? (row.updated_at as string) ?? "",
    isFeatured: (row.is_featured as boolean) ?? false,
    searchKeywords: (row.search_keywords as string[]) ?? [],
    seoTitle: (row.seo_title as string) ?? undefined,
    seoDescription: (row.seo_description as string) ?? undefined,
    faqs: (row.faqs as ExamEntity["faqs"]) ?? [],
    isPublished: (row.is_published as boolean) ?? false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

// ── List ───────────────────────────────────────────────────────────────────

export interface ExamListOpts {
  pillar?: string;
  categoryId?: string;
  status?: string;
  search?: string;
  isFeatured?: boolean;
  limit?: number;
  offset?: number;
}

const LIST_SELECT = `
  *, cat:categories!category_id(slug), subcat:categories!subcategory_id(slug)
`;

export async function getExams(opts?: ExamListOpts): Promise<{ data: ExamEntity[]; count: number }> {
  let q = db
    .from("exams")
    .select(LIST_SELECT, { count: "exact" })
    .order("updated_at", { ascending: false });

  if (opts?.pillar) q = q.eq("pillar", opts.pillar);
  if (opts?.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.isFeatured !== undefined) q = q.eq("is_featured", opts.isFeatured);
  if (opts?.search) q = q.ilike("name", `%${opts.search}%`);
  if (opts?.limit) q = q.limit(opts.limit);
  if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 25) - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: (data ?? []).map((r: any) => mapRow(r)), count: count ?? 0 };
}

// ── Get by ID ──────────────────────────────────────────────────────────────

export async function getExamById(id: string): Promise<ExamEntity | null> {
  const { data, error } = await db
    .from("exams")
    .select(LIST_SELECT)
    .eq("id", id)
    .single();
  if (error) return null;
  return mapRow(data as Record<string, unknown>);
}

// ── Create ─────────────────────────────────────────────────────────────────

export interface ExamCreateInput {
  slug: string;
  name: string;
  shortName: string;
  pillar: Pillar;
  categoryId?: string | null;
  subcategoryId?: string | null;
  entityType: ExamEntity["entityType"];
  conductingBody: string;
  officialWebsite?: string;
  status?: ExamStatus;
  isFeatured?: boolean;
  createdBy?: string;
}

export async function createExam(input: ExamCreateInput): Promise<ExamEntity> {
  const { data, error } = await db
    .from("exams")
    .insert({
      slug: input.slug,
      name: input.name,
      short_name: input.shortName,
      pillar: input.pillar,
      category_id: input.categoryId || null,
      subcategory_id: input.subcategoryId || null,
      entity_type: input.entityType,
      conducting_body: input.conductingBody,
      official_website: input.officialWebsite || null,
      status: input.status ?? "upcoming",
      is_featured: input.isFeatured ?? false,
      created_by: input.createdBy || null,
    })
    .select(LIST_SELECT)
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

// ── Update ─────────────────────────────────────────────────────────────────

export interface ExamUpdateInput {
  slug?: string;
  name?: string;
  shortName?: string;
  pillar?: Pillar;
  categoryId?: string | null;
  subcategoryId?: string | null;
  entityType?: ExamEntity["entityType"];
  conductingBody?: string;
  officialWebsite?: string | null;
  status?: ExamStatus;
  // Content flags
  hasAdmitCard?: boolean;
  hasResult?: boolean;
  hasAnswerKey?: boolean;
  hasSyllabus?: boolean;
  hasDateSheet?: boolean;
  hasMockTest?: boolean;
  hasPreviousPapers?: boolean;
  hasStudyMaterial?: boolean;
  hasApplication?: boolean;
  hasNotification?: boolean;
  hasCutoff?: boolean;
  // Structured data
  dates?: ExamEntity["dates"];
  eligibility?: ExamEntity["eligibility"];
  vacancy?: number | null;
  applicationFee?: ExamEntity["applicationFee"];
  selectionProcess?: string[];
  syllabusHighlights?: string[];
  // Academic fields
  academicYear?: string | null;
  semester?: string | null;
  admissionTo?: string | null;
  // Meta
  tags?: string[];
  searchKeywords?: string[];
  isFeatured?: boolean;
  lastUpdated?: string;
  // SEO
  seoTitle?: string | null;
  seoDescription?: string | null;
  faqs?: ExamEntity["faqs"];
}

export async function updateExam(id: string, input: ExamUpdateInput): Promise<ExamEntity> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const fieldMap: Record<string, string> = {
    slug: "slug",
    name: "name",
    shortName: "short_name",
    pillar: "pillar",
    categoryId: "category_id",
    subcategoryId: "subcategory_id",
    entityType: "entity_type",
    conductingBody: "conducting_body",
    officialWebsite: "official_website",
    status: "status",
    hasAdmitCard: "has_admit_card",
    hasResult: "has_result",
    hasAnswerKey: "has_answer_key",
    hasSyllabus: "has_syllabus",
    hasDateSheet: "has_date_sheet",
    hasMockTest: "has_mock_test",
    hasPreviousPapers: "has_previous_papers",
    hasStudyMaterial: "has_study_material",
    hasApplication: "has_application",
    hasNotification: "has_notification",
    hasCutoff: "has_cutoff",
    dates: "important_dates",
    eligibility: "eligibility",
    vacancy: "vacancy",
    applicationFee: "application_fee",
    selectionProcess: "selection_process",
    syllabusHighlights: "syllabus_highlights",
    academicYear: "academic_year",
    semester: "semester",
    admissionTo: "admission_to",
    tags: "tags",
    searchKeywords: "search_keywords",
    isFeatured: "is_featured",
    lastUpdated: "last_updated",
    seoTitle: "seo_title",
    seoDescription: "seo_description",
    faqs: "faqs",
  };

  // UUID fields that must be null instead of empty string
  const UUID_FIELDS = new Set(["category_id", "subcategory_id"]);

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as any)[key] !== undefined) {
      let value = (input as any)[key];
      // Convert empty strings to null for UUID FK columns
      if (UUID_FIELDS.has(col) && value === "") value = null;
      updates[col] = value;
    }
  }

  // Auto-update last_updated if not explicitly set
  if (!input.lastUpdated) {
    updates.last_updated = new Date().toISOString().split("T")[0];
  }

  const { data, error } = await db
    .from("exams")
    .update(updates)
    .eq("id", id)
    .select(LIST_SELECT)
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteExam(id: string): Promise<void> {
  const { error } = await db.from("exams").delete().eq("id", id);
  if (error) throw error;
}

// ── Publish / Unpublish ────────────────────────────────────────────────────

export async function publishExam(id: string): Promise<ExamEntity> {
  const { data, error } = await db
    .from("exams")
    .update({ is_published: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(LIST_SELECT)
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function unpublishExam(id: string): Promise<ExamEntity> {
  const { data, error } = await db
    .from("exams")
    .update({ is_published: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(LIST_SELECT)
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

// ── Slug check ─────────────────────────────────────────────────────────────

export async function checkSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
  let q = db.from("exams").select("id").eq("slug", slug);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return (data ?? []).length === 0;
}

// ── Search (used in content post editor for linking exams) ─────────────────

export async function searchExams(query: string, limit = 10): Promise<ExamEntity[]> {
  const { data, error } = await db
    .from("exams")
    .select(LIST_SELECT)
    .ilike("name", `%${query}%`)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => mapRow(r));
}
