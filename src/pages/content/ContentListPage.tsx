import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getContentPosts, deleteContentPost, type ContentPost } from "@/services/contentService";
import { CONTENT_TYPES } from "@/config/site";
import { usePillars } from "@/hooks/usePillars";
import { formatDate } from "@/lib/utils";
import type { ContentType } from "@/types/exam";

export function ContentListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ContentPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pillar, setPillar] = useState<string>("");
  const [contentType, setContentType] = useState<ContentType | "">("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [deleteTarget, setDeleteTarget] = useState<ContentPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { data: pillars = [] } = usePillars();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, count } = await getContentPosts({
        pillar: pillar || undefined,
        contentType: contentType || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      setData(rows);
      setTotal(count);
    } catch (err) {
      toast.error("Failed to load: " + String(err));
    } finally {
      setLoading(false);
    }
  }, [pillar, contentType, status, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteContentPost(deleteTarget.id);
      toast.success("Post deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<ContentPost>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-slate-900 line-clamp-1">{row.original.title}</p>
          <p className="text-xs text-slate-400">{row.original.examEntityName}</p>
        </div>
      ),
    },
    {
      accessorKey: "contentType",
      header: "Type",
      size: 110,
      cell: ({ row }) => (
        <span className="text-xs font-medium text-slate-600 capitalize">
          {row.original.contentType.replace(/-/g, " ")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 110,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "publishedAt",
      header: "Published",
      size: 100,
      cell: ({ row }) => (
        <span className="text-xs text-slate-400">
          {row.original.publishedAt ? formatDate(row.original.publishedAt) : "—"}
        </span>
      ),
    },
    {
      accessorKey: "views",
      header: "Views",
      size: 70,
      cell: ({ row }) => <span className="text-xs text-slate-500">{row.original.views.toLocaleString()}</span>,
    },
    {
      id: "actions",
      header: "",
      size: 70,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => navigate(`/content/${row.original.id}`)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Pencil size={14} />
          </button>
          <button onClick={() => setDeleteTarget(row.original)}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Content Posts</h1>
          <p className="text-sm text-slate-500">{total} posts</p>
        </div>
        <button onClick={() => navigate("/content/new")}
          className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={16} /> New Content Post
        </button>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search posts…"
            className="w-full rounded border border-slate-200 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <select value={contentType} onChange={(e) => setContentType(e.target.value as ContentType | "")}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
          <option value="">All Types</option>
          {CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={pillar} onChange={(e) => setPillar(e.target.value)}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
          <option value="">All Pillars</option>
          {pillars.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
          <option value="">All Statuses</option>
          {["draft","review","published","unpublished"].map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
      </div>

      <DataTable data={data} columns={columns} isLoading={loading} emptyMessage="No content posts found." />

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Post" description={`Delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete" onConfirm={handleDelete} isLoading={deleting} />
    </div>
  );
}
