import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2, History, Sparkles, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { useForm, useFieldArray } from "react-hook-form";
import {
  getEntranceExam, updateExamIdentity, updateEdition, startNewEdition,
  createEntranceExam, completeEdition, activateEdition, deleteEdition, promoteEdition,
  type ExamEdition, type ExamIdentity, type EditionStatus, type CycleFrequency, type CycleSession,
} from "@/services/entranceExamService";
import { getCategories, type Category } from "@/services/categoryService";
import { deleteExam, publishExam, unpublishExam } from "@/services/examService";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RichEditor } from "@/components/shared/RichEditor";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { ModulePanel } from "@/components/content-modules/ModulePanel";
import { getErrorMessage } from "@/lib/utils";
import { generateExamDataWithAI } from "@/lib/gemini/entranceExamAI";
import { useSettings } from "@/hooks/useSettings";

const EDITION_STATUSES: { value: EditionStatus; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "notification-released", label: "Notification Released" },
  { value: "registration-open", label: "Registration Open" },
  { value: "registration-closed", label: "Registration Closed" },
  { value: "admit-card-released", label: "Admit Card Released" },
  { value: "exam-conducted", label: "Exam Conducted" },
  { value: "answer-key-released", label: "Answer Key Released" },
  { value: "result-declared", label: "Result Declared" },
  { value: "counselling", label: "Counselling" },
  { value: "completed", label: "Completed" },
];

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
  categoryId: string;
  subcategoryId: string;
  conductingBody: string;
  officialWebsite: string;
  cycleFrequency: CycleFrequency;
  isFeatured: boolean;
  // Edition
  editionYear: number;
  editionSession: CycleSession;
  editionStatus: EditionStatus;
  notificationDate: string;
  vacancy: string;
  // Dates
  importantDates: { label: string; date: string; isUrgent: boolean }[];
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

