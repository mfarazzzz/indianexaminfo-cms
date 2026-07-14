import { getErrorMessage } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAdReports, getCampaigns } from "@/services/adService";
import type { AdReport, AdCampaign } from "@/types/ad";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function subtractDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export function ReportsPage() {
  const [reports, setReports] = useState<AdReport[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignId, setCampaignId] = useState("");
  const [dateFrom, setDateFrom] = useState(subtractDays(30));
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdReports({ campaignId: campaignId || undefined, dateFrom, dateTo });
      setReports(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCampaigns({ limit: 100 })
      .then((r) => setCampaigns(r.data))
      .catch(() => {/* non-critical — filter will still work */});
    load();
  }, []);

  useEffect(() => { load(); }, [campaignId, dateFrom, dateTo]);

  const totalImpressions = reports.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = reports.reduce((s, r) => s + r.clicks, 0);
  const totalSpend = reports.reduce((s, r) => s + r.spend, 0);
  const avgCtr = reports.length > 0 ? (reports.reduce((s, r) => s + r.ctr, 0) / reports.length).toFixed(2) : "0";

  const exportCSV = () => {
    const header = "Date,Campaign,Impressions,Clicks,CTR,Spend";
    const rows = reports.map((r) =>
      `${r.date},${r.campaignId},${r.impressions},${r.clicks},${r.ctr.toFixed(2)},${r.spend}`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `ad-reports-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = reports.slice(-30).map((r) => ({
    date: r.date.slice(5),
    impressions: r.impressions,
    clicks: r.clicks,
    spend: r.spend,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Ad Reports</h1>
        <button onClick={exportCSV}
          className="rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
          className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none">
          <option value="">All Campaigns</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
          <span className="text-slate-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => { setDateFrom(subtractDays(d)); setDateTo(new Date().toISOString().split("T")[0]); }}
              className="rounded border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Last {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Impressions", value: totalImpressions.toLocaleString() },
          { label: "Total Clicks", value: totalClicks.toLocaleString() },
          { label: "Avg CTR", value: `${avgCtr}%` },
          { label: "Total Spend", value: `₹${totalSpend.toLocaleString()}` },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Impressions & Clicks (last 30 entries)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="impressions" fill="#3B82F6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="clicks" fill="#10B981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {["Date","Impressions","Clicks","CTR","Spend","Zone"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No report data for selected range.</td></tr>
              ) : reports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-700">{r.date}</td>
                  <td className="px-4 py-3 text-xs">{r.impressions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{r.clicks.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{r.ctr.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-xs">₹{r.spend.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.zoneId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
