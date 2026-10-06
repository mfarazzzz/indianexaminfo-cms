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
import { normalizeUrlOrThrow } from "@/lib/utils";
import { getModuleRegistry } from "@/services/moduleRegistryService";
import { assertAffected } from "@/lib/auth/permissionGuard";
import type { Pillar, ExamWorkflowStatus } from "@/types/exam";
import type { SelectionModel } from "@/types/selection";

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
  /** Reference to the library's syllabus-pdf row for this cycle (Option A: one file, one row). */
  syllabusResourceId: string | null;
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
  region: string | null;
  category: string;
  /** categories.name VERBATIM (display authority — may contain "&", mixed case). */
  categoryName: string;
  subcategory: string;
  categoryId: string | null;
  subcategoryId: string | null;
  entityType: string;
  selectionModel: SelectionModel;
  conductingBody: string;
  officialWebsite: string;
  cycleFrequency: CycleFrequency;
  selectionProcess: string[];
  tags: string[];
  searchKeywords: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  isFeatured: boolean;
  /** Publish state source of truth (draft/published/archived). isPublished is derived from it. */
  workflowStatus: ExamWorkflowStatus;
  isPublished: boolean;
  isVerified: boolean;
  /** S2.6 provenance (jsonb convention in supabase/proposed/a1_ai_fill_options.sql):
   *  fill_source, notice {reference,date}, extracted_at, template, report,
   *  field_quotes, pending_documents, verified:false, published_by_ai:false.
   *  Optional: mappers outside this service (pillarService) predate the column. */
  aiMetadata?: Record<string, unknown>;
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
  workflowStatus: ExamWorkflowStatus;
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
  /** Region slug (regions table FK). REQUIRED at the DB (NOT NULL); the editor enforces it. */
  region: string;
  /** REQUIRED on create for the entrance pillar (owner S1 item 4) — a record with no
   *  category has no public URL. Enforced in createEntranceExam, validated in the editor. */
  categoryId: string;
  subcategoryId?: string;
  conductingBody: string;
  officialWebsite?: string;
  cycleFrequency?: CycleFrequency;
  /** Entity type (Axis 1). Defaults to "exam" if omitted for backward compat. */
  entityType?: string;
  /** Selection model (Axis 2). REQUIRED on create, NO default (owner S1 item 4) —
   *  the editor starts on "— Select —" and blocks save on a blank, like region. */
  selectionModel: SelectionModel;
  firstEditionYear: number;
  /** S2.6: AI provenance to seed the record with ("update from a notice"). */
  aiMetadata?: Record<string, unknown>;
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
    syllabusResourceId: (row.syllabus_resource_id as string) ?? null,
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
    region: (row.region as string) ?? null,
    category: (row as any).cat?.slug ?? "",
    categoryName: (row as any).cat?.name ?? "",
    subcategory: (row as any).subcat?.slug ?? "",
    categoryId: (row.category_id as string) ?? null,
    subcategoryId: (row.subcategory_id as string) ?? null,
    entityType: (row.entity_type as string) ?? "exam",
    selectionModel: ((row.selection_model as SelectionModel) ?? "written-exam"),
    conductingBody: (row.conducting_body as string) ?? "",
    officialWebsite: (row.official_website as string) ?? "",
    cycleFrequency: (row.cycle_frequency as CycleFrequency) ?? "annual",
    selectionProcess: (row.selection_process as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    searchKeywords: (row.search_keywords as string[]) ?? [],
    seoTitle: (row.seo_title as string) ?? null,
    seoDescription: (row.seo_description as string) ?? null,
    isFeatured: (row.is_featured as boolean) ?? false,
    workflowStatus: (row.workflow_status as ExamWorkflowStatus) ?? "draft", // fail-closed: an unknown state reads as DRAFT, never as live
    isPublished: (row.is_published as boolean) ?? false,
    isVerified: (row.is_verified as boolean) ?? false,
    aiMetadata: (row.ai_metadata as Record<string, unknown>) ?? {},
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
    workflowStatus: (row.workflow_status as ExamWorkflowStatus) ?? "draft", // fail-closed: an unknown state reads as DRAFT, never as live
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
  cycle_frequency, is_featured, workflow_status, is_published,
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
  cat:categories!category_id(slug, name),
  subcat:categories!subcategory_id(slug, name)
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
  const pillarForCreate = (input as any).pillar ?? "entrance-exam";

  // No silent defaults on create (owner S1 item 4). These throw rather than paper over a
  // missing choice: publishing is an EXPLICIT editor action (records start as DRAFT) and
  // identity fields the editor marked required (*) must actually be provided.
  //  * Category — REQUIRED for the entrance pillar: a record with no category has no
  //    public URL, so creating one silently strands the record off the site.
  //  * Selection model — REQUIRED for every pillar this service creates: the old
  //    `?? "written-exam"` default wrote a wrong selection story on merit/counselling exams.
  if (pillarForCreate === "entrance-exam" && !input.categoryId) {
    throw new Error("Category is required — a record with no category has no public URL.");
  }
  if (!input.selectionModel) {
    throw new Error("Selection model is required — choose how candidates are selected (no default).");
  }

  // Prefer short name for slug (e.g. "CAT" → "cat"), fall back to full name
  const slug = input.slug || generateSlug(input.shortName || input.name);

  // Check slug uniqueness
  const { data: existing, error: existingErr } = await db
    .from("exams")
    .select("id, name, workflow_status")
    .eq("slug", slug)
    .maybeSingle();
  // A failed uniqueness check is NOT "slug is free" — abort the create rather
  // than write a row that collides (or duplicates an existing exam silently).
  if (existingErr) {
    console.error(`[entranceExamService] createEntranceExam slug check failed:`, existingErr);
    throw new Error(`Could not verify slug "${slug}" — ${existingErr.message}`);
  }

  if (existing) {
    // R1.9: friendly message with the existing record's identity so the editor
    // can link directly to it instead of guessing which record collided.
    const err = new Error(
      `DUPLICATE_SLUG::${existing.id}::${existing.name}::${existing.workflow_status ?? 'draft'}`,
    );
    (err as any).code = 'DUPLICATE_SLUG';
    (err as any).existingExam = { id: existing.id, name: existing.name, status: existing.workflow_status ?? 'draft' };
    throw err;
  }

  // Create the exam
  const { data: examRow, error: examErr } = await db
    .from("exams")
    .insert({
      slug,
      name: input.name,
      short_name: input.shortName,
      pillar: (input as any).pillar ?? "entrance-exam" as Pillar,
      region: input.region,
      category_id: input.categoryId || null,
      subcategory_id: input.subcategoryId || null,
      entity_type: input.entityType ?? "exam",
      selection_model: input.selectionModel,
      conducting_body: input.conductingBody,
      official_website: normalizeUrlOrThrow(input.officialWebsite),
      cycle_frequency: input.cycleFrequency ?? "annual",
      // status DROPPED from exams (step 4) — set on the edition insert below.
      is_featured: false,
      // workflow_status is the publish source of truth; is_published derives from it.
      // R0.12 (2026-10-04): ALL exam pillars now start as DRAFT on create. Publishing
      // is always an explicit editor action (owner: "draft-on-create for every exam
      // pillar, not only entrance"). The old branch left non-entrance records live on
      // the site immediately after creation.
      workflow_status: "draft",
      // S2.6: provenance rides the create itself — a record born from a notice
      // records that fact even if the editor never touches identity again.
      ...(input.aiMetadata ? { ai_metadata: input.aiMetadata } : {}),
    })
    .select(DETAIL_SELECT)
    .single();
  if (examErr) throw examErr;

  // Seed _config with the pillar's default module set (2026-09-19). Previously the
  // edition was created with NO content_modules/_config, so a new record depended on
  // someone opening the Modules tab for ModulePanel to build a default — and AI Fill
  // All (which never touched _config) left every generated module OFF. Seeding here
  // makes modules ON by default, so content added later is visible without a manual
  // toggle. Non-fatal: if the registry read fails, fall back to an empty _config
  // (same as the old behaviour) rather than blocking creation.
  const pillarForModules = (input as any).pillar ?? "entrance-exam";
  let seededConfig: { moduleOrder: string[]; enabledModules: string[] } = { moduleOrder: [], enabledModules: [] };
  try {
    const registry = await getModuleRegistry(pillarForModules);
    const slugs = registry.map((m) => m.slug);
    seededConfig = { moduleOrder: slugs, enabledModules: slugs };
  } catch {
    // keep empty _config — creation must not fail on a registry hiccup
  }

  // Create first edition
  // FX1.5: the exam row already exists. If the edition insert fails, the exam
  // would be stranded with zero editions (the FX1 silent-save state). Do a
  // COMPENSATING DELETE of the just-created exam and surface the REAL error, so
  // a failed create leaves no half-built record. (A single-transaction RPC is
  // the durable fix — see supabase/proposed/fx1_create_exam_with_edition.sql.)
  const { data: edRow, error: edErr } = await db
    .from("exam_editions")
    .insert({
      exam_id: (examRow as any).id,
      year: input.firstEditionYear,
      session: "main",
      edition_label: String(input.firstEditionYear),
      is_current: true,
      status: "upcoming",
      content_modules: { _config: seededConfig },
    })
    .select("*")
    .single();
  if (edErr) {
    // Compensating delete — best effort; if it also fails, name both problems.
    const { error: compensateErr } = await db.from("exams").delete().eq("id", (examRow as any).id);
    if (compensateErr) {
      console.error(`[entranceExamService] createEntranceExam compensating delete failed for exam ${(examRow as any).id}:`, compensateErr);
      throw new Error(`Edition create failed (${edErr.message}) AND the orphan exam could not be removed (${compensateErr.message}) — this exam needs manual repair.`);
    }
    throw new Error(`Could not create the first cycle: ${edErr.message}`);
  }

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
    region: string;
    categoryId: string;
    subcategoryId: string | null;
    conductingBody: string;
    officialWebsite: string;
    cycleFrequency: CycleFrequency;
    selectionProcess: string[];
    tags: string[];
    searchKeywords: string[];
    seoTitle: string;
    seoDescription: string;
    isFeatured: boolean;
    faqs: { question: string; answer: string }[];
    selectionModel: SelectionModel;
    entityType: string;
    /** S2.6: full replacement of the ai_metadata jsonb — the CALLER merges the
     *  existing object (exam.aiMetadata) with the new run's keys. */
    aiMetadata: Record<string, unknown>;
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
  if (input.region !== undefined) updates.region = input.region;
  if (input.categoryId !== undefined) updates.category_id = input.categoryId;
  if (input.subcategoryId !== undefined) updates.subcategory_id = input.subcategoryId;
  if (input.conductingBody !== undefined) updates.conducting_body = input.conductingBody;
  if (input.officialWebsite !== undefined) updates.official_website = normalizeUrlOrThrow(input.officialWebsite);
  if (input.cycleFrequency !== undefined) updates.cycle_frequency = input.cycleFrequency;
  if (input.selectionProcess !== undefined) updates.selection_process = input.selectionProcess;
  // syllabus_highlights column DROPPED (2026-09-11) — syllabus is the structured
  // exam_syllabus_subjects store now (syllabusService). Do NOT write this column.
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.searchKeywords !== undefined) updates.search_keywords = input.searchKeywords;
  if (input.seoTitle !== undefined) updates.seo_title = input.seoTitle;
  if (input.seoDescription !== undefined) updates.seo_description = input.seoDescription;
  if (input.isFeatured !== undefined) updates.is_featured = input.isFeatured;
  if (input.faqs !== undefined) updates.faqs = input.faqs;
  if (input.selectionModel !== undefined) updates.selection_model = input.selectionModel;
  if (input.entityType !== undefined) updates.entity_type = input.entityType;
  if (input.aiMetadata !== undefined) updates.ai_metadata = input.aiMetadata;

  const { data, error } = await db
    .from("exams")
    .update(updates)
    .eq("id", examId)
    .select(DETAIL_SELECT);
  if (error) throw error;
  // Zero rows under RLS = permission refusal (e.g. no edit_any_exam and not the owner),
  // not success. Surface it clearly instead of a cryptic single-row error.
  assertAffected(data as unknown[] | null, "edit this exam");

  // Trigger frontend cache revalidation
  revalidateExams().catch(() => {});

  return mapExamIdentityRow((data as Record<string, unknown>[])[0]);
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
    syllabusResourceId: string | null;
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
  if (input.syllabusResourceId !== undefined) updates.syllabus_resource_id = input.syllabusResourceId;
  if (input.contentModules !== undefined) {
    // GUARD (2026-09-19): content_modules is written wholesale here. If the caller
    // passes a blob WITHOUT _config, we must not silently drop the existing _config
    // (module order + enabled set) — doing so unpublishes every enabled module. Read
    // the current _config and preserve it unless the caller explicitly provided one.
    const incoming = input.contentModules as Record<string, unknown>;
    if (!("_config" in incoming)) {
      const { data: cur, error: curErr } = await db
        .from("exam_editions")
        .select("content_modules")
        .eq("id", editionId)
        .single();
      // The preservation read is the guard. If it FAILS, writing `incoming`
      // without _config would silently unpublish every enabled module — so a
      // failed read must abort the save, not proceed with a lossy write.
      if (curErr) {
        console.error(`[entranceExamService] updateEdition(${editionId}) _config read failed:`, curErr);
        throw new Error(`Could not read this edition's current module config — save aborted to avoid unpublishing modules (${curErr.message}).`);
      }
      const existingConfig = ((cur as any)?.content_modules as Record<string, unknown> | undefined)?._config;
      updates.content_modules = existingConfig !== undefined
        ? { ...incoming, _config: existingConfig }
        : incoming;
    } else {
      updates.content_modules = incoming;
    }
  }
  if (input.faqs !== undefined) updates.faqs = input.faqs;

  const { data, error } = await db
    .from("exam_editions")
    .update(updates)
    .eq("id", editionId)
    .select("*");
  if (error) throw error;
  // Zero rows under RLS = permission refusal, not success.
  assertAffected(data as unknown[] | null, "edit this exam's dates & details");

  // Trigger frontend cache revalidation
  revalidateExams().catch(() => {});

  return mapEditionRow((data as Record<string, unknown>[])[0]);
}

