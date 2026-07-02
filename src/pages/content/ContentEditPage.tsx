import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Save } from "lucide-react";
import { getContentPostById, createContentPost, updateContentPost } from "@/services/contentService";
import { searchExams } from "@/services/examService";
import { RichEditor } from "@/components/shared/RichEditor";
import { SlugInput } from "@/components/shared/SlugInput";
import { AISuggestion } from "@/components/shared/AISuggestion";
import { FrontendSync } from "@/components/shared/FrontendSync";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { revalidateContentPost } from "@/lib/api/frontend";
import { CONTENT_TYPES, PILLARS } from "@/config/site";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { P } from "@/config/permissions";
import { cn, slugify } from "@/lib/utils";
import type { Pillar, ContentType } from "@/types/exam";

const schema = z.object({
  title: z.string().min(1, "Title required"),
  slug: z.string().min(1, "Slug required"),
  examId: z.string().min(1, "Exam required"),
  examEntityName: z.string(),
  pillar: z.enum(["sarkari-naukri", "entrance-exam", "board-university"]),
  contentType: z.enum(["notification","application","admit-card","date-sheet","syllabus","answer-key","result","cutoff","previous-papers","mock-test","study-material","books"]),
  excerpt: z.string().max(200).optional(),
  content: z.string().optional(),
  featuredImage: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["draft","review","published","unpublished"]).default("draft"),
  isFeatured: z.boolean().default(false),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  quickLinks: z.array(z.object({ label: z.string(), url: z.string(), isPDF: z.boolean(), isOfficial: z.boolean() })).default([]),
  importantDates: z.array(z.object({ label: z.string(), date: z.string(), isUrgent: z.boolean() })).default([]),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
});
type FormData = z.infer<typeof schema>;

