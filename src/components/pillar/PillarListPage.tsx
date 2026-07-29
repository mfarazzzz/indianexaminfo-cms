/**
 * PillarListPage — Reusable list page for any content pillar.
 * Shows a searchable, filterable grid of entities with status badges.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Loader2, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { createPillarService } from "@/services/pillarService";
import { getCategories, type Category } from "@/services/categoryService";
import { deleteExam } from "@/services/examService";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getErrorMessage } from "@/lib/utils";
import type { Pillar } from "@/types/exam";

interface Props {
  pillar: string;
  title: string;
  entityLabel: string;
}

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-yellow-100 text-yellow-700",
  "notification-released": "bg-blue-100 text-blue-700",
  "registration-open": "bg-green-100 text-green-700",
  "registration-closed": "bg-red-100 text-red-700",
  "admit-card-released": "bg-purple-100 text-purple-700",
  "exam-conducted": "bg-indigo-100 text-indigo-700",
  "answer-key-released": "bg-cyan-100 text-cyan-700",
  "result-declared": "bg-emerald-100 text-emerald-700",
  counselling: "bg-orange-100 text-orange-700",
  completed: "bg-gray-100 text-gray-500",
};

export function PillarListPage({ pillar, title, entityLabel }: Props) {
  const navigate = useNavigate();
  const service = createPillarService(pillar as Pillar);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Determine the route base path from pillar
  const basePath = `/${pillar === "board-university" ? "board-exams" : pillar === "university-exam" ? "university-exams" : pillar}`;

  useEffect(() => {
    getCategories(pillar).then(setCategories).catch(() => []);
  }, [pillar]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await service.getList({ search: search || undefined, categoryId: categoryId || undefined });
      setItems(data);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [search, categoryId, service]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExam(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{items.length} {entityLabel.toLowerCase()}s</p>
        </div>
        <button onClick={() => navigate(`${basePath}/new`)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={16} /> New {entityLabel}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-slate-200 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={`Search ${entityLabel.toLowerCase()}s...`} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">No {entityLabel.toLowerCase()}s found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.id} onClick={() => navigate(`${basePath}/${item.id}`)}
              className="bg-white rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group relative">
              <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                className="absolute top-2 right-2 p-1.5 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 size={14} />
              </button>
              <h3 className="font-medium text-slate-900 text-sm leading-snug line-clamp-2 pr-6 mb-2">{item.name}</h3>
              <div className="flex items-center gap-2 mb-2">
                {item.category && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{item.category.replace(/-/g, " ")}</span>}
                {item.isPublished ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">● Live</span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">○ Draft</span>
                )}
                {item.currentEdition && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[item.currentEdition.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {item.currentEdition.status.replace(/-/g, " ")}
                  </span>
                )}
              </div>
              {item.currentEdition?.nextDate && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar size={12} />
                  <span>{item.currentEdition.nextDate.label}:</span>
                  <span className="font-medium text-slate-700">{new Date(item.currentEdition.nextDate.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title={`Delete ${entityLabel}`}
        description={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={handleDelete} isLoading={deleting} confirmVariant="danger" />
    </div>
  );
}
