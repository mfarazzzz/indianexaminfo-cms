import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Save, Plus, Trash2, Star, Calendar,
  FileText, GraduationCap, BookOpen, Search as SearchIcon,
} from "lucide-react";
import {
  getExamById, createExam, updateExam, checkSlugAvailable,
} from "@/services/examService";
import { getCategories, type Category } from "@/services/categoryService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FrontendSync } from "@/components/shared/FrontendSync";
import { revalidateExamPaths } from "@/lib/api/frontend";
import { EXAM_STATUSES } from "@/config/site";
import { usePillars } from "@/hooks/usePillars";
import { useAuth } from "@/hooks/useAuth";
import { cn, slugify } from "@/lib/utils";
import type { ExamEntity, Pillar } from "@/types/exam";

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
});

type ExamFormData = z.infer<typeof examSchema>;

// ── Tabs ────────────────────────────────────────────────────────────────────

type TabId = "general" | "dates" | "eligibility" | "content" | "seo";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <FileText size={16} /> },
  { id: "dates", label: "Dates & Fees", icon: <Calendar size={16} /> },
  { id: "eligibility", label: "Eligibility & Selection", icon: <GraduationCap size={16} /> },
  { id: "content", label: "Content Flags", icon: <BookOpen size={16} /> },
  { id: "seo", label: "SEO & Tags", icon: <SearchIcon size={16} /> },
];

