import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Loader2, Save, Globe } from "lucide-react";
import { getExamById, createExam, updateExam, checkExamSlugAvailable } from "@/services/examService";
import { getCategories, type Category } from "@/services/categoryService";
import { SlugInput } from "@/components/shared/SlugInput";
import { AISuggestion } from "@/components/shared/AISuggestion";
import { FrontendSync } from "@/components/shared/FrontendSync";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { revalidateExamPaths } from "@/lib/api/frontend";
import { PILLARS, EXAM_STATUSES, CONTENT_TYPES } from "@/config/site";
import { useAuth } from "@/hooks/useAuth";
import type { Pillar, ExamEntity } from "@/types/exam";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  shortName: z.string().min(1, "Short name required"),
  slug: z.string().min(1, "Slug required"),
  pillar: z.enum(["sarkari-naukri", "entrance-exam", "board-university"]),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  entityType: z.enum(["exam", "board", "university", "recruitment"]),
  conductingBody: z.string().min(1, "Conducting body required"),
  officialWebsite: z.string().optional(),
  status: z.enum(["upcoming","active","registration-open","registration-closed","result-declared","completed","ongoing"]),
  isFeatured: z.boolean().default(false),
  vacancy: z.number().optional(),
  academicYear: z.string().optional(),
  semester: z.string().optional(),
  admissionTo: z.string().optional(),
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
  dates: z.array(z.object({ label: z.string(), date: z.string(), isUrgent: z.boolean() })).default([]),
  eligibilityAge: z.string().optional(),
  eligibilityQualification: z.string().optional(),
  eligibilityNationality: z.string().default("Indian Citizen"),
  feeGeneral: z.number().optional(),
  feeObc: z.number().optional(),
  feeSc: z.number().optional(),
  feeSt: z.number().optional(),
  feeEws: z.number().optional(),
  selectionProcess: z.array(z.string()).default([]),
  syllabusHighlights: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  searchKeywords: z.array(z.string()).default([]),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
});

type FormData = z.infer<typeof schema>;

