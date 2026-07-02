import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import { getPages, deletePage } from "@/services/pageService";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import type { Page } from "@/types/page";

export function PagesListPage() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setPages(await getPages()); }
    catch (err) { toast.error(String(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePage(deleteTarget.id);
      toast.success("Page deleted.");
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
        <h1 className="text-xl font-semibold text-slate-900">Pages</h1>
        <button onClick={() => navigate("/pages/new")}
          className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={16} /> Add Page
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Slug</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">System</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                  ))}
                </tr>
              ))
            ) : pages.map((page) => (
              <tr key={page.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{page.title}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">/{page.slug}</td>
                <td className="px-4 py-3">
                  {page.isSystem && (
                    <span title="System page — slug is locked">
                      <Lock size={14} className="text-slate-400" />
                    </span>
                  )}
                </td>
                <td className="px-4 py-3"><StatusBadge status={page.status} /></td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(page.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => navigate(`/pages/${page.id}`)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <Pencil size={14} />
                    </button>
                    {!page.isSystem && (
                      <button onClick={() => setDeleteTarget(page)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Page" description={`Delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete" onConfirm={handleDelete} isLoading={deleting} />
    </div>
  );
}
