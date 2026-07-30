import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Plus, Trash2, Save, Sparkles,
} from "lucide-react";
import {
  getUnifiedContentById,
  createUnifiedContent,
  updateUnifiedContent,
  type UnifiedContentType,
  type UnifiedContentStatus,
} from "@/services/unifiedContentService";
import { searchExams } from "@/services/examService";
import { getAuthors } from "@/services/blogService";
import { RichEditor } from "@/components/shared/RichEditor";
import { autoFillContentPost } from "@/lib/ai/autofill";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SlugInput } from "@/components/shared/SlugInput";
import { cn, getErrorMessage } from "@/lib/utils";
import { BLOG_SECTIONS, POST_TYPES } from "@/config/site";

// ── Types ──────────────────────────────────────────────────────────────────

interface FormData {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  contentType: UnifiedContentType;
  section: string;
  postType: string;
  pillar: string;
  status: UnifiedContentStatus;
  examId: string;
  examEntityName: string;
  authorId: string;
  authorName: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  isFeatured: boolean;
  isBreaking: boolean;
  isPinned: boolean;
  publishedAt: string;
  source: string;
  sourceLink: string;
  titleHindi: string;
  contentHindi: string;
  quickLinks: { label: string; url: string; isPDF: boolean; isOfficial: boolean }[];
  importantDates: { label: string; date: string; isUrgent: boolean }[];
  faqs: { question: string; answer: string }[];
}

const EXAM_CONTENT_TYPES: UnifiedContentType[] = [
  "notification", "application", "admit-card", "date-sheet",
  "syllabus", "answer-key", "result", "cutoff",
  "previous-papers", "mock-test", "study-material", "books",
];

const ALL_CONTENT_TYPES: { value: UnifiedContentType; label: string }[] = [
  { value: "notification", label: "Notification" },
  { value: "application", label: "Application" },
  { value: "admit-card", label: "Admit Card" },
  { value: "date-sheet", label: "Date Sheet" },
  { value: "syllabus", label: "Syllabus" },
  { value: "answer-key", label: "Answer Key" },
  { value: "result", label: "Result" },
  { value: "cutoff", label: "Cutoff" },
  { value: "previous-papers", label: "Previous Papers" },
  { value: "mock-test", label: "Mock Test" },
  { value: "study-material", label: "Study Material" },
  { value: "books", label: "Books" },
  { value: "article", label: "Article" },
  { value: "news", label: "News" },
  { value: "guide", label: "Guide" },
  { value: "opinion", label: "Opinion" },
  { value: "blog", label: "Blog" },
];

const DEFAULT_VALUES: FormData = {
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  contentType: "article",
  section: "",
  postType: "",
  pillar: "",
  status: "draft",
  examId: "",
  examEntityName: "",
  authorId: "",
  authorName: "",
  tags: "",
  seoTitle: "",
  seoDescription: "",
  isFeatured: false,
  isBreaking: false,
  isPinned: false,
  publishedAt: "",
  source: "",
  sourceLink: "",
  titleHindi: "",
  contentHindi: "",
  quickLinks: [],
  importantDates: [],
  faqs: [],
};

type EditorTab = "content" | "seo" | "settings";

