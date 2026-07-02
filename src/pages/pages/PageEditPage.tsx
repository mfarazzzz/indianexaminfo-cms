import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Lock } from "lucide-react";
import { getPageById, createPage, updatePage } from "@/services/pageService";
import { RichEditor } from "@/components/shared/RichEditor";
import { revalidatePath } from "@/lib/api/frontend";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { SITE } from "@/config/site";
import type { Page } from "@/types/page";

type FormData = {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  status: "draft" | "published";
  content: string;
};

export function PageEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { getSetting } = useSettings();
  const { user } = useAuth();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");
  const [isSystem, setIsSystem] = useState(false);

  const { register, handleSubmit, reset, watch } = useForm<FormData>({
    defaultValues: { status: "published" },
  });

  useEffect(() => {
    if (!id || isNew) return;
    setLoading(true);
    getPageById(id).then((page) => {
      if (!page) { navigate("/pages"); return; }
      setIsSystem(page.isSystem);
      setContent(page.content ?? "");
      reset({ title: page.title, slug: page.slug, metaTitle: page.metaTitle ?? "", metaDescription: page.metaDescription ?? "", status: page.status, content: page.content ?? "" });
    }).finally(() => setLoading(false));
  }, [id, isNew, navigate, reset]);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const payload = { ...data, content };
      if (isNew) {
        const page = await createPage(payload as Partial<Page>);
        toast.success("Page created.");
        navigate(`/pages/${page.id}`, { replace: true });
      } else {
        await updatePage(id!, payload as Partial<Page>, user?.id);
        toast.success("Page saved.");

        const url = getSetting("frontend_url", SITE.frontendUrl) as string;
        const token = getSetting("revalidate_token", "") as string;
        if (token) await revalidatePath(`/${data.slug}`, url, token);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={24} /></div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/pages")} className="text-slate-400 hover:text-slate-700"><ArrowLeft size={20} /></button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{isNew ? "New Page" : "Edit Page"}</h1>
            {isSystem && (
              <span title="System page">
                <Lock size={14} className="text-slate-400" />
              </span>
            )}
          </div>
        </div>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save &amp; Sync
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <label className="form-label">Title *</label>
              <input {...register("title", { required: true })} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            {!isSystem && (
              <div>
                <label className="form-label">Slug</label>
                <input {...register("slug")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Content</h2>
            </div>
            <RichEditor content={content} onChange={setContent} placeholder="Page content…" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold">Settings</h3>
            <div>
              <label className="form-label text-xs">Status</label>
              <select {...register("status")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <button type="submit" disabled={saving} className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              Save &amp; Sync
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold">SEO</h3>
            <div>
              <label className="form-label text-xs">Meta Title</label>
              <input {...register("metaTitle")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="form-label text-xs">Meta Description</label>
              <textarea {...register("metaDescription")} rows={3} className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
