/**
 * NavigationSettingsPage — CMS admin page for mega navigation configuration.
 * Allows: reorder categories, set badges, toggle visibility, set max items.
 */
import React, { useCallback, useEffect, useState } from "react";
import { GripVertical, Eye, EyeOff, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getAllNavConfig, updateNavConfig, reorderNavConfig, type NavConfigItem } from "@/services/navigationConfigService";
import { getErrorMessage } from "@/lib/utils";

const PILLAR_LABELS: Record<string, string> = {
  "entrance-exam": "Entrance Exams",
  "sarkari-naukri": "Government Jobs",
  "board-university": "Board & University",
};

const BADGE_OPTIONS = [
  { value: "", label: "None" },
  { value: "popular", label: "🔥 Popular" },
  { value: "new", label: "🆕 New" },
  { value: "updated", label: "🔄 Updated" },
];

export function NavigationSettingsPage() {
  const [items, setItems] = useState<NavConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllNavConfig()
      .then(setItems)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleVisibility = async (item: NavConfigItem) => {
    const newVal = !item.isVisible;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isVisible: newVal } : i));
    await updateNavConfig(item.id, { isVisible: newVal }).catch((err) => toast.error(getErrorMessage(err)));
  };

  const handleBadgeChange = async (item: NavConfigItem, badge: string) => {
    const val = badge || null;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, badge: val } : i));
    await updateNavConfig(item.id, { badge: val }).catch((err) => toast.error(getErrorMessage(err)));
  };

  const handleMaxItemsChange = async (item: NavConfigItem, maxItems: number) => {
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, maxItems } : i));
    await updateNavConfig(item.id, { maxItems }).catch((err) => toast.error(getErrorMessage(err)));
  };

  const handleMoveUp = (pillar: string, index: number) => {
    const pillarItems = items.filter((i) => i.pillar === pillar);
    if (index === 0) return;
    const newOrder = [...pillarItems];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    const updatedItems = items.map((i) => {
      const newIdx = newOrder.findIndex((n) => n.id === i.id);
      return newIdx >= 0 ? { ...i, displayOrder: newIdx + 1 } : i;
    });
    setItems(updatedItems);
    reorderNavConfig(newOrder.map((i) => i.id)).catch(() => {});
  };

  const handleMoveDown = (pillar: string, index: number) => {
    const pillarItems = items.filter((i) => i.pillar === pillar);
    if (index === pillarItems.length - 1) return;
    const newOrder = [...pillarItems];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    const updatedItems = items.map((i) => {
      const newIdx = newOrder.findIndex((n) => n.id === i.id);
      return newIdx >= 0 ? { ...i, displayOrder: newIdx + 1 } : i;
    });
    setItems(updatedItems);
    reorderNavConfig(newOrder.map((i) => i.id)).catch(() => {});
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>;

  const pillars = [...new Set(items.map((i) => i.pillar))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Navigation Settings</h1>
          <p className="text-sm text-slate-500">Control how categories appear in the mega menu. Changes reflect on the frontend after cache refresh (≤60 min).</p>
        </div>
      </div>

      {pillars.map((pillar) => {
        const pillarItems = items.filter((i) => i.pillar === pillar).sort((a, b) => a.displayOrder - b.displayOrder);

        return (
          <div key={pillar} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-700">{PILLAR_LABELS[pillar] ?? pillar}</h2>
            </div>

            <div className="divide-y divide-slate-100">
              {pillarItems.map((item, idx) => (
                <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${!item.isVisible ? "opacity-50 bg-slate-50/50" : ""}`}>
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => handleMoveUp(pillar, idx)} disabled={idx === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 text-xs">▲</button>
                    <button onClick={() => handleMoveDown(pillar, idx)} disabled={idx === pillarItems.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 text-xs">▼</button>
                  </div>

                  {/* Priority */}
                  <span className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-400">{idx + 1}</span>

                  {/* Name */}
                  <span className="flex-1 text-sm font-medium text-slate-700 min-w-0 truncate">{item.categoryName}</span>

                  {/* Badge */}
                  <select value={item.badge ?? ""} onChange={(e) => handleBadgeChange(item, e.target.value)}
                    className="text-[11px] border border-slate-200 rounded px-1.5 py-1 text-slate-600 bg-white w-24">
                    {BADGE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>

                  {/* Max items */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Max:</span>
                    <input type="number" min={5} max={30} value={item.maxItems}
                      onChange={(e) => handleMaxItemsChange(item, parseInt(e.target.value) || 15)}
                      className="w-10 text-[11px] border border-slate-200 rounded px-1 py-0.5 text-center" />
                  </div>

                  {/* Visibility */}
                  <button onClick={() => handleToggleVisibility(item)} title={item.isVisible ? "Hide" : "Show"}
                    className={`p-1.5 rounded ${item.isVisible ? "text-green-600 hover:bg-green-50" : "text-slate-400 hover:bg-slate-100"}`}>
                    {item.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