// ── Start New Edition ──────────────────────────────────────────────────────

export async function startNewEdition(
  examId: string,
  input: StartEditionInput
): Promise<ExamEdition> {
  const session = input.session ?? "main";
  const editionLabel = input.editionLabel ?? String(input.year);

  // Check for duplicate
  const { data: existing, error: existingErr } = await db
    .from("exam_editions")
    .select("id")
    .eq("exam_id", examId)
    .eq("year", input.year)
    .eq("session", session)
    .maybeSingle();
  // A failed duplicate check must NOT be read as "no duplicate" — abort rather
  // than risk creating a second edition for the same year/session.
  if (existingErr) {
    console.error(`[entranceExamService] startNewEdition(${examId}) duplicate check failed:`, existingErr);
    throw new Error(`Could not check for an existing ${editionLabel} edition — ${existingErr.message}`);
  }

  if (existing) {
    throw new Error(`Edition "${editionLabel}" (${session}) already exists for this exam.`);
  }

  // Build initial data with optional carryover from current edition
  let initialData: Record<string, unknown> = {};

  if (input.carryOver) {
    const { data: currentEd, error: currentEdErr } = await db
      .from("exam_editions")
      .select("*")
      .eq("exam_id", examId)
      .eq("is_current", true)
      .maybeSingle();
    // maybeSingle: no current edition is a legitimate miss (nothing to carry).
    // A transport error is NOT — carrying "nothing" silently would hand the
    // editor a hollow edition they believe was carried over.
    if (currentEdErr) {
      console.error(`[entranceExamService] startNewEdition(${examId}) carry-over read failed:`, currentEdErr);
      throw new Error(`Could not read the current edition for carry-over — ${currentEdErr.message}`);
    }

    if (currentEd) {
      if (input.carryOver.eligibility) initialData.eligibility = currentEd.eligibility;
      if (input.carryOver.fees) initialData.application_fee = currentEd.application_fee;
      // Syllabus is exam-identity-level (structured exam_syllabus_subjects), not edition — no-op here
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

  if (error) {
    // A1: idempotent. A double-click or a race can hit the unique key
    // uq_exam_edition_year_session (exam_id, year, session). Instead of
    // surfacing a raw "duplicate key" error on top of a success toast, return
    // the row that already exists — the caller sees one edition for that
    // year/session and no error. Any other error still propagates.
    if ((error as { code?: string }).code === "23505") {
      const { data: existingRow, error: fetchErr } = await db
        .from("exam_editions")
        .select("*")
        .eq("exam_id", examId)
        .eq("year", input.year)
        .eq("session", session)
        .maybeSingle();
      if (!fetchErr && existingRow) return mapEditionRow(existingRow as Record<string, unknown>);
    }
    throw error;
  }
  return mapEditionRow(data as Record<string, unknown>);
}

/**
 * FX1.2: create a CURRENT edition for an exam that has none.
 *
 * An exam can end up with zero editions (see FX1 root cause). The editor's Save
 * must then CREATE the current cycle in the same save rather than silently drop
 * every edition-level field. This inserts one edition with is_current=true for
 * the given year/session; the DB trigger sets exams.current_edition_id.
 *
 * Unlike startNewEdition (which creates a DRAFT, is_current=false, to be
 * activated on save), this creates the cycle as CURRENT immediately, because
 * there is no existing current edition to archive and the caller is about to
 * write the full edition data to it.
 */
export async function createCurrentEdition(
  examId: string,
  year: number,
  session: string = "main",
): Promise<ExamEdition> {
  // Guard: refuse if a current edition already exists (caller thinks there is
  // none — surface the inconsistency rather than create a second current).
  const { data: existingCurrent, error: checkErr } = await db
    .from("exam_editions")
    .select("id")
    .eq("exam_id", examId)
    .eq("is_current", true)
    .maybeSingle();
  if (checkErr) {
    console.error(`[entranceExamService] createCurrentEdition(${examId}) guard check failed:`, checkErr);
    throw new Error(`Could not verify the exam's current cycle — ${checkErr.message}`);
  }
  if (existingCurrent) {
    throw new Error("This exam already has a current cycle. Reload and edit it instead of creating a new one.");
  }

  const { data, error } = await db
    .from("exam_editions")
    .insert({
      exam_id: examId,
      year,
      session,
      edition_label: String(year),
      is_current: true,
      status: "upcoming",
      content_modules: {},
    })
    .select("*")
    .single();
  if (error) throw error;

  revalidateExams().catch(() => {});
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
 * Delete an edition.
 *
 * FX1.4 (2026-10-04): refuse to delete an edition when doing so would leave the
 * exam without a CURRENT cycle — the state that silently drops edition-level
 * saves (FX1). Specifically:
 *   - the ONLY edition of an exam may never be deleted (the exam would have zero
 *     editions; the editor then shows "Editions (0)" and every edition write is
 *     skipped while the UI claims success);
 *   - the CURRENT edition may not be deleted while other editions exist, unless
 *     another edition is promoted to current first (promoteEdition).
 * A non-current (archived/draft) edition may always be deleted.
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

  // FX1.4: count the exam's editions so we can refuse the destructive cases.
  const { count, error: countErr } = await db
    .from("exam_editions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  // A failed count must NOT be read as "safe to delete" — abort.
  if (countErr) {
    console.error(`[entranceExamService] deleteEdition(${editionId}) count failed:`, countErr);
    throw new Error(`Could not verify the edition count before deleting — ${countErr.message}`);
  }
  const totalEditions = count ?? 0;

  if (totalEditions <= 1) {
    throw new Error(
      "This is the exam's only cycle — deleting it would leave the exam with no cycle to edit. Create a new cycle first, then delete the old one.",
    );
  }
  if (wasCurrent) {
    throw new Error(
      "You cannot delete the current cycle while other cycles exist. Promote another cycle to current first, then delete this one.",
    );
  }

  // Delete the edition
  const { error: delErr } = await db
    .from("exam_editions")
    .delete()
    .eq("id", editionId);
  if (delErr) throw delErr;
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
