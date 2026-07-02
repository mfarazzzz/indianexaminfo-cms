import { db } from "@/lib/supabase/client";
import type { ExamEntity, Pillar } from "@/types/exam";

function mapRow(row: Record<string, unknown>): ExamEntity {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    shortName: row.short_name as string,
    pillar: row.pillar as Pillar,
    category: (row.category_slug as string) ?? (row.cat as any)?.slug ?? "",
    subcategory: (row.subcategory_slug as string) ?? (row.subcat as any)?.slug ?? "",
    entityType: row.entity_type as ExamEntity["entityType"],
    conductingBody: row.conducting_body as string,
    officialWebsite: (row.official_website as string) ?? "",
    status: row.status as ExamEntity["status"],
    hasAdmitCard: row.has_admit_card as boolean,
    hasResult: row.has_result as boolean,
    hasAnswerKey: row.has_answer_key as boolean,
    hasSyllabus: row.has_syllabus as boolean,
    hasDateSheet: row.has_date_sheet as boolean,
    hasMockTest: row.has_mock_test as boolean,
    hasPreviousPapers: row.has_previous_papers as boolean,
    hasStudyMaterial: row.has_study_material as boolean,
    hasApplication: row.has_application as boolean,
    hasNotification: row.has_notification as boolean,
    hasCutoff: row.has_cutoff as boolean,
    dates: ((row.important_dates as unknown[]) ?? []) as ExamEntity["dates"],
    eligibility: row.eligibility as ExamEntity["eligibility"] ?? undefined,
    vacancy: row.vacancy as number | undefined,
    applicationFee: row.application_fee as ExamEntity["applicationFee"] ?? undefined,
    selectionProcess: (row.selection_process as string[]) ?? [],
    syllabusHighlights: (row.syllabus_highlights as string[]) ?? [],
    academicYear: row.academic_year as string | undefined,
    semester: row.semester as string | undefined,
    admissionTo: row.admission_to as string | undefined,
    tags: (row.tags as string[]) ?? [],
    lastUpdated: row.last_updated as string,
    isFeatured: row.is_featured as boolean,
    searchKeywords: (row.search_keywords as string[]) ?? [],
    seoTitle: row.seo_title as string | undefined,
    seoDescription: row.seo_description as string | undefined,
    faqs: (row.faqs as ExamEntity["faqs"]) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: row.created_by as string | undefined,
  };
}

export type ExamListItem = Pick<ExamEntity,
  "id" | "slug" | "name" | "shortName" | "pillar" | "category" | "status" |
  "isFeatured" | "vacancy" | "lastUpdated" | "hasAdmitCard" | "hasResult" |
  "hasAnswerKey" | "hasSyllabus" | "hasDateSheet" | "hasMockTest" |
  "hasPreviousPapers" | "hasStudyMaterial" | "hasApplication" | "hasNotification" | "hasCutoff"
> & { updatedAt: string };

export async function getExams(opts?: {
  pillar?: Pillar; categorySlug?: string; status?: string;
  isFeatured?: boolean; search?: string; limit?: number; offset?: number;
}): Promise<{ data: ExamListItem[]; count: number }> {
  let q = db.from("exams").select(
    `id, slug, name, short_name, pillar, status, is_featured, vacancy,
     last_updated, updated_at,
     has_admit_card, has_result, has_answer_key, has_syllabus, has_date_sheet,
     has_mock_test, has_previous_papers, has_study_material, has_application,
     has_notification, has_cutoff,
     cat:categories!category_id(slug)`,
    { count: "exact" }
  ).order("updated_at", { ascending: false });

  if (opts?.pillar) q = q.eq("pillar", opts.pillar);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.isFeatured !== undefined) q = q.eq("is_featured", opts.isFeatured);
  if (opts?.search) q = q.ilike("name", `%${opts.search}%`);
  if (opts?.limit) q = q.limit(opts.limit);
  if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);

  const { data, error, count } = await q;
  if (error) throw error;

  const items: ExamListItem[] = (data ?? []).map((row: any) => ({
    id: row.id, slug: row.slug, name: row.name, shortName: row.short_name,
    pillar: row.pillar, category: row.cat?.slug ?? "", status: row.status,
    isFeatured: row.is_featured, vacancy: row.vacancy, lastUpdated: row.last_updated,
    updatedAt: row.updated_at, hasAdmitCard: row.has_admit_card, hasResult: row.has_result,
    hasAnswerKey: row.has_answer_key, hasSyllabus: row.has_syllabus, hasDateSheet: row.has_date_sheet,
    hasMockTest: row.has_mock_test, hasPreviousPapers: row.has_previous_papers,
    hasStudyMaterial: row.has_study_material, hasApplication: row.has_application,
    hasNotification: row.has_notification, hasCutoff: row.has_cutoff,
  }));

  return { data: items, count: count ?? 0 };
}

