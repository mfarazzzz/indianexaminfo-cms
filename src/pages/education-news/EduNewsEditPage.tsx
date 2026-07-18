import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Save, ArrowLeft, Eye, Trash2 } from "lucide-react";
import {
  getEducationNewsById, createEducationNews, updateEducationNews, deleteEducationNews,
  type CmsEducationNews, type CmsEducationNewsInput,
} from "@/services/educationNewsService";
import { getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "Lowercase with hyphens only"),
  title: z.string().min(5, "Title required (min 5 chars)"),
  titleHindi: z.string().optional().nullable(),
  category: z.string().min(1, "Category is required"),
  excerpt: z.string().optional().nullable(),
  excerptHindi: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  contentHindi: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  sourceLink: z.string().url().optional().or(z.literal("")).nullable(),
  author: z.string().optional().nullable(),
  isBreaking: z.boolean().optional(),
  isImportant: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(["draft", "pending_review", "approved", "published", "archived"]).optional(),
});

type FormData = z.infer<typeof schema>;

export function EduNewsEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<CmsEducationNews | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      slug: "", title: "", titleHindi: "", category: "government-jobs",
      excerpt: "", excerptHindi: "", content: "", contentHindi: "",
      source: "", sourceLink: "", author: "",
      isBreaking: false, isImportant: false, isFeatured: false, status: "draft",
    },
  });

  useEffect(() => {
    if (!isNew && id) {
      getEducationNewsById(id).then((item) => {
        if (!item) { toast.error("Not found"); navigate("/education-news"); return; }
        setExisting(item);
        form.reset({
          slug: item.slug,
          title: item.title,
          titleHindi: item.titleHindi ?? "",
          category: item.category,
          excerpt: item.excerpt ?? "",
          excerptHindi: item.excerptHindi ?? "",
          content: item.content ?? "",
          contentHindi: item.contentHindi ?? "",
          source: item.source ?? "",
          sourceLink: item.sourceLink ?? "",
          author: item.author ?? "",
          isBreaking: item.isBreaking,
          isImportant: item.isImportant,
          isFeatured: item.isFeatured,
          status: item.status,
        });
        setLoading(false);
      });
    }
  }, [id, isNew, navigate, form]);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const input: CmsEducationNewsInput = {
        slug: data.slug,
        title: data.title,
        titleHindi: data.titleHindi || null,
        category: data.category,
        excerpt: data.excerpt || null,
        excerptHindi: data.excerptHindi || null,
        content: data.content || null,
        contentHindi: data.contentHindi || null,
        source: data.source || null,
        sourceLink: data.sourceLink || null,
        author: data.author || null,
        isBreaking: data.isBreaking ?? false,
        isImportant: data.isImportant ?? false,
        isFeatured: data.isFeatured ?? false,
        status: data.status ?? "draft",
        createdBy: user?.id ?? null,
        createdVia: "cms_editor",
      };

      if (isNew) {
        const created = await createEducationNews(input);
        toast.success("Article created!");
        navigate(`/education-news/${created.id}`);
      } else {
        await updateEducationNews(id!, input);
        toast.success("Article updated!");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    form.setValue("status", "published");
    form.handleSubmit(onSubmit)();
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!confirm("Delete permanently?")) return;
    try {
      await deleteEducationNews(id);
      toast.success("Deleted");
      navigate("/education-news");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/education-news")} className="p-2 rounded hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">
            {isNew ? "New Education News" : "Edit Education News"}
          </h1>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
          <button onClick={handlePublish} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 font-medium">
            <Eye className="w-3.5 h-3.5" /> Publish
          </button>
          <button onClick={form.handleSubmit(onSubmit)} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <fieldset className="border border-slate-200 rounded-lg p-5">
          <legend className="text-sm font-semibold text-slate-700 px-2">Article Details</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input {...form.register("title")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              {form.formState.errors.title && <p className="text-xs text-red-500 mt-1">{form.formState.errors.title.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title (Hindi)</label>
              <input {...form.register("titleHindi")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug *</label>
              <input {...form.register("slug")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <input {...form.register("category")} placeholder="government-jobs" className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
              <input {...form.register("source")} placeholder="UPSC Official" className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source Link</label>
              <input {...form.register("sourceLink")} placeholder="https://..." className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Author</label>
              <input {...form.register("author")} className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
          </div>
        </fieldset>

        <fieldset className="border border-slate-200 rounded-lg p-5">
          <legend className="text-sm font-semibold text-slate-700 px-2">Content</legend>
          <div className="space-y-4 mt-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Excerpt</label>
              <textarea {...form.register("excerpt")} rows={3} className="w-full border border-slate-200 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Content (HTML)</label>
              <textarea {...form.register("content")} rows={12} className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-mono" />
            </div>
          </div>
        </fieldset>

        <fieldset className="border border-slate-200 rounded-lg p-5">
          <legend className="text-sm font-semibold text-slate-700 px-2">Visibility & Workflow</legend>
          <div className="flex flex-wrap gap-6 mt-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register("isBreaking")} className="rounded" />
              Breaking News
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register("isImportant")} className="rounded" />
              Important
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register("isFeatured")} className="rounded" />
              Featured
            </label>
            <div>
              <select {...form.register("status")} className="border border-slate-200 rounded px-3 py-2 text-sm">
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </fieldset>

        {existing && (
          <div className="text-xs text-slate-400 border-t pt-4 space-y-1">
            <p>Created: {new Date(existing.createdAt).toLocaleString()}</p>
            <p>Updated: {new Date(existing.updatedAt).toLocaleString()}</p>
            <p>Created By: {existing.createdBy ?? "System (legacy import)"}</p>
          </div>
        )}
      </form>
    </div>
  );
}
