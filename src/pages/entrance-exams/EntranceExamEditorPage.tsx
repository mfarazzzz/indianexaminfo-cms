import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { useForm, useFieldArray } from "react-hook-form";
import {
  getEntranceExam, updateExamIdentity, updateEdition, startNewEdition,
  createEntranceExam, completeEdition, activateEdition, deleteEdition, promoteEdition,
  type ExamEdition, type ExamIdentity, type EditionStatus, type CycleFrequency, type CycleSession,
} from "@/services/entranceExamService";
import { getCategories, type Category } from "@/services/categoryService";
import { deleteExam } from "@/services/examService";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getErrorMessage } from "@/lib/utils";

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

  const { fields: dateFields, append: appendDate, remove: removeDate } = useFieldArray({ control: form.control, name: "importantDates" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray({ control: form.control, name: "faqs" });

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
        importantDates: data.currentEdition?.importantDates ?? [],
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
          importantDates: data.importantDates,
          hasNotification: data.hasNotification,
          hasApplication: data.hasApplication,
          hasAdmitCard: data.hasAdmitCard,
          hasSyllabus: data.hasSyllabus,
          hasAnswerKey: data.hasAnswerKey,
          hasResult: data.hasResult,
          hasCutoff: data.hasCutoff,
          hasCounselling: data.hasCounselling,
        });
      }

      // If there's a draft edition pending, save it and activate it (archives old one)
      if (draftEdition) {
        await updateEdition(draftEdition.id, {
          status: data.editionStatus,
          notificationDate: data.notificationDate || null,
          vacancy: data.vacancy ? parseInt(data.vacancy) : null,
          importantDates: data.importantDates,
          hasNotification: data.hasNotification,
          hasApplication: data.hasApplication,
          hasAdmitCard: data.hasAdmitCard,
          hasSyllabus: data.hasSyllabus,
          hasAnswerKey: data.hasAnswerKey,
          hasResult: data.hasResult,
          hasCutoff: data.hasCutoff,
          hasCounselling: data.hasCounselling,
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
        {activeTab === "edition" && <EditionTab form={form} dateFields={dateFields} appendDate={appendDate} removeDate={removeDate} watchFrequency={watchFrequency} />}
        {activeTab === "modules" && <ModulesTab form={form} />}
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

function EditionTab({ form, dateFields, appendDate, removeDate, watchFrequency }: { form: any; dateFields: any[]; appendDate: (v: any) => void; removeDate: (i: number) => void; watchFrequency: CycleFrequency }) {
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
        <Field label="Vacancy" name="vacancy" form={form} type="number" placeholder="Total seats" />
      </div>

      {/* Important Dates */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-600">Important Dates</label>
          <button type="button" onClick={() => appendDate({ label: "", date: "", isUrgent: false })}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Date</button>
        </div>
        {dateFields.length === 0 && <p className="text-xs text-slate-400 italic">No dates added yet.</p>}
        {dateFields.map((field, i) => (
          <div key={field.id} className="flex items-center gap-2 mb-2">
            <input {...form.register(`importantDates.${i}.label`)} placeholder="Label" className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm" />
            <input {...form.register(`importantDates.${i}.date`)} type="date" className="rounded border border-slate-200 px-2 py-1 text-sm" />
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input type="checkbox" {...form.register(`importantDates.${i}.isUrgent`)} /> Urgent
            </label>
            <button type="button" onClick={() => removeDate(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
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

function SEOTab({ form, faqFields, appendFaq, removeFaq }: { form: any; faqFields: any[]; appendFaq: (v: any) => void; removeFaq: (i: number) => void }) {
  return (
    <div className="space-y-4">
      <Field label="SEO Title" name="seoTitle" form={form} placeholder="Override page title for search engines" />
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">SEO Description</label>
        <textarea {...form.register("seoDescription")} rows={3} placeholder="Meta description..." className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm" />
      </div>
      <Field label="Tags (comma-separated)" name="tags" form={form} placeholder="cat, mba, management, entrance" />

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
