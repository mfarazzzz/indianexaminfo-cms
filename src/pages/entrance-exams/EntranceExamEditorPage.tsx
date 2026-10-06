import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useBlocker, type BlockerFunction } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2, History, Sparkles, Loader2, Globe, ExternalLink } from "lucide-react";
import { UnsavedChangesDialog } from "@/components/shared/UnsavedChangesDialog";
import { FaqAnswerWarning } from "@/components/shared/FaqAnswerWarning";
import { toast } from "sonner";
import { useForm, useFieldArray } from "react-hook-form";
import {
  getEntranceExam, updateExamIdentity, updateEdition, startNewEdition,
  createEntranceExam, completeEdition, activateEdition, deleteEdition, promoteEdition,
  createCurrentEdition,
  type ExamEdition, type ExamIdentity, type EditionStatus, type CycleFrequency, type CycleSession,
} from "@/services/entranceExamService";
import { getCategories, type Category } from "@/services/categoryService";
import { NoCurrentCycle } from "@/components/entrance-exams/NoCurrentCycle";
import { deleteExam, setExamWorkflowStatus } from "@/services/examService";
import { getRegions, type Region } from "@/services/regionService";
import { getDerivedStatus, derivedStatusLabel, type DerivedStatusRow } from "@/services/derivedStatusService";
import type { ExamWorkflowStatus } from "@/types/exam";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RichEditor } from "@/components/shared/RichEditor";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { DraggableList } from "@/components/shared/DraggableList";
import { ModulePanel } from "@/components/content-modules/ModulePanel";
import type { ModuleConfig } from "@/types/modules";
import { getErrorMessage } from "@/lib/utils";
import { validateField } from "@/lib/fields/fieldTypes";
import { ALL_SELECTION_MODELS, SELECTION_MODEL_LABELS, SELECTION_MODEL_HINTS, type SelectionModel } from "@/types/selection";
import { getModulesForEntityType, entityTypeForPillar, resolveEntityType, ENTRANCE_EXAM_ENTITY_CHOICES } from "@/config/moduleRegistry";
import { generateStructured } from "@/lib/ai/aiFillClient";
import { findLikelyExamMatch, NOTICE_HANDOFF_KEY, type LikelyMatch } from "@/lib/ai/noticeMatch";
import { buildNoticeAiMetadata } from "@/lib/ai/noticeProvenance";
import { mergeAcceptedDateRows } from "@/lib/dates/dateRowMerge";
import { NoticeReviewDrawer } from "@/components/entrance-exams/NoticeReviewDrawer";
import {
  buildReviewRows, summarizeFill,
  type ReviewRow, type ReviewCurrentValues, type ProposedDateRow, type FillReport,
} from "@/components/entrance-exams/noticeReview";
import { ViewOnSiteButton } from "@/components/shared/ViewOnSiteButton";
import { ResourcesTab } from "@/components/entrance-exams/ResourcesTab";
import { SyllabusResourcePicker } from "@/components/entrance-exams/SyllabusResourcePicker";
import { SyllabusTab } from "@/components/entrance-exams/SyllabusTab";

// EDITION_STATUSES dropdown options REMOVED (2026-09-19) with the manual status
// field. The EditionStatus type is retained (form value + AI-fill still carry the
// stored column value), but there is no longer an editable status control — the
// site-authoritative status is the derived-status panel in the Dates & Status tab.

const CYCLE_FREQUENCIES: { value: CycleFrequency; label: string }[] = [
  { value: "annual", label: "Annual (once per year)" },
  { value: "biannual", label: "Multiple cycles per year" },
  { value: "irregular", label: "Irregular / On demand" },
];

const SESSIONS: { value: CycleSession; label: string }[] = [
  { value: "main", label: "Main" },
  { value: "session-1", label: "Session 1" },
  { value: "session-2", label: "Session 2" },
  { value: "supplementary", label: "Supplementary" },
  { value: "special", label: "Special" },
];

type FormData = {
  // Identity
  name: string;
  shortName: string;
  slug: string;
  region: string;
  categoryId: string;
  subcategoryId: string;
  conductingBody: string;
  officialWebsite: string;
  cycleFrequency: CycleFrequency;
  entityType: string;
  // "" = not chosen yet. REQUIRED on save, NO default (owner S1 item 4) — mirrors region.
  selectionModel: SelectionModel | "";
  isFeatured: boolean;
  // Edition
  editionYear: number;
  editionSession: CycleSession;
  editionStatus: EditionStatus;
  notificationDate: string;
  vacancy: string;
  // Dates — full DateRow so state/verified/stage_label/type survive the round-trip.
  importantDates: DateRow[];
  // R0.6: stage-1 eligibility and fee carried in form state for R0.5 new-record save.
  // These JSONB objects have no dedicated editor inputs yet (R1); the form holds them
  // for AI-fill + save round-tripping only. Omit from writes if still null/empty.
  eligibility: Record<string, unknown> | null;
  applicationFee: Record<string, unknown> | null;
  // Modules
  hasNotification: boolean;
  hasApplication: boolean;
  hasAdmitCard: boolean;
  hasSyllabus: boolean;
  hasAnswerKey: boolean;
  hasResult: boolean;
  hasCutoff: boolean;
  hasCounselling: boolean;
  // SEO
  seoTitle: string;
  seoDescription: string;
  tags: string;
  faqs: { question: string; answer: string }[];
};

/**
 * True when a field holds no meaningful value — used by AI Fill's empty-only
 * rule so the AI can populate blanks but NEVER replace an existing value.
 * Treats undefined/null, empty/whitespace strings, and empty arrays as blank.
 */
