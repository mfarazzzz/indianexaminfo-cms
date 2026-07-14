/**
 * ExamEditorPage.tsx — Registry-driven, context-aware exam editor.
 *
 * KEY ARCHITECTURE:
 * 1. Entity Type Profile drives: required/optional modules, general fields, dates, eligibility
 * 2. Module Registry drives: inline module editors with independent save state
 * 3. Progressive disclosure: essential fields first, advanced collapsed
 * 4. Context-aware: fields adapt based on entityType
 * 5. Writes to `exams` table + `content_posts` table (what frontend reads)
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Save, Plus, Trash2, Star, Calendar,
  FileText, GraduationCap, BookOpen, Search as SearchIcon,
  ChevronDown, ChevronUp, Check,
} from "lucide-react";
import {
  getExamById, createExam, updateExam, checkSlugAvailable,
} from "@/services/examService";
import { getCategories, type Category } from "@/services/categoryService";
import {
  getContentPosts, createContentPost, updateContentPost,
} from "@/services/contentService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EXAM_STATUSES } from "@/config/site";
import {
  getEntityProfile, getModulesForEntityType,
  getEssentialFields, getAdvancedFields, isModuleRequired,
  MODULE_CATEGORY_LABELS,
  type FieldDef, type ModuleDefinition, type EntityTypeProfile,
} from "@/config/moduleRegistry";
import { usePillars } from "@/hooks/usePillars";
import { useAuth } from "@/hooks/useAuth";
import {
  revalidateAfterExamSave, revalidateAfterModuleSave,
} from "@/lib/revalidation/revalidationService";
import { cn, slugify } from "@/lib/utils";
import type { ExamEntity, Pillar, ContentType } from "@/types/exam";

// ── Schema ──────────────────────────────────────────────────────────────────

const examSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  shortName: z.string().default(""),
  pillar: z.enum(["sarkari-naukri", "entrance-exam", "board-university"]),
  categoryId: z.string().optional().nullable(),
  subcategoryId: z.string().optional().nullable(),
  entityType: z.enum(["exam", "board", "university", "recruitment"]).default("exam"),
  conductingBody: z.string().min(1, "Conducting body is required"),
  officialWebsite: z.string().optional().default(""),
  status: z.enum(["upcoming", "active", "registration-open", "registration-closed", "result-declared", "completed", "ongoing"]).default("upcoming"),
  isFeatured: z.boolean().default(false),
  // Content flags (synced from enabled modules)
  hasAdmitCard: z.boolean().default(false),
  hasResult: z.boolean().default(false),
  hasAnswerKey: z.boolean().default(false),
  hasSyllabus: z.boolean().default(false),
  hasDateSheet: z.boolean().default(false),
  hasMockTest: z.boolean().default(false),
  hasPreviousPapers: z.boolean().default(false),
  hasStudyMaterial: z.boolean().default(false),
  hasApplication: z.boolean().default(false),
  hasNotification: z.boolean().default(false),
  hasCutoff: z.boolean().default(false),
  // Structured JSONB
  dates: z.array(z.object({ label: z.string(), date: z.string(), isUrgent: z.boolean() })).default([]),
  eligibility: z.object({ age: z.string().default(""), qualification: z.string().default(""), nationality: z.string().default("") }).optional(),
  vacancy: z.number().nullable().optional(),
  applicationFee: z.object({ general: z.number().default(0), obc: z.number().default(0), sc: z.number().default(0), st: z.number().default(0), ews: z.number().optional(), pwd: z.number().optional() }).optional(),
  selectionProcess: z.array(z.string()).default([]),
  syllabusHighlights: z.array(z.string()).default([]),
  academicYear: z.string().optional().nullable(),
  semester: z.string().optional().nullable(),
  admissionTo: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  searchKeywords: z.array(z.string()).default([]),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
  // Dynamic type-specific fields
  typeFields: z.record(z.unknown()).default({}),
});

type ExamFormData = z.infer<typeof examSchema>;

// ── Tab config ──────────────────────────────────────────────────────────────

type TabId = "general" | "dates" | "eligibility" | "modules" | "seo";
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <FileText size={16} /> },
  { id: "dates", label: "Dates & Fees", icon: <Calendar size={16} /> },
  { id: "eligibility", label: "Eligibility & Selection", icon: <GraduationCap size={16} /> },
  { id: "modules", label: "Content Modules", icon: <BookOpen size={16} /> },
  { id: "seo", label: "SEO & Tags", icon: <SearchIcon size={16} /> },
];

// Module ID → exam table flag mapping
const MODULE_FLAG_MAP: Record<string, string> = {
  "notification": "hasNotification", "application": "hasApplication",
  "admit-card": "hasAdmitCard", "date-sheet": "hasDateSheet",
  "syllabus": "hasSyllabus", "answer-key": "hasAnswerKey",
  "result": "hasResult", "cutoff": "hasCutoff",
  "previous-papers": "hasPreviousPapers", "mock-test": "hasMockTest",
  "study-material": "hasStudyMaterial",
};

// ── Main Component ──────────────────────────────────────────────────────────

export function ExamEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [exam, setExam] = useState<ExamEntity | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const { data: pillars = [] } = usePillars();
  const [moduleData, setModuleData] = useState<Record<string, any>>({});
  const [moduleSaving, setModuleSaving] = useState<string | null>(null);

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      name: "", slug: "", shortName: "", pillar: "sarkari-naukri",
      categoryId: null, subcategoryId: null, entityType: "recruitment",
      conductingBody: "", officialWebsite: "", status: "upcoming", isFeatured: false,
      hasAdmitCard: false, hasResult: false, hasAnswerKey: false, hasSyllabus: false,
      hasDateSheet: false, hasMockTest: false, hasPreviousPapers: false,
      hasStudyMaterial: false, hasApplication: false, hasNotification: false, hasCutoff: false,
      dates: [], eligibility: { age: "", qualification: "", nationality: "" },
      vacancy: null, applicationFee: { general: 0, obc: 0, sc: 0, st: 0 },
      selectionProcess: [], syllabusHighlights: [],
      academicYear: null, semester: null, admissionTo: null,
      tags: [], searchKeywords: [], seoTitle: null, seoDescription: null, faqs: [],
      typeFields: {},
    },
  });

  const { fields: dateFields, append: appendDate, remove: removeDate } = useFieldArray({ control: form.control, name: "dates" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray({ control: form.control, name: "faqs" });
  const watchedPillar = form.watch("pillar");
  const watchedCategoryId = form.watch("categoryId");
  const watchedEntityType = form.watch("entityType");
  const entityProfile = useMemo(() => getEntityProfile(watchedEntityType), [watchedEntityType]);

  useEffect(() => {
    if (watchedPillar) {
      getCategories(watchedPillar).then((cats) => {
        setCategories(cats.filter((c) => !c.parentId));
        setSubcategories(cats.filter((c) => c.parentId));
      });
    }
  }, [watchedPillar]);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getExamById(id!).then((data) => {
      if (!data) { toast.error("Exam not found"); navigate("/exams"); return; }
      setExam(data);
      form.reset({
        name: data.name, slug: data.slug, shortName: data.shortName,
        pillar: data.pillar, entityType: data.entityType, conductingBody: data.conductingBody,
        officialWebsite: data.officialWebsite ?? "", status: data.status, isFeatured: data.isFeatured,
        hasAdmitCard: data.hasAdmitCard, hasResult: data.hasResult, hasAnswerKey: data.hasAnswerKey,
        hasSyllabus: data.hasSyllabus, hasDateSheet: data.hasDateSheet, hasMockTest: data.hasMockTest,
        hasPreviousPapers: data.hasPreviousPapers, hasStudyMaterial: data.hasStudyMaterial,
        hasApplication: data.hasApplication, hasNotification: data.hasNotification, hasCutoff: data.hasCutoff,
        dates: data.dates ?? [], eligibility: data.eligibility ?? { age: "", qualification: "", nationality: "" },
        vacancy: data.vacancy ?? null, applicationFee: data.applicationFee ?? { general: 0, obc: 0, sc: 0, st: 0 },
        selectionProcess: data.selectionProcess ?? [], syllabusHighlights: data.syllabusHighlights ?? [],
        academicYear: data.academicYear ?? null, semester: data.semester ?? null, admissionTo: data.admissionTo ?? null,
        tags: data.tags ?? [], searchKeywords: data.searchKeywords ?? [],
        seoTitle: data.seoTitle ?? null, seoDescription: data.seoDescription ?? null, faqs: data.faqs ?? [],
        typeFields: {},
      });
      loadModuleData(data.id);
    }).finally(() => setLoading(false));
  }, [id, isNew, navigate, form]);

  const loadModuleData = useCallback(async (examId: string) => {
    try {
      const { data: posts } = await getContentPosts({ examId });
      const map: Record<string, any> = {};
      for (const post of posts) map[post.contentType] = post;
      setModuleData(map);
    } catch { /* modules won't be pre-populated */ }
  }, []);

  const handleNameBlur = useCallback(() => {
    const name = form.getValues("name");
    if (name && !form.getValues("slug")) form.setValue("slug", slugify(name));
  }, [form]);

  const onSubmit = async (data: ExamFormData) => {
    setSaving(true);
    try {
      const payload = buildUpdatePayload(data);
      if (isNew) {
        const available = await checkSlugAvailable(data.slug);
        if (!available) { form.setError("slug", { message: "Slug already taken" }); setSaving(false); return; }
        const created = await createExam({ slug: data.slug, name: data.name, shortName: data.shortName, pillar: data.pillar as Pillar, categoryId: data.categoryId, subcategoryId: data.subcategoryId, entityType: data.entityType, conductingBody: data.conductingBody, officialWebsite: data.officialWebsite, status: data.status, isFeatured: data.isFeatured, createdBy: user?.id });
        await updateExam(created.id, payload);
        toast.success("Exam created!");
        navigate(`/exams/${created.id}`, { replace: true });
      } else {
        if (data.slug !== exam?.slug) { const available = await checkSlugAvailable(data.slug, id); if (!available) { form.setError("slug", { message: "Slug already taken" }); setSaving(false); return; } }
        await updateExam(id!, { ...payload, slug: data.slug, name: data.name, shortName: data.shortName, pillar: data.pillar as Pillar, categoryId: data.categoryId, subcategoryId: data.subcategoryId, entityType: data.entityType, conductingBody: data.conductingBody, officialWebsite: data.officialWebsite, status: data.status, isFeatured: data.isFeatured });
        toast.success("Exam saved!");
        // Background batched revalidation — debounced, non-blocking
        revalidateAfterExamSave({ id: id!, slug: data.slug, pillar: data.pillar, categorySlug: exam?.category ?? "" });
      }
    } catch (err) { toast.error("Save failed: " + String(err)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/exams")} className="p-1.5 rounded hover:bg-slate-100"><ArrowLeft size={20} className="text-slate-600" /></button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{isNew ? "New Exam" : exam?.name ?? "Edit Exam"}</h1>
            {!isNew && <p className="text-xs text-slate-400">/{exam?.pillar}/{exam?.category}/{exam?.slug}</p>}
          </div>
          {!isNew && <StatusBadge status={exam?.status ?? "upcoming"} />}
          {entityProfile && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{entityProfile.icon} {entityProfile.label}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 bg-white rounded-t-lg px-2 pt-2">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cn("flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors", activeTab === tab.id ? "border-blue-600 text-blue-700 bg-blue-50/50" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50")}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-b-lg rounded-tr-lg border border-slate-200 p-6">
        {activeTab === "general" && <GeneralTab form={form} pillars={pillars} categories={categories} subcategories={subcategories} watchedCategoryId={watchedCategoryId} entityProfile={entityProfile} onNameBlur={handleNameBlur} />}
        {activeTab === "dates" && <DatesTab form={form} dateFields={dateFields} appendDate={appendDate} removeDate={removeDate} entityProfile={entityProfile} entityType={watchedEntityType} />}
        {activeTab === "eligibility" && <EligibilityTab form={form} entityProfile={entityProfile} />}
        {activeTab === "modules" && <ModulesTab form={form} examId={id ?? ""} examName={form.watch("name")} pillar={watchedPillar} entityType={watchedEntityType} moduleData={moduleData} setModuleData={setModuleData} moduleSaving={moduleSaving} setModuleSaving={setModuleSaving} isNew={isNew} />}
        {activeTab === "seo" && <SEOTab form={form} faqFields={faqFields} appendFaq={appendFaq} removeFaq={removeFaq} />}
      </div>
    </form>
  );
}

