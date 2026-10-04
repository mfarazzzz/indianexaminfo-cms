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
import { generateExamDataWithAI } from "@/lib/gemini/entranceExamAI";
import { aiFillIdentityTab, aiFillDatesTab, aiFillSEOTab, aiFillNewsTab, aiFillModulesTab } from "@/lib/gemini/tabAI";
import { AIFillButton } from "@/components/shared/AIFillButton";
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
  const [showDelete, setShowDelete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [tabAiFilling, setTabAiFilling] = useState<string | null>(null);
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
          importantDates: data.importantDates.filter((d: any) => d.date && d.date.trim() !== ""),
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
      });

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
        importantDates: data.importantDates.filter((d: any) => d.date && d.date.trim() !== ""),
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
    try {
      const draft = await startNewEdition(exam!.id, { year, session, editionLabel });
      toast.success(`New edition ${editionLabel || year} created as draft. Save to activate it.`);
      setDraftEdition(draft);
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

  const handleAIGenerate = async (rawContent?: string) => {
    const examName = form.getValues("name");
    const year = form.getValues("editionYear") || new Date().getFullYear();
    if (!examName) {
      toast.error("Enter the exam name first, then generate.");
      return;
    }

    // No key and no model here: the ai-fill Edge Function picks the provider
    // server-side, so the browser never holds or reads a credential.
    setAiGenerating(true);
    setShowAIDialog(false);
    try {
      const data = await generateExamDataWithAI(examName, year, rawContent);

      // No-op on empty — computed BEFORE any write. This is the "Fill Entire Exam"
      // header button: the one that once overwrote a real Notification Date and
      // reported "0 dates extracted" as success. If the AI returned nothing usable,
      // change NOTHING — no form.setValue, no updateEdition/updateExamIdentity — and
      // report it honestly. The module boolean flags (hasNotification etc.) are only
      // written on the success path below, so an empty result can't flip real flags
      // to false. `extractedDates` is reused by the success toast.
      const extractedDates = data.importantDates.filter((d) => d.date && d.date.trim() !== "").length;
      const gotAnything =
        extractedDates > 0 ||
        !!data.shortName || !!data.conductingBody || !!data.officialWebsite ||
        !!data.seoTitle || !!data.seoDescription ||
        (data.tags?.length ?? 0) > 0 || (data.faqs?.length ?? 0) > 0 ||
        (data.vacancy != null && data.vacancy !== 0) ||
        (data.contentModules && Object.keys(data.contentModules).length > 0);
      if (!gotAnything) {
        toast.warning("AI found nothing to fill — no changes were made.");
        return;
      }

      // ── EMPTY-ONLY FILL ──────────────────────────────────────────────────
      // AI must NEVER replace a value that already exists. The AI can hallucinate
      // (it returned Short Name "CAT" on a Bihar Board record from junk input) and
      // a non-empty hallucination previously passed the "gotAnything" gate and
      // overwrote a correct value. Until a per-field preview/approve diff exists,
      // the safety floor is: only fill fields that are currently blank. Existing
      // values are left untouched. `filled` collects only the fields we actually
      // wrote, so the DB auto-save below persists EXACTLY those — never echoing an
      // AI value back over a field we chose not to touch.
      const cur = form.getValues();
      const filledIdentity: Record<string, unknown> = {};
      const filledEdition: Record<string, unknown> = {};

      // Identity scalars — fill only when blank.
      if (data.shortName && isBlank(cur.shortName)) { form.setValue("shortName", data.shortName); filledIdentity.shortName = data.shortName; }
      if (data.conductingBody && isBlank(cur.conductingBody)) { form.setValue("conductingBody", data.conductingBody); filledIdentity.conductingBody = data.conductingBody; }
      if (data.officialWebsite && isBlank(cur.officialWebsite)) { form.setValue("officialWebsite", data.officialWebsite); filledIdentity.officialWebsite = data.officialWebsite; }

      // Important dates — fill ONLY existing blank rows or append genuinely new
      // labels. Never overwrite a row that already has a date (that was the
      // original clobber path). Only append/fill; if nothing changed, don't touch.
      let mergedDates: DateRow[] | null = null;
      if (data.importantDates.length > 0) {
        const currentDates = form.getValues("importantDates") as DateRow[];
        const merged = [...currentDates];
        let changed = false;
        for (const aiDate of data.importantDates) {
          if (!aiDate.date || !aiDate.label) continue;
          const matchIdx = merged.findIndex((d) =>
            d.label.toLowerCase().replace(/[^a-z]/g, "").includes(aiDate.label.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)) ||
            aiDate.label.toLowerCase().replace(/[^a-z]/g, "").includes(d.label.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8))
          );
          if (matchIdx >= 0 && isBlank(merged[matchIdx].date)) {
            // Fill an existing BLANK row only.
            merged[matchIdx] = { ...merged[matchIdx], date: aiDate.date, isUrgent: aiDate.isUrgent };
            changed = true;
          } else if (matchIdx < 0) {
            // No matching row — append as a new custom date.
            merged.push({ label: aiDate.label, date: aiDate.date, isUrgent: aiDate.isUrgent });
            changed = true;
          }
          // matchIdx >= 0 with an existing date → LEAVE IT. Never overwrite.
        }
        if (changed) { replaceDates(merged); mergedDates = merged; }
      }

      // Edition scalars — fill only when blank.
      if (data.vacancy != null && data.vacancy !== 0 && isBlank(cur.vacancy)) { form.setValue("vacancy", String(data.vacancy)); filledEdition.vacancy = data.vacancy; }
      // editionStatus always has a value (defaults to "upcoming"); treat the
      // default as fillable so AI can advance a brand-new record, but don't
      // clobber a status the user has already moved off the default.
      if (data.status && cur.editionStatus === "upcoming" && data.status !== "upcoming") {
        form.setValue("editionStatus", data.status as EditionStatus);
        filledEdition.status = data.status;
      }

      // Module boolean flags — only flip a flag from false→true (enabling a
      // section AI found evidence for). Never flip true→false: that would hide a
      // section the user turned on. Each flag written independently.
      const flagKeys = ["hasNotification","hasApplication","hasAdmitCard","hasSyllabus","hasAnswerKey","hasResult","hasCutoff","hasCounselling"] as const;
      for (const k of flagKeys) {
        if (data[k] === true && cur[k] !== true) {
          form.setValue(k, true);
          filledEdition[k] = true;
        }
      }

      // R0.6: eligibility and application fee — fill only when the form holds no value.
      // Populated from Stage-1 structured extraction; carried in form state for the
      // R0.5 single-save (new records) and written by the existing-record save path.
      if (data.eligibility && Object.keys(data.eligibility).length > 0) {
        const curElig = cur.eligibility;
        if (!curElig || Object.keys(curElig).length === 0) {
          form.setValue("eligibility", data.eligibility);
          filledEdition.eligibility = data.eligibility;
        }
      }
      if (data.applicationFee && Object.keys(data.applicationFee).length > 0) {
        const curFee = cur.applicationFee;
        if (!curFee || Object.keys(curFee).length === 0) {
          form.setValue("applicationFee", data.applicationFee);
          filledEdition.applicationFee = data.applicationFee;
        }
      }

      // SEO — fill only when blank.
      if (data.seoTitle && isBlank(cur.seoTitle)) { form.setValue("seoTitle", data.seoTitle); filledIdentity.seoTitle = data.seoTitle; }
      if (data.seoDescription && isBlank(cur.seoDescription)) { form.setValue("seoDescription", data.seoDescription); filledIdentity.seoDescription = data.seoDescription; }
      if (data.tags.length > 0 && isBlank(cur.tags)) { form.setValue("tags", data.tags.join(", ")); filledIdentity.tags = data.tags; }
      if (data.faqs.length > 0 && (cur.faqs?.length ?? 0) === 0) { replaceFaqs(data.faqs); filledIdentity.faqs = data.faqs; }

      // Content modules — merge onto existing (fills gaps, existing keys win via
      // spread order: AI first then existing so existing values are preserved).
      // R0.5: on a NEW record (no currentEdition), store in pendingModulesRef so
      // handleSave's single-save persists them after create.
      let modulesToSave: Record<string, unknown> | null = null;
      if (data.contentModules && Object.keys(data.contentModules).length > 0) {
        if (currentEdition) {
          const existing = (currentEdition.contentModules ?? {}) as Record<string, unknown>;
          modulesToSave = { ...data.contentModules, ...existing };
        } else {
          // New record — defer the write to handleSave.
          pendingModulesRef.current = { ...data.contentModules };
          modulesToSave = pendingModulesRef.current;
        }
      }

      // R1.6: AI Fill is FORM-ONLY. No direct DB writes. The editor saves.
      // Content modules go to pendingModulesRef (both new and existing records).
      if (modulesToSave && !pendingModulesRef.current) {
        pendingModulesRef.current = modulesToSave;
      }

      // Honest report: how many blank fields we actually filled, and whether we
      // skipped fields because they already had values.
      const filledCount =
        Object.keys(filledIdentity).length +
        Object.keys(filledEdition).length +
        (mergedDates ? 1 : 0) +
        (modulesToSave ? 1 : 0);
      if (filledCount === 0) {
        toast.warning("AI returned data, but every matching field already had a value — nothing was overwritten.");
      } else {
        toast.success(`AI filled ${filledCount} empty field${filledCount === 1 ? "" : "s"}. Existing values were left untouched.`);
      }
    } catch (err) {
      toast.error("AI generation failed: " + getErrorMessage(err));
    } finally {
      setAiGenerating(false);
    }
  };

  // ── Tab-Level AI Handlers ─────────────────────────────────────────────────
  //
  // These used to read the provider key out of `settings` and pass it down. The
  // key now lives only as an Edge Function secret, so nothing is read here.

  const handleAIFillIdentity = async (rawContent: string) => {
    const examName = form.getValues("name");
    if (!examName) { toast.error("Enter exam name first."); return; }
    setTabAiFilling("identity");
    try {
      const data = await aiFillIdentityTab(examName, rawContent);
      // No-op on empty: if the AI extracted nothing usable, change NOTHING and say so.
      const gotAnything = !!data.shortName || !!data.conductingBody || !!data.officialWebsite;
      if (!gotAnything) {
        toast.warning("AI extracted nothing for Identity — no changes made.");
        return;
      }
      // EMPTY-ONLY FILL: only populate blank fields. The AI can hallucinate a
      // plausible-but-wrong value (e.g. Short Name "CAT" on a Bihar Board record),
      // so it must never replace a value that already exists. `filled` carries only
      // the blanks we actually wrote, so the DB save can't echo an AI value over an
      // existing one.
      const cur = form.getValues();
      const filled: Record<string, unknown> = {};
      if (data.shortName && isBlank(cur.shortName)) { form.setValue("shortName", data.shortName, { shouldDirty: true }); filled.shortName = data.shortName; }
      if (data.conductingBody && isBlank(cur.conductingBody)) { form.setValue("conductingBody", data.conductingBody, { shouldDirty: true }); filled.conductingBody = data.conductingBody; }
      if (data.officialWebsite && isBlank(cur.officialWebsite)) { form.setValue("officialWebsite", data.officialWebsite, { shouldDirty: true }); filled.officialWebsite = data.officialWebsite; }
      if (Object.keys(filled).length === 0) {
        toast.warning("AI returned data, but Identity fields already had values — nothing was overwritten.");
        return;
      }
      // R1.6: form-only. No DB write. Editor saves.
      toast.success(`Identity: filled ${Object.keys(filled).length} empty field${Object.keys(filled).length === 1 ? "" : "s"}. Existing values untouched.`, );
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setTabAiFilling(null); }
  };

  const handleAIFillDates = async (rawContent: string) => {
    const examName = form.getValues("name");
    const year = form.getValues("editionYear") || new Date().getFullYear();
    if (!examName) { toast.error("Enter exam name first."); return; }
    setTabAiFilling("edition");
    try {
      const data = await aiFillDatesTab(examName, year, rawContent);

      // No-op on empty: only count a field as extracted when it carries a real value.
      // Historically this handler always toasted "filled and saved" and unconditionally
      // wrote status/vacancy/notificationDate — so an empty AI result reported success
      // while overwriting a real Notification Date. Change NOTHING when nothing was found.
      const extractedDates = data.importantDates.filter((d) => d.date && d.date.trim() !== "" && d.label).length;
      const gotStatus  = !!data.status;
      const gotVacancy = data.vacancy != null && data.vacancy !== 0;
      const gotNotif   = !!data.notificationDate && data.notificationDate.trim() !== "";
      if (extractedDates === 0 && !gotStatus && !gotVacancy && !gotNotif) {
        toast.warning("AI extracted no dates or status — no changes made.");
        return;
      }

      // EMPTY-ONLY FILL. Dates: fill BLANK rows or append new labels only — never
      // overwrite a row that already carries a date. Scalars (status/vacancy/
      // notificationDate): fill only when currently blank. This is what stops AI
      // from clobbering a correct Notification Date.
      const cur = form.getValues();
      let merged: DateRow[] | null = null;
      if (extractedDates > 0) {
        const current = form.getValues("importantDates") as DateRow[];
        const next = [...current];
        let changed = false;
        for (const ai of data.importantDates) {
          if (!ai.date || !ai.label) continue;
          const idx = next.findIndex((d) => d.label.toLowerCase().replace(/[^a-z]/g, "").includes(ai.label.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)));
          if (idx >= 0 && isBlank(next[idx].date)) { next[idx] = { ...next[idx], date: ai.date, isUrgent: ai.isUrgent }; changed = true; }
          else if (idx < 0) { next.push(ai); changed = true; }
          // idx >= 0 with an existing date → LEAVE IT.
        }
        if (changed) { replaceDates(next); merged = next; }
      }

      const setStatus  = gotStatus && cur.editionStatus === "upcoming" && data.status !== "upcoming";
      const setVacancy = gotVacancy && isBlank(cur.vacancy);
      const setNotif   = gotNotif && isBlank(cur.notificationDate);
      if (setStatus)  form.setValue("editionStatus", data.status as EditionStatus, { shouldDirty: true });
      if (setVacancy) form.setValue("vacancy", String(data.vacancy), { shouldDirty: true });
      if (setNotif)   form.setValue("notificationDate", data.notificationDate, { shouldDirty: true });

      const filledScalars = (setStatus ? 1 : 0) + (setVacancy ? 1 : 0) + (setNotif ? 1 : 0);
      if (!merged && filledScalars === 0) {
        toast.warning("AI returned data, but Dates & Status fields already had values — nothing was overwritten.");
        return;
      }

      // R1.6: form-only. No DB write. Editor saves.
      const addedDates = merged ? "dates updated" : "no date changes";
      toast.success(`Dates & Status: ${addedDates}, ${filledScalars} empty field${filledScalars === 1 ? "" : "s"} filled. Existing values untouched.`);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setTabAiFilling(null); }
  };

  const handleAIFillSEO = async (rawContent: string) => {
    const examName = form.getValues("name");
    const year = form.getValues("editionYear") || new Date().getFullYear();
    if (!examName) { toast.error("Enter exam name first."); return; }
    setTabAiFilling("seo");
    try {
      const data = await aiFillSEOTab(examName, year, rawContent);
      // No-op on empty: change nothing (no form.setValue, no DB write) when the AI
      // returned nothing usable, and report it honestly instead of a false success.
      const gotAnything = !!data.seoTitle || !!data.seoDescription || data.tags.length > 0 || data.faqs.length > 0;
      if (!gotAnything) {
        toast.warning("AI extracted nothing for SEO — no changes made.");
        return;
      }
      // EMPTY-ONLY FILL: only populate blank SEO fields; never replace existing.
      const cur = form.getValues();
      const filled: Record<string, unknown> = {};
      if (data.seoTitle && isBlank(cur.seoTitle)) { form.setValue("seoTitle", data.seoTitle, { shouldDirty: true }); filled.seoTitle = data.seoTitle; }
      if (data.seoDescription && isBlank(cur.seoDescription)) { form.setValue("seoDescription", data.seoDescription, { shouldDirty: true }); filled.seoDescription = data.seoDescription; }
      if (data.tags.length > 0 && isBlank(cur.tags)) { form.setValue("tags", data.tags.join(", "), { shouldDirty: true }); filled.tags = data.tags; }
      if (data.faqs.length > 0 && (cur.faqs?.length ?? 0) === 0) { replaceFaqs(data.faqs); filled.faqs = data.faqs; }
      if (Object.keys(filled).length === 0) {
        toast.warning("AI returned data, but SEO fields already had values — nothing was overwritten.");
        return;
      }
      // R1.6: form-only. No DB write. Editor saves.
      toast.success(`SEO: filled ${Object.keys(filled).length} empty field${Object.keys(filled).length === 1 ? "" : "s"}. Existing values untouched.`);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setTabAiFilling(null); }
  };

  const handleAIFillNews = async (rawContent: string) => {
    if (!currentEdition) { toast.error("Save the exam first to generate news."); return; }
    const examName = form.getValues("name");
    const year = form.getValues("editionYear") || new Date().getFullYear();
    setTabAiFilling("news");
    try {
      const items = await aiFillNewsTab(examName, year, rawContent);
      if (items.length > 0) {
        const newsItems = items.map((item) => ({
          id: crypto.randomUUID(),
          title: item.title,
          content: item.content,
          excerpt: item.excerpt,
          tags: item.tags,
          isFeatured: item.isFeatured,
          author: "AI Generated",
          publishedAt: new Date().toISOString(),
          isPublished: true,
        }));
        // R1.6: form-only — append to newsRef, editor saves.
        const currentNews = newsRef.current ?? [];
        newsRef.current = [...currentNews, ...newsItems];
        toast.success(`AI added ${items.length} news item${items.length === 1 ? "" : "s"}. Review in News tab, then Save.`);
      } else {
        toast.warning("AI generated no news items — no changes made.");
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setTabAiFilling(null); }
  };

  const handleAIFillModules = async (rawContent: string) => {
    if (!currentEdition) { toast.error("Save the exam first to generate modules."); return; }
    const examName = form.getValues("name");
    const year = form.getValues("editionYear") || new Date().getFullYear();
    setTabAiFilling("modules");
    try {
      const data = await aiFillModulesTab(examName, year, rawContent);
      if (Object.keys(data.contentModules).length > 0) {
        // R1.6: form-only — store in pendingModulesRef, editor saves.
        const existing = (currentEdition?.contentModules ?? {}) as Record<string, unknown>;
        const filledKeys = Object.keys(data.contentModules).filter((k) => !(k in existing));
        const mergedContent = { ...data.contentModules, ...existing } as Record<string, unknown>;
        const prevConfig = (existing._config as ModuleConfig | undefined) ?? { moduleOrder: [], enabledModules: [] };
        const aiEnabled = Array.isArray(data.enabledModules) ? data.enabledModules : [];
        const slugsToEnable = filledKeys.filter((k) => aiEnabled.includes(k));
        const nextEnabled = Array.from(new Set([...(prevConfig.enabledModules ?? []), ...slugsToEnable]));
        const nextOrder = Array.from(new Set([...(prevConfig.moduleOrder ?? []), ...filledKeys]));
        mergedContent._config = { ...prevConfig, enabledModules: nextEnabled, moduleOrder: nextOrder };
        pendingModulesRef.current = mergedContent;
        if (filledKeys.length === 0) {
          toast.warning("AI returned module content, but those modules already exist — nothing was overwritten.");
        } else {
          const newlyEnabledCount = slugsToEnable.filter((s) => !(prevConfig.enabledModules ?? []).includes(s)).length;
          toast.success(`AI filled ${filledKeys.length} empty module${filledKeys.length === 1 ? "" : "s"}${newlyEnabledCount > 0 ? `, ${newlyEnabledCount} will be visible` : ""}. Save to persist.`);
        }
      } else {
        toast.warning("AI extracted no module content — no changes made.");
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setTabAiFilling(null); }
  };

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
                title="Generates content for the WHOLE exam (identity, dates, SEO, modules) in one pass. Per-tab AI buttons fill only that tab."
                className="flex items-center gap-1.5 rounded border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50">
                {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiGenerating ? "Filling entire exam..." : "🤖 AI: Fill Entire Exam"}
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
              title="Generates content for the WHOLE exam (identity, dates, SEO, modules) in one pass. Per-tab AI buttons fill only that tab."
              className="flex items-center gap-1.5 rounded border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50">
              {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {aiGenerating ? "Filling entire exam..." : "🤖 AI: Fill Entire Exam"}
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
        {/* Tab-level AI Fill bar */}
        {!isNew && activeTab !== "editions" && (
          <div className="flex items-center justify-end mb-4 pb-3 border-b border-slate-100">
            {activeTab === "identity" && <AIFillButton variant="icon" scope="Identity Tab" loading={tabAiFilling === "identity"} onFill={handleAIFillIdentity} />}
            {activeTab === "edition" && <AIFillButton variant="icon" scope="Dates & Status Tab" loading={tabAiFilling === "edition"} onFill={handleAIFillDates} />}
            {activeTab === "modules" && <AIFillButton variant="icon" scope="All Modules" loading={tabAiFilling === "modules"} onFill={handleAIFillModules} />}
            {activeTab === "news" && <AIFillButton variant="icon" scope="News Tab" loading={tabAiFilling === "news"} onFill={handleAIFillNews} />}
            {activeTab === "seo" && <AIFillButton variant="icon" scope="SEO Tab" loading={tabAiFilling === "seo"} onFill={handleAIFillSEO} />}
          </div>
        )}

        {activeTab === "identity" && <IdentityTab form={form} categories={categories} regions={regions} watchFrequency={watchFrequency} watchedSelectionModel={watchedSelectionModel} isNew={isNew} pillar={pillarFromUrl} />}
        {activeTab === "resources" && <ResourcesTab examId={exam?.id ?? null} />}
        {activeTab === "syllabus" && <SyllabusTab examId={exam?.id ?? null} />}
        {activeTab === "edition" && <EditionTab form={form} dateFields={dateFields} appendDate={appendDate} removeDate={removeDate} replaceDates={replaceDates} watchFrequency={watchFrequency}
          examId={exam?.id ?? null}
          editionId={currentEdition?.id ?? null}
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
        {activeTab === "modules" && <ModulePanel editionId={currentEdition?.id ?? null} exam={exam} edition={currentEdition} onNavigateTab={setActiveTab} onDirtyChange={setModuleDirty} entityType={watchedEntityType} selectionModel={watchedSelectionModel} legacyFlags={{ hasNotification: form.getValues("hasNotification"), hasApplication: form.getValues("hasApplication"), hasAdmitCard: form.getValues("hasAdmitCard"), hasSyllabus: form.getValues("hasSyllabus"), hasAnswerKey: form.getValues("hasAnswerKey"), hasResult: form.getValues("hasResult"), hasCutoff: form.getValues("hasCutoff"), hasCounselling: form.getValues("hasCounselling") }} />}
        {activeTab === "news" && <NewsTab editionId={currentEdition?.id ?? null} contentModules={currentEdition?.contentModules ?? {}} onDirtyChange={setNewsDirty} onNewsChange={(n) => { newsRef.current = n; }} />}
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
      {showNewEdition && <NewEditionDialog onConfirm={handleStartNewEdition} onCancel={() => setShowNewEdition(false)} frequency={watchFrequency} />}

      {/* AI Generate Dialog */}
      {showAIDialog && <AIFillDialog onGenerate={handleAIGenerate} onCancel={() => setShowAIDialog(false)} examName={form.getValues("name")} />}

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
  state?: string;
  verified?: boolean;
  stage_label?: string;
  [key: string]: unknown;
};

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

function EditionTab({ form, dateFields, appendDate, removeDate, replaceDates, watchFrequency, examId, editionId, syllabusResourceId, onLinkSyllabus }: { form: any; dateFields: any[]; appendDate: (v: any) => void; removeDate: (i: number) => void; replaceDates: (v: any[]) => void; watchFrequency: CycleFrequency; examId: string | null; editionId: string | null; syllabusResourceId: string | null; onLinkSyllabus: (resourceId: string | null) => void }) {
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
              <div className="flex items-center gap-2 bg-slate-50 rounded px-3 py-2">
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

function NewsTab({ editionId, contentModules, onNewsChange, onDirtyChange }: { editionId: string | null; contentModules: Record<string, unknown>; onNewsChange?: (news: any[] | null) => void; onDirtyChange?: (dirty: boolean) => void }) {
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

function NewEditionDialog({ onConfirm, onCancel, frequency }: { onConfirm: (year: number, session: CycleSession, editionLabel?: string) => void; onCancel: () => void; frequency: CycleFrequency }) {
  const [year, setYear] = useState(new Date().getFullYear() + 1);
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
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded">Cancel</button>
          <button type="button" onClick={() => onConfirm(
            year,
            (frequency === "biannual" || frequency === "irregular") ? session : "main",
            customLabel.trim() || undefined
          )}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded">Create Edition</button>
        </div>
      </div>
    </div>
  );
}

// ── AI Fill Dialog ─────────────────────────────────────────────────────────

function AIFillDialog({ onGenerate, onCancel, examName }: { onGenerate: (rawContent?: string) => void; onCancel: () => void; examName: string }) {
  const [rawContent, setRawContent] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-purple-600" />
          <h3 className="font-semibold text-slate-900">AI Generate All Fields</h3>
        </div>

        <p className="text-sm text-slate-600">
          Paste any raw data below — official notification text, website content, PDF text, dates, or any unstructured information about <strong>{examName || "this exam"}</strong>. The AI will extract and fill all fields automatically.
        </p>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Raw Data / Content <span className="text-slate-400">(optional — leave empty to auto-generate from exam name)</span>
          </label>
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            rows={10}
            placeholder={`Paste notification text, official dates, eligibility details, or any raw content here...\n\nExample:\nCAT 2026 Notification Released\nRegistration: 1 Aug - 15 Sep 2026\nExam Date: 29 Nov 2026\nEligibility: Graduate with 50% marks\nFee: ₹2400 (General), ₹1200 (SC/ST)\nConducting Body: IIM Bangalore\n...`}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono leading-relaxed focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y"
          />
        </div>

        <div className="bg-purple-50 border border-purple-100 rounded p-3">
          <p className="text-xs text-purple-700">
            <strong>What AI will generate:</strong> Important dates, status, eligibility, fees, vacancy, module flags, SEO title &amp; description, tags, and FAQs. The AI fills blank fields only — it never overwrites a value you already set.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded">
            Cancel
          </button>
          <button type="button" onClick={() => onGenerate(rawContent || undefined)}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded flex items-center gap-1.5">
            <Sparkles size={14} />
            Generate All Fields
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