export function ExamEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [examId, setExamId] = useState<string | null>(null);
  const [currentExam, setCurrentExam] = useState<ExamEntity | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      pillar: "sarkari-naukri",
      entityType: "exam",
      status: "upcoming",
      isFeatured: false,
      eligibilityNationality: "Indian Citizen",
      dates: [],
      selectionProcess: [],
      syllabusHighlights: [],
      tags: [],
      searchKeywords: [],
      faqs: [],
    },
  });

  const { control, register, watch, setValue, handleSubmit, formState: { errors } } = form;
  const { fields: dateFields, append: addDate, remove: removeDate } = useFieldArray({ control, name: "dates" });
  const { fields: faqFields, append: addFaq, remove: removeFaq } = useFieldArray({ control, name: "faqs" });

  const watchedPillar = watch("pillar");
  const watchedName = watch("name");
  const watchedSlug = watch("slug");
  const watchedSeoTitle = watch("seoTitle");

  // Load categories when pillar changes
  useEffect(() => {
    getCategories(watchedPillar as Pillar).then((cats) => {
      setCategories(cats.filter((c) => !c.parentId));
    });
  }, [watchedPillar]);

  // Load exam for edit
  useEffect(() => {
    if (!id || isNew) return;
    setLoading(true);
    getExamById(id).then((exam) => {
      if (!exam) { navigate("/exams"); return; }
      setCurrentExam(exam);
      setExamId(exam.id);
      // Find categoryId by slug
      form.reset({
        name: exam.name,
        shortName: exam.shortName,
        slug: exam.slug,
        pillar: exam.pillar,
        entityType: exam.entityType,
        conductingBody: exam.conductingBody,
        officialWebsite: exam.officialWebsite,
        status: exam.status,
        isFeatured: exam.isFeatured,
        vacancy: exam.vacancy ?? undefined,
        academicYear: exam.academicYear,
        semester: exam.semester,
        admissionTo: exam.admissionTo,
        hasAdmitCard: exam.hasAdmitCard,
        hasResult: exam.hasResult,
        hasAnswerKey: exam.hasAnswerKey,
        hasSyllabus: exam.hasSyllabus,
        hasDateSheet: exam.hasDateSheet,
        hasMockTest: exam.hasMockTest,
        hasPreviousPapers: exam.hasPreviousPapers,
        hasStudyMaterial: exam.hasStudyMaterial,
        hasApplication: exam.hasApplication,
        hasNotification: exam.hasNotification,
        hasCutoff: exam.hasCutoff,
        dates: exam.dates,
        eligibilityAge: exam.eligibility?.age,
        eligibilityQualification: exam.eligibility?.qualification,
        eligibilityNationality: exam.eligibility?.nationality ?? "Indian Citizen",
        feeGeneral: exam.applicationFee?.general ?? undefined,
        feeObc: exam.applicationFee?.obc ?? undefined,
        feeSc: exam.applicationFee?.sc ?? undefined,
        feeSt: exam.applicationFee?.st ?? undefined,
        feeEws: exam.applicationFee?.ews ?? undefined,
        selectionProcess: exam.selectionProcess ?? [],
        syllabusHighlights: exam.syllabusHighlights ?? [],
        tags: exam.tags,
        searchKeywords: exam.searchKeywords,
        seoTitle: exam.seoTitle,
        seoDescription: exam.seoDescription,
        faqs: exam.faqs ?? [],
      });
    }).finally(() => setLoading(false));
  }, [id, isNew, navigate, form]);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const catObj = categories.find((c) => c.id === data.categoryId);
      const payload = {
        ...data,
        eligibility: {
          age: data.eligibilityAge ?? "",
          qualification: data.eligibilityQualification ?? "",
          nationality: data.eligibilityNationality,
        },
        applicationFee: {
          general: data.feeGeneral ?? 0,
          obc: data.feeObc ?? 0,
          sc: data.feeSc ?? 0,
          st: data.feeSt ?? 0,
          ...(data.feeEws != null && { ews: data.feeEws }),
        },
        lastUpdated: new Date().toISOString().split("T")[0],
        createdBy: user?.id,
      };

      if (isNew) {
        const exam = await createExam(payload);
        setExamId(exam.id);
        toast.success("Exam created!");
        navigate(`/exams/${exam.id}`, { replace: true });
      } else {
        await updateExam(id!, payload);
        toast.success("Exam saved!");
      }
    } catch (err) {
      toast.error("Save failed: " + String(err));
    } finally {
      setSaving(false);
    }
  };

  const enabledContentTypes = CONTENT_TYPES
    .filter(({ value }) => {
      const flagMap: Record<string, string> = {
        "admit-card": "hasAdmitCard", result: "hasResult", "answer-key": "hasAnswerKey",
        syllabus: "hasSyllabus", "date-sheet": "hasDateSheet", "mock-test": "hasMockTest",
        "previous-papers": "hasPreviousPapers", "study-material": "hasStudyMaterial",
        application: "hasApplication", notification: "hasNotification", cutoff: "hasCutoff",
        books: "hasStudyMaterial",
      };
      return watch(flagMap[value] as keyof FormData) === true;
    })
    .map(({ value }) => value);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const seoTitleLen = (watchedSeoTitle ?? "").length;
  const seoDescLen = (watch("seoDescription") ?? "").length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/exams")} className="text-slate-400 hover:text-slate-700">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {isNew ? "New Exam" : watchedName || "Edit Exam"}
            </h1>
            {currentExam && (
              <a
                href={`https://www.indianexaminfo.com/${currentExam.pillar}/${currentExam.category}/${currentExam.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <Globe size={12} /> View on site
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={watch("status")} />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? "Create Exam" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main form — 2/3 width */}
        <div className="col-span-2 space-y-6">
          {/* Basic Info */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="form-label">Exam Name *</label>
                <input {...register("name")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Full official exam name" />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>
              <div>
                <label className="form-label">Short Name *</label>
                <input {...register("shortName")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="IBPS PO" />
              </div>
              <div>
                <label className="form-label">Slug *</label>
                <Controller name="slug" control={control} render={({ field }) => (
                  <SlugInput
                    value={field.value}
                    onChange={field.onChange}
                    sourceValue={watchedName}
                    checkAvailable={(s) => checkExamSlugAvailable(s, examId ?? undefined)}
                    previewPrefix={`/${watchedPillar || "pillar"}/category/`}
                  />
                )} />
              </div>
              <div>
                <label className="form-label">Pillar *</label>
                <select {...register("pillar")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  {PILLARS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Entity Type</label>
                <select {...register("entityType")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="exam">Exam</option>
                  <option value="board">Board</option>
                  <option value="university">University</option>
                  <option value="recruitment">Recruitment</option>
                </select>
              </div>
              <div>
                <label className="form-label">Category</label>
                <select {...register("categoryId")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="">Select category…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Conducting Body *</label>
                <input {...register("conductingBody")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="form-label">Official Website</label>
                <input {...register("officialWebsite")} type="url" className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="https://" />
              </div>
            </div>
          </section>

          {/* Content Flags */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Content Flags</h2>
            <p className="mb-4 text-xs text-slate-500">Enabling a flag activates that content type tab on the frontend exam page.</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {CONTENT_TYPES.map(({ value, label }) => {
                const flagMap: Record<string, string> = {
                  "admit-card": "hasAdmitCard", result: "hasResult", "answer-key": "hasAnswerKey",
                  syllabus: "hasSyllabus", "date-sheet": "hasDateSheet", "mock-test": "hasMockTest",
                  "previous-papers": "hasPreviousPapers", "study-material": "hasStudyMaterial",
                  application: "hasApplication", notification: "hasNotification", cutoff: "hasCutoff",
                  books: "hasStudyMaterial",
                };
                const fieldName = flagMap[value] as keyof FormData;
                return (
                  <label key={value} className="flex cursor-pointer items-center gap-2">
                    <Controller name={fieldName as "hasAdmitCard"} control={control} render={({ field }) => (
                      <input type="checkbox" checked={field.value as boolean} onChange={field.onChange}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    )} />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Important Dates */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Important Dates</h2>
              <button type="button" onClick={() => addDate({ label: "", date: "", isUrgent: false })}
                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
                <Plus size={12} /> Add Date
              </button>
            </div>
            <div className="space-y-2">
              {dateFields.map((field, i) => (
                <div key={field.id} className="flex items-center gap-2">
                  <input {...register(`dates.${i}.label`)} placeholder="e.g. Application Start" className="flex-1 rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  <input {...register(`dates.${i}.date`)} type="date" className="rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input type="checkbox" {...register(`dates.${i}.isUrgent`)} className="h-4 w-4" /> Urgent
                  </label>
                  <button type="button" onClick={() => removeDate(i)} className="text-slate-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {dateFields.length === 0 && <p className="text-xs text-slate-400">No dates added yet.</p>}
            </div>
          </section>

          {/* Eligibility */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Eligibility</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label">Age Limit</label>
                <input {...register("eligibilityAge")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="18-32 years" />
              </div>
              <div>
                <label className="form-label">Nationality</label>
                <input {...register("eligibilityNationality")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="form-label">Vacancy</label>
                <input {...register("vacancy", { valueAsNumber: true })} type="number" className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="col-span-3">
                <label className="form-label">Qualification</label>
                <input {...register("eligibilityQualification")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
          </section>

          {/* Application Fee */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Application Fee (₹)</h2>
            <div className="grid grid-cols-5 gap-3">
              {[["feeGeneral","General"],["feeObc","OBC"],["feeSc","SC"],["feeSt","ST"],["feeEws","EWS"]].map(([field, label]) => (
                <div key={field}>
                  <label className="form-label">{label}</label>
                  <input {...register(field as keyof FormData, { valueAsNumber: true })} type="number" className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
              ))}
            </div>
          </section>

          {/* Selection Process */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Selection Process & Syllabus</h2>
            <div>
              <label className="form-label">Selection Process (comma-separated)</label>
              <input
                defaultValue={watch("selectionProcess").join(", ")}
                onBlur={(e) => setValue("selectionProcess", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Prelims, Mains, Interview"
              />
            </div>
            <div>
              <label className="form-label">Syllabus Highlights (comma-separated)</label>
              <input
                defaultValue={watch("syllabusHighlights").join(", ")}
                onBlur={(e) => setValue("syllabusHighlights", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="General Studies, Mathematics, English"
              />
            </div>
            <div>
              <label className="form-label">Tags (comma-separated)</label>
              <input
                defaultValue={watch("tags").join(", ")}
                onBlur={(e) => setValue("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="form-label">Search Keywords (comma-separated)</label>
              <input
                defaultValue={watch("searchKeywords").join(", ")}
                onBlur={(e) => setValue("searchKeywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </section>

          {/* FAQs */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">FAQs <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">{faqFields.length}</span></h2>
              <div className="flex gap-2">
                <AISuggestion
                  promptKey="faqs"
                  vars={{ examName: watchedName, year: new Date().getFullYear().toString() }}
                  onResult={(json) => {
                    try {
                      const faqs = JSON.parse(json);
                      if (Array.isArray(faqs)) faqs.forEach((f) => addFaq(f));
                    } catch { toast.error("AI returned invalid JSON"); }
                  }}
                  label="✨ Generate FAQs with AI"
                  inline={false}
                />
                <button type="button" onClick={() => addFaq({ question: "", answer: "" })}
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
                  <Plus size={12} /> Add FAQ
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {faqFields.map((field, i) => (
                <div key={field.id} className="space-y-1 rounded border border-slate-100 p-3">
                  <div className="flex items-start gap-2">
                    <input {...register(`faqs.${i}.question`)} placeholder="Question" className="flex-1 rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
                    <button type="button" onClick={() => removeFaq(i)} className="text-slate-400 hover:text-red-500 mt-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea {...register(`faqs.${i}.answer`)} placeholder="Answer" rows={2} className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none resize-none" />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar panels — 1/3 width */}
        <div className="space-y-4">
          {/* Publish */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Publish</h3>
            <div>
              <label className="form-label">Status</label>
              <select {...register("status")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                {EXAM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Controller name="isFeatured" control={control} render={({ field }) => (
                <input type="checkbox" checked={field.value} onChange={field.onChange} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
              )} />
              <span className="text-sm text-slate-700">Featured ⭐</span>
            </label>
            <button type="submit" disabled={saving} className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : isNew ? "Create Exam" : "Save Changes"}
            </button>
          </div>

          {/* SEO */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">SEO</h3>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label mb-0">SEO Title</label>
                <span className={cn("text-xs", seoTitleLen > 60 ? "text-red-500" : "text-slate-400")}>{seoTitleLen}/60</span>
              </div>
              <input {...register("seoTitle")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              <AISuggestion promptKey="seoTitle" vars={{ examName: watchedName, year: new Date().getFullYear().toString() }}
                onResult={(v) => setValue("seoTitle", v)} className="mt-1" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label mb-0">Meta Description</label>
                <span className={cn("text-xs", seoDescLen > 160 ? "text-red-500" : "text-slate-400")}>{seoDescLen}/160</span>
              </div>
              <textarea {...register("seoDescription")} rows={3} className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              <AISuggestion promptKey="metaDescription" vars={{ examName: watchedName, year: new Date().getFullYear().toString() }}
                onResult={(v) => setValue("seoDescription", v)} className="mt-1" />
            </div>
            {/* SEO score */}
            <div className="space-y-1 rounded bg-slate-50 p-3 text-xs">
              <p className={seoTitleLen > 0 && seoTitleLen <= 60 ? "text-green-600" : "text-slate-400"}>
                {seoTitleLen > 0 && seoTitleLen <= 60 ? "✅" : "⚠️"} SEO title {seoTitleLen <= 60 ? "≤60 chars" : "too long"}
              </p>
              <p className={seoDescLen > 0 && seoDescLen <= 160 ? "text-green-600" : "text-slate-400"}>
                {seoDescLen > 0 && seoDescLen <= 160 ? "✅" : "⚠️"} Description {seoDescLen <= 160 ? "≤160 chars" : "too long"}
              </p>
              <p className={(watch("faqs") ?? []).length > 0 ? "text-green-600" : "text-slate-400"}>
                {(watch("faqs") ?? []).length > 0 ? "✅" : "⚠️"} {(watch("faqs") ?? []).length} FAQs (boosts PAA)
              </p>
            </div>
          </div>

          {/* Frontend Sync */}
          {!isNew && examId && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Frontend Sync</h3>
              <FrontendSync
                onSync={(url, token) => {
                  if (!currentExam) return Promise.resolve({ total: 0, succeeded: 0, failed: [] });
                  return revalidateExamPaths(
                    { pillar: currentExam.pillar, categorySlug: currentExam.category, examSlug: currentExam.slug, enabledContentTypes },
                    url,
                    token
                  );
                }}
              />
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
