import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getExams, deleteExam, type ExamListItem } from "@/services/examService";
import { getCategories } from "@/services/categoryService";
import { PILLARS, EXAM_STATUSES } from "@/config/site";
import { formatDate } from "@/lib/utils";
import { SITE } from "@/config/site";
import type { Pillar } from "@/types/exam";
import { usePermission } from "@/hooks/usePermission";
import { P } from "@/config/permissions";

const FLAG_ICONS: { key: keyof ExamListItem; icon: string; title: string }[] = [
  { key: "hasNotification",   icon: "🔔", title: "Notification" },
  { key: "hasApplication",    icon: "📝", title: "Application" },
  { key: "hasAdmitCard",      icon: "📅", title: "Admit Card" },
  { key: "hasSyllabus",       icon: "✂️", title: "Syllabus" },
  { key: "hasAnswerKey",       icon: "🔑", title: "Answer Key" },
  { key: "hasResult",         icon: "🏆", title: "Result" },
  { key: "hasDateSheet",      icon: "📋", title: "Date Sheet" },
  { key: "hasCutoff",         icon: "✂️", title: "Cutoff" },
  { key: "hasMockTest",       icon: "🖥️", title: "Mock Test" },
  { key: "hasPreviousPapers", icon: "📚", title: "Previous Papers" },
  { key: "hasStudyMaterial",  icon: "📎", title: "Study Material" },
];

export function ExamsListPage() {
  const navigate = useNavigate();
  const canDelete = usePermission(P.DELETE_EXAM);
  const canCreate = usePermission(P.CREATE_EXAM);

  const [data, setData] = useState<ExamListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pillar, setPillar] = useState<Pillar | "">("");
  const [status, setStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ExamListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, count } = await getExams({
        pillar: pillar || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      setData(rows);
      setTotal(count);
    } catch (err) {
      toast.error("Failed to load exams: " + String(err));
    } finally {
      setLoading(false);
    }
  }, [pillar, status, search]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExam(deleteTarget.id);
      toast.success("Exam deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error("Delete failed: " + String(err));
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<ExamListItem>[] = [
    {
      accessorKey: "name",
      header: "Exam",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-slate-900">{row.original.name}</p>
          <p className="text-xs text-slate-400 font-mono">{row.original.slug}</p>
        </div>
      ),
    },
    {
      accessorKey: "pillar",
      header: "Pillar",
      size: 130,
      cell: ({ row }) => (
        <span className="text-xs text-slate-600 capitalize">
          {row.original.pillar.replace(/-/g, " ")}
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      size: 110,
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">{row.original.category || "—"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 130,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "vacancy",
      header: "Vacancy",
      size: 80,
      cell: ({ row }) => (
        <span className="text-xs text-slate-600">
          {row.original.vacancy ? row.original.vacancy.toLocaleString("en-IN") : "—"}
        </span>
      ),
    },
    {
      accessorKey: "isFeatured",
      header: "⭐",
      size: 40,
      cell: ({ row }) => (
        <span>{row.original.isFeatured ? "⭐" : ""}</span>
      ),
    },
    {
      id: "flags",
      header: "Content Flags",
      size: 200,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-0.5">
          {FLAG_ICONS.map(({ key, icon, title }) => (
            <span
              key={key}
              title={title}
              className={row.original[key] ? "opacity-100" : "opacity-20 grayscale"}
            >
              {icon}
            </span>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      size: 90,
      cell: ({ row }) => (
        <span className="text-xs text-slate-400">{formatDate(row.original.updatedAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      size: 80,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/exams/${row.original.id}`)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <a
            href={`${SITE.frontendUrl}/${row.original.pillar}/${row.original.category}/${row.original.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="View on site"
          >
            <ExternalLink size={14} />
          </a>
          {canDelete && (
            <button
              onClick={() => setDeleteTarget(row.original)}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
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
        {canCreate && (
          <button
            onClick={() => navigate("/exams/new")}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add New Exam
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exams…"
            className="w-full rounded border border-slate-200 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={pillar}
          onChange={(e) => setPillar(e.target.value as Pillar | "")}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Pillars</option>
          {PILLARS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {EXAM_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <DataTable
        data={data}
        columns={columns}
        isLoading={loading}
        emptyMessage="No exams found. Try changing filters or add a new exam."
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Exam"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all associated content posts.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        isLoading={deleting}
      />
    </div>
  );
}
