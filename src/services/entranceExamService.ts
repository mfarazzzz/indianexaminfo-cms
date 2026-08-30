/**
 * entranceExamService.ts — Dedicated service for the Entrance Exam editorial workflow.
 *
 * Operates on:
 *   - `exams` table (permanent identity: slug, name, category, conducting body)
 *   - `exam_editions` table (temporal cycle data: dates, status, fees, eligibility)
 *
 * This service is ONLY for entrance exams (pillar='entrance-exam').
 * Other pillars continue using the generic examService.ts.
 */
import { db } from "@/lib/supabase/client";
import { revalidateExams } from "@/lib/revalidate";
import { normalizeUrl } from "@/lib/utils";
import type { Pillar } from "@/types/exam";

// ── Types ──────────────────────────────────────────────────────────────────

export type EditionStatus =
  | "upcoming"
  | "notification-released"
  | "registration-open"
  | "registration-closed"
  | "admit-card-released"
  | "exam-conducted"
  | "answer-key-released"
  | "result-declared"
  | "counselling"
  | "completed";

export type CycleFrequency = "annual" | "biannual" | "irregular";
export type CycleSession = "main" | "session-1" | "session-2" | "supplementary" | "special";

export interface ExamEdition {
  id: string;
  examId: string;
  year: number;
  session: CycleSession;
  editionLabel: string;
  isCurrent: boolean;
  status: EditionStatus;
  notificationDate: string | null;
  importantDates: { label: string; date: string; isUrgent: boolean }[];
  eligibility: Record<string, unknown>;
  vacancy: number | null;
  applicationFee: Record<string, unknown>;
  ageLimit: Record<string, unknown> | null;
  hasNotification: boolean;
  hasApplication: boolean;
  hasAdmitCard: boolean;
  hasSyllabus: boolean;
  hasAnswerKey: boolean;
  hasResult: boolean;
  hasCutoff: boolean;
  hasCounselling: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  resultSummary: Record<string, unknown> | null;
  counsellingData: Record<string, unknown> | null;
  contentModules: Record<string, unknown>;
  faqs: { question: string; answer: string }[];
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface ExamIdentity {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  pillar: Pillar;
  category: string;
  subcategory: string;
  categoryId: string | null;
  subcategoryId: string | null;
  entityType: string;
  conductingBody: string;
  officialWebsite: string;
  cycleFrequency: CycleFrequency;
  selectionProcess: string[];
  syllabusHighlights: string[];
  tags: string[];
  searchKeywords: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  faqs: { question: string; answer: string }[];
  currentEditionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntranceExamListItem {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  category: string;
  categoryId: string | null;
  conductingBody: string;
  cycleFrequency: CycleFrequency;
  isFeatured: boolean;
  isPublished: boolean;
  currentEdition: {
    id: string;
    year: number;
    editionLabel: string;
    status: EditionStatus;
    nextDate: { label: string; date: string } | null;
  } | null;
}

export interface StartEditionInput {
  year: number;
  session?: CycleSession;
  editionLabel?: string;
  carryOver?: {
    eligibility?: boolean;
    syllabus?: boolean;
    fees?: boolean;
  };
}

export interface NewExamInput {
  name: string;
  shortName: string;
  slug?: string;
  pillar?: string;
  categoryId: string;
  subcategoryId?: string;
  conductingBody: string;
  officialWebsite?: string;
  cycleFrequency?: CycleFrequency;
  firstEditionYear: number;
}

// ── Row Mappers ────────────────────────────────────────────────────────────

function mapEditionRow(row: Record<string, unknown>): ExamEdition {
  return {
    id: row.id as string,
    examId: row.exam_id as string,
    year: row.year as number,
    session: (row.session as CycleSession) ?? "main",
    editionLabel: (row.edition_label as string) ?? "",
    isCurrent: (row.is_current as boolean) ?? false,
    status: (row.status as EditionStatus) ?? "upcoming",
    notificationDate: (row.notification_date as string) ?? null,
    importantDates: (row.important_dates as ExamEdition["importantDates"]) ?? [],
    eligibility: (row.eligibility as Record<string, unknown>) ?? {},
    vacancy: (row.vacancy as number) ?? null,
    applicationFee: (row.application_fee as Record<string, unknown>) ?? {},
    ageLimit: (row.age_limit as Record<string, unknown>) ?? null,
    hasNotification: (row.has_notification as boolean) ?? false,
    hasApplication: (row.has_application as boolean) ?? false,
    hasAdmitCard: (row.has_admit_card as boolean) ?? false,
    hasSyllabus: (row.has_syllabus as boolean) ?? false,
    hasAnswerKey: (row.has_answer_key as boolean) ?? false,
    hasResult: (row.has_result as boolean) ?? false,
    hasCutoff: (row.has_cutoff as boolean) ?? false,
    hasCounselling: (row.has_counselling as boolean) ?? false,
    seoTitle: (row.seo_title as string) ?? null,
    seoDescription: (row.seo_description as string) ?? null,
    resultSummary: (row.result_summary as Record<string, unknown>) ?? null,
    counsellingData: (row.counselling_data as Record<string, unknown>) ?? null,
    contentModules: (row.content_modules as Record<string, unknown>) ?? {},
    faqs: (row.faqs as { question: string; answer: string }[]) ?? [],
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: (row.created_by as string) ?? null,
  };
}

function mapExamIdentityRow(row: Record<string, unknown>): ExamIdentity {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    shortName: (row.short_name as string) ?? "",
    pillar: row.pillar as Pillar,
    category: (row as any).cat?.slug ?? "",
    subcategory: (row as any).subcat?.slug ?? "",
    categoryId: (row.category_id as string) ?? null,
    subcategoryId: (row.subcategory_id as string) ?? null,
    entityType: (row.entity_type as string) ?? "exam",
    conductingBody: (row.conducting_body as string) ?? "",
    officialWebsite: (row.official_website as string) ?? "",
    cycleFrequency: (row.cycle_frequency as CycleFrequency) ?? "annual",
    selectionProcess: (row.selection_process as string[]) ?? [],
    syllabusHighlights: (row.syllabus_highlights as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    searchKeywords: (row.search_keywords as string[]) ?? [],
    seoTitle: (row.seo_title as string) ?? null,
    seoDescription: (row.seo_description as string) ?? null,
    isFeatured: (row.is_featured as boolean) ?? false,
    isPublished: (row.is_published as boolean) ?? false,
    faqs: (row.faqs as { question: string; answer: string }[]) ?? [],
    currentEditionId: (row.current_edition_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapListItem(row: Record<string, unknown>): EntranceExamListItem {
  const edition = (row as any).current_edition;
  const dates = edition?.important_dates as { label: string; date: string; isUrgent: boolean }[] | null;
  const now = new Date();
  const nextDate = dates?.find((d) => new Date(d.date) > now) ?? null;

  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    shortName: (row.short_name as string) ?? "",
    category: (row as any).cat?.slug ?? "",
    categoryId: (row.category_id as string) ?? null,
    conductingBody: (row.conducting_body as string) ?? "",
    cycleFrequency: (row.cycle_frequency as CycleFrequency) ?? "annual",
    isFeatured: (row.is_featured as boolean) ?? false,
    isPublished: (row.is_published as boolean) ?? false,
    currentEdition: edition
      ? {
          id: edition.id as string,
          year: edition.year as number,
          editionLabel: edition.edition_label as string,
          status: edition.status as EditionStatus,
          nextDate,
        }
      : null,
  };
}

// ── Selection Screen ───────────────────────────────────────────────────────

const LIST_SELECT = `
  id, slug, name, short_name, category_id, conducting_body,
  cycle_frequency, is_featured,
  cat:categories!category_id(slug),
  current_edition:exam_editions!current_edition_id(
    id, year, edition_label, status, important_dates
  )
`;

export async function getEntranceExams(opts?: {
  search?: string;
  categoryId?: string;
  pillar?: string;
}): Promise<EntranceExamListItem[]> {
  let q = db
    .from("exams")
    .select(LIST_SELECT)
    .eq("pillar", opts?.pillar ?? "entrance-exam")
    .order("is_featured", { ascending: false })
    .order("name");

  if (opts?.search) {
    q = q.or(`name.ilike.%${opts.search}%,short_name.ilike.%${opts.search}%,slug.ilike.%${opts.search}%`);
  }
  if (opts?.categoryId) {
    q = q.eq("category_id", opts.categoryId);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => mapListItem(r));
}

// ── Get Single Exam + Edition Data ─────────────────────────────────────────

const DETAIL_SELECT = `
  *,
  cat:categories!category_id(slug),
  subcat:categories!subcategory_id(slug)
`;

export async function getEntranceExam(examId: string): Promise<{
  exam: ExamIdentity;
  currentEdition: ExamEdition | null;
  editions: ExamEdition[];
}> {
  // Fetch exam identity
  const { data: examRow, error: examErr } = await db
    .from("exams")
    .select(DETAIL_SELECT)
    .eq("id", examId)
    .single();
  if (examErr) throw examErr;

  const exam = mapExamIdentityRow(examRow as Record<string, unknown>);

  // Fetch all editions for this exam
  const { data: editionRows, error: edErr } = await db
    .from("exam_editions")
    .select("*")
    .eq("exam_id", examId)
    .order("year", { ascending: false })
    .order("session");
  if (edErr) throw edErr;

  const editions = (editionRows ?? []).map((r: any) => mapEditionRow(r));
  const currentEdition = editions.find((e: ExamEdition) => e.isCurrent) ?? null;

  return { exam, currentEdition, editions };
}

// ── Create New Exam ────────────────────────────────────────────────────────

export async function createEntranceExam(input: NewExamInput): Promise<{
  exam: ExamIdentity;
  edition: ExamEdition;
}> {
  // Prefer short name for slug (e.g. "CAT" → "cat"), fall back to full name
  const slug = input.slug || generateSlug(input.shortName || input.name);

  // Check slug uniqueness
  const { data: existing } = await db
    .from("exams")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    throw new Error(`An exam with slug "${slug}" already exists.`);
  }

  // Create the exam
  const { data: examRow, error: examErr } = await db
    .from("exams")
    .insert({
      slug,
      name: input.name,
      short_name: input.shortName,
      pillar: (input as any).pillar ?? "entrance-exam" as Pillar,
      category_id: input.categoryId || null,
      subcategory_id: input.subcategoryId || null,
      entity_type: "exam",
      conducting_body: input.conductingBody,
      official_website: normalizeUrl(input.officialWebsite),
      cycle_frequency: input.cycleFrequency ?? "annual",
      status: "upcoming",
      is_featured: false,
      is_published: true,
    })
    .select(DETAIL_SELECT)
    .single();
  if (examErr) throw examErr;

  // Create first edition
  const { data: edRow, error: edErr } = await db
    .from("exam_editions")
    .insert({
      exam_id: (examRow as any).id,
      year: input.firstEditionYear,
      session: "main",
      edition_label: String(input.firstEditionYear),
      is_current: true,
      status: "upcoming",
    })
    .select("*")
    .single();
  if (edErr) throw edErr;

  // Trigger frontend cache revalidation
  revalidateExams().catch(() => {});

  return {
    exam: mapExamIdentityRow(examRow as Record<string, unknown>),
    edition: mapEditionRow(edRow as Record<string, unknown>),
  };
}

// ── Update Exam Identity (permanent fields) ────────────────────────────────

export async function updateExamIdentity(
  examId: string,
  input: Partial<{
    name: string;
    shortName: string;
    slug: string;
    categoryId: string;
    subcategoryId: string | null;
    conductingBody: string;
    officialWebsite: string;
    cycleFrequency: CycleFrequency;
    selectionProcess: string[];
    syllabusHighlights: string[];
    tags: string[];
    searchKeywords: string[];
    seoTitle: string;
    seoDescription: string;
    isFeatured: boolean;
    faqs: { question: string; answer: string }[];
  }>
): Promise<ExamIdentity> {
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.shortName !== undefined) updates.short_name = input.shortName;
  if (input.slug !== undefined) {
    // Always sanitize slug: lowercase, no special chars, no trailing dashes
    updates.slug = input.slug
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  if (input.categoryId !== undefined) updates.category_id = input.categoryId;
  if (input.subcategoryId !== undefined) updates.subcategory_id = input.subcategoryId;
  if (input.conductingBody !== undefined) updates.conducting_body = input.conductingBody;
  if (input.officialWebsite !== undefined) updates.official_website = normalizeUrl(input.officialWebsite);
  if (input.cycleFrequency !== undefined) updates.cycle_frequency = input.cycleFrequency;
  if (input.selectionProcess !== undefined) updates.selection_process = input.selectionProcess;
  if (input.syllabusHighlights !== undefined) updates.syllabus_highlights = input.syllabusHighlights;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.searchKeywords !== undefined) updates.search_keywords = input.searchKeywords;
  if (input.seoTitle !== undefined) updates.seo_title = input.seoTitle;
  if (input.seoDescription !== undefined) updates.seo_description = input.seoDescription;
  if (input.isFeatured !== undefined) updates.is_featured = input.isFeatured;
  if (input.faqs !== undefined) updates.faqs = input.faqs;

  const { data, error } = await db
    .from("exams")
    .update(updates)
    .eq("id", examId)
    .select(DETAIL_SELECT)
    .single();
  if (error) throw error;

  // Trigger frontend cache revalidation
  revalidateExams().catch(() => {});

  return mapExamIdentityRow(data as Record<string, unknown>);
}

// ── Update Edition (temporal fields) ───────────────────────────────────────

export async function updateEdition(
  editionId: string,
  input: Partial<{
    status: EditionStatus;
    notificationDate: string | null;
    importantDates: ExamEdition["importantDates"];
    eligibility: Record<string, unknown>;
    vacancy: number | null;
    applicationFee: Record<string, unknown>;
    ageLimit: Record<string, unknown> | null;
    hasNotification: boolean;
    hasApplication: boolean;
    hasAdmitCard: boolean;
    hasSyllabus: boolean;
    hasAnswerKey: boolean;
    hasResult: boolean;
    hasCutoff: boolean;
    hasCounselling: boolean;
    seoTitle: string | null;
    seoDescription: string | null;
    resultSummary: Record<string, unknown> | null;
    counsellingData: Record<string, unknown> | null;
    contentModules: Record<string, unknown>;
    faqs: { question: string; answer: string }[];
  }>
): Promise<ExamEdition> {
  const updates: Record<string, unknown> = {};

  if (input.status !== undefined) updates.status = input.status;
  if (input.notificationDate !== undefined) updates.notification_date = input.notificationDate;
  if (input.importantDates !== undefined) updates.important_dates = input.importantDates;
  if (input.eligibility !== undefined) updates.eligibility = input.eligibility;
  if (input.vacancy !== undefined) updates.vacancy = input.vacancy;
  if (input.applicationFee !== undefined) updates.application_fee = input.applicationFee;
  if (input.ageLimit !== undefined) updates.age_limit = input.ageLimit;
  if (input.hasNotification !== undefined) updates.has_notification = input.hasNotification;
  if (input.hasApplication !== undefined) updates.has_application = input.hasApplication;
  if (input.hasAdmitCard !== undefined) updates.has_admit_card = input.hasAdmitCard;
  if (input.hasSyllabus !== undefined) updates.has_syllabus = input.hasSyllabus;
  if (input.hasAnswerKey !== undefined) updates.has_answer_key = input.hasAnswerKey;
  if (input.hasResult !== undefined) updates.has_result = input.hasResult;
  if (input.hasCutoff !== undefined) updates.has_cutoff = input.hasCutoff;
  if (input.hasCounselling !== undefined) updates.has_counselling = input.hasCounselling;
  if (input.seoTitle !== undefined) updates.seo_title = input.seoTitle;
  if (input.seoDescription !== undefined) updates.seo_description = input.seoDescription;
  if (input.resultSummary !== undefined) updates.result_summary = input.resultSummary;
  if (input.counsellingData !== undefined) updates.counselling_data = input.counsellingData;
  if (input.contentModules !== undefined) updates.content_modules = input.contentModules;
  if (input.faqs !== undefined) updates.faqs = input.faqs;

  const { data, error } = await db
    .from("exam_editions")
    .update(updates)
    .eq("id", editionId)
    .select("*")
    .single();
  if (error) throw error;

  // Trigger frontend cache revalidation
  revalidateExams().catch(() => {});

  return mapEditionRow(data as Record<string, unknown>);
}

// ── Start New Edition ──────────────────────────────────────────────────────

export async function startNewEdition(
  examId: string,
  input: StartEditionInput
): Promise<ExamEdition> {
  const session = input.session ?? "main";
  const editionLabel = input.editionLabel ?? String(input.year);

  // Check for duplicate
  const { data: existing } = await db
    .from("exam_editions")
    .select("id")
    .eq("exam_id", examId)
    .eq("year", input.year)
    .eq("session", session)
    .maybeSingle();

  if (existing) {
    throw new Error(`Edition "${editionLabel}" (${session}) already exists for this exam.`);
  }

  // Build initial data with optional carryover from current edition
  let initialData: Record<string, unknown> = {};

  if (input.carryOver) {
    const { data: currentEd } = await db
      .from("exam_editions")
      .select("*")
      .eq("exam_id", examId)
      .eq("is_current", true)
      .maybeSingle();

    if (currentEd) {
      if (input.carryOver.eligibility) initialData.eligibility = currentEd.eligibility;
      if (input.carryOver.fees) initialData.application_fee = currentEd.application_fee;
      // Syllabus is on the exam identity (syllabus_highlights), not edition — no-op here
    }
  }

  // Deactivate current edition BEFORE inserting new one
  // (the partial unique index enforces only one is_current=true per exam)
  // NOTE: We do NOT deactivate here — the new edition starts as is_current=false (draft).
  // It only becomes current when the editor saves the main form, which calls activateEdition().

  // Create new edition as draft (NOT current yet)
  const { data, error } = await db
    .from("exam_editions")
    .insert({
      exam_id: examId,
      year: input.year,
      session,
      edition_label: editionLabel,
      is_current: false,  // starts as draft — not current until editor saves
      status: "upcoming",
      eligibility: initialData.eligibility ?? {},
      application_fee: initialData.application_fee ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapEditionRow(data as Record<string, unknown>);
}

/**
 * Activate a draft edition — makes it current and archives the old one.
 * Called when the editor saves the exam after starting a new edition.
 */
export async function activateEdition(editionId: string): Promise<ExamEdition> {
  // Get the edition to find the exam_id
  const { data: edition, error: fetchErr } = await db
    .from("exam_editions")
    .select("exam_id")
    .eq("id", editionId)
    .single();
  if (fetchErr || !edition) throw new Error("Edition not found");

  // Deactivate the current edition for this exam
  await db
    .from("exam_editions")
    .update({ is_current: false })
    .eq("exam_id", (edition as any).exam_id)
    .eq("is_current", true);

  // Make this edition current
  const { data, error } = await db
    .from("exam_editions")
    .update({ is_current: true })
    .eq("id", editionId)
    .select("*")
    .single();

  if (error) throw error;
  return mapEditionRow(data as Record<string, unknown>);
}

// ── Complete Edition ───────────────────────────────────────────────────────

export async function completeEdition(
  editionId: string,
  resultData?: Record<string, unknown>
): Promise<ExamEdition> {
  const updates: Record<string, unknown> = {
    status: "completed",
    completed_at: new Date().toISOString(),
  };
  if (resultData) updates.result_summary = resultData;

  const { data, error } = await db
    .from("exam_editions")
    .update(updates)
    .eq("id", editionId)
    .select("*")
    .single();
  if (error) throw error;
  return mapEditionRow(data as Record<string, unknown>);
}

// ── Update Module Status ───────────────────────────────────────────────────

type LifecycleModule =
  | "notification"
  | "application"
  | "admit_card"
  | "syllabus"
  | "answer_key"
  | "result"
  | "cutoff"
  | "counselling";

const MODULE_TO_COLUMN: Record<LifecycleModule, string> = {
  notification: "has_notification",
  application: "has_application",
  admit_card: "has_admit_card",
  syllabus: "has_syllabus",
  answer_key: "has_answer_key",
  result: "has_result",
  cutoff: "has_cutoff",
  counselling: "has_counselling",
};

export async function updateModuleStatus(
  editionId: string,
  module: LifecycleModule,
  isAvailable: boolean
): Promise<void> {
  const col = MODULE_TO_COLUMN[module];
  if (!col) throw new Error(`Unknown module: ${module}`);

  const { error } = await db
    .from("exam_editions")
    .update({ [col]: isAvailable })
    .eq("id", editionId);
  if (error) throw error;
}

// ── Edition History ────────────────────────────────────────────────────────

export async function getEditionHistory(examId: string): Promise<ExamEdition[]> {
  const { data, error } = await db
    .from("exam_editions")
    .select("*")
    .eq("exam_id", examId)
    .order("year", { ascending: false })
    .order("session");
  if (error) throw error;
  return (data ?? []).map((r: any) => mapEditionRow(r));
}

// ── Delete Edition ─────────────────────────────────────────────────────────

/**
 * Delete an edition. If the deleted edition was current, automatically
 * promotes the most recent remaining edition to current.
 */
export async function deleteEdition(editionId: string): Promise<void> {
  // Get the edition to check if it's current and get the exam_id
  const { data: edition, error: fetchErr } = await db
    .from("exam_editions")
    .select("id, exam_id, is_current")
    .eq("id", editionId)
    .single();
  if (fetchErr || !edition) throw new Error("Edition not found");

  const examId = (edition as any).exam_id;
  const wasCurrent = (edition as any).is_current;

  // Delete the edition
  const { error: delErr } = await db
    .from("exam_editions")
    .delete()
    .eq("id", editionId);
  if (delErr) throw delErr;

  // If it was the current edition, promote the most recent remaining one
  if (wasCurrent) {
    const { data: nextEdition } = await db
      .from("exam_editions")
      .select("id")
      .eq("exam_id", examId)
      .order("year", { ascending: false })
      .order("session")
      .limit(1)
      .maybeSingle();

    if (nextEdition) {
      // Promote the most recent remaining edition
      await db
        .from("exam_editions")
        .update({ is_current: true })
        .eq("id", (nextEdition as any).id);
      // Trigger will update exams.current_edition_id
    } else {
      // No editions left — null out the pointer
      await db
        .from("exams")
        .update({ current_edition_id: null })
        .eq("id", examId);
    }
  }
}

// ── Promote Edition ────────────────────────────────────────────────────────

/**
 * Promote any edition (including archived ones) to become the current/latest edition.
 * The previously current edition gets archived (is_current=false).
 */
export async function promoteEdition(editionId: string): Promise<ExamEdition> {
  // Get the edition to find the exam_id
  const { data: edition, error: fetchErr } = await db
    .from("exam_editions")
    .select("exam_id")
    .eq("id", editionId)
    .single();
  if (fetchErr || !edition) throw new Error("Edition not found");

  // Deactivate the current edition for this exam
  await db
    .from("exam_editions")
    .update({ is_current: false })
    .eq("exam_id", (edition as any).exam_id)
    .eq("is_current", true);

  // Promote this edition to current
  const { data, error } = await db
    .from("exam_editions")
    .update({ is_current: true })
    .eq("id", editionId)
    .select("*")
    .single();

  if (error) throw error;
  return mapEditionRow(data as Record<string, unknown>);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\d{4}\s*/, "")  // Remove leading year
    .replace(/-?\d{4}$/, "")   // Remove trailing year
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