function buildUpdatePayload(data: ExamFormData) {
  return { hasAdmitCard: data.hasAdmitCard, hasResult: data.hasResult, hasAnswerKey: data.hasAnswerKey, hasSyllabus: data.hasSyllabus, hasDateSheet: data.hasDateSheet, hasMockTest: data.hasMockTest, hasPreviousPapers: data.hasPreviousPapers, hasStudyMaterial: data.hasStudyMaterial, hasApplication: data.hasApplication, hasNotification: data.hasNotification, hasCutoff: data.hasCutoff, dates: data.dates, eligibility: data.eligibility, vacancy: data.vacancy, applicationFee: data.applicationFee, selectionProcess: data.selectionProcess, syllabusHighlights: data.syllabusHighlights, academicYear: data.academicYear, semester: data.semester, admissionTo: data.admissionTo, tags: data.tags, searchKeywords: data.searchKeywords, seoTitle: data.seoTitle, seoDescription: data.seoDescription, faqs: data.faqs };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC FIELD RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

function RegistryFieldRenderer({ fields, form, prefix = "typeFields" }: { fields: FieldDef[]; form: any; prefix?: string }) {
  if (fields.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((field) => <RegistryFieldInput key={field.key} field={field} form={form} prefix={prefix} />)}
    </div>
  );
}

