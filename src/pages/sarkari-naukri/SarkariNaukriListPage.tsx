/**
 * SarkariNaukriListPage — List of government job vacancies (`sarkari_naukri`).
 * Reads the same table the editor writes (single source of truth).
 * C4: "Dates missing" and "Unverified" badges + filters.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Briefcase, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listSarkariNaukri, deleteSarkariNaukri,
  type SarkariNaukri,
} from "@/services/sarkariNaukriService";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ViewOnSiteButton } from "@/components/shared/ViewOnSiteButton";
import { getErrorMessage } from "@/lib/utils";

type FlagFilter = "" | "datesMissing" | "unverified";

/** "Dates awaited" — no application dates recorded at all (matches D). */
function datesMissing(item: SarkariNaukri): boolean {
  return !item.notificationDate && !item.applicationStartDate && !item.applicationEndDate;
}

export function SarkariNaukriListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<SarkariNaukri[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [flag, setFlag] = useState<FlagFilter>("");
  const [deleteTarget, setDeleteTarget] = useState<SarkariNaukri | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const opts: Parameters<typeof listSarkariNaukri>[0] = {};
      if (search) opts.search = search;
      if (flag === "datesMissing") opts.datesMissing = true;
      if (flag === "unverified") opts.unverified = true;
      const res = await listSarkariNaukri(opts);
      setItems(res.data);
      setCount(res.count);
    } catch (err) {
      toast.error("Failed to load: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, flag]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSarkariNaukri(deleteTarget.id);
      toast.success(`"${deleteTarget.title}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Sarkari Naukri</h1>
          <p className="text-sm text-slate-500">{count} government jobs</p>
        </div>
        <button onClick={() => navigate("/sarkari-naukri/new")}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={16} /> New Job
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-slate-200 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search jobs..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-1.5 text-sm" />
        </div>
        <select value={flag} onChange={(e) => setFlag(e.target.value as FlagFilter)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">All vacancies</option>
          <option value="datesMissing">Dates missing</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Briefcase size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No government jobs found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.id} onClick={() => navigate(`/sarkari-naukri/${item.id}`)}
              className="bg-white rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer group relative">
              <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                <ViewOnSiteButton pillar="sarkari-naukri" category={item.category ?? ""} slug={item.slug} isPublished={item.workflowStatus === "published"} />
                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                  className="p-1.5 rounded text-slate-300 hover:text-red-600 hover:bg-red-50"
                  title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
              <h3 className="font-medium text-slate-900 text-sm line-clamp-2 pr-6 mb-2">{item.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {item.category && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{item.category.replace(/-/g, " ")}</span>
                )}
                {item.workflowStatus === "published" ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">● Live</span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">○ Draft</span>
                )}
                {/* C4 badges */}
                {datesMissing(item) && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium">Dates missing</span>
                )}
                {!item.verifiedAt && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-medium">Unverified</span>
                )}
              </div>
              <p className="text-xs text-slate-500">{item.organization}</p>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Job" description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete" onConfirm={handleDelete} isLoading={deleting} confirmVariant="danger" />
    </div>
  );
}
