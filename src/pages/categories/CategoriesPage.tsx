import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Loader2, ExternalLink } from "lucide-react";
import { getCategories, createCategory, updateCategory, deleteCategory, checkSlugAvailable, type Category } from "@/services/categoryService";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SlugInput } from "@/components/shared/SlugInput";
import { revalidateAll } from "@/lib/api/frontend";
import { useSettings } from "@/hooks/useSettings";
import { PILLARS } from "@/config/site";
import { SITE } from "@/config/site";
import type { Pillar } from "@/types/exam";

type FormData = {
  name: string;
  slug: string;
  shortName: string;
  pillar: Pillar;
  parentId: string;
  description: string;
  icon: string;
  color: string;
  orderIndex: number;
  isActive: boolean;
};

export function CategoriesPage() {
  const { getSetting } = useSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pillarFilter, setPillarFilter] = useState<Pillar>("sarkari-naukri");
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugValue, setSlugValue] = useState("");

  const { register, handleSubmit, reset, setValue } = useForm<FormData>({
    defaultValues: { pillar: pillarFilter, isActive: true, orderIndex: 0 },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await getCategories());
    } catch (err) {
      toast.error("Failed to load categories: " + String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = categories.filter((c) => c.pillar === pillarFilter);
  const parents = filtered.filter((c) => !c.parentId);

  const openNew = () => {
    setEditing(null);
    setSlugValue("");
    reset({ pillar: pillarFilter, isActive: true, orderIndex: filtered.length, parentId: "" });
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setSlugValue(cat.slug);
    reset({
      name: cat.name, slug: cat.slug, shortName: cat.shortName ?? "",
      pillar: cat.pillar, parentId: cat.parentId ?? "",
      description: cat.description ?? "", icon: cat.icon ?? "",
      color: cat.color ?? "", orderIndex: cat.orderIndex, isActive: cat.isActive,
    });
    setShowForm(true);
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const payload = {
        ...data, slug: slugValue || data.slug,
        parentId: data.parentId || null,
        shortName: data.shortName || null,
        description: data.description || null,
        icon: data.icon || null,
        color: data.color || null,
      };
      if (editing) {
        await updateCategory(editing.id, payload);
        toast.success("Category updated.");
      } else {
        await createCategory(payload as never);
        toast.success(`Category saved. Frontend URL: /${data.pillar}/${slugValue || data.slug}`);
      }
      setShowForm(false);
      load();

      // Revalidate (fire-and-forget — don't block on failure)
      const url = getSetting("frontend_url", SITE.frontendUrl) as string;
      const token = getSetting("revalidate_token", "") as string;
      if (token) revalidateAll(url, token).catch(() => {/* non-critical */});
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.examCount > 0) {
      toast.error(`Cannot delete — ${deleteTarget.examCount} exams use this category.`);
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await deleteCategory(deleteTarget.id);
      toast.success("Category deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Categories</h1>
        <button onClick={openNew}
          className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Pillar tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        {PILLARS.map((p) => (
          <button key={p.value} onClick={() => setPillarFilter(p.value as Pillar)}
            className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${pillarFilter === p.value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Category tree */}
      <div className="rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={24} />
          </div>
        ) : parents.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            No categories for this pillar. Add one to get started.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {parents.map((cat) => {
              const children = filtered.filter((c) => c.parentId === cat.id);
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 group">
                    <div className="flex items-center gap-3">
                      {cat.icon && <span className="text-lg">{cat.icon}</span>}
                      <div>
                        <span className="font-medium text-slate-900">{cat.name}</span>
                        <span className="ml-2 font-mono text-xs text-slate-400">{cat.slug}</span>
                        {!cat.isActive && <span className="ml-2 text-xs text-red-500">(inactive)</span>}
                      </div>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                        {cat.examCount} exams
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <a href={`${SITE.frontendUrl}/${cat.pillar}/${cat.slug}`} target="_blank" rel="noopener noreferrer"
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600">
                        <ExternalLink size={14} />
                      </a>
                      <button onClick={() => openEdit(cat)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(cat)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {children.map((child) => (
                    <div key={child.id} className="flex items-center justify-between pl-12 pr-5 py-2 hover:bg-slate-50 group border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300">└</span>
                        <span className="text-sm text-slate-700">{child.name}</span>
                        <span className="font-mono text-xs text-slate-400">{child.slug}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{child.examCount}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={() => openEdit(child)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteTarget(child)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">{editing ? "Edit Category" : "New Category"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="form-label text-xs">Name *</label>
                  <input {...register("name", { required: true })} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="form-label text-xs">Slug *</label>
                  <SlugInput value={slugValue} onChange={setSlugValue}
                    checkAvailable={(s) => checkSlugAvailable(s, editing?.id)}
                    previewPrefix={`/${pillarFilter}/`} />
                </div>
                <div>
                  <label className="form-label text-xs">Short Name</label>
                  <input {...register("shortName")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="form-label text-xs">Pillar *</label>
                  <select {...register("pillar")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
                    {PILLARS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Parent Category</label>
                  <select {...register("parentId")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
                    <option value="">None (top-level)</option>
                    {parents.filter((c) => c.id !== editing?.id).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Order</label>
                  <input {...register("orderIndex", { valueAsNumber: true })} type="number" className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="form-label text-xs">Icon (emoji)</label>
                  <input {...register("icon")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" placeholder="🏦" />
                </div>
                <div>
                  <label className="form-label text-xs">Color</label>
                  <input {...register("color")} type="color" className="h-[38px] w-full rounded border border-slate-200 px-2 py-1 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="form-label text-xs">Description</label>
                  <textarea {...register("description")} rows={2} className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded text-blue-600" />
                <span className="text-sm">Active</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editing ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Category"
        description={deleteTarget?.examCount ? `Cannot delete — ${deleteTarget.examCount} exams use this category.` : `Delete "${deleteTarget?.name}"?`}
        confirmLabel={deleteTarget?.examCount ? "OK" : "Delete"}
        confirmVariant={deleteTarget?.examCount ? "primary" : "danger"}
        onConfirm={handleDelete} isLoading={deleting} />
    </div>
  );
}
