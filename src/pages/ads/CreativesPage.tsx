import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getCampaigns, getCreatives } from "@/services/adService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AdCampaign, AdCreative } from "@/types/ad";

export function CreativesPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingCreatives, setLoadingCreatives] = useState(false);

  useEffect(() => {
    getCampaigns({ status: "active", limit: 100 })
      .then((r) => {
        setCampaigns(r.data);
        if (r.data.length > 0) setSelectedId(r.data[0].id);
      })
      .catch((err) => toast.error("Failed to load campaigns: " + String(err)))
      .finally(() => setLoadingCampaigns(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingCreatives(true);
    getCreatives(selectedId)
      .then(setCreatives)
      .catch((err) => toast.error("Failed to load creatives: " + String(err)))
      .finally(() => setLoadingCreatives(false));
  }, [selectedId]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Ad Creatives</h1>
        {selectedId && (
          <button onClick={() => navigate(`/ads/campaigns/${selectedId}`)}
            className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <ExternalLink size={14} /> Edit in Campaign
          </button>
        )}
      </div>

      {loadingCampaigns ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No active campaigns. <button onClick={() => navigate("/ads/campaigns/new")} className="text-blue-600 hover:underline">Create a campaign</button> to manage creatives.
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Campaign selector */}
          <div className="w-56 shrink-0">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Active Campaigns</p>
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              {campaigns.map((c) => (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  className={`flex w-full flex-col items-start px-4 py-3 text-sm transition-colors border-b border-slate-100 last:border-0 ${selectedId === c.id ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}>
                  <span className="font-medium truncate w-full">{c.name}</span>
                  <span className="text-xs text-slate-400 truncate w-full">{c.advertiserName}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Creatives list */}
          <div className="flex-1 space-y-3">
            {selectedCampaign && (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <StatusBadge status={selectedCampaign.status} />
                <span className="text-sm font-medium text-slate-900">{selectedCampaign.name}</span>
                <span className="text-sm text-slate-500">· {selectedCampaign.advertiserName}</span>
                <span className="ml-auto text-xs text-slate-400">
                  {selectedCampaign.impressions.toLocaleString()} impressions · {selectedCampaign.clicks.toLocaleString()} clicks
                </span>
              </div>
            )}

            {loadingCreatives ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      {["Name", "Type", "Link", "Active", "Impressions", "Clicks"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {creatives.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                          No creatives for this campaign.{" "}
                          <button onClick={() => navigate(`/ads/campaigns/${selectedId}`)}
                            className="text-blue-600 hover:underline">
                            Add one →
                          </button>
                        </td>
                      </tr>
                    ) : creatives.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 capitalize">{c.type ?? "—"}</td>
                        <td className="px-4 py-3 max-w-48 truncate text-xs text-blue-600">
                          <a href={c.linkUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {c.linkUrl}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block h-2 w-2 rounded-full ${c.isActive ? "bg-green-400" : "bg-slate-300"}`} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{c.impressions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{c.clicks.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
