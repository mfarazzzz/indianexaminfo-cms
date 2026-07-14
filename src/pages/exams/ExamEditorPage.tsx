/**
 * ExamEditorPage.tsx — Dynamic, context-aware exam editor.
 *
 * Key behaviors:
 * 1. General tab adapts fields based on entityType (recruitment / exam / board / university)
 * 2. Content Modules tab generates full inline editors when modules are toggled on
 * 3. Dates & Eligibility tabs show extra fields based on entityType
 * 4. All data writes to the `exams` table (what the frontend reads)
 * 5. Module editors create/update `content_posts` linked by exam_id
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
  ChevronDown, ChevronUp, ExternalLink, Upload,
} from "lucide-react";
import {
  getExamById, createExam, updateExam, checkSlugAvailable,
} from "@/services/examService";
import { getCategories, type Category } from "@/services/categoryService";
import {
  getContentPosts, createContentPost, updateContentPost,
} from "@/services/contentService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FrontendSync } from "@/components/shared/FrontendSync";
import { revalidateExamPaths } from "@/lib/api/frontend";
import { EXAM_STATUSES } from "@/config/site";
import { CONTENT_TYPE_CONFIGS } from "@/config/contentTypeFields";
import { getFieldsForTab, type DynamicFieldDef } from "@/config/examTypeFields";
import { usePillars } from "@/hooks/usePillars";
import { useAuth } from "@/hooks/useAuth";
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
  // Content flags
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
  eligibility: z.object({
    age: z.string().default(""),
    qualification: z.string().default(""),
    nationality: z.string().default(""),
  }).optional(),
  vacancy: z.number().nullable().optional(),
  applicationFee: z.object({
    general: z.number().default(0),
    obc: z.number().default(0),
    sc: z.number().default(0),
    st: z.number().default(0),
    ews: z.number().optional(),
    pwd: z.number().optional(),
  }).optional(),
  selectionProcess: z.array(z.string()).default([]),
  syllabusHighlights: z.array(z.string()).default([]),
  // Academic
  academicYear: z.string().optional().nullable(),
  semester: z.string().optional().nullable(),
  admissionTo: z.string().optional().nullable(),
  // Tags
  tags: z.array(z.string()).default([]),
  searchKeywords: z.array(z.string()).default([]),
  // SEO
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
  // Dynamic type-specific fields stored in a flat JSONB-like map
  typeFields: z.record(z.unknown()).default({}),
});

type ExamFormData = z.infer<typeof examSchema>;

// ── Tabs ────────────────────────────────────────────────────────────────────

type TabId = "general" | "dates" | "eligibility" | "modules" | "seo";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <FileText size={16} /> },
  { id: "dates", label: "Dates & Fees", icon: <Calendar size={16} /> },
  { id: "eligibility", label: "Eligibility & Selection", icon: <GraduationCap size={16} /> },
  { id: "modules", label: "Content Modules", icon: <BookOpen size={16} /> },
  { id: "seo", label: "SEO & Tags", icon: <SearchIcon size={16} /> },
];

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

  // Content module states — loaded content_posts for this exam
  const [moduleData, setModuleData] = useState<Record<string, any>>({});
  const [moduleSaving, setModuleSaving] = useState<string | null>(null);

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      name: "", slug: "", shortName: "", pillar: "sarkari-naukri",
      categoryId: null, subcategoryId: null, entityType: "exam",
      conductingBody: "", officialWebsite: "", status: "upcoming",
      isFeatured: false,
      hasAdmitCard: false, hasResult: false, hasAnswerKey: false,
      hasSyllabus: false, hasDateSheet: false, hasMockTest: false,
      hasPreviousPapers: false, hasStudyMaterial: false, hasApplication: false,
      hasNotification: false, hasCutoff: false,
      dates: [], eligibility: { age: "", qualification: "", nationality: "" },
      vacancy: null, applicationFee: { general: 0, obc: 0, sc: 0, st: 0 },
      selectionProcess: [], syllabusHighlights: [],
      academicYear: null, semester: null, admissionTo: null,
      tags: [], searchKeywords: [],
      seoTitle: null, seoDescription: null, faqs: [],
      typeFields: {},
    },
  });

  const { fields: dateFields, append: appendDate, remove: removeDate } = useFieldArray({ control: form.control, name: "dates" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray({ control: form.control, name: "faqs" });

  const watchedPillar = form.watch("pillar");
  const watchedCategoryId = form.watch("categoryId");
  const watchedEntityType = form.watch("entityType");

  // Load categories when pillar changes
  useEffect(() => {
    if (watchedPillar) {
      getCategories(watchedPillar).then((cats) => {
        setCategories(cats.filter((c) => !c.parentId));
        setSubcategories(cats.filter((c) => c.parentId));
      });
    }
  }, [watchedPillar]);

  // Load exam data for editing
  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getExamById(id!)
      .then((data) => {
        if (!data) {
          toast.error("Exam not found");
          navigate("/exams");
          return;
        }
        setExam(data);
        form.reset({
          name: data.name,
          slug: data.slug,
          shortName: data.shortName,
          pillar: data.pillar,
          entityType: data.entityType,
          conductingBody: data.conductingBody,
          officialWebsite: data.officialWebsite ?? "",
          status: data.status,
          isFeatured: data.isFeatured,
          hasAdmitCard: data.hasAdmitCard,
          hasResult: data.hasResult,
          hasAnswerKey: data.hasAnswerKey,
          hasSyllabus: data.hasSyllabus,
          hasDateSheet: data.hasDateSheet,
          hasMockTest: data.hasMockTest,
          hasPreviousPapers: data.hasPreviousPapers,
          hasStudyMaterial: data.hasStudyMaterial,
          hasApplication: data.hasApplication,
          hasNotification: data.hasNotification,
          hasCutoff: data.hasCutoff,
          dates: data.dates ?? [],
          eligibility: data.eligibility ?? { age: "", qualification: "", nationality: "" },
          vacancy: data.vacancy ?? null,
          applicationFee: data.applicationFee ?? { general: 0, obc: 0, sc: 0, st: 0 },
          selectionProcess: data.selectionProcess ?? [],
          syllabusHighlights: data.syllabusHighlights ?? [],
          academicYear: data.academicYear ?? null,
          semester: data.semester ?? null,
          admissionTo: data.admissionTo ?? null,
          tags: data.tags ?? [],
          searchKeywords: data.searchKeywords ?? [],
          seoTitle: data.seoTitle ?? null,
          seoDescription: data.seoDescription ?? null,
          faqs: data.faqs ?? [],
          typeFields: {},
        });
        // Load linked content posts for module editors
        loadModuleData(data.id);
      })
      .finally(() => setLoading(false));
  }, [id, isNew, navigate, form]);

  // Load content_posts for this exam (populates module editors)
  const loadModuleData = useCallback(async (examId: string) => {
    try {
      const { data: posts } = await getContentPosts({ examId });
      const map: Record<string, any> = {};
      for (const post of posts) {
        map[post.contentType] = post;
      }
      setModuleData(map);
    } catch {
      // Ignore — modules just won't be pre-populated
    }
  }, []);

  // Auto-generate slug from name
  const handleNameBlur = useCallback(() => {
    const name = form.getValues("name");
    const currentSlug = form.getValues("slug");
    if (name && !currentSlug) {
      form.setValue("slug", slugify(name));
    }
  }, [form]);

  // Save exam handler
  const onSubmit = async (data: ExamFormData) => {
    setSaving(true);
    try {
      if (isNew) {
        const available = await checkSlugAvailable(data.slug);
        if (!available) {
          form.setError("slug", { message: "This slug is already taken" });
          setSaving(false);
          return;
        }
        const created = await createExam({
          slug: data.slug,
          name: data.name,
          shortName: data.shortName,
          pillar: data.pillar as Pillar,
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId,
          entityType: data.entityType,
          conductingBody: data.conductingBody,
          officialWebsite: data.officialWebsite,
          status: data.status,
          isFeatured: data.isFeatured,
          createdBy: user?.id,
        });
        await updateExam(created.id, buildUpdatePayload(data));
        toast.success("Exam created!");
        navigate(`/exams/${created.id}`, { replace: true });
      } else {
        if (data.slug !== exam?.slug) {
          const available = await checkSlugAvailable(data.slug, id);
          if (!available) {
            form.setError("slug", { message: "This slug is already taken" });
            setSaving(false);
            return;
          }
        }
        await updateExam(id!, { ...buildUpdatePayload(data), slug: data.slug, name: data.name, shortName: data.shortName, pillar: data.pillar as Pillar, categoryId: data.categoryId, subcategoryId: data.subcategoryId, entityType: data.entityType, conductingBody: data.conductingBody, officialWebsite: data.officialWebsite, status: data.status, isFeatured: data.isFeatured });
        toast.success("Exam saved!");
      }
    } catch (err) {
      toast.error("Save failed: " + String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/exams")} className="p-1.5 rounded hover:bg-slate-100">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {isNew ? "New Exam" : exam?.name ?? "Edit Exam"}
            </h1>
            {!isNew && <p className="text-xs text-slate-400">/{exam?.pillar}/{exam?.category}/{exam?.slug}</p>}
          </div>
          {!isNew && <StatusBadge status={exam?.status ?? "upcoming"} />}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <FrontendSync
              onSync={async (frontendUrl, token) =>
                revalidateExamPaths(
                  { pillar: exam?.pillar ?? "", categorySlug: exam?.category ?? "", examSlug: exam?.slug ?? "", enabledContentTypes: [] },
                  frontendUrl, token
                )
              }
            />
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-slate-200 bg-white rounded-t-lg px-2 pt-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-blue-600 text-blue-700 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-b-lg rounded-tr-lg border border-slate-200 p-6">
        {activeTab === "general" && (
          <GeneralTabContent
            form={form}
            pillars={pillars}
            categories={categories}
            subcategories={subcategories}
            watchedCategoryId={watchedCategoryId}
            watchedEntityType={watchedEntityType}
            onNameBlur={handleNameBlur}
          />
        )}
        {activeTab === "dates" && (
          <DatesTabContent
            form={form}
            dateFields={dateFields}
            appendDate={appendDate}
            removeDate={removeDate}
            entityType={watchedEntityType}
          />
        )}
        {activeTab === "eligibility" && (
          <EligibilityTabContent form={form} entityType={watchedEntityType} />
        )}
        {activeTab === "modules" && (
          <ContentModulesTab
            form={form}
            examId={id ?? ""}
            examName={form.watch("name")}
            pillar={watchedPillar}
            moduleData={moduleData}
            setModuleData={setModuleData}
            moduleSaving={moduleSaving}
            setModuleSaving={setModuleSaving}
            isNew={isNew}
          />
        )}
        {activeTab === "seo" && (
          <SEOTabContent
            form={form}
            faqFields={faqFields}
            appendFaq={appendFaq}
            removeFaq={removeFaq}
          />
        )}
      </div>
    </form>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildUpdatePayload(data: ExamFormData) {
  return {
    hasAdmitCard: data.hasAdmitCard,
    hasResult: data.hasResult,
    hasAnswerKey: data.hasAnswerKey,
    hasSyllabus: data.hasSyllabus,
    hasDateSheet: data.hasDateSheet,
    hasMockTest: data.hasMockTest,
    hasPreviousPapers: data.hasPreviousPapers,
    hasStudyMaterial: data.hasStudyMaterial,
    hasApplication: data.hasApplication,
    hasNotification: data.hasNotification,
    hasCutoff: data.hasCutoff,
    dates: data.dates,
    eligibility: data.eligibility,
    vacancy: data.vacancy,
    applicationFee: data.applicationFee,
    selectionProcess: data.selectionProcess,
    syllabusHighlights: data.syllabusHighlights,
    academicYear: data.academicYear,
    semester: data.semester,
    admissionTo: data.admissionTo,
    tags: data.tags,
    searchKeywords: data.searchKeywords,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    faqs: data.faqs,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC FIELD RENDERER — renders fields from examTypeFields config
// ═══════════════════════════════════════════════════════════════════════════════

function DynamicFields({ fields, form }: { fields: DynamicFieldDef[]; form: any }) {
  if (fields.length === 0) return null;

  // Group fields by section
  const sections = new Map<string, DynamicFieldDef[]>();
  for (const f of fields) {
    const sec = f.section ?? "_default";
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push(f);
  }

  return (
    <>
      {[...sections.entries()].map(([section, sectionFields]) => (
        <div key={section} className="space-y-3">
          {section !== "_default" && (
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1 mt-4">
              {section}
            </h4>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sectionFields.map((field) => (
              <DynamicFieldInput key={field.key} field={field} form={form} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function DynamicFieldInput({ field, form }: { field: DynamicFieldDef; form: any }) {
  const value = form.watch(`typeFields.${field.key}`) ?? "";
  const onChange = (val: unknown) => form.setValue(`typeFields.${field.key}`, val);

  const inputCls = "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  switch (field.type) {
    case "text":
    case "url":
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {field.label} {field.required && <span className="text-red-400">*</span>}
          </label>
          <input
            type={field.type === "url" ? "url" : "text"}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputCls}
          />
          {field.hint && <p className="text-xs text-slate-400 mt-0.5">{field.hint}</p>}
        </div>
      );
    case "textarea":
      return (
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {field.label} {field.required && <span className="text-red-400">*</span>}
          </label>
          <textarea
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className={cn(inputCls, "resize-none")}
          />
          {field.hint && <p className="text-xs text-slate-400 mt-0.5">{field.hint}</p>}
        </div>
      );
    case "date":
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {field.label} {field.required && <span className="text-red-400">*</span>}
          </label>
          <input
            type="date"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
          />
        </div>
      );
    case "number":
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {field.label} {field.required && <span className="text-red-400">*</span>}
          </label>
          <input
            type="number"
            value={value as string}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
            placeholder={field.placeholder}
            className={inputCls}
          />
        </div>
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-slate-300 text-blue-600"
          />
          <label className="text-sm text-slate-700">{field.label}</label>
        </div>
      );
    case "select":
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {field.label} {field.required && <span className="text-red-400">*</span>}
          </label>
          <select
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
          >
            <option value="">— Select —</option>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    case "comma-list":
      return (
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
          <input
            type="text"
            value={Array.isArray(value) ? (value as string[]).join(", ") : (value as string)}
            onChange={(e) => onChange(e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
            placeholder={field.placeholder}
            className={inputCls}
          />
          {field.hint && <p className="text-xs text-slate-400 mt-0.5">{field.hint}</p>}
        </div>
      );
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: General (adapts based on entityType)
// ═══════════════════════════════════════════════════════════════════════════════

function GeneralTabContent({
  form, pillars, categories, subcategories, watchedCategoryId, watchedEntityType, onNameBlur,
}: {
  form: any; pillars: any[]; categories: Category[]; subcategories: Category[];
  watchedCategoryId: string | null | undefined; watchedEntityType: string; onNameBlur: () => void;
}) {
  const filteredSubcats = subcategories.filter((c) => c.parentId === watchedCategoryId);
  const dynamicFields = useMemo(() => getFieldsForTab(watchedEntityType, "general"), [watchedEntityType]);

  return (
    <div className="space-y-6">
      {/* Core identity fields (always shown) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Exam Name *</label>
          <input
            {...form.register("name")}
            onBlur={onNameBlur}
            placeholder="e.g. IBPS PO 2025"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {form.formState.errors.name && <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Slug *</label>
          <input
            {...form.register("slug")}
            placeholder="ibps-po-2025"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {form.formState.errors.slug && <p className="text-xs text-red-500 mt-1">{form.formState.errors.slug.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Short Name</label>
          <input {...form.register("shortName")} placeholder="IBPS PO" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label>
          <select {...form.register("entityType")} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            <option value="recruitment">Government Recruitment</option>
            <option value="exam">Entrance Exam</option>
            <option value="board">Board Exam</option>
            <option value="university">University Admission</option>
          </select>
          <p className="text-xs text-slate-400 mt-0.5">Changes the fields shown across all tabs</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Pillar *</label>
          <select {...form.register("pillar")} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {pillars.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}
            {pillars.length === 0 && (
              <>
                <option value="sarkari-naukri">Sarkari Naukri</option>
                <option value="entrance-exam">Entrance Exam</option>
                <option value="board-university">Board & University</option>
              </>
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select {...form.register("categoryId")} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            <option value="">— Select category —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subcategory</label>
          <select {...form.register("subcategoryId")} disabled={!watchedCategoryId} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50">
            <option value="">— Select subcategory —</option>
            {filteredSubcats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Conducting Body *</label>
          <input {...form.register("conductingBody")} placeholder="e.g. Institute of Banking Personnel Selection" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          {form.formState.errors.conductingBody && <p className="text-xs text-red-500 mt-1">{form.formState.errors.conductingBody.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Official Website</label>
          <input {...form.register("officialWebsite")} placeholder="https://www.ibps.in" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Exam Status</label>
          <select {...form.register("status")} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {EXAM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" {...form.register("isFeatured")} id="isFeatured" className="rounded border-slate-300" />
          <label htmlFor="isFeatured" className="text-sm text-slate-700 flex items-center gap-1">
            <Star size={14} className="text-amber-500" /> Featured Exam
          </label>
        </div>
      </div>

      {/* Dynamic fields based on entityType */}
      {dynamicFields.length > 0 && (
        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
              {watchedEntityType}
            </span>
            Type-Specific Fields
          </h3>
          <DynamicFields fields={dynamicFields} form={form} />
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Dates & Fees (with dynamic type-specific date fields)
// ═══════════════════════════════════════════════════════════════════════════════

function DatesTabContent({
  form, dateFields, appendDate, removeDate, entityType,
}: {
  form: any; dateFields: any[]; appendDate: (v: any) => void; removeDate: (i: number) => void; entityType: string;
}) {
  const dynamicDateFields = useMemo(() => getFieldsForTab(entityType, "dates"), [entityType]);

  return (
    <div className="space-y-8">
      {/* Type-specific date fields */}
      {dynamicDateFields.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium capitalize">
              {entityType}
            </span>
            Key Dates
          </h3>
          <DynamicFields fields={dynamicDateFields} form={form} />
        </section>
      )}

      {/* Important Dates (generic — all types) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Important Dates (Timeline)</h3>
          <button
            type="button"
            onClick={() => appendDate({ label: "", date: "", isUrgent: false })}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} /> Add Date
          </button>
        </div>
        {dateFields.length === 0 && (
          <p className="text-sm text-slate-400 italic">No dates added yet. These appear as a timeline on the frontend.</p>
        )}
        <div className="space-y-2">
          {dateFields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_150px_auto_auto] gap-2 items-center">
              <input
                {...form.register(`dates.${i}.label`)}
                placeholder="e.g. Application Start"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
              <input
                type="date"
                {...form.register(`dates.${i}.date`)}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
              <label className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap">
                <input type="checkbox" {...form.register(`dates.${i}.isUrgent`)} className="rounded border-slate-300" />
                Urgent
              </label>
              <button type="button" onClick={() => removeDate(i)} className="p-1 text-slate-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Vacancy */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Total Vacancy</h3>
        <input
          type="number"
          {...form.register("vacancy", { valueAsNumber: true })}
          placeholder="e.g. 4500"
          className="w-48 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </section>

      {/* Application Fee */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Application Fee (₹)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(["general", "obc", "sc", "st", "ews", "pwd"] as const).map((cat) => (
            <div key={cat}>
              <label className="block text-xs text-slate-500 mb-1 uppercase">{cat}</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                <input
                  type="number"
                  min={0}
                  {...form.register(`applicationFee.${cat}`, { valueAsNumber: true })}
                  className="w-full rounded-md border border-slate-200 pl-5 pr-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Academic fields (board/university) */}
      {(entityType === "board" || entityType === "university") && (
        <section>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Academic Period</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Academic Year</label>
              <input {...form.register("academicYear")} placeholder="2025-26" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Semester</label>
              <input {...form.register("semester")} placeholder="1st Semester" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Admission To</label>
              <input {...form.register("admissionTo")} placeholder="B.Tech, MBA" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Eligibility & Selection (adapts to entityType)
// ═══════════════════════════════════════════════════════════════════════════════

function EligibilityTabContent({ form, entityType }: { form: any; entityType: string }) {
  const selectionStr = (form.watch("selectionProcess") ?? []).join(", ");
  const syllabusStr = (form.watch("syllabusHighlights") ?? []).join(", ");
  const dynamicFields = useMemo(() => getFieldsForTab(entityType, "eligibility"), [entityType]);

  return (
    <div className="space-y-8">
      {/* Core Eligibility (always shown) */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Eligibility Criteria</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Age Limit</label>
            <input {...form.register("eligibility.age")} placeholder="e.g. 20-30 years" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Qualification</label>
            <input {...form.register("eligibility.qualification")} placeholder="e.g. Graduation in any discipline" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nationality</label>
            <input {...form.register("eligibility.nationality")} placeholder="e.g. Indian" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
      </section>

      {/* Type-specific eligibility fields */}
      {dynamicFields.length > 0 && (
        <section className="border-t border-slate-100 pt-6">
          <DynamicFields fields={dynamicFields} form={form} />
        </section>
      )}

      {/* Selection Process */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Selection Process</h3>
        <p className="text-xs text-slate-400 mb-2">Comma-separated stages</p>
        <input
          value={selectionStr}
          onChange={(e) => form.setValue("selectionProcess", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
          placeholder="Prelims, Mains, Interview"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {(form.watch("selectionProcess") ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.watch("selectionProcess").map((step: string, i: number) => (
              <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {i + 1}. {step}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Syllabus Highlights */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Syllabus Highlights</h3>
        <p className="text-xs text-slate-400 mb-2">Comma-separated subjects/topics</p>
        <input
          value={syllabusStr}
          onChange={(e) => form.setValue("syllabusHighlights", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
          placeholder="English, Reasoning, Quantitative Aptitude, General Awareness"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {(form.watch("syllabusHighlights") ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.watch("syllabusHighlights").map((subj: string, i: number) => (
              <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 border border-green-100">{subj}</span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Content Modules — The heart of the dynamic system
// Each enabled module generates a full inline editor with type-specific fields
// ═══════════════════════════════════════════════════════════════════════════════

const MODULE_FLAG_MAP: { flag: string; contentType: ContentType; label: string; icon: string }[] = [
  { flag: "hasNotification",    contentType: "notification",    label: "Notification",    icon: "🔔" },
  { flag: "hasApplication",     contentType: "application",     label: "Application",     icon: "📝" },
  { flag: "hasAdmitCard",       contentType: "admit-card",      label: "Admit Card",      icon: "🪪" },
  { flag: "hasDateSheet",       contentType: "date-sheet",      label: "Date Sheet",      icon: "📅" },
  { flag: "hasSyllabus",        contentType: "syllabus",        label: "Syllabus",        icon: "📚" },
  { flag: "hasAnswerKey",       contentType: "answer-key",      label: "Answer Key",      icon: "🔑" },
  { flag: "hasResult",          contentType: "result",          label: "Result",          icon: "🏆" },
  { flag: "hasCutoff",          contentType: "cutoff",          label: "Cutoff",          icon: "📊" },
  { flag: "hasPreviousPapers",  contentType: "previous-papers", label: "Previous Papers", icon: "📄" },
  { flag: "hasMockTest",        contentType: "mock-test",       label: "Mock Test",       icon: "🧪" },
  { flag: "hasStudyMaterial",   contentType: "study-material",  label: "Study Material",  icon: "🗂️" },
];

function ContentModulesTab({
  form, examId, examName, pillar, moduleData, setModuleData, moduleSaving, setModuleSaving, isNew,
}: {
  form: any; examId: string; examName: string; pillar: string;
  moduleData: Record<string, any>; setModuleData: (v: Record<string, any>) => void;
  moduleSaving: string | null; setModuleSaving: (v: string | null) => void;
  isNew: boolean;
}) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleExpand = (ct: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(ct)) next.delete(ct);
      else next.add(ct);
      return next;
    });
  };

  // When a flag is toggled ON, auto-expand the module
  const handleFlagToggle = (flag: string, ct: string) => {
    const current = form.getValues(flag);
    form.setValue(flag, !current);
    if (!current) {
      // Toggled ON → expand
      setExpandedModules((prev) => new Set(prev).add(ct));
    }
  };

  // Save module data as a content_post
  const saveModule = async (contentType: ContentType, moduleFormData: Record<string, unknown>) => {
    if (isNew) {
      toast.error("Save the exam first before adding module content.");
      return;
    }
    setModuleSaving(contentType);
    try {
      const existing = moduleData[contentType];
      const slug = `${form.getValues("slug")}-${contentType}`;
      const title = `${examName} — ${CONTENT_TYPE_CONFIGS[contentType]?.label ?? contentType}`;

      if (existing?.id) {
        // Update existing content post
        const updated = await updateContentPost(existing.id, {
          title,
          slug,
          contentTypeData: moduleFormData,
          pillar,
          contentType,
          examEntityName: examName,
          status: existing.status,
        });
        setModuleData({ ...moduleData, [contentType]: updated });
        toast.success(`${CONTENT_TYPE_CONFIGS[contentType]?.label} saved`);
      } else {
        // Create new content post
        const created = await createContentPost({
          title,
          slug,
          pillar,
          contentType,
          examId,
          examEntityName: examName,
          contentTypeData: moduleFormData,
          status: "draft",
        });
        setModuleData({ ...moduleData, [contentType]: created });
        toast.success(`${CONTENT_TYPE_CONFIGS[contentType]?.label} created`);
      }
    } catch (err) {
      toast.error(`Failed to save: ${String(err)}`);
    } finally {
      setModuleSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="mb-4">
        <p className="text-sm text-slate-600">
          Enable content modules for this exam. Each enabled module generates a complete editor below.
          Module data is saved as linked content posts that the frontend renders.
        </p>
        {isNew && (
          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            ⚠️ Save the exam first to enable module editing.
          </p>
        )}
      </div>

      {MODULE_FLAG_MAP.map(({ flag, contentType, label, icon }) => {
        const isEnabled = form.watch(flag);
        const isExpanded = expandedModules.has(contentType);
        const hasData = !!moduleData[contentType];
        const config = CONTENT_TYPE_CONFIGS[contentType];

        return (
          <div
            key={contentType}
            className={cn(
              "border rounded-lg transition-all",
              isEnabled ? "border-blue-200 bg-blue-50/30" : "border-slate-200"
            )}
          >
            {/* Module header — toggle + expand */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => handleFlagToggle(flag, contentType)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-lg">{icon}</span>
                <div>
                  <p className={cn("text-sm font-medium", isEnabled ? "text-slate-900" : "text-slate-500")}>
                    {label}
                  </p>
                  {config && <p className="text-xs text-slate-400">{config.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasData && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                    Has content
                  </span>
                )}
                {isEnabled && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(contentType)}
                    className="p-1 rounded hover:bg-slate-200 text-slate-500"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}
              </div>
            </div>

            {/* Expanded module editor */}
            {isEnabled && isExpanded && config && (
              <div className="border-t border-slate-200 bg-white px-4 py-4">
                <ModuleEditor
                  contentType={contentType}
                  config={config}
                  existingData={moduleData[contentType]?.contentTypeData ?? {}}
                  onSave={(data) => saveModule(contentType as ContentType, data)}
                  isSaving={moduleSaving === contentType}
                  disabled={isNew}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Module Editor — renders fields from CONTENT_TYPE_CONFIGS dynamically ─────

function ModuleEditor({
  contentType, config, existingData, onSave, isSaving, disabled,
}: {
  contentType: string;
  config: { label: string; fields: any[] };
  existingData: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => void;
  isSaving: boolean;
  disabled: boolean;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>(existingData);

  // Sync when existingData changes
  useEffect(() => {
    setFormData(existingData);
  }, [existingData]);

  const updateField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const inputCls = "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {config.fields.map((field) => {
          const value = formData[field.key] ?? "";

          switch (field.type) {
            case "text":
            case "url":
              return (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type={field.type === "url" ? "url" : "text"}
                    value={value as string}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className={inputCls}
                    disabled={disabled}
                  />
                  {field.hint && <p className="text-xs text-slate-400 mt-0.5">{field.hint}</p>}
                </div>
              );
            case "textarea":
              return (
                <div key={field.key} className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  <textarea
                    value={value as string}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className={cn(inputCls, "resize-none")}
                    disabled={disabled}
                  />
                  {field.hint && <p className="text-xs text-slate-400 mt-0.5">{field.hint}</p>}
                </div>
              );
            case "date":
              return (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type="date"
                    value={value as string}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    className={inputCls}
                    disabled={disabled}
                  />
                </div>
              );
            case "number":
              return (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type="number"
                    value={value as string}
                    onChange={(e) => updateField(field.key, e.target.value ? Number(e.target.value) : "")}
                    placeholder={field.placeholder}
                    className={inputCls}
                    disabled={disabled}
                  />
                </div>
              );
            case "boolean":
              return (
                <div key={field.key} className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => updateField(field.key, e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                    disabled={disabled}
                  />
                  <label className="text-sm text-slate-700">{field.label}</label>
                </div>
              );
            case "select":
              return (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  <select
                    value={value as string}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    className={inputCls}
                    disabled={disabled}
                  >
                    <option value="">— Select —</option>
                    {(field.options ?? []).map((o: any) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              );
            case "fee-table":
              return (
                <div key={field.key} className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label>
                  <FeeTableField
                    value={(value as Record<string, number>) ?? {}}
                    onChange={(v) => updateField(field.key, v)}
                    disabled={disabled}
                  />
                  {field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}
                </div>
              );
            case "subject-list":
              return (
                <div key={field.key} className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label>
                  <RepeatableList
                    value={(value as any[]) ?? []}
                    onChange={(v) => updateField(field.key, v)}
                    disabled={disabled}
                    fields={["name", "url"]}
                    placeholders={["Subject / Book name", "Resource URL (optional)"]}
                  />
                  {field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}
                </div>
              );
            case "paper-list":
              return (
                <div key={field.key} className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label>
                  <RepeatableList
                    value={(value as any[]) ?? []}
                    onChange={(v) => updateField(field.key, v)}
                    disabled={disabled}
                    fields={["year", "title", "url"]}
                    placeholders={["Year", "Paper name", "PDF URL"]}
                  />
                </div>
              );
            case "cutoff-table":
              return (
                <div key={field.key} className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label>
                  <RepeatableList
                    value={(value as any[]) ?? []}
                    onChange={(v) => updateField(field.key, v)}
                    disabled={disabled}
                    fields={["category", "marks"]}
                    placeholders={["Category (General/OBC/SC…)", "Cutoff Marks"]}
                  />
                  {field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}
                </div>
              );
            case "schedule-table":
              return (
                <div key={field.key} className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label>
                  <RepeatableList
                    value={(value as any[]) ?? []}
                    onChange={(v) => updateField(field.key, v)}
                    disabled={disabled}
                    fields={["date", "subject"]}
                    placeholders={["Date", "Subject / Paper"]}
                  />
                </div>
              );
            default:
              return null;
          }
        })}
      </div>

      {/* Save module button */}
      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onSave(formData)}
          disabled={isSaving || disabled}
          className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save {config.label}
        </button>
      </div>
    </div>
  );
}

// ── Reusable sub-components for module editors ───────────────────────────────

function FeeTableField({ value, onChange, disabled }: { value: Record<string, number>; onChange: (v: Record<string, number>) => void; disabled?: boolean }) {
  const cats = ["general", "obc", "sc", "st", "ews", "pwd"] as const;
  const labels: Record<string, string> = { general: "General", obc: "OBC-NCL", sc: "SC", st: "ST", ews: "EWS", pwd: "PwBD" };
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {cats.map((c) => (
        <div key={c}>
          <label className="text-xs text-slate-500 mb-0.5 block">{labels[c]}</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
            <input
              type="number"
              min={0}
              value={value[c] ?? ""}
              onChange={(e) => onChange({ ...value, [c]: Number(e.target.value) })}
              className="w-full rounded border border-slate-200 pl-5 pr-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              disabled={disabled}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RepeatableList({
  value, onChange, disabled, fields, placeholders,
}: {
  value: Record<string, string>[];
  onChange: (v: Record<string, string>[]) => void;
  disabled?: boolean;
  fields: string[];
  placeholders: string[];
}) {
  const add = () => {
    const empty: Record<string, string> = {};
    for (const f of fields) empty[f] = "";
    onChange([...value, empty]);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));

  return (
    <div className="space-y-2">
      {value.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          {fields.map((f, fi) => (
            <input
              key={f}
              value={row[f] ?? ""}
              onChange={(e) => update(i, f, e.target.value)}
              placeholder={placeholders[fi]}
              className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              disabled={disabled}
            />
          ))}
          <button type="button" onClick={() => remove(i)} className="p-1 text-slate-400 hover:text-red-500" disabled={disabled}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-50"
      >
        <Plus size={12} /> Add Row
      </button>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SEO & Tags
// ═══════════════════════════════════════════════════════════════════════════════

function SEOTabContent({
  form, faqFields, appendFaq, removeFaq,
}: {
  form: any; faqFields: any[]; appendFaq: (v: any) => void; removeFaq: (i: number) => void;
}) {
  const tagsStr = (form.watch("tags") ?? []).join(", ");
  const keywordsStr = (form.watch("searchKeywords") ?? []).join(", ");

  return (
    <div className="space-y-8">
      {/* SEO Title & Description */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">SEO Meta</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">SEO Title (max 60 chars)</label>
            <input
              {...form.register("seoTitle")}
              maxLength={60}
              placeholder="e.g. IBPS PO 2025 — Notification, Dates, Eligibility"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-0.5">{(form.watch("seoTitle") ?? "").length}/60</p>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Meta Description (max 160 chars)</label>
            <textarea
              {...form.register("seoDescription")}
              maxLength={160}
              rows={2}
              placeholder="Brief description for search engines..."
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-slate-400 mt-0.5">{(form.watch("seoDescription") ?? "").length}/160</p>
          </div>
        </div>
      </section>

      {/* Tags */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Tags</h3>
        <p className="text-xs text-slate-400 mb-2">Comma-separated tags for categorization</p>
        <input
          value={tagsStr}
          onChange={(e) => form.setValue("tags", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
          placeholder="banking, ibps, po"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </section>

      {/* Search Keywords */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Search Keywords</h3>
        <p className="text-xs text-slate-400 mb-2">Extra keywords to improve internal search results</p>
        <input
          value={keywordsStr}
          onChange={(e) => form.setValue("searchKeywords", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
          placeholder="ibps po 2025, banking exam, probationary officer"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </section>

      {/* FAQs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">FAQs (JSON-LD Schema)</h3>
          <button
            type="button"
            onClick={() => appendFaq({ question: "", answer: "" })}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} /> Add FAQ
          </button>
        </div>
        {faqFields.length === 0 && (
          <p className="text-sm text-slate-400 italic">No FAQs added. These appear as FAQ structured data in Google search.</p>
        )}
        <div className="space-y-3">
          {faqFields.map((field, i) => (
            <div key={field.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">FAQ #{i + 1}</span>
                <button type="button" onClick={() => removeFaq(i)} className="text-slate-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
              <input
                {...form.register(`faqs.${i}.question`)}
                placeholder="Question..."
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
              <textarea
                {...form.register(`faqs.${i}.answer`)}
                placeholder="Answer..."
                rows={2}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