function RegistryFieldInput({ field, form, prefix }: { field: FieldDef; form: any; prefix: string }) {
  const path = `${prefix}.${field.key}`;
  const value = form.watch(path) ?? "";
  const set = (v: unknown) => form.setValue(path, v);
  const cls = "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  switch (field.type) {
    case "text": case "url":
      return (<div><label className="block text-sm font-medium text-slate-700 mb-1">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</label><input type={field.type === "url" ? "url" : "text"} value={value as string} onChange={(e) => set(e.target.value)} placeholder={field.placeholder} className={cls} />{field.hint && <p className="text-xs text-slate-400 mt-0.5">{field.hint}</p>}</div>);
    case "textarea":
      return (<div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</label><textarea value={value as string} onChange={(e) => set(e.target.value)} placeholder={field.placeholder} rows={3} className={cn(cls, "resize-none")} />{field.hint && <p className="text-xs text-slate-400 mt-0.5">{field.hint}</p>}</div>);
    case "date":
      return (<div><label className="block text-sm font-medium text-slate-700 mb-1">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</label><input type="date" value={value as string} onChange={(e) => set(e.target.value)} className={cls} /></div>);
    case "number":
      return (<div><label className="block text-sm font-medium text-slate-700 mb-1">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</label><input type="number" value={value as string} onChange={(e) => set(e.target.value ? Number(e.target.value) : "")} placeholder={field.placeholder} className={cls} /></div>);
    case "boolean":
      return (<div className="flex items-center gap-2 pt-5"><input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} className="rounded border-slate-300 text-blue-600" /><label className="text-sm text-slate-700">{field.label}</label></div>);
    case "select":
      return (<div><label className="block text-sm font-medium text-slate-700 mb-1">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</label><select value={value as string} onChange={(e) => set(e.target.value)} className={cls}><option value="">— Select —</option>{(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>);
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: General
// ═══════════════════════════════════════════════════════════════════════════════

function GeneralTab({ form, pillars, categories, subcategories, watchedCategoryId, entityProfile, onNameBlur }: { form: any; pillars: any[]; categories: Category[]; subcategories: Category[]; watchedCategoryId: string | null | undefined; entityProfile: EntityTypeProfile | undefined; onNameBlur: () => void }) {
  const filteredSubcats = subcategories.filter((c) => c.parentId === watchedCategoryId);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const essentialFields = entityProfile?.generalFields.filter((f) => f.priority === "essential") ?? [];
  const advancedFields = entityProfile?.generalFields.filter((f) => f.priority === "advanced") ?? [];
  const cls = "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Exam Name *</label><input {...form.register("name")} onBlur={onNameBlur} placeholder="e.g. IBPS PO 2025" className={cls} />{form.formState.errors.name && <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>}</div>
        <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Slug *</label><input {...form.register("slug")} placeholder="ibps-po-2025" className={cn(cls, "font-mono")} />{form.formState.errors.slug && <p className="text-xs text-red-500 mt-1">{form.formState.errors.slug.message}</p>}</div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Short Name</label><input {...form.register("shortName")} placeholder="IBPS PO" className={cls} /></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label><select {...form.register("entityType")} className={cls}><option value="recruitment">🏛️ Government Recruitment</option><option value="exam">📝 Entrance Exam</option><option value="board">🏫 Board Exam</option><option value="university">🎓 University Admission</option></select><p className="text-xs text-slate-400 mt-0.5">Changes fields, modules, and validation across all tabs</p></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Pillar *</label><select {...form.register("pillar")} className={cls}>{pillars.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}{pillars.length === 0 && <><option value="sarkari-naukri">Sarkari Naukri</option><option value="entrance-exam">Entrance Exam</option><option value="board-university">Board & University</option></>}</select></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label><select {...form.register("categoryId")} className={cls}><option value="">— Select —</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Subcategory</label><select {...form.register("subcategoryId")} disabled={!watchedCategoryId} className={cn(cls, "disabled:opacity-50")}><option value="">— Select —</option>{filteredSubcats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Conducting Body *</label><input {...form.register("conductingBody")} placeholder="e.g. Institute of Banking Personnel Selection" className={cls} />{form.formState.errors.conductingBody && <p className="text-xs text-red-500 mt-1">{form.formState.errors.conductingBody.message}</p>}</div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Official Website</label><input {...form.register("officialWebsite")} placeholder="https://www.ibps.in" className={cls} /></div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Exam Status</label><select {...form.register("status")} className={cls}>{EXAM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        <div className="flex items-center gap-2 pt-6"><input type="checkbox" {...form.register("isFeatured")} id="isFeatured" className="rounded border-slate-300" /><label htmlFor="isFeatured" className="text-sm text-slate-700 flex items-center gap-1"><Star size={14} className="text-amber-500" /> Featured</label></div>
      </div>
      {/* Type-specific essential fields */}
      {essentialFields.length > 0 && (
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">{entityProfile?.icon} <span>{entityProfile?.label} — Details</span></h3>
          <RegistryFieldRenderer fields={essentialFields} form={form} />
        </div>
      )}
      {/* Advanced (collapsed) */}
      {advancedFields.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showAdvanced ? "Hide" : "Show"} Advanced Fields ({advancedFields.length})
          </button>
          {showAdvanced && <div className="mt-3"><RegistryFieldRenderer fields={advancedFields} form={form} /></div>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Dates & Fees
// ═══════════════════════════════════════════════════════════════════════════════

function DatesTab({ form, dateFields, appendDate, removeDate, entityProfile, entityType }: { form: any; dateFields: any[]; appendDate: (v: any) => void; removeDate: (i: number) => void; entityProfile: EntityTypeProfile | undefined; entityType: string }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const essentialDates = entityProfile?.dateFields.filter((f) => f.priority === "essential") ?? [];
  const advancedDates = entityProfile?.dateFields.filter((f) => f.priority === "advanced") ?? [];

  return (
    <div className="space-y-8">
      {essentialDates.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">{entityProfile?.icon} Key Dates</h3>
          <RegistryFieldRenderer fields={essentialDates} form={form} />
        </section>
      )}
      {advancedDates.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">{showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Additional Date Fields ({advancedDates.length})</button>
          {showAdvanced && <div className="mt-3"><RegistryFieldRenderer fields={advancedDates} form={form} /></div>}
        </section>
      )}
      {/* Important Dates timeline */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Important Dates (Frontend Timeline)</h3>
          <button type="button" onClick={() => appendDate({ label: "", date: "", isUrgent: false })} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"><Plus size={14} /> Add Date</button>
        </div>
        {dateFields.length === 0 && <p className="text-sm text-slate-400 italic">No dates added. These appear as a timeline on the frontend exam page.</p>}
        <div className="space-y-2">
          {dateFields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_150px_auto_auto] gap-2 items-center">
              <input {...form.register(`dates.${i}.label`)} placeholder="e.g. Application Start" className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
              <input type="date" {...form.register(`dates.${i}.date`)} className="rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
              <label className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap"><input type="checkbox" {...form.register(`dates.${i}.isUrgent`)} className="rounded border-slate-300" />Urgent</label>
              <button type="button" onClick={() => removeDate(i)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>
      {/* Vacancy & Fee */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Vacancy & Application Fee</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="block text-xs text-slate-500 mb-1">Total Vacancy</label><input type="number" {...form.register("vacancy", { valueAsNumber: true })} placeholder="e.g. 4500" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" /></div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-2">Application Fee (₹)</label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {(["general", "obc", "sc", "st", "ews", "pwd"] as const).map((cat) => (
                <div key={cat}><label className="block text-xs text-slate-500 mb-0.5 uppercase">{cat}</label><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span><input type="number" min={0} {...form.register(`applicationFee.${cat}`, { valueAsNumber: true })} className="w-full rounded-md border border-slate-200 pl-5 pr-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" /></div></div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Eligibility & Selection
// ═══════════════════════════════════════════════════════════════════════════════

function EligibilityTab({ form, entityProfile }: { form: any; entityProfile: EntityTypeProfile | undefined }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const essentialFields = entityProfile?.eligibilityFields.filter((f) => f.priority === "essential") ?? [];
  const advancedFields = entityProfile?.eligibilityFields.filter((f) => f.priority === "advanced") ?? [];
  const selectionStr = (form.watch("selectionProcess") ?? []).join(", ");
  const syllabusStr = (form.watch("syllabusHighlights") ?? []).join(", ");

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Core Eligibility</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-xs text-slate-500 mb-1">Age Limit</label><input {...form.register("eligibility.age")} placeholder="e.g. 20-30 years" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" /></div>
          <div><label className="block text-xs text-slate-500 mb-1">Qualification</label><input {...form.register("eligibility.qualification")} placeholder="e.g. Graduation" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" /></div>
          <div><label className="block text-xs text-slate-500 mb-1">Nationality</label><input {...form.register("eligibility.nationality")} placeholder="e.g. Indian" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" /></div>
        </div>
      </section>
      {essentialFields.length > 0 && <section className="border-t border-slate-100 pt-5"><h3 className="text-sm font-semibold text-slate-800 mb-3">{entityProfile?.icon} Additional Criteria</h3><RegistryFieldRenderer fields={essentialFields} form={form} /></section>}
      {advancedFields.length > 0 && <section><button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">{showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Advanced ({advancedFields.length})</button>{showAdvanced && <div className="mt-3"><RegistryFieldRenderer fields={advancedFields} form={form} /></div>}</section>}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Selection Process</h3>
        <p className="text-xs text-slate-400 mb-2">Comma-separated stages</p>
        <input value={selectionStr} onChange={(e) => form.setValue("selectionProcess", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="Prelims, Mains, Interview" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        {(form.watch("selectionProcess") ?? []).length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{form.watch("selectionProcess").map((s: string, i: number) => <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{i + 1}. {s}</span>)}</div>}
      </section>
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Syllabus Highlights</h3>
        <input value={syllabusStr} onChange={(e) => form.setValue("syllabusHighlights", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="English, Reasoning, Quantitative Aptitude" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Content Modules — Registry-driven, context-aware, independent save
// ═══════════════════════════════════════════════════════════════════════════════

function ModulesTab({ form, examId, examName, pillar, entityType, moduleData, setModuleData, moduleSaving, setModuleSaving, isNew }: { form: any; examId: string; examName: string; pillar: string; entityType: string; moduleData: Record<string, any>; setModuleData: (v: Record<string, any>) => void; moduleSaving: string | null; setModuleSaving: (v: string | null) => void; isNew: boolean }) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const availableModules = useMemo(() => getModulesForEntityType(entityType), [entityType]);
  const profile = useMemo(() => getEntityProfile(entityType), [entityType]);

  // Group modules by category
  const grouped = useMemo(() => {
    const g: Record<string, ModuleDefinition[]> = {};
    for (const m of availableModules) { if (!g[m.category]) g[m.category] = []; g[m.category].push(m); }
    return g;
  }, [availableModules]);

  const toggleExpand = (id: string) => setExpandedModules((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const handleToggle = (moduleId: string) => {
    const flag = MODULE_FLAG_MAP[moduleId];
    if (flag) {
      const current = form.getValues(flag);
      form.setValue(flag, !current);
      if (!current) setExpandedModules((prev) => new Set(prev).add(moduleId));
    }
  };

  const saveModule = async (moduleId: string, moduleFormData: Record<string, unknown>) => {
    if (isNew) { toast.error("Save the exam first."); return; }
    setModuleSaving(moduleId);
    try {
      const existing = moduleData[moduleId];
      const slug = `${form.getValues("slug")}-${moduleId}`;
      const mod = availableModules.find((m) => m.id === moduleId);
      const title = `${examName} — ${mod?.label ?? moduleId}`;
      if (existing?.id) {
        const updated = await updateContentPost(existing.id, { title, slug, contentTypeData: moduleFormData, pillar, contentType: moduleId as ContentType, examEntityName: examName });
        setModuleData({ ...moduleData, [moduleId]: updated });
      } else {
        const created = await createContentPost({ title, slug, pillar, contentType: moduleId as ContentType, examId, examEntityName: examName, contentTypeData: moduleFormData, status: "draft" });
        setModuleData({ ...moduleData, [moduleId]: created });
      }
      toast.success(`${mod?.label ?? moduleId} saved`);
      // Background batched revalidation — debounced with exam save if both happen
      revalidateAfterModuleSave({ examSlug: form.getValues("slug"), pillar, categorySlug: "", contentType: moduleId });
    } catch (err) { toast.error(`Save failed: ${String(err)}`); }
    finally { setModuleSaving(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">Enable and configure content modules. Each module has its own editor and saves independently.</p>
          {isNew && <p className="text-xs text-amber-600 mt-1">⚠️ Save the exam first to enable module editing.</p>}
        </div>
        {profile && (
          <div className="text-xs text-slate-500">
            <span className="font-medium">{profile?.label}</span> — {profile?.requiredModules.length} required
          </div>
        )}
      </div>

      {Object.entries(grouped).map(([category, modules]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {MODULE_CATEGORY_LABELS[category]?.label ?? category}
          </h3>
          <div className="space-y-2">
            {modules.map((mod) => {
              const flag = MODULE_FLAG_MAP[mod.id];
              const isEnabled = flag ? form.watch(flag) : expandedModules.has(mod.id);
              const isExpanded = expandedModules.has(mod.id);
              const hasData = !!moduleData[mod.id];
              const required = isModuleRequired(mod.id, entityType);

              return (
                <div key={mod.id} className={cn("border rounded-lg transition-all", isEnabled ? "border-blue-200 bg-blue-50/20" : "border-slate-200")}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      {flag && <input type="checkbox" checked={isEnabled} onChange={() => handleToggle(mod.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />}
                      <span className="text-lg">{mod.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={cn("text-sm font-medium", isEnabled ? "text-slate-900" : "text-slate-500")}>{mod.label}</p>
                          {required && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-50 text-red-600 border border-red-100">Required</span>}
                          {hasData && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-50 text-green-700 border border-green-100 flex items-center gap-0.5"><Check size={10} />Saved</span>}
                        </div>
                        <p className="text-xs text-slate-400">{mod.description}</p>
                      </div>
                    </div>
                    {(isEnabled || !flag) && (
                      <button type="button" onClick={() => toggleExpand(mod.id)} className="p-1.5 rounded hover:bg-slate-200 text-slate-500">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-white px-4 py-4">
                      <ModuleEditor moduleId={mod.id} entityType={entityType} existingData={moduleData[mod.id]?.contentTypeData ?? {}} onSave={(data) => saveModule(mod.id, data)} isSaving={moduleSaving === mod.id} disabled={isNew} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Module Editor — renders from MODULE_REGISTRY with progressive disclosure ─

function ModuleEditor({ moduleId, entityType, existingData, onSave, isSaving, disabled }: { moduleId: string; entityType: string; existingData: Record<string, unknown>; onSave: (data: Record<string, unknown>) => void; isSaving: boolean; disabled: boolean }) {
  const [formData, setFormData] = useState<Record<string, unknown>>(existingData);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const essentialFields = useMemo(() => getEssentialFields(moduleId, entityType), [moduleId, entityType]);
  const advancedFields = useMemo(() => getAdvancedFields(moduleId, entityType), [moduleId, entityType]);

  useEffect(() => { setFormData(existingData); }, [existingData]);

  const updateField = (key: string, value: unknown) => setFormData((prev) => ({ ...prev, [key]: value }));
  const cls = "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  const renderField = (field: FieldDef) => {
    const value = formData[field.key] ?? "";
    switch (field.type) {
      case "text": case "url":
        return <div key={field.key}><label className="block text-sm font-medium text-slate-700 mb-1">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</label><input type={field.type === "url" ? "url" : "text"} value={value as string} onChange={(e) => updateField(field.key, e.target.value)} placeholder={field.placeholder} className={cls} disabled={disabled} />{field.hint && <p className="text-xs text-slate-400 mt-0.5">{field.hint}</p>}</div>;
      case "textarea":
        return <div key={field.key} className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</label><textarea value={value as string} onChange={(e) => updateField(field.key, e.target.value)} placeholder={field.placeholder} rows={3} className={cn(cls, "resize-none")} disabled={disabled} />{field.hint && <p className="text-xs text-slate-400 mt-0.5">{field.hint}</p>}</div>;
      case "date":
        return <div key={field.key}><label className="block text-sm font-medium text-slate-700 mb-1">{field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}</label><input type="date" value={value as string} onChange={(e) => updateField(field.key, e.target.value)} className={cls} disabled={disabled} /></div>;
      case "number":
        return <div key={field.key}><label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label><input type="number" value={value as string} onChange={(e) => updateField(field.key, e.target.value ? Number(e.target.value) : "")} placeholder={field.placeholder} className={cls} disabled={disabled} /></div>;
      case "boolean":
        return <div key={field.key} className="flex items-center gap-2 pt-5"><input type="checkbox" checked={!!value} onChange={(e) => updateField(field.key, e.target.checked)} className="rounded border-slate-300 text-blue-600" disabled={disabled} /><label className="text-sm text-slate-700">{field.label}</label></div>;
      case "select":
        return <div key={field.key}><label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label><select value={value as string} onChange={(e) => updateField(field.key, e.target.value)} className={cls} disabled={disabled}><option value="">— Select —</option>{(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
      case "fee-table":
        return <div key={field.key} className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label><FeeTable value={(value as Record<string, number>) ?? {}} onChange={(v) => updateField(field.key, v)} disabled={disabled} />{field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}</div>;
      case "repeatable":
        return <div key={field.key} className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label><RepeatableRows columns={field.columns ?? []} value={(value as any[]) ?? []} onChange={(v) => updateField(field.key, v)} disabled={disabled} />{field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}</div>;
      case "cutoff-table":
        return <div key={field.key} className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label><RepeatableRows columns={[{ key: "category", label: "Category", type: "text", placeholder: "General/OBC/SC…" }, { key: "marks", label: "Cutoff Marks", type: "number" }]} value={(value as any[]) ?? []} onChange={(v) => updateField(field.key, v)} disabled={disabled} />{field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}</div>;
      case "schedule-table":
        return <div key={field.key} className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label><RepeatableRows columns={[{ key: "date", label: "Date", type: "date" }, { key: "subject", label: "Subject/Paper", type: "text", placeholder: "Mathematics" }]} value={(value as any[]) ?? []} onChange={(v) => updateField(field.key, v)} disabled={disabled} />{field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}</div>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{essentialFields.map(renderField)}</div>
      {advancedFields.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">{showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Advanced ({advancedFields.length})</button>
          {showAdvanced && <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">{advancedFields.map(renderField)}</div>}
        </div>
      )}
      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button type="button" onClick={() => onSave(formData)} disabled={isSaving || disabled} className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Module
        </button>
      </div>
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function FeeTable({ value, onChange, disabled }: { value: Record<string, number>; onChange: (v: Record<string, number>) => void; disabled?: boolean }) {
  const cats = ["general", "obc", "sc", "st", "ews", "pwd"] as const;
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {cats.map((c) => (<div key={c}><label className="text-xs text-slate-500 mb-0.5 block uppercase">{c}</label><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span><input type="number" min={0} value={value[c] ?? ""} onChange={(e) => onChange({ ...value, [c]: Number(e.target.value) })} className="w-full rounded border border-slate-200 pl-5 pr-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" disabled={disabled} /></div></div>))}
    </div>
  );
}

function RepeatableRows({ columns, value, onChange, disabled }: { columns: { key: string; label: string; type: string; placeholder?: string }[]; value: Record<string, any>[]; onChange: (v: Record<string, any>[]) => void; disabled?: boolean }) {
  const add = () => { const row: Record<string, any> = {}; for (const c of columns) row[c.key] = ""; onChange([...value, row]); };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i: number, key: string, val: any) => onChange(value.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr) 32px` }}>
          {columns.map((c) => <span key={c.key} className="text-[10px] font-medium text-slate-400 uppercase">{c.label}</span>)}<span />
        </div>
      )}
      {value.map((row, i) => (
        <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr) 32px` }}>
          {columns.map((c) => (
            <input key={c.key} type={c.type === "number" ? "number" : c.type === "date" ? "date" : "text"} value={row[c.key] ?? ""} onChange={(e) => update(i, c.key, c.type === "number" ? Number(e.target.value) : e.target.value)} placeholder={c.placeholder} className="rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" disabled={disabled} />
          ))}
          <button type="button" onClick={() => remove(i)} className="p-1 text-slate-400 hover:text-red-500" disabled={disabled}><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={add} disabled={disabled} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-50"><Plus size={12} /> Add Row</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SEO & Tags
// ═══════════════════════════════════════════════════════════════════════════════

function SEOTab({ form, faqFields, appendFaq, removeFaq }: { form: any; faqFields: any[]; appendFaq: (v: any) => void; removeFaq: (i: number) => void }) {
  const tagsStr = (form.watch("tags") ?? []).join(", ");
  const keywordsStr = (form.watch("searchKeywords") ?? []).join(", ");

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">SEO Meta</h3>
        <div className="space-y-3">
          <div><label className="block text-xs text-slate-500 mb-1">SEO Title (max 60 chars)</label><input {...form.register("seoTitle")} maxLength={60} placeholder="e.g. IBPS PO 2025 — Notification, Dates, Eligibility" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" /><p className="text-xs text-slate-400 mt-0.5">{(form.watch("seoTitle") ?? "").length}/60</p></div>
          <div><label className="block text-xs text-slate-500 mb-1">Meta Description (max 160 chars)</label><textarea {...form.register("seoDescription")} maxLength={160} rows={2} placeholder="Brief description for search engines" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" /><p className="text-xs text-slate-400 mt-0.5">{(form.watch("seoDescription") ?? "").length}/160</p></div>
        </div>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Tags</h3>
        <input value={tagsStr} onChange={(e) => form.setValue("tags", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="banking, ibps, po" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </section>
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Search Keywords</h3>
        <input value={keywordsStr} onChange={(e) => form.setValue("searchKeywords", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="ibps po 2025, banking exam" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </section>
      <section>
        <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-slate-800">FAQs (JSON-LD)</h3><button type="button" onClick={() => appendFaq({ question: "", answer: "" })} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"><Plus size={14} /> Add FAQ</button></div>
        {faqFields.length === 0 && <p className="text-sm text-slate-400 italic">No FAQs. These generate FAQ rich snippets in Google.</p>}
        <div className="space-y-3">
          {faqFields.map((field, i) => (
            <div key={field.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">FAQ #{i + 1}</span><button type="button" onClick={() => removeFaq(i)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button></div>
              <input {...form.register(`faqs.${i}.question`)} placeholder="Question…" className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
              <textarea {...form.register(`faqs.${i}.answer`)} placeholder="Answer…" rows={2} className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none resize-none" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
