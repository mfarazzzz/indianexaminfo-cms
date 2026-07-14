import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Star } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getExams, deleteExam, type ExamListOpts } from "@/services/examService";
import { getCategories, type Category } from "@/services/categoryService";
import { EXAM_STATUSES } from "@/config/site";
import { usePillars } from "@/hooks/usePillars";
import { formatDate , getErrorMessage } from "@/lib/utils";
import type { ExamEntity, Pillar } from "@/types/exam";

export function ExamsListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [data, setData] = useState<ExamEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pillar, setPillar] = useState<string>(searchParams.get("pillar") ?? "");
  const [status, setStatus] = useState<string>(searchParams.get("status") ?? "");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ExamEntity | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { data: pillars = [] } = usePillars();

  // Load categories when pillar changes
  useEffect(() => {
    if (pillar) {
      getCategories(pillar).then(setCategories).catch(() => setCategories([]));
    } else {
      setCategories([]);
    }
    setCategoryId("");
  }, [pillar]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const opts: ExamListOpts = {};
      if (pillar) opts.pillar = pillar;
      if (categoryId) opts.categoryId = categoryId;
      if (status) opts.status = status;
      if (search) opts.search = search;
      const { data: rows, count } = await getExams(opts);
      setData(rows);
      setTotal(count);
    } catch (err) {
      toast.error("Failed to load exams: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [pillar, categoryId, status, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExam(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<ExamEntity>[] = [
    {
      accessorKey: "name",
      header: "Exam Name",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {row.original.isFeatured && <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />}
            <p className="font-medium text-slate-900 line-clamp-1">{row.original.name}</p>
          </div>
          <p className="text-xs text-slate-400 line-clamp-1">/{row.original.pillar}/{row.original.category}/{row.original.slug}</p>
        </div>
      ),
    },
    {
      accessorKey: "pillar",
      header: "Pillar",
      cell: ({ row }) => (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">
          {row.original.pillar.replace(/-/g, " ")}
        </span>
      ),
    },
    {
      accessorKey: "entityType",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-xs capitalize text-slate-600">{row.original.entityType}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">{formatDate(row.original.updatedAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/exams/${row.original.id}`)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Exam Manager</h1>
          <p className="text-sm text-slate-500">{total} exams total</p>
        </div>
        <button
          onClick={() => navigate("/exams/new")}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          New Exam
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-slate-200 p-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search exams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Pillar filter */}
        <select
          value={pillar}
          onChange={(e) => setPillar(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Pillars</option>
          {pillars.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Category filter */}
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          disabled={!pillar}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {EXAM_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        <DataTable columns={columns} data={data} isLoading={loading} />
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Exam"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will also affect all linked content posts.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isLoading={deleting}
        confirmVariant="danger"
      />
    </div>
  );
}
