import { getErrorMessage } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAdZones, updateAdZone } from "@/services/adService";
import type { AdZone } from "@/types/ad";
import { Loader2 } from "lucide-react";

export function ZonesPage() {
  const [zones, setZones] = useState<AdZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getAdZones()
      .then(setZones)
      .catch((err) => toast.error("Failed to load zones: " + getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const toggleZone = async (zone: AdZone) => {
    setSaving(zone.id);
    try {
      await updateAdZone(zone.id, { isActive: !zone.isActive });
      setZones(zones.map((z) => z.id === zone.id ? { ...z, isActive: !z.isActive } : z));
      toast.success(`Zone ${zone.isActive ? "disabled" : "enabled"}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const updateFallback = async (id: string, html: string) => {
    try {
      await updateAdZone(id, { fallbackHtml: html });
      toast.success("Fallback HTML saved.");
    } catch (err) {
      toast.error("Save failed: " + getErrorMessage(err));
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={24} /></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Ad Zones</h1>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {["Zone","Size","Position","Placement","Active","Fallback HTML"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {zones.map((zone) => (
              <tr key={zone.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{zone.name}</p>
                  <p className="text-xs font-mono text-slate-400">{zone.slug}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{zone.size}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{zone.position}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{zone.pagePlacement}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleZone(zone)} disabled={saving === zone.id}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${zone.isActive ? "bg-green-500" : "bg-slate-200"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${zone.isActive ? "translate-x-4.5" : "translate-x-0.5"}`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <input defaultValue={zone.fallbackHtml ?? ""} onBlur={(e) => updateFallback(zone.id, e.target.value)}
                    placeholder="<!-- fallback ad code -->" className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