export function EntranceExamEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [exam, setExam] = useState<ExamIdentity | null>(null);
  const [currentEdition, setCurrentEdition] = useState<ExamEdition | null>(null);
  const [draftEdition, setDraftEdition] = useState<ExamEdition | null>(null);
  const [editions, setEditions] = useState<ExamEdition[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<string>("identity");
  const [showNewEdition, setShowNewEdition] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const { getSetting } = useSettings();

  const form = useForm<FormData>({
    defaultValues: {
      name: "", shortName: "", slug: "", categoryId: "", subcategoryId: "",
      conductingBody: "", officialWebsite: "", cycleFrequency: "annual",
      isFeatured: false, editionYear: new Date().getFullYear(), editionSession: "main",
      editionStatus: "upcoming", notificationDate: "", vacancy: "",
      importantDates: [], hasNotification: false, hasApplication: false,
      hasAdmitCard: false, hasSyllabus: false, hasAnswerKey: false,
      hasResult: false, hasCutoff: false, hasCounselling: false,
      seoTitle: "", seoDescription: "", tags: "", faqs: [],
    },
  });

  const { fields: dateFields, append: appendDate, remove: removeDate, replace: replaceDates } = useFieldArray({ control: form.control, name: "importantDates" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq, replace: replaceFaqs } = useFieldArray({ control: form.control, name: "faqs" });

  const watchFrequency = form.watch("cycleFrequency");

  useEffect(() => {
    getCategories("entrance-exam").then(setCategories).catch(() => {});
  }, []);

  const loadExam = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const data = await getEntranceExam(id);
      setExam(data.exam);
      setIsPublished(data.exam.isPublished);
      setCurrentEdition(data.currentEdition);
      setEditions(data.editions);
      // Populate form with exam identity
      form.reset({
        name: data.exam.name,
        shortName: data.exam.shortName,
        slug: data.exam.slug,
        categoryId: data.exam.categoryId ?? "",
        subcategoryId: data.exam.subcategoryId ?? "",
        conductingBody: data.exam.conductingBody,
        officialWebsite: data.exam.officialWebsite,
        cycleFrequency: data.exam.cycleFrequency,
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
      navigate("/entrance-exams");
    } finally {
      setLoading(false);
    }
  }, [id, isNew, form, navigate]);

  useEffect(() => { loadExam(); }, [loadExam]);

  const handleSave = async (data: FormData) => {
    setSaving(true);
    try {
      if (isNew) {
        // Create new exam + first edition
        const result = await createEntranceExam({
          name: data.name,
          shortName: data.shortName,
          slug: data.slug || undefined,
          categoryId: data.categoryId,
          conductingBody: data.conductingBody,
          officialWebsite: data.officialWebsite,
          cycleFrequency: data.cycleFrequency,
          firstEditionYear: data.editionYear,
        });
        toast.success(`"${data.name}" created.`);
        navigate(`/entrance-exams/${result.exam.id}`, { replace: true });
        return;
      }

      // Update existing exam — split between identity and edition
      await updateExamIdentity(exam!.id, {
        name: data.name,
        shortName: data.shortName,
        slug: data.slug,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId || null,
        conductingBody: data.conductingBody,
        officialWebsite: data.officialWebsite,
        cycleFrequency: data.cycleFrequency,
        isFeatured: data.isFeatured,
        seoTitle: data.seoTitle || undefined,
        seoDescription: data.seoDescription || undefined,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        faqs: data.faqs,
      });

      // Update current edition (if one exists)
      if (currentEdition) {
        await updateEdition(currentEdition.id, {
          status: data.editionStatus,
          notificationDate: data.notificationDate || null,
          vacancy: data.vacancy ? parseInt(data.vacancy) : null,
          importantDates: data.importantDates.filter((d: any) => d.date && d.date.trim() !== ""),
          hasNotification: data.hasNotification,
          hasApplication: data.hasApplication,
          hasAdmitCard: data.hasAdmitCard,
          hasSyllabus: data.hasSyllabus,
          hasAnswerKey: data.hasAnswerKey,
          hasResult: data.hasResult,
          hasCutoff: data.hasCutoff,
          hasCounselling: data.hasCounselling,
          faqs: data.faqs.filter((f: any) => f.question && f.question.trim() !== ""),
        });
      }

      // If there's a draft edition pending, save it and activate it (archives old one)
      if (draftEdition) {
        await updateEdition(draftEdition.id, {
          status: data.editionStatus,
          notificationDate: data.notificationDate || null,
          vacancy: data.vacancy ? parseInt(data.vacancy) : null,
          importantDates: data.importantDates.filter((d: any) => d.date && d.date.trim() !== ""),
          hasNotification: data.hasNotification,
          hasApplication: data.hasApplication,
          hasAdmitCard: data.hasAdmitCard,
          hasSyllabus: data.hasSyllabus,
          hasAnswerKey: data.hasAnswerKey,
          hasResult: data.hasResult,
          hasCutoff: data.hasCutoff,
          hasCounselling: data.hasCounselling,
          faqs: data.faqs.filter((f: any) => f.question && f.question.trim() !== ""),
        });
        await activateEdition(draftEdition.id);
        setDraftEdition(null);
        toast.success("New edition activated. Previous edition archived.");
      } else {
        toast.success("Saved successfully.");
      }
      await loadExam();
    } catch (err) {
      toast.error("Save failed: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleStartNewEdition = async (year: number, session: CycleSession) => {
    try {
      const draft = await startNewEdition(exam!.id, { year, session });
      toast.success(`New edition ${year} created as draft. Save to activate it.`);
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
      navigate("/entrance-exams");
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

    const apiKey = getSetting("gemini_api_key", "");
    const model = getSetting("gemini_model", "");
    if (!apiKey) {
      toast.error("No AI API key configured. Go to Settings → AI.");
      return;
    }

    setAiGenerating(true);
    setShowAIDialog(false);
    try {
      const data = await generateExamDataWithAI(examName, year, apiKey as string, model as string || undefined, rawContent);

      // Fill identity fields
      if (data.shortName) form.setValue("shortName", data.shortName);
      if (data.conductingBody) form.setValue("conductingBody", data.conductingBody);
      if (data.officialWebsite) form.setValue("officialWebsite", data.officialWebsite);

      // Fill edition fields — merge AI dates into existing standard date rows
      if (data.importantDates.length > 0) {
        // Get current form dates (the standard pre-defined rows)
        const currentDates = form.getValues("importantDates") as { label: string; date: string; isUrgent: boolean }[];

        // Merge: for each AI date, try to match an existing row by similar label, else append
        const merged = [...currentDates];
        for (const aiDate of data.importantDates) {
          if (!aiDate.date || !aiDate.label) continue;
          // Find matching existing row by loose label matching
          const matchIdx = merged.findIndex((d) =>
            d.label.toLowerCase().replace(/[^a-z]/g, "").includes(aiDate.label.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)) ||
            aiDate.label.toLowerCase().replace(/[^a-z]/g, "").includes(d.label.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8))
          );
          if (matchIdx >= 0 && !merged[matchIdx].date) {
            // Fill the existing blank row
            merged[matchIdx] = { ...merged[matchIdx], date: aiDate.date, isUrgent: aiDate.isUrgent };
          } else if (matchIdx >= 0 && merged[matchIdx].date) {
            // Row already has a date — update it
            merged[matchIdx] = { ...merged[matchIdx], date: aiDate.date, isUrgent: aiDate.isUrgent };
          } else {
            // No match found — append as a new custom date
            merged.push({ label: aiDate.label, date: aiDate.date, isUrgent: aiDate.isUrgent });
          }
        }
        replaceDates(merged);
      }
      if (data.vacancy) form.setValue("vacancy", String(data.vacancy));
      form.setValue("editionStatus", data.status as EditionStatus);

      // Fill modules
      form.setValue("hasNotification", data.hasNotification);
      form.setValue("hasApplication", data.hasApplication);
      form.setValue("hasAdmitCard", data.hasAdmitCard);
      form.setValue("hasSyllabus", data.hasSyllabus);
      form.setValue("hasAnswerKey", data.hasAnswerKey);
      form.setValue("hasResult", data.hasResult);
      form.setValue("hasCutoff", data.hasCutoff);
      form.setValue("hasCounselling", data.hasCounselling);

      // Fill SEO
      if (data.seoTitle) form.setValue("seoTitle", data.seoTitle);
      if (data.seoDescription) form.setValue("seoDescription", data.seoDescription);
      if (data.tags.length > 0) form.setValue("tags", data.tags.join(", "));
      if (data.faqs.length > 0) replaceFaqs(data.faqs);

      // Save content modules directly to the edition if it exists
      if (currentEdition && data.contentModules && Object.keys(data.contentModules).length > 0) {
        try {
          const { updateEdition: updateEd } = await import("@/services/entranceExamService");
          await updateEd(currentEdition.id, { contentModules: data.contentModules });
        } catch {} // non-critical — will be saved on next Save click
      }

      toast.success("AI generated all fields including content modules. Review and save.");
    } catch (err) {
      toast.error("AI generation failed: " + getErrorMessage(err));
    } finally {
      setAiGenerating(false);
    }
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
          <button type="button" onClick={() => navigate("/entrance-exams")} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 truncate">
              {isNew ? "New Entrance Exam" : exam?.name ?? ""}
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
              {/* Publish status badge + toggle */}
              <button type="button" onClick={async () => {
                setPublishing(true);
                try {
                  if (isPublished) {
                    await unpublishExam(exam!.id);
                    setIsPublished(false);
                    toast.success("Exam unpublished. It won't appear on the frontend.");
                  } else {
                    await publishExam(exam!.id);
                    setIsPublished(true);
                    toast.success("Exam published! It will appear on the frontend shortly.");
                  }
                } catch (err) {
                  toast.error(getErrorMessage(err));
                } finally {
                  setPublishing(false);
                }
              }} disabled={publishing}
                className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isPublished
                    ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                } disabled:opacity-50`}>
                <Globe size={14} />
                {publishing ? "..." : isPublished ? "Published ✓" : "Draft — Publish"}
              </button>
              <button type="button" onClick={() => setShowAIDialog(true)} disabled={aiGenerating}
                className="flex items-center gap-1.5 rounded border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50">
                {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiGenerating ? "Generating..." : "🤖 AI Fill All"}
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
              className="flex items-center gap-1.5 rounded border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50">
              {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {aiGenerating ? "Generating..." : "🤖 AI Fill All"}
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
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg border border-slate-200 border-t-0 p-5">
        {activeTab === "identity" && <IdentityTab form={form} categories={categories} watchFrequency={watchFrequency} isNew={isNew} />}
        {activeTab === "edition" && <EditionTab form={form} dateFields={dateFields} appendDate={appendDate} removeDate={removeDate} replaceDates={replaceDates} watchFrequency={watchFrequency} />}
        {activeTab === "modules" && <ModulePanel editionId={currentEdition?.id ?? null} legacyFlags={{ hasNotification: form.getValues("hasNotification"), hasApplication: form.getValues("hasApplication"), hasAdmitCard: form.getValues("hasAdmitCard"), hasSyllabus: form.getValues("hasSyllabus"), hasAnswerKey: form.getValues("hasAnswerKey"), hasResult: form.getValues("hasResult"), hasCutoff: form.getValues("hasCutoff"), hasCounselling: form.getValues("hasCounselling") }} />}
        {activeTab === "news" && <NewsTab editionId={currentEdition?.id ?? null} contentModules={currentEdition?.contentModules ?? {}} onSave={async (modules) => { if (currentEdition) { await updateEdition(currentEdition.id, { contentModules: modules }); toast.success("News saved."); await loadExam(); } }} />}
        {activeTab === "seo" && <SEOTab form={form} faqFields={faqFields} appendFaq={appendFaq} removeFaq={removeFaq} editionId={currentEdition?.id ?? null} contentModules={currentEdition?.contentModules ?? {}} onSaveModules={async (modules) => { if (currentEdition) { await updateEdition(currentEdition.id, { contentModules: modules }); toast.success("SEO settings saved."); await loadExam(); } }} />}
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
    </form>
  );
}

// ── Tab Components ─────────────────────────────────────────────────────────

function IdentityTab({ form, categories, watchFrequency, isNew }: { form: any; categories: Category[]; watchFrequency: CycleFrequency; isNew: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Exam Name *" name="name" form={form} placeholder="Common Admission Test (CAT)" />
      <Field label="Short Name *" name="shortName" form={form} placeholder="CAT" />
      <Field label="Slug" name="slug" form={form} placeholder="auto-generated if empty" disabled={!isNew} />
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
      <div className="flex items-center gap-2 pt-5">
        <input type="checkbox" {...form.register("isFeatured")} id="isFeatured" className="rounded" />
        <label htmlFor="isFeatured" className="text-sm text-slate-600">Featured exam</label>
      </div>
    </div>
  );
}

// Standard date fields that every entrance exam typically has
const STANDARD_DATE_LABELS = [
  { label: "Notification Release", isUrgent: false },
  { label: "Registration Opens", isUrgent: true },
  { label: "Registration Closes", isUrgent: true },
  { label: "Application Correction Window", isUrgent: false },
  { label: "Admit Card Release", isUrgent: false },
  { label: "Exam Date", isUrgent: true },
  { label: "Answer Key Release", isUrgent: false },
  { label: "Result Declaration", isUrgent: false },
  { label: "Counselling Starts", isUrgent: false },
  { label: "Cutoff Release", isUrgent: false },
];

/** Merge DB dates with standard rows so all 10 standard rows are always visible */
function mergeWithStandardDates(dbDates: { label: string; date: string; isUrgent: boolean }[]): { label: string; date: string; isUrgent: boolean }[] {
  const merged = STANDARD_DATE_LABELS.map((std) => {
    const match = dbDates.find((d) =>
      d.label.toLowerCase().replace(/[^a-z]/g, "").includes(std.label.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)) ||
      std.label.toLowerCase().replace(/[^a-z]/g, "").includes(d.label.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8))
    );
    return match ? { label: std.label, date: match.date, isUrgent: match.isUrgent } : { label: std.label, date: "", isUrgent: std.isUrgent };
  });
  // Append any custom dates from DB that don't match standard labels
  const standardLabelsNorm = STANDARD_DATE_LABELS.map((s) => s.label.toLowerCase().replace(/[^a-z]/g, ""));
  for (const d of dbDates) {
    const dNorm = d.label.toLowerCase().replace(/[^a-z]/g, "");
    const isStandard = standardLabelsNorm.some((s) => s.includes(dNorm.slice(0, 8)) || dNorm.includes(s.slice(0, 8)));
    if (!isStandard) merged.push(d);
  }
  return merged;
}

function EditionTab({ form, dateFields, appendDate, removeDate, replaceDates, watchFrequency }: { form: any; dateFields: any[]; appendDate: (v: any) => void; removeDate: (i: number) => void; replaceDates: (v: any[]) => void; watchFrequency: CycleFrequency }) {
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
        replaceDates(STANDARD_DATE_LABELS.map((d) => ({ label: d.label, date: "", isUrgent: d.isUrgent })));
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select {...form.register("editionStatus")} className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm">
            {EDITION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Notification Date" name="notificationDate" form={form} type="date" />
        <Field label="Vacancy" name="vacancy" form={form} type="number" placeholder="Total seats (leave 0 if N/A)" />
      </div>

      {/* Important Dates — pre-defined rows + custom */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Important Dates</label>
            <p className="text-xs text-slate-400">Leave date blank if not yet announced — blank dates won't appear on frontend.</p>
          </div>
          <button type="button" onClick={() => appendDate({ label: "", date: "", isUrgent: false })}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Custom Date</button>
        </div>
        <div className="space-y-2">
          {dateFields.map((field, i) => (
            <div key={field.id} className="flex items-center gap-2 bg-slate-50 rounded px-3 py-2">
              <input {...form.register(`importantDates.${i}.label`)} placeholder="Date label"
                className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm bg-white" />
              <input {...form.register(`importantDates.${i}.date`)} type="date"
                className="w-40 rounded border border-slate-200 px-2 py-1.5 text-sm bg-white" />
              <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                <input type="checkbox" {...form.register(`importantDates.${i}.isUrgent`)} className="rounded" /> Urgent
              </label>
              <button type="button" onClick={() => removeDate(i)} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModulesTab({ form }: { form: any }) {
  const modules = [
    { name: "hasNotification", label: "Notification" },
    { name: "hasApplication", label: "Application / Registration" },
    { name: "hasAdmitCard", label: "Admit Card" },
    { name: "hasSyllabus", label: "Syllabus" },
    { name: "hasAnswerKey", label: "Answer Key" },
    { name: "hasResult", label: "Result" },
    { name: "hasCutoff", label: "Cutoff" },
    { name: "hasCounselling", label: "Counselling" },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-3">Toggle which lifecycle content is available for this edition.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {modules.map((m) => (
          <label key={m.name} className="flex items-center gap-2 p-3 rounded border border-slate-200 hover:border-blue-200 cursor-pointer transition-colors">
            <input type="checkbox" {...form.register(m.name)} className="rounded" />
            <span className="text-sm text-slate-700">{m.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Content Modules Tab ────────────────────────────────────────────────────

const STEP_GUIDE_MODULES = [
  { key: "howToApply", title: "How to Apply" },
  { key: "howToDownloadAdmitCard", title: "How to Download Admit Card" },
  { key: "howToCheckResult", title: "How to Check Result" },
  { key: "howToDownloadAnswerKey", title: "How to Download Answer Key" },
  { key: "howToDownloadNotification", title: "How to Download Notification" },
  { key: "howToFillApplication", title: "How to Fill Application Form" },
  { key: "howToPayFee", title: "How to Pay Application Fee" },
  { key: "howToCorrectApplication", title: "How to Correct Application Form" },
  { key: "howToRecoverLogin", title: "How to Recover Login Details" },
];

function ContentModulesTab({ editionId, contentModules, onSave }: { editionId: string | null; contentModules: Record<string, unknown>; onSave: (modules: Record<string, unknown>) => Promise<void> }) {
  const [modules, setModules] = React.useState<Record<string, any>>(contentModules);
  const [saving, setSaving] = React.useState(false);
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);

  const updateModule = (key: string, value: any) => {
    setModules((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(modules); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Structured content modules for this edition. AI fills these automatically, or edit manually.</p>
        <button type="button" onClick={handleSave} disabled={saving || !editionId}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium">
          {saving ? "Saving..." : "Save Content"}
        </button>
      </div>

      {/* Step-by-Step Guides */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">📋 Step-by-Step Guides</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {STEP_GUIDE_MODULES.map((guide) => {
            const data = modules[guide.key] as { title?: string; steps?: any[] } | undefined;
            const stepCount = data?.steps?.length ?? 0;
            const isExpanded = expandedSection === guide.key;

            return (
              <div key={guide.key}>
                <button type="button" onClick={() => setExpandedSection(isExpanded ? null : guide.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
                  <span className="text-sm text-slate-700">{guide.title}</span>
                  <span className="text-xs text-slate-400">{stepCount > 0 ? `${stepCount} steps` : "Empty"}</span>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2">
                    {(data?.steps ?? []).map((step: any, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs font-bold text-slate-400 mt-1.5 w-5">{step.order ?? i + 1}.</span>
                        <input value={step.text ?? ""} onChange={(e) => {
                          const newSteps = [...(data?.steps ?? [])];
                          newSteps[i] = { ...newSteps[i], text: e.target.value };
                          updateModule(guide.key, { ...data, title: data?.title ?? guide.title, steps: newSteps });
                        }} className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Step description" />
                        <button type="button" onClick={() => {
                          const newSteps = (data?.steps ?? []).filter((_: any, idx: number) => idx !== i);
                          updateModule(guide.key, { ...data, steps: newSteps });
                        }} className="text-red-400 hover:text-red-600 mt-1"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => {
                      const newSteps = [...(data?.steps ?? []), { order: (data?.steps?.length ?? 0) + 1, text: "" }];
                      updateModule(guide.key, { title: data?.title ?? guide.title, steps: newSteps });
                    }} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Step</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Exam Pattern */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">📝 Exam Pattern</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500">Mode</label>
              <input value={(modules.examPattern as any)?.mode ?? ""} onChange={(e) => updateModule("examPattern", { ...modules.examPattern, mode: e.target.value })}
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Online CBT" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Duration</label>
              <input value={(modules.examPattern as any)?.duration ?? ""} onChange={(e) => updateModule("examPattern", { ...modules.examPattern, duration: e.target.value })}
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="3 hours" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Total Marks</label>
              <input type="number" value={(modules.examPattern as any)?.totalMarks ?? ""} onChange={(e) => updateModule("examPattern", { ...modules.examPattern, totalMarks: parseInt(e.target.value) || 0 })}
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Marking Scheme</label>
              <input value={(modules.examPattern as any)?.markingScheme ?? ""} onChange={(e) => updateModule("examPattern", { ...modules.examPattern, markingScheme: e.target.value })}
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="+4 / -1" />
            </div>
          </div>
        </div>
      </div>

      {/* Eligibility */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">✅ Eligibility</h3>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Qualification</label>
            <input value={(modules.eligibility as any)?.qualification ?? ""} onChange={(e) => updateModule("eligibility", { ...modules.eligibility, qualification: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Graduate with 50% marks" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Age Limit</label>
            <input value={(modules.eligibility as any)?.ageLimit ?? ""} onChange={(e) => updateModule("eligibility", { ...modules.eligibility, ageLimit: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="No age limit" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Attempts</label>
            <input value={(modules.eligibility as any)?.attempts ?? ""} onChange={(e) => updateModule("eligibility", { ...modules.eligibility, attempts: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="No limit" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Nationality</label>
            <input value={(modules.eligibility as any)?.nationality ?? ""} onChange={(e) => updateModule("eligibility", { ...modules.eligibility, nationality: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Indian / NRI / PIO" />
          </div>
        </div>
      </div>

      {/* Application Fee */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">💰 Application Fee</h3>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {["general", "obc", "sc", "st"].map((cat) => (
            <div key={cat}>
              <label className="text-xs text-slate-500 capitalize">{cat}</label>
              <input type="number" value={(modules.applicationFee as any)?.[cat] ?? ""} onChange={(e) => updateModule("applicationFee", { ...modules.applicationFee, [cat]: parseInt(e.target.value) || 0 })}
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="₹" />
            </div>
          ))}
        </div>
      </div>

      {/* Highlights */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">⭐ Highlights</h3>
          <button type="button" onClick={() => updateModule("highlights", [...(modules.highlights ?? []), ""])}
            className="text-xs text-blue-600 font-medium">+ Add</button>
        </div>
        <div className="p-4 space-y-2">
          {((modules.highlights as string[]) ?? []).map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={h} onChange={(e) => {
                const arr = [...(modules.highlights as string[] ?? [])];
                arr[i] = e.target.value;
                updateModule("highlights", arr);
              }} className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Key highlight" />
              <button type="button" onClick={() => updateModule("highlights", (modules.highlights as string[]).filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          {(!modules.highlights || (modules.highlights as string[]).length === 0) && <p className="text-xs text-slate-400 italic">No highlights yet.</p>}
        </div>
      </div>

      {/* Important Links */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">🔗 Important Links</h3>
          <button type="button" onClick={() => updateModule("importantLinks", [...(modules.importantLinks ?? []), { label: "", url: "", isOfficial: true, type: "other" }])}
            className="text-xs text-blue-600 font-medium">+ Add Link</button>
        </div>
        <div className="p-4 space-y-2">
          {((modules.importantLinks as any[]) ?? []).map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={link.label ?? ""} onChange={(e) => {
                const arr = [...(modules.importantLinks as any[])];
                arr[i] = { ...arr[i], label: e.target.value };
                updateModule("importantLinks", arr);
              }} className="w-40 rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Label" />
              <input value={link.url ?? ""} onChange={(e) => {
                const arr = [...(modules.importantLinks as any[])];
                arr[i] = { ...arr[i], url: e.target.value };
                updateModule("importantLinks", arr);
              }} className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm" placeholder="https://..." />
              <button type="button" onClick={() => updateModule("importantLinks", (modules.importantLinks as any[]).filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          {(!modules.importantLinks || (modules.importantLinks as any[]).length === 0) && <p className="text-xs text-slate-400 italic">No links yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ── News Tab ───────────────────────────────────────────────────────────────

function NewsTab({ editionId, contentModules, onSave }: { editionId: string | null; contentModules: Record<string, unknown>; onSave: (modules: Record<string, unknown>) => Promise<void> }) {
  const [news, setNews] = React.useState<any[]>((contentModules.news as any[]) ?? []);
  const [saving, setSaving] = React.useState(false);
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState({ title: "", content: "", excerpt: "", tags: "", isFeatured: false, featureImage: "" });

  const handleSave = async () => {
    setSaving(true);
    try { await onSave({ ...contentModules, news }); } finally { setSaving(false); }
  };

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
        <button type="button" onClick={handleSave} disabled={saving || !editionId}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium">
          {saving ? "Saving..." : "Save News"}
        </button>
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

function SEOTab({ form, faqFields, appendFaq, removeFaq, editionId, contentModules, onSaveModules }: { form: any; faqFields: any[]; appendFaq: (v: any) => void; removeFaq: (i: number) => void; editionId: string | null; contentModules: Record<string, unknown>; onSaveModules: (modules: Record<string, unknown>) => Promise<void> }) {
  const existingSeo = (contentModules.newsSeo as any) ?? {};
  const [newsSeo, setNewsSeo] = React.useState({
    newsKeywords: existingSeo.newsKeywords ?? "",
    standout: existingSeo.standout ?? "",
    syndicationSource: existingSeo.syndicationSource ?? "",
    maxImagePreview: existingSeo.maxImagePreview ?? "large",
    robotsNewsTag: existingSeo.robotsNewsTag ?? "",
    googleNewsCategory: existingSeo.googleNewsCategory ?? "",
    discoverOptIn: existingSeo.discoverOptIn ?? true,
  });
  const [savingSeo, setSavingSeo] = React.useState(false);

  const handleSaveNewsSeo = async () => {
    setSavingSeo(true);
    try {
      await onSaveModules({ ...contentModules, newsSeo: newsSeo });
    } finally {
      setSavingSeo(false);
    }
  };

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

      {/* Google News & Discover SEO */}
      <div className="border border-slate-200 rounded-lg">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">📰 News SEO (Google News & Discover)</h3>
          <button type="button" onClick={handleSaveNewsSeo} disabled={savingSeo || !editionId}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium">
            {savingSeo ? "Saving..." : "Save News SEO"}
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">News Keywords</label>
            <input value={newsSeo.newsKeywords} onChange={(e) => setNewsSeo({ ...newsSeo, newsKeywords: e.target.value })}
              className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm" placeholder="comma-separated keywords for Google News (max 10)" />
            <p className="text-xs text-slate-400 mt-0.5">Used in news_keywords meta tag for Google News indexing</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Google News Category</label>
              <select value={newsSeo.googleNewsCategory} onChange={(e) => setNewsSeo({ ...newsSeo, googleNewsCategory: e.target.value })}
                className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm">
                <option value="">Select category</option>
                <option value="Education">Education</option>
                <option value="India">India</option>
                <option value="Science">Science</option>
                <option value="Technology">Technology</option>
                <option value="Business">Business</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Image Preview</label>
              <select value={newsSeo.maxImagePreview} onChange={(e) => setNewsSeo({ ...newsSeo, maxImagePreview: e.target.value })}
                className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm">
                <option value="large">Large (recommended for Discover)</option>
                <option value="standard">Standard</option>
                <option value="none">None</option>
              </select>
              <p className="text-xs text-slate-400 mt-0.5">Large images improve visibility in Google Discover</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Standout Tag URL</label>
            <input value={newsSeo.standout} onChange={(e) => setNewsSeo({ ...newsSeo, standout: e.target.value })}
              className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm" placeholder="URL of the original story (if this is original reporting)" />
            <p className="text-xs text-slate-400 mt-0.5">Google News standout tag for original journalism credit</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Syndication Source</label>
            <input value={newsSeo.syndicationSource} onChange={(e) => setNewsSeo({ ...newsSeo, syndicationSource: e.target.value })}
              className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm" placeholder="Original source URL if content is syndicated" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Robots News Directives</label>
            <input value={newsSeo.robotsNewsTag} onChange={(e) => setNewsSeo({ ...newsSeo, robotsNewsTag: e.target.value })}
              className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm" placeholder="e.g. noindex, nosnippet (leave empty for default indexing)" />
            <p className="text-xs text-slate-400 mt-0.5">Controls how Google News indexes this content</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={newsSeo.discoverOptIn} onChange={(e) => setNewsSeo({ ...newsSeo, discoverOptIn: e.target.checked })} className="rounded" />
            Opt-in to Google Discover (ensure large featured image is set)
          </label>
        </div>
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

function NewEditionDialog({ onConfirm, onCancel, frequency }: { onConfirm: (year: number, session: CycleSession) => void; onCancel: () => void; frequency: CycleFrequency }) {
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [session, setSession] = useState<CycleSession>("main");

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
          {frequency === "biannual" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cycle / Session</label>
              <select value={session} onChange={(e) => setSession(e.target.value as CycleSession)}
                className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm">
                {SESSIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
        </div>
        <p className="text-xs text-amber-600">⚠️ The current edition will be archived automatically.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded">Cancel</button>
          <button type="button" onClick={() => onConfirm(year, frequency === "biannual" ? session : "main")}
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
            <strong>What AI will generate:</strong> Important dates, status, eligibility, fees, vacancy, all module flags, SEO title & description (Google Discover optimized), tags, and 6+ FAQs targeting featured snippets.
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