// ── Component ───────────────────────────────────────────────────────────────

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
    },
  });

  const { fields: dateFields, append: appendDate, remove: removeDate } = useFieldArray({ control: form.control, name: "dates" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray({ control: form.control, name: "faqs" });

  const watchedPillar = form.watch("pillar");
  const watchedCategoryId = form.watch("categoryId");

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
        // Populate form — need to look up category/subcategory IDs
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
        });
      })
      .finally(() => setLoading(false));
  }, [id, isNew, navigate, form]);

  // Auto-generate slug from name
  const handleNameBlur = useCallback(() => {
    const name = form.getValues("name");
    const currentSlug = form.getValues("slug");
    if (name && !currentSlug) {
      form.setValue("slug", slugify(name));
    }
  }, [form]);

  // Save handler
  const onSubmit = async (data: ExamFormData) => {
    setSaving(true);
    try {
      if (isNew) {
        // Check slug availability
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
        // Now update with all additional fields
        await updateExam(created.id, {
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
        });
        toast.success("Exam created!");
        navigate(`/exams/${created.id}`, { replace: true });
      } else {
        // Check slug if changed
        if (data.slug !== exam?.slug) {
          const available = await checkSlugAvailable(data.slug, id);
          if (!available) {
            form.setError("slug", { message: "This slug is already taken" });
            setSaving(false);
            return;
          }
        }
        await updateExam(id!, {
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
        });
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
              onSync={async (frontendUrl, token) => {
                return revalidateExamPaths(
                  {
                    pillar: exam?.pillar ?? "",
                    categorySlug: exam?.category ?? "",
                    examSlug: exam?.slug ?? "",
                    enabledContentTypes: [],
                  },
                  frontendUrl,
                  token
                );
              }}
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
            onNameBlur={handleNameBlur}
            isNew={isNew}
          />
        )}
        {activeTab === "dates" && (
          <DatesTabContent
            form={form}
            dateFields={dateFields}
            appendDate={appendDate}
            removeDate={removeDate}
          />
        )}
        {activeTab === "eligibility" && <EligibilityTabContent form={form} />}
        {activeTab === "content" && <ContentFlagsTabContent form={form} />}
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


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: General
// ═══════════════════════════════════════════════════════════════════════════════

function GeneralTabContent({
  form, pillars, categories, subcategories, watchedCategoryId, onNameBlur, isNew,
}: {
  form: any; pillars: any[]; categories: Category[]; subcategories: Category[];
  watchedCategoryId: string | null | undefined; onNameBlur: () => void; isNew: boolean;
}) {
  const filteredSubcats = subcategories.filter((c) => c.parentId === watchedCategoryId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Name */}
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-1">Exam Name *</label>
        <input
          {...form.register("name")}
          onBlur={onNameBlur}
          placeholder="e.g. IBPS PO 2025"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {form.formState.errors.name && (
          <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>
        )}
      </div>

      {/* Slug */}
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-1">Slug *</label>
        <input
          {...form.register("slug")}
          placeholder="ibps-po-2025"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {form.formState.errors.slug && (
          <p className="text-xs text-red-500 mt-1">{form.formState.errors.slug.message}</p>
        )}
      </div>

      {/* Short Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Short Name</label>
        <input
          {...form.register("shortName")}
          placeholder="IBPS PO"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Entity Type */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label>
        <select
          {...form.register("entityType")}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="exam">Exam</option>
          <option value="board">Board</option>
          <option value="university">University</option>
          <option value="recruitment">Recruitment</option>
        </select>
      </div>

      {/* Pillar */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Pillar *</label>
        <select
          {...form.register("pillar")}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {pillars.map((p) => (
            <option key={p.slug} value={p.slug}>{p.label}</option>
          ))}
          {pillars.length === 0 && (
            <>
              <option value="sarkari-naukri">Sarkari Naukri</option>
              <option value="entrance-exam">Entrance Exam</option>
              <option value="board-university">Board & University</option>
            </>
          )}
        </select>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
        <select
          {...form.register("categoryId")}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">— Select category —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Subcategory */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Subcategory</label>
        <select
          {...form.register("subcategoryId")}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          disabled={!watchedCategoryId}
        >
          <option value="">— Select subcategory —</option>
          {filteredSubcats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Conducting Body */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Conducting Body *</label>
        <input
          {...form.register("conductingBody")}
          placeholder="e.g. Institute of Banking Personnel Selection"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {form.formState.errors.conductingBody && (
          <p className="text-xs text-red-500 mt-1">{form.formState.errors.conductingBody.message}</p>
        )}
      </div>

      {/* Official Website */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Official Website</label>
        <input
          {...form.register("officialWebsite")}
          placeholder="https://www.ibps.in"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Exam Status</label>
        <select
          {...form.register("status")}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {EXAM_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Featured */}
      <div className="flex items-center gap-2 pt-6">
        <input type="checkbox" {...form.register("isFeatured")} id="isFeatured" className="rounded border-slate-300" />
        <label htmlFor="isFeatured" className="text-sm text-slate-700 flex items-center gap-1">
          <Star size={14} className="text-amber-500" /> Featured Exam
        </label>
      </div>

      {/* Academic fields (for board/university types) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
        <input
          {...form.register("academicYear")}
          placeholder="2025-26"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Semester</label>
        <input
          {...form.register("semester")}
          placeholder="e.g. 1st Semester"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Admission To</label>
        <input
          {...form.register("admissionTo")}
          placeholder="e.g. B.Tech, MBA"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Dates & Fees
// ═══════════════════════════════════════════════════════════════════════════════

function DatesTabContent({
  form, dateFields, appendDate, removeDate,
}: {
  form: any; dateFields: any[]; appendDate: (v: any) => void; removeDate: (i: number) => void;
}) {
  return (
    <div className="space-y-8">
      {/* Important Dates */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Important Dates</h3>
          <button
            type="button"
            onClick={() => appendDate({ label: "", date: "", isUrgent: false })}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} /> Add Date
          </button>
        </div>
        {dateFields.length === 0 && (
          <p className="text-sm text-slate-400 italic">No dates added yet. Click "Add Date" to get started.</p>
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Eligibility & Selection
// ═══════════════════════════════════════════════════════════════════════════════

function EligibilityTabContent({ form }: { form: any }) {
  // Selection process as comma-separated → array
  const selectionStr = (form.watch("selectionProcess") ?? []).join(", ");
  const syllabusStr = (form.watch("syllabusHighlights") ?? []).join(", ");

  return (
    <div className="space-y-8">
      {/* Eligibility */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Eligibility Criteria</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Age Limit</label>
            <input
              {...form.register("eligibility.age")}
              placeholder="e.g. 20-30 years"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Qualification</label>
            <input
              {...form.register("eligibility.qualification")}
              placeholder="e.g. Graduation in any discipline"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nationality</label>
            <input
              {...form.register("eligibility.nationality")}
              placeholder="e.g. Indian"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Selection Process */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Selection Process</h3>
        <p className="text-xs text-slate-400 mb-2">Comma-separated stages (e.g. Prelims, Mains, Interview)</p>
        <input
          value={selectionStr}
          onChange={(e) => {
            const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
            form.setValue("selectionProcess", arr);
          }}
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
          onChange={(e) => {
            const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
            form.setValue("syllabusHighlights", arr);
          }}
          placeholder="English, Reasoning, Quantitative Aptitude, General Awareness"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {(form.watch("syllabusHighlights") ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.watch("syllabusHighlights").map((subj: string, i: number) => (
              <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 border border-green-100">
                {subj}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Content Flags
// ═══════════════════════════════════════════════════════════════════════════════

function ContentFlagsTabContent({ form }: { form: any }) {
  const flags = [
    { key: "hasNotification", label: "Notification", desc: "Official notification PDF/page available" },
    { key: "hasApplication", label: "Application", desc: "Online application form link/guide available" },
    { key: "hasAdmitCard", label: "Admit Card", desc: "Admit card download page available" },
    { key: "hasDateSheet", label: "Date Sheet", desc: "Exam date sheet/schedule available" },
    { key: "hasSyllabus", label: "Syllabus", desc: "Detailed syllabus page available" },
    { key: "hasAnswerKey", label: "Answer Key", desc: "Answer key download available" },
    { key: "hasResult", label: "Result", desc: "Result page/link available" },
    { key: "hasCutoff", label: "Cutoff", desc: "Cutoff marks data available" },
    { key: "hasPreviousPapers", label: "Previous Papers", desc: "Past year question papers available" },
    { key: "hasMockTest", label: "Mock Test", desc: "Practice mock tests available" },
    { key: "hasStudyMaterial", label: "Study Material", desc: "Study notes/material available" },
  ] as const;

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Toggle which content types are available for this exam. This controls what hub pages show this exam and what tabs appear on the frontend exam detail page.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {flags.map(({ key, label, desc }) => (
          <label
            key={key}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
              form.watch(key) ? "border-blue-200 bg-blue-50/50" : "border-slate-200 hover:border-slate-300"
            )}
          >
            <input
              type="checkbox"
              {...form.register(key)}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-slate-800">{label}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          </label>
        ))}
      </div>
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
          onChange={(e) => {
            const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
            form.setValue("tags", arr);
          }}
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
          onChange={(e) => {
            const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
            form.setValue("searchKeywords", arr);
          }}
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
