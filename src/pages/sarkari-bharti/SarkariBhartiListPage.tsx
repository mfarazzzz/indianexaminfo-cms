import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Shield, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getEntranceExams, type EntranceExamListItem } from "@/services/entranceExamService";
import { getCategories, type Category } from "@/services/categoryService";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BulkImportExport } from "@/components/shared/BulkImportExport";
import { ViewOnSiteButton } from "@/components/shared/ViewOnSiteButton";
import { deleteExam } from "@/services/examService";
import { getErrorMessage } from "@/lib/utils";

export function SarkariBhartiListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<EntranceExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<EntranceExamListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { getCategories("sarkari-bharti").then(setCategories).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEntranceExams({ pillar: "sarkari-bharti", search: search || undefined, categoryId: categoryId || undefined });
      setItems(data);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [search, categoryId]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-slate-900">Sarkari Bharti</h1><p className="text-sm text-slate-500">{items.length} recruitments</p></div>
        <button onClick={() => navigate("/sarkari-bharti/new")} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={16} /> New Recruitment</button>
      </div>
      {/* Bulk Import/Export */}
      <BulkImportExport pillar="sarkari-bharti" pillarLabel="Sarkari Bharti" onImportComplete={load} />
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-slate-200 p-3">
        <div className="relative flex-1 min-w-[200px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search recruitments..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-1.5 text-sm" /></div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"><option value="">All Departments</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>
      : items.length === 0 ? <div className="bg-white rounded-lg border p-12 text-center"><Shield size={40} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-500 text-sm">No recruitments found.</p></div>
      : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{items.map((item) => (
        <div key={item.id} onClick={() => navigate(`/sarkari-bharti/${item.id}`)} className="bg-white rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer group relative">
          <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
            <ViewOnSiteButton pillar="sarkari-bharti" category={item.category} slug={item.slug} isPublished={item.isPublished} />
            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }} className="p-1.5 rounded text-slate-300 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
          <h3 className="font-medium text-slate-900 text-sm line-clamp-2 pr-6 mb-2">{item.name}</h3>
          <div className="flex items-center gap-2"><span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{item.category.replace(/-/g, " ")}</span>
            {item.isPublished ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">● Live</span> : <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">○ Draft</span>}
          </div>
        </div>
      ))}</div>}
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Delete Recruitment" description={`Delete "${deleteTarget?.name}"?`} confirmLabel="Delete" onConfirm={async () => { if (!deleteTarget) return; setDeleting(true); try { await deleteExam(deleteTarget.id); toast.success("Deleted."); setDeleteTarget(null); load(); } catch (err) { toast.error(getErrorMessage(err)); } finally { setDeleting(false); } }} isLoading={deleting} confirmVariant="danger" />
    </div>
  );
}
