/**
 * MessagesListPage — CMS Messages data grid (S0-5 Part 3, P3-1 spec).
 *
 * Staff triage screen for reader_messages. Rows, not cards; no decorative
 * icons or emoji. The grid is the consumer of a table created by an UNAPPLIED
 * proposed migration (reader_messages.sql): until the owner promotes + applies
 * it, opening the page surfaces a load error via toast rather than fake data —
 * by design, numbers and rows only ever come from a real query.
 *
 * Spec rules pinned here:
 *  • counts per status above the grid (same filters minus the status filter);
 *  • the full column set (date/time, ref, category, reason, page, message,
 *    name, email, phone, status, assignee, source);
 *  • SERVER-side sort + pagination (50/page) — a client sort would only ever
 *    order the current page;
 *  • per-column filters (status, category, source, date range, assignee) and
 *    one global search (text, email, phone, ref);
 *  • sticky header; resizable and hideable columns remembered per user;
 *  • INLINE status/assignee edits; multi-select BULK status / assign / spam
 *    (each bulk write goes through the single-row service functions so every
 *    change still records its own honest event row);
 *  • Download = the current filtered AND sorted view as .xlsx and .csv,
 *    gated on manage_settings;
 *  • row click → the detail side panel.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { type ColumnDef, type RowSelectionState, type SortingState, type VisibilityState } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { MessageDetailDrawer } from "./MessageDetailDrawer";
import {
  listReaderMessages, statusCounts,
  exportReaderMessagesCsv, exportReaderMessagesXlsx,
  updateStatus, updateAssignee, bulkUpdateStatus, bulkAssign,
  type ReaderMessage, type ListOpts, type MessageSortCol,
} from "@/services/readerMessageService";
import { getUserProfiles } from "@/services/userService";
import { usePermission } from "@/hooks/usePermission";
import { useAuth } from "@/hooks/useAuth";
import { P } from "@/config/permissions";
import {
  MESSAGE_STATUSES, MESSAGE_SOURCES, STATUS_LABELS, SOURCE_LABELS,
  OPEN_STATUSES, type MessageStatus,
} from "@/config/messages";
import { getErrorMessage } from "@/lib/utils";

const PAGE_SIZE = 50;

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-50 text-blue-700",
  in_progress: "bg-purple-50 text-purple-700",
  waiting_on_reader: "bg-amber-50 text-amber-700",
  resolved: "bg-green-50 text-green-700",
  wont_fix: "bg-slate-100 text-slate-500",
  spam: "bg-red-50 text-red-600",
};

const CATEGORIES = [
  "report_error", "suggest_update", "general_question",
  "technical_problem", "advertising", "legal_removal",
];

/** "28 Sep 2026, 14:05" — date AND time, per the spec's date/time column. */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/** Per-user localStorage key for the grid's remembered column layout. */
const storageKey = (uid: string, what: "visibility" | "sizing") =>
  `messages.grid.${what}.${uid}`;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
}