export function ContentEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const canPublish = usePermission(P.PUBLISH_POST);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [examSearch, setExamSearch] = useState("");
  const [examResults, setExamResults] = useState<{ id: string; name: string; slug: string; pillar: Pillar }[]>([]);
  const [categorySlug, setCategorySlug] = useState("");
  const [examSlug, setExamSlug] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "draft", isFeatured: false, pillar: "sarkari-naukri", contentType: "notification", quickLinks: [], importantDates: [], faqs: [] },
  });
  const { register, control, watch, setValue, handleSubmit, formState: { errors } } = form;
  const { fields: qlFields, append: addQL, remove: removeQL } = useFieldArray({ control, name: "quickLinks" });
  const { fields: dateFields, append: addDate, remove: removeDate } = useFieldArray({ control, name: "importantDates" });
  const { fields: faqFields, append: addFaq, remove: removeFaq } = useFieldArray({ control, name: "faqs" });

  const watchedTitle = watch("title");
  const watchedSlug = watch("slug");
  const watchedPillar = watch("pillar");
  const watchedContentType = watch("contentType");
  const watchedExamId = watch("examId");

  useEffect(() => {
    if (!id || isNew) return;
    setLoading(true);
    getContentPostById(id).then((post) => {
      if (!post) { navigate("/content"); return; }
      form.reset({
        title: post.title, slug: post.slug, examId: post.examEntityId,
        examEntityName: post.examEntityName, pillar: post.pillar,
        contentType: post.contentType, excerpt: post.excerpt,
        content: post.content, featuredImage: post.featuredImage,
        tags: post.tags, status: post.status, isFeatured: post.isFeatured,
        seoTitle: post.seoTitle, seoDescription: post.seoDescription,
        quickLinks: post.quickLinks, importantDates: post.importantDates ?? [],
        faqs: post.faqs ?? [],
      });
    }).finally(() => setLoading(false));
  }, [id, isNew, navigate, form]);

  useEffect(() => {
    if (!examSearch || examSearch.length < 2) { setExamResults([]); return; }
    searchExams(examSearch).then(setExamResults);
  }, [examSearch]);

  const selectExam = (exam: { id: string; name: string; slug: string; pillar: Pillar }) => {
    setValue("examId", exam.id);
    setValue("examEntityName", exam.name);
    setValue("pillar", exam.pillar);
    setExamSlug(exam.slug);
    setExamSearch("");
    setExamResults([]);
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      if (isNew) {
        const post = await createContentPost({ ...data, examId: data.examId, createdBy: user?.id });
        toast.success("Post created!");
        navigate(`/content/${post.id}`, { replace: true });
      } else {
        await updateContentPost(id!, { ...data, examId: data.examId, updatedBy: user?.id });
        toast.success("Post saved!");
      }
    } catch (err) {
      toast.error("Save failed: " + String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;

  const seoTitleLen = (watch("seoTitle") ?? "").length;
  const seoDescLen = (watch("seoDescription") ?? "").length;
  const excerptLen = (watch("excerpt") ?? "").length;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/content")} className="text-slate-400 hover:text-slate-700"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-semibold text-slate-900">{isNew ? "New Content Post" : "Edit Content Post"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={watch("status")} />
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? "Create Post" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main */}
        <div className="col-span-2 space-y-5">
          {/* Exam selector */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <label className="form-label">Exam (required) *</label>
            <div className="relative">
              <input value={watch("examEntityName") || examSearch}
                onChange={(e) => { setExamSearch(e.target.value); if (!e.target.value) setValue("examId", ""); }}
                placeholder="Search exam name…"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              {examResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded border border-slate-200 bg-white shadow-md">
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
            {errors.examId && <p className="mt-1 text-xs text-red-600">Please select an exam</p>}
          </section>

          {/* Content Type + Title + Slug */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Content Type *</label>
                <select {...register("contentType")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  {CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Pillar</label>
                <select {...register("pillar")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  {PILLARS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="form-label mb-0">Title *</label>
                <AISuggestion promptKey="seoTitle" vars={{ examName: watch("examEntityName"), contentType: watchedContentType }}
                  onResult={(v) => setValue("title", v)} label="✨ AI suggest" />
              </div>
              <input {...register("title")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
            </div>
            <div>
              <label className="form-label">Slug *</label>
              <Controller name="slug" control={control} render={({ field }) => (
                <SlugInput value={field.value} onChange={field.onChange} sourceValue={watchedTitle}
                  previewPrefix={`/${watchedPillar}/category/${examSlug || "exam"}/${watchedContentType}/`} />
              )} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label mb-0">Excerpt (max 200 chars)</label>
                <span className={cn("text-xs", excerptLen > 200 ? "text-red-500" : "text-slate-400")}>{excerptLen}/200</span>
              </div>
              <textarea {...register("excerpt")} rows={2} className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          </section>

          {/* Rich Editor */}
          <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Content</h2>
              <AISuggestion promptKey="fullContent" vars={{ examName: watch("examEntityName"), contentType: watchedContentType, year: new Date().getFullYear().toString() }}
                onResult={(html) => setValue("content", html)} label="✨ Generate Full Article" inline={false} />
            </div>
            <Controller name="content" control={control} render={({ field }) => (
              <RichEditor content={field.value ?? ""} onChange={field.onChange} placeholder="Start writing or use AI to generate content…" />
            )} />
          </section>

          {/* Quick Links */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Quick Links</h2>
              <button type="button" onClick={() => addQL({ label: "", url: "", isPDF: false, isOfficial: false })}
                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
                <Plus size={12} /> Add Link
              </button>
            </div>
            <div className="space-y-2">
              {qlFields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                  <input {...register(`quickLinks.${i}.label`)} placeholder="Label" className="col-span-3 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  <input {...register(`quickLinks.${i}.url`)} placeholder="https://..." type="url" className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  <label className="col-span-1 flex items-center gap-1 text-xs text-slate-600">
                    <input type="checkbox" {...register(`quickLinks.${i}.isPDF`)} className="h-3.5 w-3.5" /> PDF
                  </label>
                  <label className="col-span-2 flex items-center gap-1 text-xs text-slate-600">
                    <input type="checkbox" {...register(`quickLinks.${i}.isOfficial`)} className="h-3.5 w-3.5" /> Official
                  </label>
                  <button type="button" onClick={() => removeQL(i)} className="col-span-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </section>

          {/* Important Dates */}
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
                  <input {...register(`importantDates.${i}.label`)} placeholder="Label" className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none" />
                  <input {...register(`importantDates.${i}.date`)} type="date" className="rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none" />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" {...register(`importantDates.${i}.isUrgent`)} /> Urgent</label>
                  <button type="button" onClick={() => removeDate(i)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </section>

          {/* FAQs */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">FAQs</h2>
              <div className="flex gap-2">
                <AISuggestion promptKey="faqs" vars={{ examName: watch("examEntityName"), contentType: watchedContentType }}
                  onResult={(json) => { try { JSON.parse(json).forEach((f: { question: string; answer: string }) => addFaq(f)); } catch { toast.error("AI returned invalid JSON"); } }}
                  label="✨ Generate FAQs" inline={false} />
                <button type="button" onClick={() => addFaq({ question: "", answer: "" })}
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
            {faqFields.map((field, i) => (
              <div key={field.id} className="mb-3 space-y-1 rounded border border-slate-100 p-3">
                <div className="flex gap-2">
                  <input {...register(`faqs.${i}.question`)} placeholder="Question" className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none" />
                  <button type="button" onClick={() => removeFaq(i)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
                <textarea {...register(`faqs.${i}.answer`)} rows={2} placeholder="Answer" className="w-full resize-none rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none" />
              </div>
            ))}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Publish */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold">Publish</h3>
            <select {...register("status")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
              <option value="draft">Draft</option>
              <option value="review">Submit for Review</option>
              {canPublish && <option value="published">Published</option>}
              {canPublish && <option value="unpublished">Unpublished</option>}
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register("isFeatured")} className="h-4 w-4 rounded text-blue-600" />
              <span className="text-sm">Featured</span>
            </label>
            <button type="submit" disabled={saving} className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : isNew ? "Create Post" : "Save"}
            </button>
          </div>

          {/* Featured Image */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Featured Image</h3>
            <Controller name="featuredImage" control={control} render={({ field }) => (
              <ImageUploader value={field.value} onChange={field.onChange} />
            )} />
          </div>

          {/* SEO */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold">SEO</h3>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label mb-0 text-xs">SEO Title</label>
                <span className={cn("text-xs", seoTitleLen > 60 ? "text-red-500" : "text-slate-400")}>{seoTitleLen}/60</span>
              </div>
              <input {...register("seoTitle")} className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:outline-none" />
              <AISuggestion promptKey="seoTitle" vars={{ examName: watch("examEntityName"), contentType: watchedContentType }}
                onResult={(v) => setValue("seoTitle", v)} className="mt-1" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label mb-0 text-xs">Meta Description</label>
                <span className={cn("text-xs", seoDescLen > 160 ? "text-red-500" : "text-slate-400")}>{seoDescLen}/160</span>
              </div>
              <textarea {...register("seoDescription")} rows={3} className="w-full resize-none rounded border border-slate-200 px-3 py-1.5 text-sm focus:outline-none" />
              <AISuggestion promptKey="metaDescription" vars={{ examName: watch("examEntityName"), contentType: watchedContentType }}
                onResult={(v) => setValue("seoDescription", v)} className="mt-1" />
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="form-label text-xs">Tags (comma-separated)</label>
            <input defaultValue={watch("tags").join(", ")}
              onBlur={(e) => setValue("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
          </div>

          {/* Frontend Sync */}
          {!isNew && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold">Frontend Sync</h3>
              <FrontendSync onSync={(url, token) =>
                revalidateContentPost({ pillar: watchedPillar, categorySlug: "category", examSlug: examSlug || "exam", contentType: watchedContentType, postSlug: watchedSlug }, url, token)
              } />
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