export function UnifiedContentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("content");
  const [examSearch, setExamSearch] = useState("");
  const [examResults, setExamResults] = useState<{ id: string; name: string; slug: string; pillar: string }[]>([]);
  const [authors, setAuthors] = useState<{ id: string; name: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasSavedOnce, setHasSavedOnce] = useState(false);

  const form = useForm<FormData>({ defaultValues: DEFAULT_VALUES });
  const { register, control, watch, setValue, handleSubmit, reset, formState: { isDirty } } = form;

  const { fields: qlFields, append: addQL, remove: removeQL } = useFieldArray({ control, name: "quickLinks" });
  const { fields: dateFields, append: addDate, remove: removeDate } = useFieldArray({ control, name: "importantDates" });
  const { fields: faqFields, append: addFaq, remove: removeFaq } = useFieldArray({ control, name: "faqs" });

  const watchedTitle = watch("title");
  const watchedContentType = watch("contentType");
  const watchedStatus = watch("status");

  const isExamContent = EXAM_CONTENT_TYPES.includes(watchedContentType);

  // Load authors on mount
  useEffect(() => {
    getAuthors()
      .then((list) => setAuthors(list.map((a) => ({ id: a.id, name: a.name }))))
      .catch(() => setAuthors([]));
  }, []);

  // Load existing content for edit mode
  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getUnifiedContentById(id!).then((post) => {
      if (!post) { navigate("/content"); return; }
      reset({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        contentType: post.contentType,
        section: post.section,
        postType: post.postType,
        pillar: post.pillar,
        status: post.status,
        examId: post.examId,
        examEntityName: post.examEntityName,
        authorId: post.authorId,
        authorName: post.authorName,
        tags: (post.tags ?? []).join(", "),
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        isFeatured: post.isFeatured,
        isBreaking: post.isBreaking,
        isPinned: post.isPinned,
        publishedAt: post.publishedAt?.slice(0, 16) ?? "",
        source: post.source,
        sourceLink: post.sourceLink,
        titleHindi: post.titleHindi,
        contentHindi: post.contentHindi,
        quickLinks: post.quickLinks ?? [],
        importantDates: post.importantDates ?? [],
        faqs: post.faqs ?? [],
      });
      setHasSavedOnce(true);
    }).finally(() => setLoading(false));
  }, [id, isNew, navigate, reset]);

  // Exam search
  useEffect(() => {
    if (!examSearch || examSearch.length < 2) { setExamResults([]); return; }
    const t = setTimeout(() => {
      searchExams(examSearch).then((items) =>
        setExamResults(items.map((e) => ({ id: e.id, name: e.name, slug: e.slug, pillar: e.pillar ?? "" })))
      );
    }, 300);
    return () => clearTimeout(t);
  }, [examSearch]);

  // Auto-save draft (debounced)
  useEffect(() => {
    if (!hasSavedOnce || !isDirty || watchedStatus !== "draft") return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSubmit(onSubmit)();
    }, 5000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [watchedTitle, isDirty, hasSavedOnce, watchedStatus]);

  const selectExam = (exam: { id: string; name: string; slug: string; pillar: string }) => {
    setValue("examId", exam.id, { shouldDirty: true });
    setValue("examEntityName", exam.name, { shouldDirty: true });
    setValue("pillar", exam.pillar, { shouldDirty: true });
    setExamSearch("");
    setExamResults([]);
  };

  const handleAiFill = async () => {
    const title = watch("title");
    if (!title) { toast.error("Enter a title first for AI Fill."); return; }
    setAiLoading(true);
    try {
      const result = await autoFillContentPost(title);
      if (result.excerpt) setValue("excerpt", result.excerpt as string, { shouldDirty: true });
      if (result.seoTitle) setValue("seoTitle", result.seoTitle as string, { shouldDirty: true });
      if (result.seoDescription) setValue("seoDescription", result.seoDescription as string, { shouldDirty: true });
      if (result.tags) setValue("tags", (result.tags as string[]).join(", "), { shouldDirty: true });
      toast.success("AI filled fields!");
    } catch (err) {
      toast.error("AI Fill failed: " + getErrorMessage(err));
    } finally {
      setAiLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const tags = data.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt || undefined,
        content: data.content || undefined,
        contentType: data.contentType,
        section: data.section || undefined,
        postType: data.postType || undefined,
        pillar: data.pillar || undefined,
        status: data.status,
        examId: data.examId || undefined,
        examEntityName: data.examEntityName || undefined,
        authorId: data.authorId || undefined,
        authorName: data.authorName || undefined,
        tags,
        seoTitle: data.seoTitle || undefined,
        seoDescription: data.seoDescription || undefined,
        isFeatured: data.isFeatured,
        isBreaking: data.isBreaking,
        isPinned: data.isPinned,
        publishedAt: data.publishedAt || undefined,
        source: data.source || undefined,
        sourceLink: data.sourceLink || undefined,
        titleHindi: data.titleHindi || undefined,
        contentHindi: data.contentHindi || undefined,
        quickLinks: data.quickLinks,
        importantDates: data.importantDates,
        faqs: data.faqs,
      };

      if (isNew) {
        const post = await createUnifiedContent(payload);
        toast.success("Content created!");
        setHasSavedOnce(true);
        navigate(`/content/${post.id}`, { replace: true });
      } else {
        await updateUnifiedContent(id!, payload);
        toast.success("Content saved!");
        setHasSavedOnce(true);
      }
    } catch (err) {
      toast.error("Save failed: " + getErrorMessage(err));
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

  const seoTitleLen = (watch("seoTitle") ?? "").length;
  const seoDescLen = (watch("seoDescription") ?? "").length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/content")} className="text-slate-400 hover:text-slate-700">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {isNew ? "New Content" : "Edit Content"}
            </h1>
            <p className="text-xs text-slate-500 capitalize">
              {watchedContentType.replace(/-/g, " ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={watchedStatus} />
          <button
            type="button"
            onClick={handleAiFill}
            disabled={aiLoading}
            className="inline-flex items-center gap-1.5 rounded border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            AI Fill
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["content", "seo", "settings"] as EditorTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors ${
              activeTab === t
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "seo" ? "SEO & Tags" : t}
          </button>
        ))}
      </div>

      {/* ═══ Content Tab ═══ */}
      {activeTab === "content" && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-5">
            {/* Title */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input
                  {...register("title")}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Content title..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Slug *</label>
                <Controller
                  name="slug"
                  control={control}
                  render={({ field }) => (
                    <SlugInput value={field.value} onChange={field.onChange} sourceValue={watchedTitle} />
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Excerpt</label>
                <textarea
                  {...register("excerpt")}
                  rows={3}
                  className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Brief description..."
                />
              </div>
            </section>

            {/* Rich Content */}
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Content</label>
              <Controller
                name="content"
                control={control}
                render={({ field }) => (
                  <RichEditor content={field.value} onChange={field.onChange} placeholder="Write your content..." />
                )}
              />
            </section>

            {/* Quick Links (exam content) */}
            {isExamContent && (
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Quick Links</h2>
                  <button type="button" onClick={() => addQL({ label: "", url: "", isPDF: false, isOfficial: true })}
                    className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
                    <Plus size={12} /> Add Link
                  </button>
                </div>
                <div className="space-y-2">
                  {qlFields.map((field, i) => (
                    <div key={field.id} className="flex gap-2 items-center">
                      <input {...register(`quickLinks.${i}.label`)} placeholder="Label"
                        className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                      <input {...register(`quickLinks.${i}.url`)} placeholder="URL" type="url"
                        className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                      <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                        <input type="checkbox" {...register(`quickLinks.${i}.isPDF`)} /> PDF
                      </label>
                      <button type="button" onClick={() => removeQL(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {qlFields.length === 0 && <p className="text-xs text-slate-400">No quick links.</p>}
                </div>
              </section>
            )}

            {/* Important Dates (exam content) */}
            {isExamContent && (
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Important Dates</h2>
                  <button type="button" onClick={() => addDate({ label: "", date: "", isUrgent: false })}
                    className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
                    <Plus size={12} /> Add Date
                  </button>
                </div>
                <div className="space-y-2">
                  {dateFields.map((field, i) => (
                    <div key={field.id} className="flex gap-2 items-center">
                      <input {...register(`importantDates.${i}.label`)} placeholder="e.g. Exam Date"
                        className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                      <input {...register(`importantDates.${i}.date`)} type="date"
                        className="rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none" />
                      <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                        <input type="checkbox" {...register(`importantDates.${i}.isUrgent`)} /> Urgent
                      </label>
                      <button type="button" onClick={() => removeDate(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {dateFields.length === 0 && <p className="text-xs text-slate-400">No dates added.</p>}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Content Type Selector */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Type & Classification</h3>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Content Type *</label>
                <select {...register("contentType")}
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
                  {ALL_CONTENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Section (articles/news) */}
              {!isExamContent && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Section</label>
                  <select {...register("section")}
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">None</option>
                    {BLOG_SECTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Post Type (articles/news) */}
              {!isExamContent && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Post Type</label>
                  <select {...register("postType")}
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">None</option>
                    {POST_TYPES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {/* Exam Linking */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Linked Exam {isExamContent && <span className="text-red-500">*</span>}
              </h3>
              <div className="relative">
                <input
                  value={watch("examEntityName") || examSearch}
                  onChange={(e) => {
                    setExamSearch(e.target.value);
                    if (!e.target.value) {
                      setValue("examId", "", { shouldDirty: true });
                      setValue("examEntityName", "", { shouldDirty: true });
                    }
                  }}
                  placeholder="Search exam name…"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                {examResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white shadow-md">
                    {examResults.map((e) => (
                      <button key={e.id} type="button" onClick={() => selectExam(e)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 text-left">
                        <span className="font-medium text-slate-900">{e.name}</span>
                        <span className="text-xs text-slate-400 capitalize">{e.pillar.replace(/-/g, " ")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {watch("examId") && (
                <p className="text-xs text-green-600">✓ Linked to exam</p>
              )}
            </section>

            {/* Author (for articles/news) */}
            {!isExamContent && (
              <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Author</h3>
                <select {...register("authorId")}
                  onChange={(e) => {
                    const selected = authors.find((a) => a.id === e.target.value);
                    setValue("authorId", e.target.value, { shouldDirty: true });
                    setValue("authorName", selected?.name ?? "", { shouldDirty: true });
                  }}
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="">Select Author</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </section>
            )}

            {/* Source (for news) */}
            {!isExamContent && (
              <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Source</h3>
                <input {...register("source")} placeholder="Source name"
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                <input {...register("sourceLink")} placeholder="Source URL" type="url"
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
              </section>
            )}
          </div>
        </div>
      )}

      {/* ═══ SEO & Tags Tab ═══ */}
      {activeTab === "seo" && (
        <div className="max-w-3xl space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">SEO</h2>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">SEO Title</label>
                <span className={cn("text-xs", seoTitleLen > 60 ? "text-red-500" : "text-slate-400")}>
                  {seoTitleLen}/60
                </span>
              </div>
              <input {...register("seoTitle")} placeholder="SEO-optimized title"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">SEO Description</label>
                <span className={cn("text-xs", seoDescLen > 160 ? "text-red-500" : "text-slate-400")}>
                  {seoDescLen}/160
                </span>
              </div>
              <textarea {...register("seoDescription")} rows={3} placeholder="Meta description for search engines"
                className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Tags</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
              <input {...register("tags")} placeholder="exam, result, 2025, upsc"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">FAQs</h2>
              <button type="button" onClick={() => addFaq({ question: "", answer: "" })}
                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
                <Plus size={12} /> Add FAQ
              </button>
            </div>
            <div className="space-y-3">
              {faqFields.map((field, i) => (
                <div key={field.id} className="rounded border border-slate-100 bg-slate-50 p-3 space-y-2">
                  <div className="flex gap-2 items-start">
                    <input {...register(`faqs.${i}.question`)} placeholder="Question"
                      className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                    <button type="button" onClick={() => removeFaq(i)} className="text-slate-400 hover:text-red-500 mt-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea {...register(`faqs.${i}.answer`)} placeholder="Answer" rows={2}
                    className="w-full resize-none rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              ))}
              {faqFields.length === 0 && <p className="text-xs text-slate-400">No FAQs added.</p>}
            </div>
          </section>
        </div>
      )}

      {/* ═══ Settings Tab ═══ */}
      {activeTab === "settings" && (
        <div className="max-w-3xl space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Publishing</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select {...register("status")}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="draft">Draft</option>
                  <option value="review">Review</option>
                  <option value="published">Published</option>
                  <option value="unpublished">Unpublished</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Published At</label>
                <input {...register("publishedAt")} type="datetime-local"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Flags</h2>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register("isFeatured")} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="text-sm text-slate-700">Featured</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register("isBreaking")} className="h-4 w-4 rounded border-slate-300 text-red-600" />
                <span className="text-sm text-slate-700">Breaking</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register("isPinned")} className="h-4 w-4 rounded border-slate-300 text-amber-600" />
                <span className="text-sm text-slate-700">Pinned</span>
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Hindi Translation</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title (Hindi)</label>
              <input {...register("titleHindi")} placeholder="हिंदी शीर्षक"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Content (Hindi)</label>
              <textarea {...register("contentHindi")} rows={4} placeholder="हिंदी सामग्री..."
                className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          </section>
        </div>
      )}
    </form>
  );
}