export function MessagesListPage() {
  const canExport = usePermission(P.MANAGE_SETTINGS); // export + delete gate
  const { user } = useAuth();
  const [params] = useSearchParams();
  // The editor/bulletin hooks deep-link here with ?entity_id=&status=open&ref=.
  const initialEntityId = params.get("entity_id") ?? "";
  const initialStatus = params.get("status") ?? "";
  const initialRef = params.get("ref") ?? "";

  const [data, setData] = useState<ReaderMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<MessageStatus, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters (per-column) + one global search.
  const [search, setSearch] = useState(initialRef);
  const [status, setStatus] = useState(
    initialStatus && initialStatus !== "open" ? initialStatus : "",
  );
  const [openOnly, setOpenOnly] = useState(initialStatus === "open");
  const [entityId] = useState(initialEntityId);
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Server-side sort.
  const [sort, setSort] = useState<{ col: MessageSortCol; desc: boolean }>({ col: "createdAt", desc: true });

  // Selection for bulk actions.
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Staff list: assignee filter, inline assignee editor, bulk assign.
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  // Remembered per-user column layout.
  const uid = user?.id ?? "anon";
  const [visibility, setVisibility] = useState<VisibilityState>(() =>
    loadJson(storageKey(uid, "visibility"), {} as VisibilityState));
  const [sizing, setSizing] = useState<Record<string, number>>(() =>
    loadJson(storageKey(uid, "sizing"), {} as Record<string, number>));
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  useEffect(() => {
    localStorage.setItem(storageKey(uid, "visibility"), JSON.stringify(visibility));
  }, [uid, visibility]);
  useEffect(() => {
    localStorage.setItem(storageKey(uid, "sizing"), JSON.stringify(sizing));
  }, [uid, sizing]);

  const [selected, setSelected] = useState<ReaderMessage | null>(null);

  useEffect(() => {
    getUserProfiles()
      .then((rows) => setUsers(rows.map((r) => ({ id: r.id, name: r.name || r.email }))))
      .catch(() => { /* non-critical: the assignee lists stay empty */ });
  }, []);

  const buildOpts = useCallback((): ListOpts => {
    const opts: ListOpts = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
    if (openOnly) opts.statuses = [...OPEN_STATUSES];
    else if (status) opts.status = status;
    if (entityId) opts.entityId = entityId;
    if (category) opts.category = category;
    if (source) opts.source = source;
    if (assignee) opts.assignee = assignee;
    if (dateFrom) opts.dateFrom = `${dateFrom}T00:00:00.000Z`;
    if (dateTo) opts.dateTo = dateTo;
    if (search.trim()) opts.search = search.trim();
    opts.sortCol = sort.col;
    opts.sortDir = sort.desc ? "desc" : "asc";
    return opts;
  }, [page, status, openOnly, entityId, category, source, assignee, dateFrom, dateTo, search, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const opts = buildOpts();
      // Counts use the same filters WITHOUT the status dimension, so the strip
      // shows what each status would hold if clicked.
      const { status: _s, statuses: _ss, ...countOpts } = opts;
      const [list, countMap] = await Promise.all([
        listReaderMessages(opts),
        statusCounts(countOpts),
      ]);
      setData(list.data);
      setTotal(list.count);
      setCounts(countMap);
      setRowSelection({}); // selection is per loaded page
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

  // Reset to the first page whenever a filter changes (page is in buildOpts).
  const filterSignature = `${status}|${openOnly}|${entityId}|${category}|${source}|${assignee}|${dateFrom}|${dateTo}|${search}`;
  const lastFilter = useRefString(filterSignature);
  useEffect(() => {
    if (lastFilter.current !== null && lastFilter.current !== filterSignature) setPage(0);
    lastFilter.current = filterSignature;
  }, [filterSignature, lastFilter]);

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((k) => rowSelection[k]),
    [rowSelection],
  );

  // ── Inline + bulk edits ─────────────────────────────────────────────────────

  const inlineStatus = async (row: ReaderMessage, next: MessageStatus) => {
    setData((d) => d.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    try {
      await updateStatus(row.id, next);
      reloadCounts();
    } catch (err) {
      toast.error(getErrorMessage(err));
      load();
    }
  };

  const inlineAssignee = async (row: ReaderMessage, next: string) => {
    const name = next ? (users.find((u) => u.id === next)?.name ?? null) : null;
    setData((d) => d.map((r) => (r.id === row.id
      ? { ...r, assignee: next || null, assigneeName: name } : r)));
    try {
      await updateAssignee(row.id, next || null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      load();
    }
  };

  const bulkStatus = async (next: MessageStatus) => {
    const ids = selectedIds;
    if (ids.length === 0) return;
    const { done, failed } = await bulkUpdateStatus(ids, next);
    if (failed) toast.error(`${done} updated, ${failed} failed.`);
    else toast.success(`${done} marked ${STATUS_LABELS[next]}.`);
    load();
  };

  const bulkAssignTo = async (userId: string | null) => {
    const ids = selectedIds;
    if (ids.length === 0) return;
    const { done, failed } = await bulkAssign(ids, userId);
    if (failed) toast.error(`${done} assigned, ${failed} failed.`);
    else toast.success(`${done} assigned.`);
    load();
  };

  const reloadCounts = async () => {
    try {
      const { status: _s, statuses: _ss, ...countOpts } = buildOpts();
      setCounts(await statusCounts(countOpts));
    } catch { /* counts are secondary; a failed refresh stays silent */ }
  };

  // ── Downloads: the CURRENT filtered + sorted view, both formats ────────────

  const handleExport = async (kind: "csv" | "xlsx") => {
    try {
      const opts = buildOpts();
      delete opts.limit; delete opts.offset; // export is the whole view, not one page
      if (kind === "csv") await exportReaderMessagesCsv(opts);
      else await exportReaderMessagesXlsx(opts);
      toast.success(kind === "csv" ? "CSV download started." : "XLSX download started.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // ── Columns (spec order; all hideable + resizable, remembered per user) ────

  const columns: ColumnDef<ReaderMessage>[] = useMemo(() => {
    const selectCls = "w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs";
    return [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all on page"
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label="Select row"
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(e.target.checked)}
          />
        ),
        size: 32,
        enableSorting: false,
        enableResizing: false,
      },
      {
        accessorKey: "createdAt",
        header: "Date / time",
        size: 150,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(row.original.createdAt)}</span>
        ),
      },
      {
        accessorKey: "refNumber",
        header: "Ref",
        size: 110,
        cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.original.refNumber}</span>,
      },
      {
        accessorKey: "category",
        header: "Category",
        size: 130,
        cell: ({ row }) => <span className="text-xs capitalize">{row.original.category.replace(/_/g, " ")}</span>,
      },
      {
        accessorKey: "reason",
        header: "Reason",
        size: 130,
        cell: ({ row }) => (
          <span className="text-xs capitalize text-slate-600">
            {row.original.reason ? row.original.reason.replace(/_/g, " ") : "—"}
          </span>
        ),
      },
      {
        accessorKey: "pageTitle",
        header: "Page",
        size: 190,
        enableSorting: false, // page_title is not a sort column on the server
        cell: ({ row }) => {
          const { pageTitle, pageUrl } = row.original;
          if (!pageUrl) return <span className="text-xs text-slate-400">—</span>;
          return (
            <a
              href={pageUrl} target="_blank" rel="noopener noreferrer"
              className="block truncate text-xs text-blue-600 hover:underline"
              title={pageUrl}
            >
              {pageTitle || pageUrl}
            </a>
          );
        },
      },
      {
        accessorKey: "message",
        header: "Message",
        size: 280,
        enableSorting: false, // sorting a free-text body is meaningless
        cell: ({ row }) => (
          <p className="max-w-[280px] truncate text-sm text-slate-800" title={row.original.message}>
            {row.original.message}
          </p>
        ),
      },
      {
        accessorKey: "senderName",
        header: "Name",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => <span className="truncate text-sm">{row.original.senderName || "—"}</span>,
      },
      {
        accessorKey: "senderEmail",
        header: "Email",
        size: 180,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate text-xs text-slate-500">{row.original.senderEmail || "—"}</span>
        ),
      },
      {
        accessorKey: "senderPhone",
        header: "Phone",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => <span className="whitespace-nowrap text-xs text-slate-500">{row.original.senderPhone || "—"}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 150,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <span className={`hidden xl:inline-block h-2 w-2 rounded-full ${STATUS_STYLES[row.original.status] ?? "bg-slate-300"}`} aria-hidden />
            <select
              className={selectCls}
              value={row.original.status}
              aria-label={`Status for ${row.original.refNumber}`}
              onChange={(e) => inlineStatus(row.original, e.target.value as MessageStatus)}
              onClick={(e) => e.stopPropagation()}
            >
              {MESSAGE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        ),
      },
      {
        accessorKey: "assignee",
        header: "Assignee",
        size: 150,
        cell: ({ row }) => (
          <select
            className={selectCls}
            value={row.original.assignee ?? ""}
            aria-label={`Assignee for ${row.original.refNumber}`}
            onChange={(e) => inlineAssignee(row.original, e.target.value)}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        size: 120,
        cell: ({ row }) => (
          <span className="text-xs text-slate-600">
            {SOURCE_LABELS[row.original.source as keyof typeof SOURCE_LABELS] ?? row.original.source}
          </span>
        ),
      },
    ];
  }, [users]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sorting state shaped for TanStack (manual: the server does the ordering).
  const sorting: SortingState = useMemo(
    () => [{ id: sort.col, desc: sort.desc }],
    [sort],
  );
  const onSortingChange = useCallback((next: SortingState) => {
    if (next.length === 0) return; // the grid always has exactly one sort
    const last = next[next.length - 1];
    setSort({ col: last.id as MessageSortCol, desc: !!last.desc });
  }, []);

  const filterCls =
    "rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Reader Messages</h1>
          <p className="text-sm text-slate-500">{total} message{total === 1 ? "" : "s"} matching filters</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Column show/hide — remembered per user */}
          <div className="relative">
            <button
              onClick={() => setColumnsMenuOpen((o) => !o)}
              className={filterCls}
              aria-expanded={columnsMenuOpen}
            >
              Columns
            </button>
            {columnsMenuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-48 rounded border border-slate-200 bg-white p-2 shadow-lg">
                {columns.filter((c) => c.id !== "select").map((c) => {
                  const id = String(c.id ?? (c as any).accessorKey);
                  const label = typeof c.header === "string" ? c.header : id;
                  return (
                    <label key={id} className="flex items-center gap-2 px-1 py-0.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={visibility[id] !== false}
                        onChange={(e) => setVisibility((v) => ({ ...v, [id]: e.target.checked }))}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          {canExport && (
            <>
              <button
                onClick={() => handleExport("xlsx")}
                disabled={loading || data.length === 0}
                className={filterCls + " font-medium"}
              >
                Download XLSX
              </button>
              <button
                onClick={() => handleExport("csv")}
                disabled={loading || data.length === 0}
                className={filterCls + " font-medium"}
              >
                Download CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Counts per status above the grid — click to filter */}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Counts per status">
        {MESSAGE_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => {
              if (!openOnly && status === s) { setStatus(""); }
              else { setOpenOnly(false); setStatus(s); }
            }}
            className={`rounded border px-2.5 py-1 text-xs font-medium ${
              !openOnly && status === s
                ? "border-blue-300 bg-blue-50 text-blue-800"
                : STATUS_STYLES[s] ?? "bg-slate-100 text-slate-600"
            } border-opacity-100`}
          >
            {STATUS_LABELS[s]}: {counts ? counts[s] : "…"}
          </button>
        ))}
        <button
          onClick={() => { setOpenOnly((o) => !o); setStatus(""); }}
          className={`rounded border px-2.5 py-1 text-xs font-medium ${
            openOnly ? "border-blue-300 bg-blue-50 text-blue-800" : "bg-slate-50 text-slate-600"
          }`}
        >
          Open: {counts ? OPEN_STATUSES.reduce((n, s) => n + counts[s], 0) : "…"}
        </button>
      </div>

      {/* Filters: global search + per-column filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search message, email, phone, ref…"
          className={filterCls + " w-72"}
          aria-label="Global search"
        />
        <select className={filterCls} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select className={filterCls} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source">
          <option value="">All sources</option>
          {MESSAGE_SOURCES.map((s) => (
            <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
          ))}
        </select>
        <select className={filterCls} value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Filter by assignee">
          <option value="">All assignees</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          From
          <input type="date" className={filterCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          To
          <input type="date" className={filterCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        {entityId && (
          <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
            Filtered to one page's reports
          </span>
        )}
      </div>

      {/* Bulk actions — only when rows are selected */}
      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-sm text-slate-600">{selectedIds.length} selected</span>
          <select
            className={filterCls}
            defaultValue=""
            aria-label="Bulk set status"
            onChange={(e) => { if (e.target.value) { bulkStatus(e.target.value as MessageStatus); e.target.value = ""; } }}
          >
            <option value="">Set status…</option>
            {MESSAGE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select
            className={filterCls}
            defaultValue=""
            aria-label="Bulk assign"
            onChange={(e) => { const v = e.target.value; if (v !== "") { bulkAssignTo(v === "__unassign__" ? null : v); e.target.value = ""; } }}
          >
            <option value="">Choose assignee…</option>
            <option value="__unassign__">Unassign</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button
            onClick={() => bulkStatus("spam")}
            className="rounded bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Mark spam
          </button>
        </div>
      )}

      <DataTable
        data={data}
        columns={columns}
        isLoading={loading}
        emptyMessage="No messages match these filters."
        getRowId={(row) => row.id}
        onRowClick={setSelected}
        stickyHeader
        sorting={sorting}
        onSortingChange={onSortingChange}
        enableResizing
        columnSizing={sizing}
        onColumnSizingChange={setSizing}
        columnVisibility={visibility}
        onColumnVisibilityChange={setVisibility}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      />

      {/* Server-side pagination — 50 per page */}
      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page + 1} of {pages}
          {total > 0 && ` · showing ${page * PAGE_SIZE + 1}–${Math.min(total, (page + 1) * PAGE_SIZE)} of ${total}`}
        </span>
        <span className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className={filterCls + " disabled:opacity-40"}
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1 || loading}
            className={filterCls + " disabled:opacity-40"}
          >
            Next
          </button>
        </span>
      </div>

      {selected && (
        <MessageDetailDrawer
          message={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { load(); }}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}

/** A ref that remembers the previous string (filter-change → reset page). */
function useRefString(initial: string) {
  const ref = useState(() => ({ current: initial }))[0];
  return ref;
}
