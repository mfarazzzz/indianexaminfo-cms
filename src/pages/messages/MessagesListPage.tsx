/**
 * MessagesListPage — CMS Messages data grid (S0-5 Part 3).
 *
 * Staff triage screen for reader_messages: filterable DataTable with a
 * row-open detail drawer (notes + who/when history). Read/update is available
 * to handle_messages holders; the CSV export and delete affordances are shown
 * only to manage_settings holders — matching reader_messages.sql, where
 * delete is an RLS policy on manage_settings and "export" is defined as this
 * very download, gated in the UI.
 *
 * NOTE: the grid is the consumer of a table that is created by an UNAPPLIED
 * proposed migration (reader_messages.sql). Until the owner promotes + applies
 * it, opening this page surfaces a load error via toast rather than fake data
 * — by design, numbers and rows only ever come from a real query.
 */
import { useCallback, useEffect, useState } from "react";
import { Search, Download, Eye } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { MessageDetailDrawer } from "./MessageDetailDrawer";
import {
  listReaderMessages, exportReaderMessagesCsv,
  type ReaderMessage, type ListOpts,
} from "@/services/readerMessageService";
import { usePermission } from "@/hooks/usePermission";
import { P } from "@/config/permissions";
import { formatDate, getErrorMessage } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-50 text-blue-700",
  triage: "bg-amber-50 text-amber-700",
  in_progress: "bg-purple-50 text-purple-700",
  resolved: "bg-green-50 text-green-700",
  wont_fix: "bg-slate-100 text-slate-500",
};
const PRIORITY_STYLES: Record<string, string> = {
  low: "text-slate-400",
  normal: "text-slate-600",
  high: "font-semibold text-red-600",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function MessagesListPage() {
  const canExport = usePermission(P.MANAGE_SETTINGS); // export + delete gate
  const [data, setData] = useState<ReaderMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [selected, setSelected] = useState<ReaderMessage | null>(null);

  const buildOpts = useCallback((): ListOpts => {
    const opts: ListOpts = { limit: 50 };
    if (status) opts.status = status;
    if (category) opts.category = category;
    if (source) opts.source = source;
    if (search.trim()) opts.search = search.trim();
    return opts;
  }, [status, category, source, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, count } = await listReaderMessages(buildOpts());
      setData(rows);
      setTotal(count);
    } catch (err) {
      toast.error("Failed to load: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [buildOpts]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleExport = async () => {
    try {
      await exportReaderMessagesCsv(buildOpts());
      toast.success("Export started.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const columns: ColumnDef<ReaderMessage>[] = [
    {
      accessorKey: "refNumber",
      header: "Ref",
      cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.original.refNumber}</span>,
    },
    {
      accessorKey: "message",
      header: "Message",
      cell: ({ row }) => (
        <div className="max-w-[360px]">
          <p className="truncate text-sm text-slate-800">{row.original.message}</p>
          <p className="text-xs text-slate-400">
            {row.original.source === "contact_form" ? "Contact form" : "Report sheet"}
            {" · "}{row.original.category.replace(/_/g, " ")}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "senderName",
      header: "Sender",
      cell: ({ row }) => (
        <div className="max-w-[180px]">
          <p className="truncate text-sm text-slate-700">{row.original.senderName || "—"}</p>
          <p className="truncate text-xs text-slate-400">{row.original.senderEmail || row.original.senderPhone || ""}</p>
        </div>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <span className={`text-xs capitalize ${PRIORITY_STYLES[row.original.priority] ?? ""}`}>
          {row.original.priority}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusPill status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Received",
      cell: ({ row }) => <span className="text-xs text-slate-500">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => setSelected(row.original)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
        >
          <Eye className="h-3.5 w-3.5" /> Open
        </button>
      ),
    },
  ];

  const filterCls =
    "rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Reader Messages</h1>
          <p className="text-sm text-slate-500">{total} message{total === 1 ? "" : "s"} · contact form & report-sheet submissions</p>
        </div>
        {canExport && (
          <button
            onClick={handleExport}
            disabled={loading || data.length === 0}
            className="flex items-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ref, message, sender…"
            className={filterCls + " w-64 pl-8"}
          />
        </div>
        <select className={filterCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["new", "triage", "in_progress", "resolved", "wont_fix"].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select className={filterCls} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {["report_error", "suggest_update", "general_question", "technical_problem", "advertising", "legal_removal"].map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select className={filterCls} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          <option value="contact_form">Contact form</option>
          <option value="report_sheet">Report sheet</option>
        </select>
      </div>

      <DataTable
        data={data}
        columns={columns}
        isLoading={loading}
        emptyMessage={loading ? "Loading…" : "No messages match these filters."}
      />

      {selected && (
        <MessageDetailDrawer
          message={selected}
          onClose={() => setSelected(null)}
          onChanged={load}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
