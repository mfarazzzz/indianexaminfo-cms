import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Save, ExternalLink } from "lucide-react";
import { getBlogPostById, createBlogPost, updateBlogPost, getAuthors } from "@/services/blogService";
import { searchEntities } from "@/services/entity/entityService";
import { RichEditor } from "@/components/shared/RichEditor";
import { SlugInput } from "@/components/shared/SlugInput";
import { AISuggestion } from "@/components/shared/AISuggestion";
import { FrontendSync } from "@/components/shared/FrontendSync";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AIAutoFillDialog, AIAutoFillButton } from "@/components/shared/AIAutoFillDialog";
import { autoFillBlogPost } from "@/lib/ai/autofill";
import { revalidateBlogPost } from "@/lib/api/frontend";
import { BLOG_SECTIONS, POST_TYPES, SITE } from "@/config/site";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { P } from "@/config/permissions";
import { cn , getErrorMessage } from "@/lib/utils";
import type { BlogAuthor } from "@/types/blog";

const schema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  section: z.enum(["education-news","exam-prep","career-guidance","scholarship","study-abroad","edtech","student-life","opinion"]),
  postType: z.enum(["news","article","guide","listicle","opinion","interview","analysis","how-to"]).optional(),
  authorId: z.string().optional(),
  featuredImage: z.string().optional(),
  featuredImageCaption: z.string().optional(),
  tags: z.array(z.string()).default([]),
  relatedExamSlugs: z.array(z.string()).default([]),
  status: z.enum(["draft","review","published","unpublished"]).default("draft"),
  isFeatured: z.boolean().default(false),
  isBreaking: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  canonicalUrl: z.string().optional(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
});
type FormData = z.infer<typeof schema>;

