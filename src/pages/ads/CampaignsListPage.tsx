import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCampaigns, updateCampaignStatus } from "@/services/adService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDate , getErrorMessage } from "@/lib/utils";
import type { AdCampaign } from "@/types/ad";

export function CampaignsListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [rejectTarget, setRejectTarget] = useState<AdCampaign | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, count } = await getCampaigns({ status: statusFilter || undefined });
      setData(rows);
      setTotal(count);
    } catch (err) {
      toast.error("Failed to load campaigns: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason) return;
    try {
      await updateCampaignStatus(rejectTarget.id, "rejected", { rejectionReason: rejectReason });
      toast.success("Campaign rejected.");
    } catch (err) {
      toast.error("Reject failed: " + getErrorMessage(err));
    } finally {
      setRejectTarget(null);
      setRejectReason("");
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ad Campaigns</h1>
          <p className="text-sm text-slate-500">{total} campaigns</p>
        </div>
        <button onClick={() => navigate("/ads/campaigns/new")}
          className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={16} /> New Campaign
        </button>
      </div>

      <div className="flex gap-2">
        {["","pending-review","active","paused","completed","rejected","draft"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {["Campaign","Advertiser","Type","Status","Budget","Spent","Impressions","CTR","Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                ))}</tr>
              ))
            ) : data.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">No campaigns found.</td></tr>
            ) : data.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button onClick={() => navigate(`/ads/campaigns/${c.id}`)} className="font-medium text-blue-600 hover:underline">{c.name}</button>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{c.advertiserName ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500 capitalize">{c.type ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-xs text-slate-600">₹{c.budgetTotal.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-slate-600">₹{c.budgetSpent.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{c.impressions.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{c.ctr.toFixed(2)}%</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {c.status === "pending-review" && (
                      <>
                        <button onClick={async () => { await updateCampaignStatus(c.id, "active"); load(); }}
                          className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
                          Approve
                        </button>
                        <button onClick={() => setRejectTarget(c)}
                          className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100">
                          Reject
                        </button>
                      </>
                    )}
                    <button onClick={() => navigate(`/ads/campaigns/${c.id}`)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reject dialog */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="text-base font-semibold">Reject Campaign</h3>
            <p className="mt-1 text-sm text-slate-600">Provide a reason for rejection:</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
              className="mt-3 w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setRejectTarget(null)} className="rounded border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
