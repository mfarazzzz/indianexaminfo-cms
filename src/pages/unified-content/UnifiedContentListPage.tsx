import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  getUnifiedContentList,
  deleteUnifiedContent,
  publishUnifiedContent,
  unpublishUnifiedContent,
  type UnifiedContent,
  type UnifiedContentType,
  type UnifiedContentStatus,
} from "@/services/unifiedContentService";
import { formatDate, getErrorMessage } from "@/lib/utils";

// ── Content type display config ────────────────────────────────────────────

const TYPE_BADGE_COLORS: Record<string, string> = {
  notification: "bg-blue-100 text-blue-700",
  application: "bg-green-100 text-green-700",
  "admit-card": "bg-purple-100 text-purple-700",
  "date-sheet": "bg-indigo-100 text-indigo-700",
  syllabus: "bg-cyan-100 text-cyan-700",
  "answer-key": "bg-teal-100 text-teal-700",
  result: "bg-emerald-100 text-emerald-700",
  cutoff: "bg-orange-100 text-orange-700",
  "previous-papers": "bg-amber-100 text-amber-700",
  "mock-test": "bg-rose-100 text-rose-700",
  "study-material": "bg-pink-100 text-pink-700",
  books: "bg-yellow-100 text-yellow-700",
  article: "bg-slate-100 text-slate-700",
  news: "bg-red-100 text-red-700",
  guide: "bg-violet-100 text-violet-700",
  opinion: "bg-fuchsia-100 text-fuchsia-700",
  blog: "bg-sky-100 text-sky-700",
};

const ALL_CONTENT_TYPES: { value: UnifiedContentType; label: string }[] = [
  { value: "notification", label: "Notification" },
  { value: "application", label: "Application" },
  { value: "admit-card", label: "Admit Card" },
  { value: "date-sheet", label: "Date Sheet" },
  { value: "syllabus", label: "Syllabus" },
  { value: "answer-key", label: "Answer Key" },
  { value: "result", label: "Result" },
  { value: "cutoff", label: "Cutoff" },
  { value: "previous-papers", label: "Previous Papers" },
  { value: "mock-test", label: "Mock Test" },
  { value: "study-material", label: "Study Material" },
  { value: "books", label: "Books" },
  { value: "article", label: "Article" },
  { value: "news", label: "News" },
  { value: "guide", label: "Guide" },
  { value: "opinion", label: "Opinion" },
  { value: "blog", label: "Blog" },
];

type TabFilter = "all" | "articles" | "exam";

export function UnifiedContentListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [data, setData] = useState<UnifiedContent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [contentType, setContentType] = useState<UnifiedContentType | "">("");
  const [status, setStatus] = useState<UnifiedContentStatus | "">(
    (searchParams.get("status") as UnifiedContentStatus) ?? ""
  );
  const [tab, setTab] = useState<TabFilter>("all");
  const [sortBy, setSortBy] = useState<"updated_at" | "published_at" | "views" | "title">("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteTarget, setDeleteTarget] = useState<UnifiedContent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, count } = await getUnifiedContentList({
        contentType: contentType || undefined,
        contentTypeGroup: tab === "all" ? undefined : (tab === "articles" ? "articles" : "exam"),
        status: status || undefined,
        search: search || undefined,
        sortBy,
        sortDir,
      });
      setData(rows);
      setTotal(count);
    } catch (err) {
      toast.error("Failed to load content: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [contentType, tab, status, search, sortBy, sortDir]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUnifiedContent(deleteTarget.id);
      toast.success(`"${deleteTarget.title}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePublish = async (item: UnifiedContent) => {
    try {
      if (item.status === "published") {
        await unpublishUnifiedContent(item.id);
        toast.success("Unpublished.");
      } else {
        await publishUnifiedContent(item.id);
        toast.success("Published!");
      }
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const columns: ColumnDef<UnifiedContent>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 line-clamp-1">{row.original.title}</p>
          {row.original.examEntityName && (
            <p className="text-xs text-slate-400 truncate">{row.original.examEntityName}</p>
          )}
          {row.original.section && !row.original.examEntityName && (
            <p className="text-xs text-slate-400 capitalize">{row.original.section.replace(/-/g, " ")}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "contentType",
      header: "Type",
      size: 130,
      cell: ({ row }) => {
        const ct = row.original.contentType;
        const color = TYPE_BADGE_COLORS[ct] ?? "bg-gray-100 text-gray-600";
        return (
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${color}`}>
            {ct.replace(/-/g, " ")}
          </span>
        );
      },
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
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">{row.original.views.toLocaleString()}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      size: 100,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleTogglePublish(row.original); }}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title={row.original.status === "published" ? "Unpublish" : "Publish"}
          >
            {row.original.status === "published" ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/content/${row.original.id}`); }}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "articles", label: "Articles & News" },
    { key: "exam", label: "Exam Content" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Content</h1>
          <p className="text-sm text-slate-500">{total} posts</p>
        </div>
        <button
          onClick={() => navigate("/content/new")}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> New Content
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setContentType(""); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search content…"
            className="w-full rounded border border-slate-200 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value as UnifiedContentType | "")}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All Types</option>
          {ALL_CONTENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as UnifiedContentStatus | "")}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
        </select>
        <select
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [col, dir] = e.target.value.split(":") as [typeof sortBy, "asc" | "desc"];
            setSortBy(col);
            setSortDir(dir);
          }}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="updated_at:desc">Newest First</option>
          <option value="updated_at:asc">Oldest First</option>
          <option value="published_at:desc">Recently Published</option>
          <option value="views:desc">Most Views</option>
          <option value="title:asc">Title A→Z</option>
          <option value="title:desc">Title Z→A</option>
        </select>
      </div>

      {/* Table */}
      <DataTable
        data={data}
        columns={columns}
        isLoading={loading}
        emptyMessage="No content found."
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Content"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isLoading={deleting}
        confirmVariant="danger"
      />
    </div>
  );
}
