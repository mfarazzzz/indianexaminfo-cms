import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getBlogPosts, deleteBlogPost } from "@/services/blogService";
import type { BlogPost } from "@/types/blog";
import { BLOG_SECTIONS, POST_TYPES } from "@/config/site";
import { formatDate } from "@/lib/utils";

export function BlogListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const [status, setStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, count } = await getBlogPosts({
        section: section as never || undefined,
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
  }, [section, status, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBlogPost(deleteTarget.id);
      toast.success("Post deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<BlogPost>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-slate-900 line-clamp-1">{row.original.title}</p>
          <div className="flex gap-2 mt-0.5">
            {row.original.isBreaking && <span className="text-[10px] font-medium bg-red-100 text-red-600 px-1 rounded">BREAKING</span>}
            {row.original.isPinned && <span className="text-[10px] font-medium bg-blue-100 text-blue-600 px-1 rounded">PINNED</span>}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "section",
      header: "Section",
      size: 140,
      cell: ({ row }) => (
        <span className="text-xs text-slate-600 capitalize">{row.original.section.replace(/-/g, " ")}</span>
      ),
    },
    {
      id: "author",
      header: "Author",
      size: 120,
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">{row.original.author?.name ?? "—"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 100,
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
          <button onClick={() => navigate(`/blog/${row.original.id}`)}
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
          <h1 className="text-xl font-semibold text-slate-900">Blog Posts</h1>
          <p className="text-sm text-slate-500">{total} posts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate("/blog/authors")}
            className="rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Manage Authors
          </button>
          <button onClick={() => navigate("/blog/new")}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> New Blog Post
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search posts…"
            className="w-full rounded border border-slate-200 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <select value={section} onChange={(e) => setSection(e.target.value)}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
          <option value="">All Sections</option>
          {BLOG_SECTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
          <option value="">All Statuses</option>
          {["draft","review","published","unpublished"].map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
      </div>

      <DataTable data={data} columns={columns} isLoading={loading} emptyMessage="No blog posts found." />

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Blog Post" description={`Delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete" onConfirm={handleDelete} isLoading={deleting} />
    </div>
  );
}