export function BlogEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const canPublish = usePermission(P.PUBLISH_POST);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [authors, setAuthors] = useState<BlogAuthor[]>([]);
  const [examSearch, setExamSearch] = useState("");
  const [examResults, setExamResults] = useState<{ slug: string; name: string }[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { section: "education-news", status: "draft", isFeatured: false, isBreaking: false, isPinned: false, tags: [], relatedExamSlugs: [], faqs: [] },
  });
  const { register, control, watch, setValue, handleSubmit } = form;
  const { fields: faqFields, append: addFaq, remove: removeFaq } = useFieldArray({ control, name: "faqs" });

  const watchedTitle = watch("title");
  const watchedSection = watch("section");
  const watchedSlug = watch("slug");

  useEffect(() => {
    getAuthors()
      .then(setAuthors)
      .catch(() => {/* non-critical — author dropdown just stays empty */});
  }, []);

  useEffect(() => {
    if (!id || isNew) return;
    setLoading(true);
    getBlogPostById(id)
      .then((post) => {
        if (!post) { navigate("/blog"); return; }
        form.reset({
          title: post.title, slug: post.slug, excerpt: post.excerpt,
          content: post.content, section: post.section, postType: post.postType,
          authorId: post.author?.id, featuredImage: post.featuredImage,
          featuredImageCaption: post.featuredImageCaption, tags: post.tags,
          relatedExamSlugs: post.relatedExamSlugs, status: post.status,
          isFeatured: post.isFeatured, isBreaking: post.isBreaking, isPinned: post.isPinned,
          seoTitle: post.seoTitle, seoDescription: post.seoDescription,
          canonicalUrl: post.canonicalUrl, faqs: post.faqs ?? [],
        });
      })
      .catch((err) => { toast.error("Failed to load post: " + getErrorMessage(err)); navigate("/blog"); })
      .finally(() => setLoading(false));
  }, [id, isNew, navigate, form]);

  useEffect(() => {
    if (!examSearch || examSearch.length < 2) { setExamResults([]); return; }
    searchEntities(examSearch).then((results: import("@/types/entity").EntityListItem[]) => setExamResults(results.map((e: import("@/types/entity").EntityListItem) => ({ slug: e.slug, name: e.name }))));
  }, [examSearch]);

  const addRelatedExam = (slug: string) => {
    const current = watch("relatedExamSlugs");
    if (!current.includes(slug)) setValue("relatedExamSlugs", [...current, slug]);
    setExamSearch("");
    setExamResults([]);
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      if (isNew) {
        const post = await createBlogPost({ ...data, authorId: data.authorId, createdBy: user?.id });
        toast.success("Post created!");
        navigate(`/blog/${post.id}`, { replace: true });
      } else {
        await updateBlogPost(id!, { ...data, authorId: data.authorId, updatedBy: user?.id });
        toast.success("Post saved!");
      }
    } catch (err) {
      toast.error("Save failed: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;

  const seoTitleLen = (watch("seoTitle") ?? "").length;
  const seoDescLen = (watch("seoDescription") ?? "").length;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/blog")} className="text-slate-400 hover:text-slate-700"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-semibold text-slate-900">{isNew ? "New Blog Post" : "Edit Blog Post"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={watch("status")} />
          {!isNew && watch("status") === "published" && watch("slug") && (
            <a
              href={`${SITE.frontendUrl}/news/${watch("slug")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
            >
              <ExternalLink size={14} /> View on Site
            </a>
          )}
          <AIAutoFillButton onClick={() => setAiDialogOpen(true)} />
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? "Create Post" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-5">
          {/* Section / Type / Author */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label">Section *</label>
                <select {...register("section")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  {BLOG_SECTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Post Type</label>
                <select {...register("postType")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Select…</option>
                  {POST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Author</label>
                <select {...register("authorId")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">No author</option>
                  {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Title + Slug */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <label className="form-label">Title *</label>
              <input {...register("title")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="form-label">Slug *</label>
              <Controller name="slug" control={control} render={({ field }) => (
                <SlugInput value={field.value} onChange={field.onChange} sourceValue={watchedTitle}
                  previewPrefix={`/blog/${watchedSection}/`} />
              )} />
            </div>
            <div>
              <label className="form-label">Excerpt</label>
              <textarea {...register("excerpt")} rows={2} className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="form-label">Featured Image Caption</label>
              <input {...register("featuredImageCaption")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </section>

          {/* Content */}
          <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Content</h2>
              <AISuggestion promptKey="fullContent" vars={{ examName: watchedTitle, contentType: "blog article" }}
                onResult={(html) => setValue("content", html)} label="✨ Generate Article" inline={false} />
            </div>
            <Controller name="content" control={control} render={({ field }) => (
              <RichEditor content={field.value ?? ""} onChange={field.onChange} placeholder="Write your article…" />
            )} />
          </section>

          {/* Related Exams */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Related Exams</h2>
            <div className="relative mb-2">
              <input value={examSearch} onChange={(e) => setExamSearch(e.target.value)}
                placeholder="Search exam to link…"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              {examResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded border border-slate-200 bg-white shadow-md">
                  {examResults.map((e) => (
                    <button key={e.slug} type="button" onClick={() => addRelatedExam(e.slug)}
                      className="flex w-full px-3 py-2 text-sm hover:bg-slate-50 text-left">
                      {e.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {watch("relatedExamSlugs").map((slug) => (
                <span key={slug} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                  {slug}
                  <button type="button" onClick={() => setValue("relatedExamSlugs", watch("relatedExamSlugs").filter((s) => s !== slug))}
                    className="text-slate-400 hover:text-red-500">×</button>
                </span>
              ))}
            </div>
          </section>

          {/* FAQs */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">FAQs</h2>
              <div className="flex gap-2">
                <AISuggestion promptKey="faqs" vars={{ examName: watchedTitle }}
                  onResult={(json) => { try { JSON.parse(json).forEach((f: { question: string; answer: string }) => addFaq(f)); } catch { toast.error("Invalid JSON from AI"); } }}
                  label="✨ Generate FAQs" inline={false} />
                <button type="button" onClick={() => addFaq({ question: "", answer: "" })}
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
            {faqFields.map((field, i) => (
              <div key={field.id} className="mb-3 rounded border border-slate-100 p-3 space-y-1">
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
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold">Publish</h3>
            <select {...register("status")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
              <option value="draft">Draft</option>
              <option value="review">Submit for Review</option>
              {canPublish && <option value="published">Published</option>}
              {canPublish && <option value="unpublished">Unpublished</option>}
            </select>
            <div className="space-y-2">
              {[["isFeatured","Featured ⭐"],["isBreaking","Breaking 🔴"],["isPinned","Pinned 📌"]].map(([field, label]) => (
                <label key={field} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register(field as keyof FormData)} className="h-4 w-4 rounded text-blue-600" />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            <button type="submit" disabled={saving} className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : isNew ? "Create Post" : "Save"}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Featured Image</h3>
            <Controller name="featuredImage" control={control} render={({ field }) => (
              <ImageUploader value={field.value} onChange={field.onChange} folder="blog" />
            )} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold">SEO</h3>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700">SEO Title</label>
                <span className={cn("text-xs", seoTitleLen > 60 ? "text-red-500" : "text-slate-400")}>{seoTitleLen}/60</span>
              </div>
              <input {...register("seoTitle")} className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:outline-none" />
              <AISuggestion promptKey="seoTitle" vars={{ examName: watchedTitle }} onResult={(v) => setValue("seoTitle", v)} className="mt-1" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700">Meta Description</label>
                <span className={cn("text-xs", seoDescLen > 160 ? "text-red-500" : "text-slate-400")}>{seoDescLen}/160</span>
              </div>
              <textarea {...register("seoDescription")} rows={3} className="w-full resize-none rounded border border-slate-200 px-3 py-1.5 text-sm focus:outline-none" />
              <AISuggestion promptKey="metaDescription" vars={{ examName: watchedTitle }} onResult={(v) => setValue("seoDescription", v)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Canonical URL</label>
              <input {...register("canonicalUrl")} className="mt-1 w-full rounded border border-slate-200 px-3 py-1.5 text-sm focus:outline-none" placeholder="https://..." />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="form-label text-xs">Tags (comma-separated)</label>
            <input defaultValue={watch("tags").join(", ")}
              onBlur={(e) => setValue("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
          </div>

          {!isNew && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold">Frontend Sync</h3>
              <FrontendSync onSync={(url, token) => revalidateBlogPost(watchedSection, watchedSlug, url, token)} />
            </div>
          )}
        </div>
      </div>

      {/* AI Auto-Fill Dialog */}
      <AIAutoFillDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        extractFn={autoFillBlogPost}
        title="AI Auto-Fill Blog Post"
        placeholder="Paste raw news, article draft, or topic details. AI will generate a complete blog post with SEO."
        onResult={(data) => {
          const d = data as any;
          if (d.title) form.setValue("title", d.title);
          if (d.slug) form.setValue("slug", d.slug);
          if (d.excerpt) form.setValue("excerpt", d.excerpt);
          if (d.content) form.setValue("content", d.content);
          if (d.section) form.setValue("section", d.section);
          if (d.postType) form.setValue("postType", d.postType);
          if (d.tags) form.setValue("tags", d.tags);
          if (d.seoTitle) form.setValue("seoTitle", d.seoTitle);
          if (d.seoDescription) form.setValue("seoDescription", d.seoDescription);
          if (Array.isArray(d.faqs)) form.setValue("faqs", d.faqs);
          toast.success("AI filled all fields! Review and save.");
        }}
      />
    </form>
  );
}
