import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Star, Archive } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  listResults, deleteResult, bulkPublishResults, bulkArchiveResults,
  type CmsResult, type CmsResultListOpts,
} from "@/services/resultService";
import { formatDate, getErrorMessage } from "@/lib/utils";

const CATEGORIES = [
  "anganwadi", "asha-nhm", "panchayat", "court", "municipal", "driver",
  "group-d", "block-office", "hospital", "forest", "home-guard", "jail",
  "zila-parishad", "school", "college", "revenue", "postal", "electricity",
  "agriculture", "irrigation", "cooperative", "animal-husbandry",
  "civil-services", "ssc", "railway", "banking", "state-psc", "defence",
  "police", "insurance", "regulatory", "teaching", "paramilitary", "medical",
  "engineering", "scientific", "psu",
];

export function ResultsListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<CmsResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CmsResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const opts: CmsResultListOpts = {};
      if (status) opts.status = status;
      if (category) opts.category = category;
      if (search) opts.search = search;
      opts.limit = 50;
      const { data: rows, count } = await listResults(opts);
      setData(rows);
      setTotal(count);
    } catch (err) {
      toast.error("Failed to load: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, category, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteResult(deleteTarget.id);
      toast.success("Result deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const columns: ColumnDef<CmsResult>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="max-w-[400px]">
          <p className="font-medium text-sm text-slate-800 truncate">{row.original.title}</p>
          <p className="text-xs text-slate-400 truncate">{row.original.organization} · {row.original.category}</p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "resultStatus",
      header: "Result",
      cell: ({ row }) => (
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
          {row.original.resultStatus ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "resultDate",
      header: "Date",
      cell: ({ row }) => <span className="text-xs text-slate-500">{formatDate(row.original.resultDate)}</span>,
    },
    {
      accessorKey: "isFeatured",
      header: "★",
      cell: ({ row }) => row.original.isFeatured ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> : null,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => navigate(`/results/${row.original.id}`)} className="p-1.5 rounded hover:bg-slate-100" title="Edit">
            <Pencil className="w-3.5 h-3.5 text-slate-500" />
          </button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1.5 rounded hover:bg-red-50" title="Delete">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Sarkari Results</h1>
          <p className="text-sm text-slate-500">{total} entries total</p>
        </div>
        <button onClick={() => navigate("/results/new")}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Result
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search results..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={data} isLoading={loading} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Result"
        description={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