export async function getExamById(id: string): Promise<ExamEntity | null> {
  const { data, error } = await db.from("exams").select(`
    *, cat:categories!category_id(slug), subcat:categories!subcategory_id(slug)
  `).eq("id", id).single();
  if (error) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function createExam(input: any): Promise<ExamEntity> {
  const { data, error } = await db.from("exams").insert({
    slug: input.slug, name: input.name, short_name: input.shortName,
    pillar: input.pillar, category_id: input.categoryId ?? null,
    subcategory_id: input.subcategoryId ?? null, entity_type: input.entityType ?? "exam",
    conducting_body: input.conductingBody, official_website: input.officialWebsite ?? null,
    status: input.status ?? "upcoming",
    has_admit_card: input.hasAdmitCard ?? false, has_result: input.hasResult ?? false,
    has_answer_key: input.hasAnswerKey ?? false, has_syllabus: input.hasSyllabus ?? false,
    has_date_sheet: input.hasDateSheet ?? false, has_mock_test: input.hasMockTest ?? false,
    has_previous_papers: input.hasPreviousPapers ?? false, has_study_material: input.hasStudyMaterial ?? false,
    has_application: input.hasApplication ?? false, has_notification: input.hasNotification ?? false,
    has_cutoff: input.hasCutoff ?? false, vacancy: input.vacancy ?? null,
    academic_year: input.academicYear ?? null, semester: input.semester ?? null,
    admission_to: input.admissionTo ?? null, eligibility: input.eligibility ?? {},
    application_fee: input.applicationFee ?? {}, selection_process: input.selectionProcess ?? [],
    syllabus_highlights: input.syllabusHighlights ?? [], important_dates: input.dates ?? [],
    seo_title: input.seoTitle ?? null, seo_description: input.seoDescription ?? null,
    faqs: input.faqs ?? [], tags: input.tags ?? [], is_featured: input.isFeatured ?? false,
    search_keywords: input.searchKeywords ?? [], last_updated: input.lastUpdated ?? new Date().toISOString().split("T")[0],
    created_by: input.createdBy ?? null,
  }).select(`*, cat:categories!category_id(slug), subcat:categories!subcategory_id(slug)`).single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function updateExam(id: string, input: any): Promise<ExamEntity> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), last_updated: new Date().toISOString().split("T")[0] };
  const fieldMap: Record<string, string> = {
    slug:"slug", name:"name", shortName:"short_name", pillar:"pillar", categoryId:"category_id",
    subcategoryId:"subcategory_id", entityType:"entity_type", conductingBody:"conducting_body",
    officialWebsite:"official_website", status:"status", isFeatured:"is_featured",
    hasAdmitCard:"has_admit_card", hasResult:"has_result", hasAnswerKey:"has_answer_key",
    hasSyllabus:"has_syllabus", hasDateSheet:"has_date_sheet", hasMockTest:"has_mock_test",
    hasPreviousPapers:"has_previous_papers", hasStudyMaterial:"has_study_material",
    hasApplication:"has_application", hasNotification:"has_notification", hasCutoff:"has_cutoff",
    vacancy:"vacancy", academicYear:"academic_year", semester:"semester", admissionTo:"admission_to",
    eligibility:"eligibility", applicationFee:"application_fee", selectionProcess:"selection_process",
    syllabusHighlights:"syllabus_highlights", dates:"important_dates", seoTitle:"seo_title",
    seoDescription:"seo_description", faqs:"faqs", tags:"tags", searchKeywords:"search_keywords",
  };
  for (const [key, col] of Object.entries(fieldMap)) {
    if (input[key] !== undefined) updates[col] = input[key];
  }
  const { data, error } = await db.from("exams").update(updates).eq("id", id)
    .select(`*, cat:categories!category_id(slug), subcat:categories!subcategory_id(slug)`).single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteExam(id: string): Promise<void> {
  const { error } = await db.from("exams").delete().eq("id", id);
  if (error) throw error;
}

export async function checkExamSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
  let q = db.from("exams").select("id").eq("slug", slug);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return (data ?? []).length === 0;
}

export async function searchExams(query: string): Promise<{ id: string; name: string; slug: string; pillar: Pillar; status: ExamEntity["status"] }[]> {
  const { data } = await db.from("exams").select("id, name, slug, pillar, status").ilike("name", `%${query}%`).limit(20);
  return (data ?? []) as any[];
}
