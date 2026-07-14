import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { getAuditLogs } from "@/services/auditService";
import { formatDate , getErrorMessage } from "@/lib/utils";
import type { AuditLog } from "@/types/audit";

const ACTION_COLORS: Record<string, string> = {
  created:   "bg-green-50 text-green-700",
  updated:   "bg-blue-50 text-blue-700",
  deleted:   "bg-red-50 text-red-700",
  published: "bg-purple-50 text-purple-700",
};

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filters, setFilters] = useState({ entityType: "", action: "", dateFrom: "", dateTo: "" });
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count } = await getAuditLogs({ ...filters, limit, offset });
      setLogs(data);
      setTotal(count);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    const header = "Timestamp,User,Role,Action,Entity Type,Entity Name";
    const rows = logs.map((l) =>
      `"${l.createdAt}","${l.userName}","${l.userRole}","${l.action}","${l.entityType ?? ""}","${l.entityName ?? ""}"`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500">{total} entries — append-only</p>
        </div>
        <button onClick={exportCSV}
          className="rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <select value={filters.entityType} onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
          <option value="">All Entities</option>
          {["exam","content_post","blog_post","category","menu","settings","ad_campaign"].map((e) => (
            <option key={e} value={e}>{e.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
          <option value="">All Actions</option>
          {["created","updated","deleted","published","approved","rejected"].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
        <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
        <button onClick={() => setFilters({ entityType: "", action: "", dateFrom: "", dateTo: "" })}
          className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Timestamp</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Entity</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Name</th>
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">No audit entries found.</td></tr>
            ) : logs.map((log) => (
              <React.Fragment key={log.id}>
                <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{log.userName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 capitalize">{log.userRole}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-600"}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{log.entityType ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{log.entityName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {expanded === log.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </td>
                </tr>
                {expanded === log.id && (
                  <tr>
                    <td colSpan={7} className="bg-slate-50 px-4 py-3">
                      <pre className="text-xs text-slate-600 overflow-auto max-h-40 rounded bg-white border border-slate-200 p-3">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}
              className="rounded border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">
              ← Previous
            </button>
            <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}
              className="rounded border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
