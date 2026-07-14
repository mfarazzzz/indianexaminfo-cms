import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { getAuthors, createAuthor, updateAuthor, deleteAuthor } from "@/services/blogService";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ImageUploader } from "@/components/shared/ImageUploader";
import type { BlogAuthor } from "@/types/blog";
import { slugify , getErrorMessage } from "@/lib/utils";

type FormData = {
  name: string;
  slug: string;
  designation: string;
  bio: string;
  avatar: string;
  specialization: string;
  twitter: string;
  linkedin: string;
  isActive: boolean;
};

export function BlogAuthorsPage() {
  const [authors, setAuthors] = useState<BlogAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BlogAuthor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlogAuthor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: { isActive: true },
  });

  const load = async () => {
    setLoading(true);
    try { setAuthors(await getAuthors()); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setAvatarUrl("");
    reset({ isActive: true });
    setShowForm(true);
  };

  const openEdit = (author: BlogAuthor) => {
    setEditing(author);
    setAvatarUrl(author.avatar);
    reset({
      name: author.name,
      slug: author.slug,
      designation: author.designation,
      bio: author.bio,
      avatar: author.avatar,
      specialization: author.specialization.join(", "),
      twitter: author.socialLinks.twitter ?? "",
      linkedin: author.socialLinks.linkedin ?? "",
      isActive: author.isActive,
    });
    setShowForm(true);
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const payload = {
        name: data.name,
        slug: data.slug || slugify(data.name),
        designation: data.designation,
        bio: data.bio,
        avatar: avatarUrl,
        specialization: data.specialization.split(",").map((s) => s.trim()).filter(Boolean),
        socialLinks: {
          ...(data.twitter && { twitter: data.twitter }),
          ...(data.linkedin && { linkedin: data.linkedin }),
        },
        isActive: data.isActive,
      };
      if (editing) {
        await updateAuthor(editing.id, payload);
        toast.success("Author updated.");
      } else {
        await createAuthor(payload);
        toast.success("Author created.");
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAuthor(deleteTarget.id);
      toast.success("Author deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Blog Authors</h1>
        <button onClick={openNew}
          className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={16} /> Add Author
        </button>
      </div>

      {/* Authors grid */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={24} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((author) => (
            <div key={author.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {author.avatar ? (
                    <img src={author.avatar} alt={author.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                      {(author.name?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-slate-900">{author.name}</p>
                    <p className="text-xs text-slate-500">{author.designation}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(author)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(author)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">{author.bio}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">{author.totalPosts} posts</span>
                <span className={`text-xs font-medium ${author.isActive ? "text-green-600" : "text-red-500"}`}>
                  {author.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? "Edit Author" : "New Author"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="mb-3">
                <label className="form-label text-xs">Avatar</label>
                <ImageUploader value={avatarUrl} onChange={setAvatarUrl} folder="authors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Name *</label>
                  <input {...register("name", { required: true })} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="form-label text-xs">Slug</label>
                  <input {...register("slug")} placeholder="auto-generated" className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="form-label text-xs">Designation</label>
                  <input {...register("designation")} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="form-label text-xs">Bio</label>
                  <textarea {...register("bio")} rows={3} className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="form-label text-xs">Specialization (comma-separated)</label>
                  <input {...register("specialization")} placeholder="UPSC, SSC, Banking" className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="form-label text-xs">Twitter URL</label>
                  <input {...register("twitter")} type="url" className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="form-label text-xs">LinkedIn URL</label>
                  <input {...register("linkedin")} type="url" className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded text-blue-600" />
                <span className="text-sm text-slate-700">Active</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editing ? "Save Changes" : "Create Author"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Author" description={`Delete "${deleteTarget?.name}"? Their posts will remain but lose author attribution.`}
        confirmLabel="Delete" onConfirm={handleDelete} isLoading={deleting} />
    </div>
  );
}
