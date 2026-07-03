import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart2, TrendingUp, DollarSign, CheckCircle, Loader2 } from "lucide-react";
import { getCampaigns, updateCampaignStatus, getAdZones } from "@/services/adService";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import type { AdCampaign } from "@/types/ad";

export function AdDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [pending, setPending] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCampaigns({ limit: 100 }),
      getCampaigns({ status: "pending-review", limit: 50 }),
    ]).then(([all, pend]) => {
      setCampaigns(all.data);
      setPending(pend.data);
    }).catch((err) => toast.error("Failed to load campaigns: " + String(err)))
      .finally(() => setLoading(false));
  }, []);

  const active = campaigns.filter((c) => c.status === "active");
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const totalRevenue = campaigns.reduce((sum, c) => sum + c.budgetSpent, 0);

  const stats = [
    { label: "Active Campaigns", value: active.length, icon: <BarChart2 size={18} className="text-blue-600" />, href: "/ads/campaigns?status=active" },
    { label: "Impressions (total)", value: totalImpressions.toLocaleString(), icon: <TrendingUp size={18} className="text-indigo-600" />, href: "/ads/reports" },
    { label: "Revenue (total)", value: `₹${totalRevenue.toLocaleString()}`, icon: <DollarSign size={18} className="text-green-600" />, href: "/ads/reports" },
    { label: "Pending Approval", value: pending.length, icon: <CheckCircle size={18} className="text-yellow-600" />, href: "/ads/campaigns?status=pending-review", highlight: pending.length > 0 },
  ];

  const approve = async (id: string) => {
    try {
      await updateCampaignStatus(id, "active", { approvedBy: user?.id });
      setPending((prev) => prev.filter((c) => c.id !== id));
      toast.success("Campaign approved.");
    } catch (err) {
      toast.error("Approve failed: " + String(err));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Ad Dashboard</h1>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((card) => (
              <button key={card.label} onClick={() => navigate(card.href)}
                className={`rounded-lg border bg-white p-4 text-left shadow-sm hover:shadow-md transition-shadow ${card.highlight ? "border-yellow-300 ring-1 ring-yellow-300" : "border-slate-200"}`}>
                <div className="rounded bg-slate-50 p-1.5 w-fit">{card.icon}</div>
                <p className="mt-3 text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="text-xs text-slate-500">{card.label}</p>
              </button>
            ))}
          </div>

          {/* Pending approval */}
          {pending.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <h2 className="mb-3 text-sm font-semibold text-yellow-900">
                Campaigns Pending Approval ({pending.length})
              </h2>
              <div className="space-y-2">
                {pending.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded bg-white border border-yellow-100 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.advertiserName} · Budget: ₹{c.budgetTotal.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/ads/campaigns/${c.id}`)}
                        className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                        Review
                      </button>
                      <button onClick={() => approve(c.id)}
                        className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick nav */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Campaigns", href: "/ads/campaigns" },
              { label: "Ad Creatives", href: "/ads/creatives" },
              { label: "Ad Zones", href: "/ads/zones" },
              { label: "Reports", href: "/ads/reports" },
            ].map((item) => (
              <button key={item.href} onClick={() => navigate(item.href)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                {item.label} →
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