function isBlank(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function EntranceExamEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  // Detect pillar from URL path
  const pillarFromUrl = (() => {
    const path = window.location.pathname;
    if (path.includes("/govt-exam")) return "government-exam";
    if (path.includes("/govt-vacancy")) return "govt-vacancy";
    if (path.includes("/sarkari-naukri")) return "government-exam";
    if (path.includes("/sarkari-bharti")) return "govt-vacancy";
    if (path.includes("/board-exams")) return "board-exam";
    if (path.includes("/university-exams")) return "university-exam";
    return "entrance-exam";
  })();

  // Derive the list path for back navigation
  const listPath = (() => {
    const path = window.location.pathname;
    if (path.includes("/govt-exam")) return "/govt-exam";
    if (path.includes("/govt-vacancy")) return "/govt-vacancy";
    if (path.includes("/sarkari-naukri")) return "/govt-exam";
    if (path.includes("/sarkari-bharti")) return "/govt-vacancy";
    if (path.includes("/board-exams")) return "/board-exams";
    if (path.includes("/university-exams")) return "/university-exams";
    return "/entrance-exams";
  })();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [exam, setExam] = useState<ExamIdentity | null>(null);
  const [currentEdition, setCurrentEdition] = useState<ExamEdition | null>(null);
  const [draftEdition, setDraftEdition] = useState<ExamEdition | null>(null);
  const [editions, setEditions] = useState<ExamEdition[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeTab, setActiveTab] = useState<string>("identity");
  const [showNewEdition, setShowNewEdition] = useState(false);
  // A1: in-flight guard so a double-click on "Create Edition" cannot fire two
  // startNewEdition calls (the second hit the unique key and toasted an error).
  const [startingEdition, setStartingEdition] = useState(false);
  // A5: in-flight guard for the header's "Activate it / Create <year> cycle" fix.
  const [fixingCycle, setFixingCycle] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  // S2.4: the review drawer's state — set only after an extraction, cleared on
  // apply/close. Nothing reaches the form without an explicit Accept.
  const [reviewState, setReviewState] = useState<
    { rows: ReviewRow[]; report: FillReport; providerNote: string; match: LikelyMatch | null; sourceText: string } | null
  >(null);
  // S2.8: the per-tab AI fill state is gone — one entry point now ("Update
  // from a notice" → review drawer), so nothing tracks per-tab fills.
  // S2.6: the last extraction's provenance + the metadata staged by an Apply,
  // written into exams.ai_metadata by the EDITOR's next save — never before.
  const extractionMetaRef = React.useRef<{
    provider: string; model: string; template: string; issues: import("@/lib/ai/aiFillClient").ExtractionIssue[];
    noticeReference?: string; sourceText: string;
  } | null>(null);
  const pendingProvenanceRef = React.useRef<Record<string, unknown> | null>(null);
  const [isPublished, setIsPublished] = useState(true);
  const [workflowStatus, setWorkflowStatus] = useState<ExamWorkflowStatus>("published");
  const [publishing, setPublishing] = useState(false);
  // ── Unsaved-changes guard state ────────────────────────────────────────────
  // Local-state tabs (Modules/News) hold edits outside react-hook-form,
  // so they report their own dirty flag up here. Aggregated with form dirtiness
  // below into a single `isDirty`. Each flag is set by comparing the tab's current
  // state to the values it was seeded from (type-and-revert clears it) — never a
  // bare "a keystroke happened" flag, so the guard doesn't fire on no-op edits.
  // NOTE: the Modules tab (ModulePanel) autosaves module content on a 2-second
  // debounce (useModuleAutosave). Config actions (enable/reorder) persist
  // immediately, but a content edit has a ~2s window where it's unsaved. So the
  // Modules tab DOES feed the guard: `moduleDirty` mirrors ModulePanel's aggregate
  // "an autosave is pending" flag, closing that window without redesigning the
  // module save model. The News list is manual-save and reports its own
  // compared-to-seed flag. All feed the single unsaved-changes guard.
  // R0.1 (2026-10-04): the News-SEO block was removed — content_modules.newsSeo
  // had NO reader anywhere (frontend included), so the 7 fields silently went
  // nowhere. Existing stored data is left untouched for now.
  // R0.5: when AI fills a NEW record (no currentEdition), the generated content_modules
  // are stored here (not written to DB immediately). handleSave's isNew branch feeds
  // them into the single updateEdition call after create, so one Save persists everything.
  const pendingModulesRef = React.useRef<Record<string, unknown> | null>(null);

  const [moduleDirty, setModuleDirty] = useState(false);
  // Mirror of moduleDirty readable synchronously inside guard callbacks (so
  // "Save & continue" can wait for the pending module autosave to land before
  // it lets the tab unmount, without stale-closure reads of moduleDirty).
  const moduleDirtyRef = React.useRef(false);
  React.useEffect(() => { moduleDirtyRef.current = moduleDirty; }, [moduleDirty]);
  const [newsDirty, setNewsDirty] = useState(false);
  // Item 3 (Group 3) — unified Save. News lives in child-component local state;
  // the child mirrors its CURRENT value up into this ref on every change. The
  // primary Save reads the ref to build ONE merged content_modules object and
  // persists it in a SINGLE updateEdition call — so a News save can no longer
  // write a stale whole-column snapshot over the other surfaces. null = the tab
  // hasn't mounted/reported yet, so Save leaves the news key untouched.
  const newsRef = React.useRef<any[] | null>(null);
  // The pending action awaiting a Save/Discard/Cancel decision. `kind` distinguishes
  // an in-editor tab switch from an in-app route navigation (they resume differently).
  const [pendingExit, setPendingExit] = useState<
    | { kind: "tab"; to: string }
    | { kind: "nav" }
    | null
  >(null);
  const [guardSaving, setGuardSaving] = useState(false);

  const form = useForm<FormData>({
    defaultValues: {
      // region: REQUIRED on create, NO default — the picker starts on "— Select —"
      // so a value must be chosen (the region lesson: a blank must block save, not
      // silently write a wrong/national value). Validated in onSubmit + DB FK/NOT NULL.
      name: "", shortName: "", slug: "", region: "", categoryId: "", subcategoryId: "",
      conductingBody: "", officialWebsite: "", cycleFrequency: "annual",
      // entityType is decided by the pillar (same rule as the DB CHECK). Only
      // entrance-exam leaves a choice; every other pillar is fixed.
      entityType: resolveEntityType(pillarFromUrl),
      // Selection model: REQUIRED, NO default (owner S1 item 4). The picker starts on
      // "— Select —" so the editor must consciously choose — the old "written-exam"
      // default silently wrote the wrong selection story on merit/counselling exams.
      selectionModel: "",
      isFeatured: false, editionYear: new Date().getFullYear(), editionSession: "main",
      editionStatus: "upcoming", notificationDate: "", vacancy: "",
      // R0.6: no editor input yet; form holds null until AI-fill writes stage-1 data.
      importantDates: [], eligibility: null, applicationFee: null,
      hasNotification: false, hasApplication: false,
      hasAdmitCard: false, hasSyllabus: false, hasAnswerKey: false,
      hasResult: false, hasCutoff: false, hasCounselling: false,
      seoTitle: "", seoDescription: "", tags: "", faqs: [],
    },
  });

  const { fields: dateFields, append: appendDate, remove: removeDate, replace: replaceDates } = useFieldArray({ control: form.control, name: "importantDates" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq, replace: replaceFaqs } = useFieldArray({ control: form.control, name: "faqs" });

  const watchFrequency = form.watch("cycleFrequency");
  const watchedEntityType = form.watch("entityType");
  const watchedSelectionModel = form.watch("selectionModel") as SelectionModel;
  // FX1.3: the form's cycle year, used by the no-cycle empty states.
  const watchedEditionYear = form.watch("editionYear") || new Date().getFullYear();

  useEffect(() => {
    getCategories(pillarFromUrl).then(setCategories).catch(() => {});
  }, [pillarFromUrl]);

  // Region vocabulary for the picker (states + UTs + all-india). Loaded once.
  useEffect(() => {
    getRegions().then(setRegions).catch(() => setRegions([]));
  }, []);

  // The pillar (from the URL) decides the entity type — the same rule as the DB
  // CHECK. A fixed pillar forces its type; entrance-exam keeps a value only if
  // it's one of the two valid choices, else snaps to "exam". This also corrects
  // any stale entity_type read from an older record on load.
  useEffect(() => {
    const fixed = entityTypeForPillar(pillarFromUrl);
    if (fixed !== null) {
      if (watchedEntityType !== fixed) {
        form.setValue("entityType", fixed, { shouldDirty: false, shouldValidate: true });
      }
    } else if (!ENTRANCE_EXAM_ENTITY_CHOICES.includes(watchedEntityType as never)) {
      form.setValue("entityType", "exam", { shouldDirty: false, shouldValidate: true });
    }
  }, [pillarFromUrl, watchedEntityType, form]);

  const loadExam = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const data = await getEntranceExam(id);
      setExam(data.exam);
      setIsPublished(data.exam.isPublished);
      setWorkflowStatus(data.exam.workflowStatus);
      setCurrentEdition(data.currentEdition);
      setEditions(data.editions);
      // Populate form with exam identity
      form.reset({
        name: data.exam.name,
        shortName: data.exam.shortName,
        slug: data.exam.slug,
        region: data.exam.region ?? "",
        categoryId: data.exam.categoryId ?? "",
        subcategoryId: data.exam.subcategoryId ?? "",
        conductingBody: data.exam.conductingBody,
        officialWebsite: data.exam.officialWebsite,
        cycleFrequency: data.exam.cycleFrequency,
        entityType: data.exam.entityType ?? "exam",
        selectionModel: data.exam.selectionModel ?? "",
        isFeatured: data.exam.isFeatured,
        seoTitle: data.exam.seoTitle ?? "",
        seoDescription: data.exam.seoDescription ?? "",
        tags: data.exam.tags.join(", "),
        faqs: data.exam.faqs ?? [],
        // Edition fields
        editionYear: data.currentEdition?.year ?? new Date().getFullYear(),
        editionSession: data.currentEdition?.session ?? "main",
        editionStatus: data.currentEdition?.status ?? "upcoming",
        notificationDate: data.currentEdition?.notificationDate ?? "",
        vacancy: data.currentEdition?.vacancy?.toString() ?? "",
        importantDates: mergeWithStandardDates(data.currentEdition?.importantDates ?? []),
        // R0.6: load structured eligibility/fee from the edition JSONB columns.
        eligibility: data.currentEdition?.eligibility ?? null,
        applicationFee: data.currentEdition?.applicationFee ?? null,
        hasNotification: data.currentEdition?.hasNotification ?? false,
        hasApplication: data.currentEdition?.hasApplication ?? false,
        hasAdmitCard: data.currentEdition?.hasAdmitCard ?? false,
        hasSyllabus: data.currentEdition?.hasSyllabus ?? false,
        hasAnswerKey: data.currentEdition?.hasAnswerKey ?? false,
        hasResult: data.currentEdition?.hasResult ?? false,
        hasCutoff: data.currentEdition?.hasCutoff ?? false,
        hasCounselling: data.currentEdition?.hasCounselling ?? false,
      });
    } catch (err) {
      toast.error("Failed to load exam: " + getErrorMessage(err));
      const basePath = window.location.pathname.split("/")[1] || "entrance-exams";
      navigate(`/${basePath}`);
    } finally {
      setLoading(false);
    }
  }, [id, isNew, form, navigate]);

  useEffect(() => { loadExam(); }, [loadExam]);

  const handleSave = async (data: FormData) => {
    // Reject a website value that can't normalise to a single valid URL, rather
    // than silently storing "" (which would destroy the editor's input without
    // warning). Empty is fine; only non-empty-in / empty-out is an error. The
    // form keeps the original text so nothing is lost — the editor just fixes it.
    // Uses the shared `url` field type so the CMS and the Postgres CHECK on
    // exams.official_website enforce the SAME rule (no drift).
    const websiteCheck = validateField("url", data.officialWebsite);
    if (!websiteCheck.ok) {
      toast.error(`Official Website: ${websiteCheck.error}`);
      return;
    }

    // Region is REQUIRED (exams.region is NOT NULL + FK to regions). Block save on a
    // blank rather than letting the DB reject it with an opaque constraint error.
    // No default — the editor must consciously choose (the region lesson).
    if (!data.region) {
      toast.error("Region is required — choose a state, union territory, or All India.");
      setActiveTab("identity");
      return;
    }

    // Selection model is REQUIRED with no default (owner S1 item 4) — validated exactly
    // like region: block save, name the field, jump to the tab that holds it.
    if (!data.selectionModel) {
      toast.error("Selection Model is required — choose how candidates are selected.");
      setActiveTab("identity");
      return;
    }

    // Category is REQUIRED for the entrance pillar (owner S1 item 4): it was starred (*)
    // but saved as `|| null`, stranding the record — a record with no category has no
    // public URL. Other pillars keep their current behaviour pending the item-4 report.
    if (isNew && pillarFromUrl === "entrance-exam" && !data.categoryId) {
      toast.error("Category is required — a record with no category has no public URL.");
      setActiveTab("identity");
      return;
    }

    // C1: validate the time-with-date fields before any write. The DB CHECK only
    // validates `date`, so these rules are enforced here; a violation aborts the
    // save (form state intact) with the first clear message.
    const dateErrors = validateDateRowsForWrite(data.importantDates);
    if (dateErrors.length > 0) {
      toast.error(dateErrors[0]);
      setActiveTab("edition");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        // R0.5 (2026-10-04): the old branch returned immediately after create,
        // discarding every AI-filled field (dates, eligibility, fee, modules, FAQs,
        // SEO) the operator had reviewed. The corrected flow: create the draft exam
        // + first edition, THEN persist all form state in the same Save click.
        const result = await createEntranceExam({
          name: data.name,
          shortName: data.shortName,
          slug: data.slug || undefined,
          pillar: pillarFromUrl,
          region: data.region,
          categoryId: data.categoryId,
          conductingBody: data.conductingBody,
          officialWebsite: data.officialWebsite,
          cycleFrequency: data.cycleFrequency,
          entityType: resolveEntityType(pillarFromUrl, data.entityType),
          selectionModel: data.selectionModel as SelectionModel,
          firstEditionYear: data.editionYear,
          // S2.6: a record born from a notice records the notice.
          ...(pendingProvenanceRef.current ? { aiMetadata: pendingProvenanceRef.current } : {}),
        });

        // Identity fields that createEntranceExam does not accept (SEO, FAQs, tags,
        // subcategoryId, isFeatured). Write them now so the draft is complete.
        await updateExamIdentity(result.exam.id, {
          subcategoryId: data.subcategoryId || undefined,
          isFeatured: data.isFeatured,
          selectionModel: data.selectionModel as SelectionModel,
          seoTitle: data.seoTitle || undefined,
          seoDescription: data.seoDescription || undefined,
          tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
          faqs: data.faqs?.length ? data.faqs : undefined,
        });

        // Build the full content_modules for the first edition:
        //   - Start from the seeded config from createEntranceExam (has _config).
        //   - Overlay AI-generated modules stored in pendingModulesRef (R0.5).
        //   - Overlay the News tab's items if the tab was mounted (newsRef).
        const baseContentModules: Record<string, unknown> =
          (result.edition as any)?.content_modules ?? {};
        const finalContentModules: Record<string, unknown> = {
          ...baseContentModules,
          ...(pendingModulesRef.current ?? {}),
        };
        if (newsRef.current !== null) {
          // R0.10: canonical news shape { items: [...] }.
          finalContentModules.news = { items: newsRef.current };
        }

        await updateEdition(result.edition.id, {
          status: data.editionStatus,
          notificationDate: data.notificationDate || null,
          vacancy: data.vacancy ? parseInt(data.vacancy) : null,
          importantDates: serializeDateRowsForWrite(data.importantDates),
          eligibility: data.eligibility ?? undefined,
          applicationFee: data.applicationFee ?? undefined,
          hasNotification: data.hasNotification,
          hasApplication: data.hasApplication,
          hasAdmitCard: data.hasAdmitCard,
          hasSyllabus: data.hasSyllabus,
          hasAnswerKey: data.hasAnswerKey,
          hasResult: data.hasResult,
          hasCutoff: data.hasCutoff,
          hasCounselling: data.hasCounselling,
          // Only write content_modules if there's something beyond the seeded _config.
          ...(Object.keys(finalContentModules).length > 1 || pendingModulesRef.current || newsRef.current !== null
            ? { contentModules: finalContentModules }
            : {}),
        });

        // Clear the pending modules now that they've been persisted.
        pendingModulesRef.current = null;
        // S2.6: create already carried the provenance through the insert — drop the
        // staged copy so the post-create navigation cannot re-apply it.
        pendingProvenanceRef.current = null;

        toast.success(`"${data.name}" created as Draft.`);
        // Navigate to the freshly saved record (all form state is now on disk).
        const basePath = window.location.pathname.split("/new")[0] || "/entrance-exams";
        navigate(`${basePath}/${result.exam.id}`, { replace: true });
        return;
      }

      // Update existing exam — split between identity and edition
      await updateExamIdentity(exam!.id, {
        name: data.name,
        shortName: data.shortName,
        slug: data.slug,
        region: data.region,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId || null,
        conductingBody: data.conductingBody,
        officialWebsite: data.officialWebsite,
        cycleFrequency: data.cycleFrequency,
        // Persist the pillar-resolved entity type so an entrance-exam record can
        // be switched between exam / university-admission; fixed pillars are a no-op.
        entityType: resolveEntityType(pillarFromUrl, data.entityType),
        isFeatured: data.isFeatured,
        selectionModel: data.selectionModel as SelectionModel,
        seoTitle: data.seoTitle || undefined,
        seoDescription: data.seoDescription || undefined,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        faqs: data.faqs,
        // S2.6: persist the staged provenance ONLY when an Apply staged it, and
        // clear it after the save succeeds so a later save cannot re-write it.
        ...(pendingProvenanceRef.current ? { aiMetadata: pendingProvenanceRef.current } : {}),
      });
      pendingProvenanceRef.current = null; // identity write landed — one-shot provenance

      // Item 3 — build ONE merged content_modules from the live News child state
      // (ref), overlaying the target edition's existing modules. Written in the
      // SAME updateEdition call below (single whole-column write), which removes
      // the stale-snapshot cross-overwrite. R0.1: the newsSeo overlay is gone.
      // `undefined` when the tab hasn't reported, so we don't touch the column.
      // R0.10: canonical news shape is { items: [...] }.
      // FX1.2: when the exam has NO current edition, the base is the AI-pending
      // modules (if any), not a stale snapshot.
      const buildMergedContentModules = (baseModules?: Record<string, unknown> | null): Record<string, unknown> | undefined => {
        const base = (baseModules ?? currentEdition?.contentModules ?? pendingModulesRef.current ?? {}) as Record<string, unknown>;
        if (newsRef.current === null) {
          // No news reported. Still carry AI-pending modules if this is a fresh cycle.
          if (!currentEdition && pendingModulesRef.current) return { ...pendingModulesRef.current };
          return undefined;
        }
        return { ...base, news: { items: newsRef.current } };
      };

      // The edition-level payload, identical regardless of which edition we write to.
      const editionWrite = (mergedModules: Record<string, unknown> | undefined) => ({
        status: data.editionStatus,
        notificationDate: data.notificationDate || null,
        vacancy: data.vacancy ? parseInt(data.vacancy) : null,
        importantDates: serializeDateRowsForWrite(data.importantDates),
        // R0.6: write eligibility/fee only when the form holds a non-null value.
        eligibility: data.eligibility ?? undefined,
        applicationFee: data.applicationFee ?? undefined,
        hasNotification: data.hasNotification,
        hasApplication: data.hasApplication,
        hasAdmitCard: data.hasAdmitCard,
        hasSyllabus: data.hasSyllabus,
        hasAnswerKey: data.hasAnswerKey,
        hasResult: data.hasResult,
        hasCutoff: data.hasCutoff,
        hasCounselling: data.hasCounselling,
        // R0.8: no edition faqs shadow write (frontend reads exams.faqs only).
        ...(mergedModules !== undefined ? { contentModules: mergedModules } : {}),
      });

      // FX1.2: resolve the target edition and write ONCE. Priority:
      //   pending draft (activate it) > existing current > a NEW current created
      //   now (exam had zero editions). The old code wrote edition data ONLY when
      //   currentEdition existed, then ALWAYS toasted success — silently dropping
      //   dates/eligibility/fee/modules/news when the exam had lost its cycle.
      if (draftEdition) {
        await updateEdition(draftEdition.id, editionWrite(buildMergedContentModules()));
        await activateEdition(draftEdition.id);
        setDraftEdition(null);
        toast.success("Saved. New edition activated. Previous edition archived.");
      } else if (currentEdition) {
        await updateEdition(currentEdition.id, editionWrite(buildMergedContentModules()));
        toast.success("Saved successfully.");
      } else {
        // No current edition — create the cycle now so nothing is dropped.
        const newEdition = await createCurrentEdition(exam!.id, data.editionYear);
        await updateEdition(newEdition.id, editionWrite(buildMergedContentModules({})));
        pendingModulesRef.current = null;
        toast.success(`Created the ${data.editionYear} cycle and saved.`);
      }
      // Unified Save persisted News too — clear its local dirty flag.
      // (loadExam() below re-seeds the child tabs from the freshly saved edition.)
      setNewsDirty(false);
      await loadExam();
    } catch (err: any) {
      // R1.9: friendly duplicate-slug error with a link to the existing record.
      if (err?.code === 'DUPLICATE_SLUG' && err?.existingExam) {
        const { id: existId, name: existName, status: existStatus } = err.existingExam;
        const statusLabel = existStatus === 'published' ? 'Published' : existStatus === 'archived' ? 'Archived' : 'Draft';
        toast.error(
          `An exam with this name already exists: ${existName} (${statusLabel}).`,
          {
            description: `Open it to update, or change the Short Name / Slug and try again.`,
            action: { label: "Open existing", onClick: () => navigate(`${listPath}/${existId}`) },
            duration: 10000,
          },
        );
      } else {
        toast.error("Save failed: " + getErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Unsaved-changes guard ───────────────────────────────────────────────────
  // Aggregate dirtiness: react-hook-form tracks identity/dates/seo-form (isDirty
  // compares against the loaded defaults, so typing a value and reverting it is
  // NOT dirty), plus the local-state tabs report their own compared-to-seed flags.
  const formDirty = form.formState.isDirty;
  const isDirty = formDirty || moduleDirty || newsDirty;

  // Human label for the surface that's dirty — named in the dialog so the editor
  // knows what they'd lose. Prefer the active tab when it's the dirty one.
  const dirtyWhere = (() => {
    if (activeTab === "modules" && moduleDirty) return "Modules";
    if (activeTab === "news" && newsDirty) return "News";
    if (activeTab === "seo" && formDirty) return "SEO";
    if (moduleDirty) return "Modules";
    if (newsDirty) return "News";
    const LABELS: Record<string, string> = {
      identity: "Identity", resources: "Resources", syllabus: "Syllabus",
      edition: "Dates & Status", modules: "Modules", news: "News",
      seo: "SEO", editions: "Editions",
    };
    return LABELS[activeTab] ?? "this tab";
  })();

  // (1) In-app navigation guard (RR 6.26 useBlocker): blocks leaving the editor
  // route (back button, sidebar link, ViewOnSite→away) while dirty.
  const blockerFn = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
    [isDirty]
  );
  const blocker = useBlocker(blockerFn);
  useEffect(() => {
    if (blocker.state === "blocked") setPendingExit({ kind: "nav" });
  }, [blocker.state]);

  // (2) Browser close / refresh / external navigation guard.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // Chrome requires returnValue to be set
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // (3) Tab-switch guard: the ONLY way tabs change. If the current surface is
  // dirty, hold the switch and ask; otherwise switch immediately.
  const guardedSetActiveTab = useCallback((to: string) => {
    if (to === activeTab) return;
    if (isDirty) {
      setPendingExit({ kind: "tab", to });
      return;
    }
    setActiveTab(to);
  }, [activeTab, isDirty]);

  // Clear the manual-save local dirty flags after a resolved guard. moduleDirty is
  // NOT cleared here: it's owned by ModulePanel's live autosave state (it clears
  // itself when the pending save lands, and resets to false on unmount), so forcing
  // it false here would lie about whether the edit was actually persisted.
  const clearLocalDirty = useCallback(() => {
    setNewsDirty(false);
  }, []);

  const guardProceed = useCallback(() => {
    const exit = pendingExit;
    setPendingExit(null);
    if (!exit) return;
    if (exit.kind === "tab") setActiveTab(exit.to);
    else if (exit.kind === "nav" && blocker.state === "blocked") blocker.proceed();
  }, [pendingExit, blocker]);

  const guardCancel = useCallback(() => {
    setPendingExit(null);
    if (blocker.state === "blocked") blocker.reset();
  }, [blocker]);

  const guardDiscard = useCallback(() => {
    // Discard local-state edits so they can't resurface; RHF form is reset by the
    // pending navigation/tab unmount reloading from server on next mount, but we
    // also reset it to the last loaded values so a stay-then-return is clean.
    clearLocalDirty();
    form.reset(form.formState.defaultValues);
    guardProceed();
  }, [clearLocalDirty, form, guardProceed]);

  const guardSaveAndContinue = useCallback(async () => {
    setGuardSaving(true);
    try {
      // Item 3: the primary Save (handleSave) is now unified — it persists the RHF
      // form fields AND the News local state (merged into one content_modules
      // write). So "Save & continue" must run it whenever ANY of those surfaces is
      // dirty, not only when the RHF form is dirty — otherwise a News-only edit
      // wouldn't be saved before leaving. handleSave reads the live newsRef, so it
      // captures the current value regardless of which tab is active.
      if (formDirty || newsDirty) {
        await form.handleSubmit(handleSave)();
      }
      // Modules: a content edit autosaves on a 2s debounce. If one is still pending
      // we must let it land BEFORE we proceed — proceeding unmounts ModulePanel and
      // clears the debounce timer, which would drop the edit. Wait for the pending
      // flag (mirrored in moduleDirtyRef) to clear, capped so a stuck save can't
      // hang the dialog forever (~6s = debounce + retry/backoff headroom).
      if (moduleDirtyRef.current) {
        const deadline = Date.now() + 6000;
        while (moduleDirtyRef.current && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      clearLocalDirty();
      guardProceed();
    } finally {
      setGuardSaving(false);
    }
  }, [formDirty, newsDirty, form, clearLocalDirty, guardProceed]);

  const handleStartNewEdition = async (year: number, session: CycleSession, editionLabel?: string) => {
    if (startingEdition) return; // A1: ignore re-entrant clicks while a create is in flight
    setStartingEdition(true);
    try {
      const draft = await startNewEdition(exam!.id, { year, session, editionLabel });
      toast.success(`New edition ${editionLabel || year} created as draft. Save to activate it.`);
      setDraftEdition(draft);
      // A3: reflect the new draft in the editions list immediately so the
      // "Editions (N)" tab count and the header are correct without a full
      // reload (a reload would reset the form off the draft being edited).
      setEditions((prev) => (prev.some((e) => e.id === draft.id) ? prev : [draft, ...prev]));
      setShowNewEdition(false);
      // Switch editor to show the draft edition fields
      form.setValue("editionYear", draft.year);
      form.setValue("editionSession", draft.session);
      form.setValue("editionStatus", draft.status);
      form.setValue("notificationDate", "");
      form.setValue("vacancy", "");
      form.setValue("importantDates", []);
      form.setValue("hasNotification", false);
      form.setValue("hasApplication", false);
      form.setValue("hasAdmitCard", false);
      form.setValue("hasSyllabus", false);
      form.setValue("hasAnswerKey", false);
      form.setValue("hasResult", false);
      form.setValue("hasCutoff", false);
      form.setValue("hasCounselling", false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setStartingEdition(false);
    }
  };

  // A5: activate an existing draft/other edition as the current cycle (used by
  // the header banner and the Modules empty state when there is no current one).
  const handleActivateDraft = async (editionId: string, label: string) => {
    try {
      await activateEdition(editionId);
      await loadExam();
      toast.success(`${label} is now the active cycle.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteExam(exam!.id);
      toast.success(`"${exam!.name}" deleted.`);
      navigate(listPath);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // ── S2.4: extraction → review drawer. NOTHING applies directly. ──────────
  // The old path ran generateExamDataWithAI and silently filled blank fields.
  // Now the server-side NOTICE_EXTRACT_V1 template produces flagged rows, the
  // drawer shows every proposal with its source quote and confidence, and only
  // the editor's Accepted rows touch the FORM (R1.6 holds: the editor saves).
  const handleAIGenerate = async (rawContent?: string) => {
    const year = form.getValues("editionYear") || new Date().getFullYear();
    if (!rawContent || rawContent.trim().length < 50) {
      // YMYL: the old knowledge-only mode fabricated dates. The notice IS the
      // source now — no paste, no extraction. The NAME also comes from the
      // notice (S2.8): a brand-new record no longer needs one typed first.
      toast.error("Paste the official notice text first — nothing is generated from memory.");
      return;
    }

    setAiGenerating(true);
    setShowAIDialog(false);
    try {
      const ext = await generateStructured("NOTICE_EXTRACT_V1", rawContent, {
        pillar: pillarFromUrl || "entrance-exam",
        consumer: "update-from-notice",
      });
      const rows = buildReviewRows(
        ext,
        form.getValues() as ReviewCurrentValues,
        categories.map((c) => ({ slug: c.slug, id: c.id })),
        year,
      );

      // S2.5: on a NEW record, check whether the notice belongs to an exam
      // that already exists — one record per cycle, many notices. The drawer
      // then offers to carry the extraction THERE instead of duplicating.
      let match: LikelyMatch | null = null;
      if (isNew) {
        const f = ext.content.fields as Record<string, { value?: string } | undefined>;
        match = await findLikelyExamMatch(
          {
            name: typeof f.name?.value === "string" ? f.name.value : undefined,
            shortName: typeof f.shortName?.value === "string" ? f.shortName.value : undefined,
            conductingBody: typeof f.conductingBody?.value === "string" ? f.conductingBody.value : undefined,
            year,
          },
          pillarFromUrl || "entrance-exam",
        ).catch(() => null); // a failed read must not block the review — it just means "no suggestion"
      }

      setReviewState({
        rows,
        report: summarizeFill(rows, ext.issues),
        providerNote: `${ext.provider} · ${ext.model} · template ${ext.template}`,
        match,
        sourceText: rawContent,
      });
      // S2.6: remember WHO produced this answer and the notice's own reference —
      // Apply stages it into ai_metadata; the save persists it.
      const refField = (ext.content.fields as Record<string, { value?: unknown } | undefined>).noticeReference;
      extractionMetaRef.current = {
        provider: ext.provider,
        model: ext.model,
        template: ext.template,
        issues: ext.issues,
        noticeReference: typeof refField?.value === "string" && refField.value.trim() ? refField.value.trim() : undefined,
        sourceText: rawContent,
      };
      if (rows.length === 0) {
        toast.warning("The model read the notice but proposed no usable changes. Check the pasted text.");
      }
    } catch (err) {
      // A JSON/schema failure surfaces HERE in plain words — never silently
      // empty (§15.1 item 5: the old stage-2 catch hid every parse failure).
      toast.error(err instanceof Error ? err.message : getErrorMessage(err));
    } finally {
      setAiGenerating(false);
    }
  };

  /** Merge ACCEPTED date rows into the form — S2.5 rules: match and update,
   *  never duplicate; an extension appends with a supersedes link; a blank
   *  standard slot fills; a dated row is never clobbered. */
  const mergeProposedDates = (proposed: ProposedDateRow[]): boolean => {
    const currentDates = form.getValues("importantDates") as DateRow[];
    const res = mergeAcceptedDateRows(currentDates, proposed as unknown as DateRow[]);
    if (res.filled + res.added > 0) replaceDates(res.rows);
    if (res.duplicatesIgnored > 0) {
      toast.info(`${res.duplicatesIgnored} date(s) already on the timeline were left as-is.`);
    }
    return res.filled + res.added > 0;
  };

  /** S2.5: carry the extraction to the existing record it belongs to. The
   *  notice text rides through sessionStorage; the target editor re-runs the
   *  extraction against ITS form so the review compares real current values. */
  const handleOpenMatch = (match: LikelyMatch) => {
    if (!reviewState) return;
    try {
      sessionStorage.setItem(NOTICE_HANDOFF_KEY, JSON.stringify({ text: reviewState.sourceText, at: Date.now() }));
    } catch { /* storage full/blocked — the click still navigates */ }
    setReviewState(null);
    const basePath = window.location.pathname.split("/")[1] || "entrance-exams";
    navigate(`/${basePath}/${match.exam.id}`);
  };

  /** The drawer's one callback: writes ONLY to the form, never the DB. */
  const handleApplyAccepted = (accepted: ReviewRow[]) => {
    if (accepted.length === 0) return;
    let applied = 0;
    for (const r of accepted) {
      if (r.kind === "field" && r.formPath && !isBlank(r.formValue)) {
        form.setValue(r.formPath as keyof FormData, r.formValue as never, { shouldDirty: true });
        applied++;
      }
    }
    const dateRows = accepted.filter((r) => r.kind === "date" && r.row).map((r) => r.row!);
    if (dateRows.length > 0 && mergeProposedDates(dateRows)) applied += dateRows.length;

    // S2.6: stage the provenance run (metadata + document references). It only
    // reaches the database when the editor SAVES — Apply alone touches the form.
    const meta = extractionMetaRef.current;
    if (meta) {
      const proposalRows = accepted.filter((r) => r.kind === "proposal" && r.documentReference);
      pendingProvenanceRef.current = buildNoticeAiMetadata(exam?.aiMetadata, {
        sourceType: "pasted_text",
        noticeReference: meta.noticeReference,
        provider: meta.provider,
        model: meta.model,
        template: meta.template,
        report: reviewState?.report ?? { proposed: 0, defaultAccepted: 0, flagged: 0, noFieldYet: 0, lowConfidence: [], missingOptions: [] },
        issues: meta.issues,
        acceptedRows: accepted,
        documentReferences: proposalRows.map((r) => r.documentReference!),
      }, new Date().toISOString());
    }

    setReviewState(null);
    toast.success(`${applied} change(s) applied to the form. Review them, then Save.`);
  };

  // S2.5: consume a carried-over notice ("Open it and review the changes
  // there") once — and only once — per record, and only while it is fresh.
  const handoffDone = React.useRef(false);
  useEffect(() => {
    if (isNew || loading || handoffDone.current) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(NOTICE_HANDOFF_KEY);
      if (raw) sessionStorage.removeItem(NOTICE_HANDOFF_KEY);
    } catch { return; }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { text?: string; at?: number };
      if (!parsed.text || !parsed.at || Date.now() - parsed.at > 15 * 60 * 1000) return; // stale — drop silently
      handoffDone.current = true;
      void handleAIGenerate(parsed.text);
    } catch { /* malformed handoff — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, loading]);



  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const tabs = [
    { id: "identity", label: "Identity" },
    // Exam-identity-level tabs (shared across editions), beside Identity.
    ...(!isNew ? [{ id: "resources", label: "Resources" }] : []),
    ...(!isNew ? [{ id: "syllabus", label: "Syllabus" }] : []),
    { id: "edition", label: "Dates & Status" },
    { id: "modules", label: "Modules" },
    { id: "news", label: "News" },
    { id: "seo", label: "SEO" },
    ...(!isNew ? [{ id: "editions", label: `Editions (${editions.length})` }] : []),
  ];

  // A5: the draft/other edition to offer activating when there is no current cycle.
  const a5Draft = pickDraftWhenNoCurrent(editions, !!currentEdition, !!draftEdition);

  return (
    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => navigate(listPath)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 truncate">
              {isNew ? (pillarFromUrl === "government-exam" ? "New Govt Exam Recruitment" : pillarFromUrl === "govt-vacancy" ? "New Govt Vacancy" : "New Entrance Exam") : exam?.name ?? ""}
            </h1>
            {currentEdition && !draftEdition && (
              <p className="text-xs text-slate-500">
                Edition: {currentEdition.editionLabel} ({currentEdition.session !== "main" ? currentEdition.session + " — " : ""}{currentEdition.status.replace(/-/g, " ")})
              </p>
            )}
            {draftEdition && (
              <p className="text-xs text-amber-600 font-medium">
                ⚠️ Draft edition: {draftEdition.editionLabel} — Save to activate
              </p>
            )}
            {/* A5: no active cycle, but other editions/drafts exist. Say so plainly
                and offer the two ways out, instead of a bare "Editions (0)". */}
            {a5Draft && (() => {
              const thisYear = new Date().getFullYear();
              return (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-amber-700 font-medium">
                    ⚠️ No active cycle. {a5Draft.editionLabel} exists:
                  </span>
                  <button
                    type="button"
                    disabled={fixingCycle}
                    onClick={async () => {
                      setFixingCycle(true);
                      try { await activateEdition(a5Draft.id); await loadExam(); toast.success(`${a5Draft.editionLabel} is now the active cycle.`); }
                      catch (err) { toast.error(getErrorMessage(err)); }
                      finally { setFixingCycle(false); }
                    }}
                    className="font-medium text-blue-600 hover:underline disabled:opacity-50"
                  >Activate it</button>
                  <span className="text-slate-400">or</span>
                  <button
                    type="button"
                    disabled={fixingCycle}
                    onClick={async () => {
                      setFixingCycle(true);
                      try { await createCurrentEdition(exam!.id, thisYear); await loadExam(); toast.success(`Created the ${thisYear} cycle.`); }
                      catch (err) { toast.error(getErrorMessage(err)); }
                      finally { setFixingCycle(false); }
                    }}
                    className="font-medium text-blue-600 hover:underline disabled:opacity-50"
                  >Create {thisYear} cycle</button>
                </div>
              );
            })()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              {/* Publish state — workflow_status is the single source of truth
                  (draft = not on site, published = live, archived = retired).
                  is_published is derived from this by a DB trigger. */}
              <div className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium ${
                workflowStatus === "published"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : workflowStatus === "draft"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-300 bg-slate-100 text-slate-600"
              }`}>
                <Globe size={14} />
                <select
                  value={workflowStatus}
                  disabled={publishing}
                  onChange={async (e) => {
                    const next = e.target.value as ExamWorkflowStatus;
                    setPublishing(true);
                    try {
                      await setExamWorkflowStatus(exam!.id, next);
                      setWorkflowStatus(next);
                      setIsPublished(next === "published");
                      toast.success(
                        next === "published" ? "Published — live on the frontend."
                        : next === "draft" ? "Set to draft — not on the frontend (404s on direct access)."
                        : "Archived — retired from the frontend."
                      );
                    } catch (err) {
                      toast.error(getErrorMessage(err));
                    } finally {
                      setPublishing(false);
                    }
                  }}
                  className="bg-transparent text-xs font-medium focus:outline-none disabled:opacity-50 cursor-pointer"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published ✓</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              {exam?.slug && (
                <ViewOnSiteButton
                  pillar={exam.pillar}
                  category={exam.category}
                  slug={exam.slug}
                  isPublished={isPublished}
                  size="lg"
                />
              )}
              <button type="button" onClick={() => setShowAIDialog(true)} disabled={aiGenerating}
                title="Paste an official notice — the AI proposes changes with source quotes; you review and accept before anything touches the form."
                className="flex items-center gap-1.5 rounded border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50">
                {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiGenerating ? "Reading the notice..." : "🤖 Update from a notice"}
              </button>
              <button type="button" onClick={() => setShowNewEdition(true)}
                className="flex items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <Plus size={14} /> New Edition
              </button>
              <button type="button" onClick={() => setShowDelete(true)}
                className="flex items-center gap-1.5 rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
          {isNew && (
            <button type="button" onClick={() => setShowAIDialog(true)} disabled={aiGenerating}
              title="Paste an official notice — the AI proposes changes with source quotes; you review and accept before anything touches the form."
              className="flex items-center gap-1.5 rounded border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50">
              {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {aiGenerating ? "Reading the notice..." : "🤖 Update from a notice"}
            </button>
          )}
          <button type="submit" disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Save size={14} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 bg-white rounded-t-lg overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => guardedSetActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg border border-slate-200 border-t-0 p-5">
        {/* S2.8: the per-tab AI buttons are gone. One entry point — "Update from
            a notice" in the header — feeds the review drawer for every tab. */}

        {activeTab === "identity" && <IdentityTab form={form} categories={categories} regions={regions} watchFrequency={watchFrequency} watchedSelectionModel={watchedSelectionModel} isNew={isNew} pillar={pillarFromUrl} />}
        {activeTab === "resources" && <ResourcesTab examId={exam?.id ?? null} />}
        {activeTab === "syllabus" && <SyllabusTab examId={exam?.id ?? null} />}
        {activeTab === "edition" && <EditionTab form={form} dateFields={dateFields} appendDate={appendDate} removeDate={removeDate} replaceDates={replaceDates} watchFrequency={watchFrequency}
          examId={exam?.id ?? null}
          editionId={currentEdition?.id ?? null}
          onCycleCreated={loadExam}
          syllabusResourceId={currentEdition?.syllabusResourceId ?? null}
          onLinkSyllabus={async (resourceId) => {
            if (!currentEdition) return;
            try {
              await updateEdition(currentEdition.id, { syllabusResourceId: resourceId });
              await loadExam();
              toast.success(resourceId ? "Syllabus PDF linked to this edition." : "Syllabus PDF unlinked.");
            } catch (err) {
              toast.error("Failed to link syllabus: " + getErrorMessage(err));
            }
          }}
        />}
        {activeTab === "modules" && <ModulePanel editionId={currentEdition?.id ?? null} exam={exam} edition={currentEdition} onNavigateTab={setActiveTab} onDirtyChange={setModuleDirty} entityType={watchedEntityType} selectionModel={watchedSelectionModel} editionYear={watchedEditionYear} onCycleCreated={loadExam} existingDraftLabel={a5Draft?.editionLabel ?? null} onActivateDraft={a5Draft ? () => handleActivateDraft(a5Draft.id, a5Draft.editionLabel) : undefined} legacyFlags={{ hasNotification: form.getValues("hasNotification"), hasApplication: form.getValues("hasApplication"), hasAdmitCard: form.getValues("hasAdmitCard"), hasSyllabus: form.getValues("hasSyllabus"), hasAnswerKey: form.getValues("hasAnswerKey"), hasResult: form.getValues("hasResult"), hasCutoff: form.getValues("hasCutoff"), hasCounselling: form.getValues("hasCounselling") }} />}
        {activeTab === "news" && <NewsTab editionId={currentEdition?.id ?? null} examId={exam?.id ?? null} editionYear={watchedEditionYear} onCycleCreated={loadExam} contentModules={currentEdition?.contentModules ?? {}} onDirtyChange={setNewsDirty} onNewsChange={(n) => { newsRef.current = n; }} />}
        {activeTab === "seo" && <SEOTab form={form} faqFields={faqFields} appendFaq={appendFaq} removeFaq={removeFaq} />}
        {activeTab === "editions" && <HistoryTab editions={editions}
          onDelete={async (edId, label) => {
            if (!confirm(`Delete edition "${label}"? This cannot be undone.`)) return;
            try {
              await deleteEdition(edId);
              toast.success(`Edition "${label}" deleted.`);
              await loadExam();
            } catch (err) { toast.error(getErrorMessage(err)); }
          }}
          onPromote={async (edId, label) => {
            if (!confirm(`Promote "${label}" to current edition? The current edition will be archived.`)) return;
            try {
              await promoteEdition(edId);
              toast.success(`"${label}" is now the current edition.`);
              await loadExam();
            } catch (err) { toast.error(getErrorMessage(err)); }
          }}
          onEdit={(ed) => {
            // Load the selected edition into the form for editing
            form.setValue("editionYear", ed.year);
            form.setValue("editionSession", ed.session);
            form.setValue("editionStatus", ed.status);
            form.setValue("notificationDate", ed.notificationDate ?? "");
            form.setValue("vacancy", ed.vacancy?.toString() ?? "");
            form.setValue("importantDates", ed.importantDates ?? []);
            form.setValue("hasNotification", ed.hasNotification);
            form.setValue("hasApplication", ed.hasApplication);
            form.setValue("hasAdmitCard", ed.hasAdmitCard);
            form.setValue("hasSyllabus", ed.hasSyllabus);
            form.setValue("hasAnswerKey", ed.hasAnswerKey);
            form.setValue("hasResult", ed.hasResult);
            form.setValue("hasCutoff", ed.hasCutoff);
            form.setValue("hasCounselling", ed.hasCounselling);
            setCurrentEdition(ed);
            setDraftEdition(null);
            setActiveTab("edition");
            toast.info(`Editing edition "${ed.editionLabel}". Save to apply changes.`);
          }}
        />}
      </div>

      {/* New Edition Dialog */}
      {showNewEdition && <NewEditionDialog onConfirm={handleStartNewEdition} onCancel={() => setShowNewEdition(false)} frequency={watchFrequency} busy={startingEdition} defaultYear={computeNewEditionDefaultYear(currentEdition?.year)} />}

      {/* Notice-based extraction (S2.8: the single AI entry point) */}
      {showAIDialog && <AIFillDialog onGenerate={handleAIGenerate} onCancel={() => setShowAIDialog(false)} />}

      {/* S2.4 Review drawer — every proposed change with its quote + confidence.
          Apply accepted writes to the FORM only; the editor saves (R1.6). */}
      <NoticeReviewDrawer
        open={!!reviewState}
        rows={reviewState?.rows ?? []}
        report={reviewState?.report ?? { proposed: 0, defaultAccepted: 0, flagged: 0, noFieldYet: 0, lowConfidence: [], missingOptions: [] }}
        providerNote={reviewState?.providerNote ?? ""}
        match={reviewState?.match ?? null}
        onOpenMatch={handleOpenMatch}
        onClose={() => setReviewState(null)}
        onApply={handleApplyAccepted}
      />

      {/* Delete Dialog */}
      <ConfirmDialog open={showDelete} onOpenChange={setShowDelete} title="Delete Exam"
        description={`Permanently delete "${exam?.name}" and all its editions? This cannot be undone.`}
        confirmLabel="Delete" onConfirm={handleDelete} confirmVariant="danger" />

      {/* Unsaved-changes guard — shown when a tab switch or in-app navigation would
          lose unsaved work. Names the dirty surface; Save & continue / Discard / Cancel. */}
      {pendingExit && (
        <UnsavedChangesDialog
          where={dirtyWhere}
          saving={guardSaving}
          onSaveAndContinue={guardSaveAndContinue}
          onDiscard={guardDiscard}
          onCancel={guardCancel}
        />
      )}
    </form>
  );
}

// ── Tab Components ─────────────────────────────────────────────────────────

function IdentityTab({ form, categories, regions, watchFrequency, watchedSelectionModel, isNew, pillar }: { form: any; categories: Category[]; regions: Region[]; watchFrequency: CycleFrequency; watchedSelectionModel: SelectionModel; isNew: boolean; pillar: string }) {
  // The pillar decides the entity type. Only entrance-exam offers a choice.
  const pillarIsFixed = entityTypeForPillar(pillar) !== null;
  const currentEntityType: string = form.watch("entityType");
  const ENTITY_TYPE_LABELS: Record<string, string> = {
    recruitment: "🏛️ Government Recruitment",
    exam: "📝 Entrance / Competitive Exam",
    board: "🏫 Board Exam",
    "university-admission": "🎓 University Admission",
    "university-exam": "📚 University Exam",
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Exam Name *" name="name" form={form} placeholder="Common Admission Test (CAT)" />
      <Field label="Short Name *" name="shortName" form={form} placeholder="CAT" />
      <Field label="Slug" name="slug" form={form} placeholder="auto-generated if empty" disabled={!isNew} />
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Region *</label>
        <select {...form.register("region")} className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">— Select —</option>
          {regions.filter((r) => r.kind === "national").map((r) => <option key={r.slug} value={r.slug}>{r.label}</option>)}
          {regions.some((r) => r.kind === "state") && (
            <optgroup label="States">
              {regions.filter((r) => r.kind === "state").map((r) => <option key={r.slug} value={r.slug}>{r.label}</option>)}
            </optgroup>
          )}
          {regions.some((r) => r.kind === "ut") && (
            <optgroup label="Union Territories">
              {regions.filter((r) => r.kind === "ut").map((r) => <option key={r.slug} value={r.slug}>{r.label}</option>)}
            </optgroup>
          )}
        </select>
        <p className="text-xs text-slate-400 mt-0.5">Which state page this appears on. Choose All India for national exams.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
        <select {...form.register("categoryId")} className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">Select category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <Field label="Conducting Body *" name="conductingBody" form={form} placeholder="IIM Bangalore" />
      <Field label="Official Website" name="officialWebsite" form={form} placeholder="https://iimcat.ac.in" />
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Exam Frequency</label>
        <select {...form.register("cycleFrequency")} className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm">
          {CYCLE_FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      {/* Entity Type — Axis 1: what this entity is. Decided by the pillar. */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Entity Type</label>
        {pillarIsFixed ? (
          <>
            <input type="text" readOnly value={ENTITY_TYPE_LABELS[currentEntityType] ?? currentEntityType} className="w-full rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500 cursor-not-allowed" />
            <p className="text-xs text-slate-400 mt-0.5">Set by the pillar for this section</p>
          </>
        ) : (
          <>
            <select {...form.register("entityType")} className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm">
              <option value="exam">📝 Entrance / Competitive Exam</option>
              <option value="university-admission">🎓 University Admission</option>
            </select>
            <p className="text-xs text-slate-400 mt-0.5">Entrance exams only: an entrance exam or a university admission</p>
          </>
        )}
      </div>
      {/* Selection Model — Axis 2: how candidates are selected. REQUIRED, no default. */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Selection Model *</label>
        <select {...form.register("selectionModel")} className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">— Select —</option>
          {ALL_SELECTION_MODELS.map((m) => (
            <option key={m} value={m}>{SELECTION_MODEL_LABELS[m]}</option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-0.5">{SELECTION_MODEL_HINTS[watchedSelectionModel]}</p>
      </div>
      <div className="flex items-center gap-2 pt-5">
        <input type="checkbox" {...form.register("isFeatured")} id="isFeatured" className="rounded" />
        <label htmlFor="isFeatured" className="text-sm text-slate-600">Featured exam</label>
      </div>
    </div>
  );
}

/**
 * A persisted important-dates row. The editor only *edits* label/date/isUrgent,
 * but the persisted row also carries fields the frontend + exam_derived_status
 * VIEW depend on: `type` (frontend vocabulary), `state`
 * (confirmed|expected|cancelled|postponed), `verified`, `stage_label`.
 *
 * DATA-INTEGRITY CONTRACT: these extra fields are OPAQUE PASS-THROUGH. The editor
 * must never rebuild a row as an object literal (that silently drops them — the
 * bug that erased CTET's cancelled / NEET-UG's expected on every save). Always
 * spread the original row and overlay only the edited fields. `[key: string]`
 * makes any future persisted field ride along untouched too.
 */
type DateRow = {
  label: string;
  date: string;
  isUrgent: boolean;
  type?: string;
  // S2.2 — fine-grained event (registration_end, choice_filling, allotment, …).
  // Additive: the site ignores it until S3 renders it; `type` stays the
  // exam_derived_status VIEW's vocabulary. Never persisted as an empty string.
  kind?: string;
  state?: string;
  verified?: boolean;
  stage_label?: string;
  // C1 — time with dates. All optional; stored as JSONB keys on the row.
  // end_date: YYYY-MM-DD (range end); start_time/end_time: HH:MM 24h (IST);
  // time_text: free-text timing when no clock time is known (e.g. "afternoon").
  end_date?: string;
  start_time?: string;
  end_time?: string;
  time_text?: string;
  // S2.2 pass-through keys (ride the spread contract; rendered in S3):
  // phase ("Phase-3"), rank_batch ("1–1,52,202"), audience ("candidate" |
  // "institute"), supersedes (extension rows link the row they replace).
  [key: string]: unknown;
};

// Optional date-row keys that must NEVER be persisted as an empty string — an
// unchosen value means the key is absent (mirrors the FX2 state rule).
const EMPTYABLE_DATE_KEYS = ["state", "end_date", "start_time", "end_time", "time_text", "kind"] as const;

/**
 * A2 — default year for the New Edition dialog and the "Create <year> cycle"
 * button. When the exam has NO current edition, the cycle that should exist is
 * the CURRENT calendar year (2026), not next year. When it already has a current
 * edition, the new cycle defaults to the next cycle year (current + 1).
 */
export function computeNewEditionDefaultYear(currentEditionYear: number | null | undefined): number {
  return currentEditionYear != null ? currentEditionYear + 1 : new Date().getFullYear();
}

/**
 * A5 — when an exam has NO active cycle but other editions/drafts exist, pick
 * the edition to offer activating. Returns null when there IS a current edition
 * or a pending in-memory draft (those cases have their own banners). Used by
 * both the header banner and the Modules empty state so the rule lives once.
 */
export function pickDraftWhenNoCurrent(
  editions: { id: string; isCurrent: boolean; editionLabel: string }[],
  hasCurrent: boolean,
  hasPendingDraft: boolean,
): { id: string; editionLabel: string } | null {
  if (hasCurrent || hasPendingDraft || editions.length === 0) return null;
  const draft = editions.find((e) => !e.isCurrent) ?? editions[0];
  return draft ? { id: draft.id, editionLabel: draft.editionLabel } : null;
}

/**
 * FX2 — serialize date rows for the DB write (the single chokepoint for both
 * the editor save and the AI-fill-then-save path, since AI now fills form state).
 *
 *  1. Drop rows with no date. The DB CHECK `exam_editions_important_dates_valid`
 *     (important_dates_all_iso) rejects an empty-date row unless its state is a
 *     tentative one (expected/postponed/cancelled); the CMS never writes an
 *     empty-date row, so filtering first keeps a stray blank row from failing
 *     the whole write.
 *  2. Strip empty optional keys. The R0.4 state select and the C1 time fields
 *     default to "" when untouched. "" is not a valid value for any of them
 *     (state vocabulary, HH:MM, YYYY-MM-DD), and "no value" must mean the key is
 *     ABSENT — never key:"". A dated row with these empty passes the DB CHECK
 *     today, but writing "" is semantically wrong and pollutes the JSONB.
 */
export function serializeDateRowsForWrite(rows: DateRow[]): DateRow[] {
  return rows
    .filter((d) => d.date && d.date.trim() !== "")
    .map((d) => {
      const out: DateRow = { ...d };
      for (const key of EMPTYABLE_DATE_KEYS) {
        const v = out[key];
        if (typeof v !== "string" || v.trim() === "") delete out[key];
      }
      return out;
    });
}

/**
 * C1 — validate the time-with-date fields. Returns a list of human-readable
 * errors (empty = valid). The DB CHECK only validates `date`, so these rules
 * live here and block the save with a clear message.
 *  - end_date must not precede date
 *  - end_time requires an end_date or a date (a time needs a day)
 *  - on a single day (no end_date, or end_date === date), end_time >= start_time
 */
export function validateDateRowsForWrite(rows: DateRow[]): string[] {
  const errors: string[] = [];
  for (const raw of serializeDateRowsForWrite(rows)) {
    const label = raw.label?.trim() || "(untitled date)";
    const { date, end_date, start_time, end_time } = raw;
    if (end_date && date && end_date < date) {
      errors.push(`"${label}": end date (${end_date}) is before the start date (${date}).`);
    }
    if (end_time && !end_date && !date) {
      errors.push(`"${label}": an end time needs a date.`);
    }
    const sameDay = !end_date || end_date === date;
    if (sameDay && start_time && end_time && end_time < start_time) {
      errors.push(`"${label}": end time (${end_time}) is before start time (${start_time}) on the same day.`);
    }
  }
  return errors;
}

// Standard date fields that every entrance exam typically has.
// `type` is the PERSISTED/frontend vocabulary (what exam_derived_status reads) —
// used to match a DB row to its standard slot by type first, label second.
// We never rewrite a persisted row's type; this is match-only metadata.
const STANDARD_DATE_LABELS: { label: string; isUrgent: boolean; type?: string }[] = [
  { label: "Notification Release", isUrgent: false, type: "notification" },
  { label: "Registration Opens", isUrgent: true, type: "application_start" },
  { label: "Registration Closes", isUrgent: true, type: "application_end" },
  { label: "Application Correction Window", isUrgent: false, type: "application_correction" },
  { label: "Admit Card Release", isUrgent: false, type: "admit_card" },
  { label: "Exam Date", isUrgent: true, type: "exam_written" },
  { label: "Answer Key Release", isUrgent: false, type: "answer_key" },
  { label: "Result Declaration", isUrgent: false, type: "result" },
  { label: "Counselling Starts", isUrgent: false, type: "counselling" },
  { label: "Cutoff Release", isUrgent: false, type: "cutoff" },
];

/**
 * Merge DB dates with standard rows so all standard rows are always visible.
 *
 * Preserves EVERY field on a matched DB row (state/verified/stage_label/type/…)
 * by spreading the original and only overlaying the standard label. Matching is
 * by `type` first (reliable, survives label renames), falling back to label
 * prefix for legacy untyped rows.
 */
function mergeWithStandardDates(rawDates: unknown): DateRow[] {
  const dbDates: DateRow[] = Array.isArray(rawDates) ? (rawDates as DateRow[]) : [];
  const usedDbIndices = new Set<number>();

  const merged: DateRow[] = STANDARD_DATE_LABELS.map((std) => {
    // 1) Match by type first — the stable key. Never orphaned by a label rename.
    let matchIdx = std.type
      ? dbDates.findIndex((d, idx) => !usedDbIndices.has(idx) && d.type === std.type)
      : -1;

    // 2) Fall back to label-prefix match for legacy rows that carry no type.
    if (matchIdx < 0) {
      const stdNorm = std.label.toLowerCase().replace(/[^a-z]/g, "");
      let bestScore = 0;
      dbDates.forEach((d, idx) => {
        if (usedDbIndices.has(idx) || (d.type && d.type !== std.type)) return;
        const dNorm = (d.label ?? "").toLowerCase().replace(/[^a-z]/g, "");
        let score = 0;
        for (let i = 0; i < Math.min(stdNorm.length, dNorm.length); i++) {
          if (stdNorm[i] === dNorm[i]) score++;
          else break;
        }
        if (score >= 12 && score > bestScore) {
          bestScore = score;
          matchIdx = idx;
        }
      });
    }

    if (matchIdx >= 0) {
      usedDbIndices.add(matchIdx);
      // PRESERVE the whole persisted row; only ensure a stable standard label +
      // carry the standard type when the legacy row had none. Never drop fields.
      const d = dbDates[matchIdx];
      return { ...d, label: std.label, type: d.type ?? std.type };
    }
    // No DB row for this slot — an empty standard row (stripped on save if left blank).
    return { label: std.label, date: "", isUrgent: std.isUrgent, type: std.type };
  });

  // Append any custom DB rows that weren't matched — spread whole, drop nothing.
  dbDates.forEach((d, idx) => {
    if (!usedDbIndices.has(idx)) merged.push({ ...d });
  });

  return merged;
}

function EditionTab({ form, dateFields, appendDate, removeDate, replaceDates, watchFrequency, examId, editionId, syllabusResourceId, onLinkSyllabus, onCycleCreated }: { form: any; dateFields: any[]; appendDate: (v: any) => void; removeDate: (i: number) => void; replaceDates: (v: any[]) => void; watchFrequency: CycleFrequency; examId: string | null; editionId: string | null; syllabusResourceId: string | null; onLinkSyllabus: (resourceId: string | null) => void; onCycleCreated?: () => void | Promise<void> }) {
  // ── Derived status (what the SITE shows) ───────────────────────────────────
  // The public site computes status from the current edition's important_dates
  // via the exam_derived_status VIEW — NOT from the manual `status` column below.
  // We read the VIEW here so the editor stops lying about what a visitor sees.
  const [derived, setDerived] = React.useState<DerivedStatusRow | null>(null);
  const [derivedLoading, setDerivedLoading] = React.useState(false);
  React.useEffect(() => {
    if (!examId) { setDerived(null); return; }
    let cancelled = false;
    setDerivedLoading(true);
    getDerivedStatus(examId)
      .then((d) => { if (!cancelled) setDerived(d); })
      .finally(() => { if (!cancelled) setDerivedLoading(false); });
    return () => { cancelled = true; };
  }, [examId]);

  // On first render, ensure standard date fields exist ONLY if truly empty
  // Use a small delay to allow form.reset() from loadExam to propagate first
  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (didInit.current) return;
    // Wait a tick for form.reset() to propagate to field arrays
    const timer = setTimeout(() => {
      didInit.current = true;
      const currentDates = form.getValues("importantDates") as any[];
      if (!currentDates || currentDates.length === 0) {
        replaceDates(STANDARD_DATE_LABELS.map((d) => ({ label: d.label, date: "", isUrgent: d.isUrgent, type: d.type })));
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag reorder handler
  const handleReorder = (orderedIds: string[]) => {
    const currentDates = form.getValues("importantDates") as DateRow[];
    const reordered = orderedIds.map((id) => {
      const idx = dateFields.findIndex((f) => f.id === id);
      return currentDates[idx];
    }).filter(Boolean);
    replaceDates(reordered);
  };

  return (
    <div className="space-y-5">
      {/* FX1.3: an EXISTING exam that has no cycle. The form below still lets the
          editor set the year; this banner offers a one-click create + reload. */}
      {!editionId && examId && (
        <NoCurrentCycle
          examId={examId}
          year={form.getValues("editionYear") || new Date().getFullYear()}
          onCreated={onCycleCreated ?? (() => {})}
          context="Dates & Status"
        />
      )}
      {/* Year & Session — conditional on frequency */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Year" name="editionYear" form={form} type="number" />
        {watchFrequency === "biannual" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cycle / Session</label>
            <select {...form.register("editionSession")} className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm">
              {SESSIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}
        {/* Manual status dropdown REMOVED (2026-09-19): the exam_editions.status column
            is not read by the frontend in any case (its enum can't even hold
            cancelled/postponed, the only values the site would honour), so an editable
            field here only invited edits that do nothing. The column is left in place and
            untouched; the site-authoritative status is the derived panel below. */}
      </div>

      {/* ── What the site shows: DERIVED status ──────────────────────────────
          Read from exam_derived_status (same VIEW the frontend reads). This is
          the authoritative, honest status. The manual field above does not drive
          any public surface. */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Status shown on site
            </span>
            {derivedLoading ? (
              <span className="text-xs text-slate-400">Loading…</span>
            ) : derived ? (
              <span className="text-sm px-2 py-0.5 rounded bg-blue-600 text-white font-semibold">
                {derivedStatusLabel(derived.derivedStatus)}
              </span>
            ) : (
              <span className="text-xs text-slate-400 italic">
                {examId ? "Not published / no dates yet — the site shows no derived status." : "Save the exam first."}
              </span>
            )}
          </div>
          {derived && (
            <span className="text-[11px] text-slate-400">
              Computed live from Important Dates below · updates automatically
            </span>
          )}
        </div>

        {/* Where cancelled/postponed actually comes from. */}
        <p className="mt-2 text-[11px] text-slate-500">
          To mark the exam <strong>cancelled</strong> or <strong>postponed</strong>, set that state on the specific
          date row in Important Dates below — the site reads it from there, not from the Status field.
        </p>
      </div>

      {/* Syllabus PDF for THIS cycle — references the shared library (Option A). */}
      {editionId && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Syllabus PDF (this cycle)</label>
          <SyllabusResourcePicker
            examId={examId}
            editionYear={Number(form.getValues("editionYear")) || null}
            value={syllabusResourceId}
            onChange={onLinkSyllabus}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Notification Date" name="notificationDate" form={form} type="date" />
        <Field label="Vacancy" name="vacancy" form={form} type="number" placeholder="Total seats (leave 0 if N/A)" />
      </div>
      {/* Important Dates — pre-defined rows + custom — DRAGGABLE */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Important Dates</label>
            <p className="text-xs text-slate-400">Leave a date blank if it hasn't been announced yet — blank dates won't appear on the site. Drag to reorder.</p>
          </div>
          <button type="button" onClick={() => appendDate({ label: "", date: "", isUrgent: false })}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Custom Date</button>
        </div>
        <DraggableList
          items={dateFields.map((f, i) => ({ ...f, _idx: i }))}
          onReorder={handleReorder}
          renderItem={(field, { dragHandleProps }) => {
            const i = (field as any)._idx;
            return (
              <div className="bg-slate-50 rounded px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input {...form.register(`importantDates.${i}.label`)} placeholder="Date label"
                    className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm bg-white" />
                  <input {...form.register(`importantDates.${i}.date`)} type="date"
                    className="w-40 rounded border border-slate-200 px-2 py-1.5 text-sm bg-white" />
                  {/* R0.4: state is the field the site reads to determine cancelled / postponed. */}
                  <select {...form.register(`importantDates.${i}.state`)}
                    className="w-28 rounded border border-slate-200 px-2 py-1.5 text-xs bg-white text-slate-700"
                    title="Set this date event's confirmation state. Cancelled or Postponed on a key date changes the status shown on the site.">
                    <option value="">— State —</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="expected">Expected</option>
                    <option value="tba">TBA</option>
                    <option value="postponed">Postponed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                    <input type="checkbox" {...form.register(`importantDates.${i}.isUrgent`)} className="rounded" /> Urgent
                  </label>
                  <button type="button" onClick={() => removeDate(i)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
                {/* C1: optional end date + IST clock times + a free-text time note.
                    Stored as JSONB keys end_date / start_time / end_time / time_text. */}
                <div className="flex flex-wrap items-center gap-2 pl-1 text-xs">
                  <label className="flex items-center gap-1 text-slate-500">
                    to
                    <input {...form.register(`importantDates.${i}.end_date`)} type="date"
                      className="w-36 rounded border border-slate-200 px-1.5 py-1 text-xs bg-white" title="End date (optional) — makes this a range" />
                  </label>
                  <label className="flex items-center gap-1 text-slate-500">
                    from
                    <input {...form.register(`importantDates.${i}.start_time`)} type="time"
                      className="w-28 rounded border border-slate-200 px-1.5 py-1 text-xs bg-white" title="Start time (IST, optional)" />
                  </label>
                  <label className="flex items-center gap-1 text-slate-500">
                    to
                    <input {...form.register(`importantDates.${i}.end_time`)} type="time"
                      className="w-28 rounded border border-slate-200 px-1.5 py-1 text-xs bg-white" title="End time (IST, optional)" />
                  </label>
                  <input {...form.register(`importantDates.${i}.time_text`)}
                    placeholder="or a time note, e.g. afternoon / अपराह्न"
                    className="flex-1 min-w-[160px] rounded border border-slate-200 px-1.5 py-1 text-xs bg-white"
                    title="Free-text timing shown when no clock time is known" />
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

// R0.7 (2026-10-04): the old in-file ModulesTab / STEP_GUIDE_MODULES / ContentModulesTab
// were DEAD — the tabs array (:1015) always renders ModulePanel for modules and never
// imported these three. ~240 lines of never-rendered JSX removed.

// ── News Tab ───────────────────────────────────────────────────────────────

// ── News section tolerant reader (R0.10) ────────────────────────────────────
// The canonical shape is content_modules.news = { items: [...] }.
// Legacy records may store a bare array: content_modules.news = [...].
// Always return an array of items, regardless of which shape is on disk.
function readNewsSection(contentModules: Record<string, unknown>): any[] {
  const raw = contentModules?.news as unknown;
  if (Array.isArray(raw)) return raw;                         // legacy bare array
  if (raw && typeof raw === "object" && Array.isArray((raw as any).items))
    return (raw as any).items;                                // canonical { items }
  return [];                                                   // nothing yet
}

function NewsTab({ editionId, examId, editionYear, onCycleCreated, contentModules, onNewsChange, onDirtyChange }: { editionId: string | null; examId?: string | null; editionYear?: number; onCycleCreated?: () => void | Promise<void>; contentModules: Record<string, unknown>; onNewsChange?: (news: any[] | null) => void; onDirtyChange?: (dirty: boolean) => void }) {
  const [news, setNews] = React.useState<any[]>(() => readNewsSection(contentModules));
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState({ title: "", content: "", excerpt: "", tags: "", isFeatured: false, featureImage: "" });

  // Item 3: mirror the CURRENT news list up to the editor on every change, so the
  // primary Save reads live state (not a stale snapshot). Persistence is the
  // editor's single Save — this tab no longer has its own save button.
  React.useEffect(() => { onNewsChange?.(news); }, [news, onNewsChange]);
  // Post-audit fix: reset the editor's newsRef to null on unmount. Refs outlive
  // remounts, so a ref left populated while THIS tab is unmounted could feed a
  // stale news snapshot into a later Save (e.g. after an AI action rewrote
  // content_modules.news and reloaded while another tab was active), overwriting
  // the fresher server value. null means "not mounted → leave the server's news
  // (from base) untouched", which is the safe merge behaviour.
  React.useEffect(() => () => onNewsChange?.(null), [onNewsChange]);

  // Dirty = saved news list changed from its seed, OR a new-item draft has typed
  // content not yet added. Compared by value (JSON) so type-and-revert clears it.
  const seedRef = React.useRef(JSON.stringify(readNewsSection(contentModules)));
  React.useEffect(() => {
    const listChanged = JSON.stringify(news) !== seedRef.current;
    const draftHasContent = !!(draft.title.trim() || draft.content.trim() || draft.excerpt.trim());
    onDirtyChange?.(listChanged || draftHasContent);
  }, [news, draft, onDirtyChange]);
  // Clear the dirty flag when this tab unmounts so a stale flag can't linger.
  React.useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const addNews = () => {
    if (!draft.title.trim()) return;
    const item = {
      id: crypto.randomUUID(),
      title: draft.title,
      content: draft.content,
      excerpt: draft.excerpt || draft.content.slice(0, 150),
      tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      author: "Editorial Team",
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublished: true,
      isFeatured: draft.isFeatured,
      featureImage: draft.featureImage || null,
    };
    if (editingIdx !== null) {
      const updated = [...news];
      updated[editingIdx] = { ...updated[editingIdx], ...item, id: updated[editingIdx].id };
      setNews(updated);
      setEditingIdx(null);
    } else {
      setNews([item, ...news]);
    }
    setDraft({ title: "", content: "", excerpt: "", tags: "", isFeatured: false, featureImage: "" });
  };

  const editNews = (idx: number) => {
    const item = news[idx];
    setDraft({ title: item.title, content: item.content ?? "", excerpt: item.excerpt ?? "", tags: (item.tags ?? []).join(", "), isFeatured: item.isFeatured ?? false, featureImage: item.featureImage ?? "" });
    setEditingIdx(idx);
  };

  const deleteNews = (idx: number) => {
    if (!confirm(`Delete "${news[idx]?.title}"?`)) return;
    setNews(news.filter((_, i) => i !== idx));
  };

  // FX1.3: an EXISTING exam with no cycle — show the honest empty state, not
  // "Save the exam first". A not-yet-saved exam (no examId) keeps the old copy.
  if (!editionId) {
    if (examId) {
      return <NoCurrentCycle examId={examId} year={editionYear ?? new Date().getFullYear()} onCreated={onCycleCreated ?? (() => {})} context="News" />;
    }
    return <div className="text-center py-8"><p className="text-sm text-slate-400">Save the exam first to add news.</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Exam-specific news and updates. Published news appears on the exam page and global news feed.</p>
        {/* Item 3: no separate "Save News" button — news is persisted by the editor's
            primary Save (top-right), together with everything else, in one write. */}
        <span className="text-[11px] text-slate-400 whitespace-nowrap">Saved with the main <span className="font-medium">Save</span> button (top-right).</span>
      </div>

      {/* Add/Edit news form */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
        <h4 className="text-sm font-semibold text-slate-700">{editingIdx !== null ? "✏️ Edit News" : "➕ Add News"}</h4>
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm" placeholder="News title *" />
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">News Content</label>
          <RichEditor
            content={draft.content}
            onChange={(html) => setDraft({ ...draft, content: html })}
            placeholder="Write news content here..."
            minHeight={200}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Feature Image</label>
          <ImageUploader
            value={draft.featureImage}
            onChange={(url) => setDraft({ ...draft, featureImage: url })}
            folder="media"
            label="Upload Feature Image"
          />
        </div>
        <input value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
          className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm" placeholder="Short excerpt (auto-generated if empty)" />
        <div className="flex items-center gap-4">
          <input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
            className="flex-1 rounded border border-slate-200 px-3 py-1.5 text-sm" placeholder="Tags (comma-separated)" />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
            <input type="checkbox" checked={draft.isFeatured} onChange={(e) => setDraft({ ...draft, isFeatured: e.target.checked })} className="rounded" />
            Featured
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={addNews}
            className="text-xs px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 font-medium">
            {editingIdx !== null ? "Update" : "Publish"}
          </button>
          {editingIdx !== null && (
            <button type="button" onClick={() => { setEditingIdx(null); setDraft({ title: "", content: "", excerpt: "", tags: "", isFeatured: false, featureImage: "" }); }}
              className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100">Cancel</button>
          )}
        </div>
      </div>

      {/* News list */}
      <div className="space-y-2">
        {news.length === 0 && <p className="text-sm text-slate-400 italic text-center py-4">No news yet. Add the first update above.</p>}
        {news.map((item, i) => (
          <div key={item.id ?? i} className="border border-slate-200 rounded-lg p-3 bg-white">
            <div className="flex items-start justify-between gap-2">
              {item.featureImage && (
                <img src={item.featureImage} alt="" className="w-16 h-12 object-cover rounded border border-slate-100 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-slate-800 line-clamp-1">{item.title}</h4>
                  {item.isFeatured && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Featured</span>}
                  {item.isPublished ? (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Published</span>
                  ) : (
                    <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Draft</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.excerpt || item.content?.slice(0, 100)}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(item.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => editNews(i)} className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50">Edit</button>
                <button type="button" onClick={() => deleteNews(i)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// R0.1 (2026-10-04): the "News SEO (Google News & Discover)" block was removed
// from this tab. Its 7 fields wrote content_modules.newsSeo, which has NO reader
// anywhere — not the CMS, not the frontend — so they were a phantom surface.
function SEOTab({ form, faqFields, appendFaq, removeFaq }: { form: any; faqFields: any[]; appendFaq: (v: any) => void; removeFaq: (i: number) => void }) {
  return (
    <div className="space-y-6">
      {/* Standard SEO */}
      <div className="space-y-4">
        <Field label="SEO Title" name="seoTitle" form={form} placeholder="Override page title for search engines" />
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">SEO Description</label>
          <textarea {...form.register("seoDescription")} rows={3} placeholder="Meta description..." className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm" />
        </div>
        <Field label="Tags (comma-separated)" name="tags" form={form} placeholder="cat, mba, management, entrance" />
      </div>

      {/* FAQs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-600">FAQs</label>
          <button type="button" onClick={() => appendFaq({ question: "", answer: "" })}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add FAQ</button>
        </div>
        {faqFields.map((field, i) => (
          <div key={field.id} className="mb-3 border border-slate-100 rounded p-3 space-y-2">
            <input {...form.register(`faqs.${i}.question`)} placeholder="Question" className="w-full rounded border border-slate-200 px-2 py-1 text-sm" />
            <textarea {...form.register(`faqs.${i}.answer`)} placeholder="Answer" rows={2} className="w-full rounded border border-slate-200 px-2 py-1 text-sm" />
            <FaqAnswerWarning control={form.control} name={`faqs.${i}.answer`} />
            <button type="button" onClick={() => removeFaq(i)} className="text-xs text-red-500">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryTab({ editions, onDelete, onPromote, onEdit }: { editions: ExamEdition[]; onDelete: (id: string, label: string) => void; onPromote: (id: string, label: string) => void; onEdit: (edition: ExamEdition) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Manage all editions. You can edit, delete, or promote any edition to make it the active one.</p>
      </div>

      {editions.length === 0 && (
        <div className="text-center py-8">
          <History size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">No editions yet. Click "New Edition" to create one.</p>
        </div>
      )}

      {editions.map((ed) => {
        const isDraft = !ed.isCurrent && ed.status === "upcoming" && !ed.completedAt;
        const isArchived = !ed.isCurrent && !isDraft;

        return (
          <div key={ed.id} className={`rounded-lg border p-4 ${
            ed.isCurrent ? "border-blue-300 bg-blue-50/50" :
            isDraft ? "border-amber-300 bg-amber-50/50" :
            "border-slate-200 bg-white"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-800">{ed.editionLabel}</h4>
                {ed.session !== "main" && <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{ed.session}</span>}
                {ed.isCurrent && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">● Current</span>}
                {isDraft && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">◌ Draft</span>}
                {isArchived && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">Archived</span>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                ed.status === "completed" ? "bg-gray-100 text-gray-600" :
                ed.status === "result-declared" ? "bg-emerald-100 text-emerald-700" :
                ed.status === "upcoming" ? "bg-yellow-100 text-yellow-700" :
                "bg-blue-100 text-blue-700"
              }`}>
                {ed.status.replace(/-/g, " ")}
              </span>
            </div>

            {/* Edition meta */}
            <div className="mt-2 text-xs text-slate-500">
              Year: {ed.year} · Created: {new Date(ed.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              {ed.completedAt && <span> · Completed: {new Date(ed.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
            </div>

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => onEdit(ed)}
                className="text-xs px-3 py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition-colors">
                ✏️ Edit
              </button>
              {!ed.isCurrent && (
                <button type="button" onClick={() => onPromote(ed.id, ed.editionLabel)}
                  className="text-xs px-3 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors border border-blue-200">
                  ⬆️ Make Current
                </button>
              )}
              <button type="button" onClick={() => onDelete(ed.id, ed.editionLabel)}
                className="text-xs px-3 py-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors border border-red-200 ml-auto">
                🗑️ Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── New Edition Dialog ─────────────────────────────────────────────────────

function NewEditionDialog({ onConfirm, onCancel, frequency, busy, defaultYear }: { onConfirm: (year: number, session: CycleSession, editionLabel?: string) => void; onCancel: () => void; frequency: CycleFrequency; busy?: boolean; defaultYear?: number }) {
  // A2: default to the caller-provided year (current year when the exam has no
  // current edition; next cycle year otherwise). Falls back to next calendar year.
  const [year, setYear] = useState(defaultYear ?? new Date().getFullYear() + 1);
  const [session, setSession] = useState<CycleSession>("main");
  const [customLabel, setCustomLabel] = useState("");

  // Auto-suggest label based on session selection
  const suggestedLabel = session === "main" ? String(year)
    : session === "session-1" ? `${year} Session 1`
    : session === "session-2" ? `${year} Session 2`
    : `${year} ${session.charAt(0).toUpperCase() + session.slice(1)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">Start New Edition</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
            <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm" />
          </div>
          {(frequency === "biannual" || frequency === "irregular") && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cycle / Session</label>
              <select value={session} onChange={(e) => setSession(e.target.value as CycleSession)}
                className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm">
                {SESSIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
          {(frequency === "biannual" || frequency === "irregular") && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Edition Label <span className="text-slate-400">(custom name for this cycle)</span>
              </label>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder={suggestedLabel}
                className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">
                Examples: "CTET-Feb", "CTET-Sep", "JEE Main Jan", "JEE Main Apr"
              </p>
            </div>
          )}
        </div>
        <p className="text-xs text-amber-600">⚠️ The current edition will be archived automatically.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={() => onConfirm(
            year,
            (frequency === "biannual" || frequency === "irregular") ? session : "main",
            customLabel.trim() || undefined
          )}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50">{busy ? "Creating…" : "Create Edition"}</button>
        </div>
      </div>
    </div>
  );
}

// ── AI Fill Dialog ─────────────────────────────────────────────────────────

function AIFillDialog({ onGenerate, onCancel }: { onGenerate: (rawContent?: string) => void; onCancel: () => void }) {
  const [rawContent, setRawContent] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-purple-600" />
          <h3 className="font-semibold text-slate-900">Update from a notice</h3>
        </div>

        <p className="text-sm text-slate-600">
          Paste the official notice text below. The AI proposes structured changes — name, category, selection, dates with times, eligibility, fees — each with the exact words it read them from. <strong>Nothing is applied until you review it</strong>, and nothing is saved until you press Save.
        </p>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Official notice text <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            rows={10}
            placeholder={`Paste the notification / press-note text here — Hindi is fine.\n\nExample:\nUP D.El.Ed Phase-3 Counselling 2026\nChoice filling: 05.10.2026 (अपराह्न) से 07.10.2026 सायं 06:00 बजे\nSeat Allotment: 08.10.2026\n...`}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono leading-relaxed focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y"
          />
        </div>

        <div className="bg-purple-50 border border-purple-100 rounded p-3">
          <p className="text-xs text-purple-700">
            <strong>How it works:</strong> the notice is the only source — dates, kinds (choice filling, allotment, lock…), times, fee, eligibility each come back with a verbatim quote and a confidence. Review every change in the drawer, accept what is right, then Apply. PDF/OCR input arrives with S5; paste the text for scanned notices.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded">
            Cancel
          </button>
          <button type="button" onClick={() => onGenerate(rawContent || undefined)} disabled={!rawContent.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded flex items-center gap-1.5 disabled:opacity-50">
            <Sparkles size={14} />
            Read the notice
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reusable Field Component ───────────────────────────────────────────────

function Field({ label, name, form, type = "text", placeholder, disabled }: { label: string; name: string; form: any; type?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type={type} {...form.register(name)} placeholder={placeholder} disabled={disabled}
        className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400" />
    </div>
  );
}
