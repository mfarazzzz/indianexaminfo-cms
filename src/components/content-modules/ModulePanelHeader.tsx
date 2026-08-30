/**
 * ModulePanelHeader — Save status, stale count, collapse all toggle.
 */
import React from "react";
import { Check, Loader2, AlertCircle, ChevronsUpDown } from "lucide-react";
import type { SaveStatus } from "@/types/modules";

interface Props {
  aggregateStatus: SaveStatus;
  lastSavedAt: string | null;
  staleCount?: number;
  allCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onAddCustomModule?: () => void;
  onEnableAll?: () => void;
  onDisableAll?: () => void;
  /** When false, this exam's facts are AI-seeded / not human-checked. Warn the editor. */
  isVerified?: boolean;
}

export function ModulePanelHeader({ aggregateStatus, lastSavedAt, staleCount, allCollapsed, onToggleCollapse, onEnableAll, onDisableAll, isVerified }: Props) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-700">Content Modules</h3>
        <StatusIndicator status={aggregateStatus} lastSavedAt={lastSavedAt} />
        {isVerified === false && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium"
            title="This exam's content has not been human-verified. Facts (dates, eligibility, fee) may be AI-seeded and wrong. Verify against the official notification before relying on it."
          >
            Unverified
          </span>
        )}
        {(staleCount ?? 0) > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            {staleCount} stale
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onEnableAll && (
          <button type="button" onClick={onEnableAll}
            className="text-[11px] text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50">
            Enable All
          </button>
        )}
        {onDisableAll && (
          <button type="button" onClick={onDisableAll}
            className="text-[11px] text-slate-500 hover:text-slate-700 font-medium px-2 py-1 rounded hover:bg-slate-50">
            Disable All
          </button>
        )}
        {onToggleCollapse && (
          <button type="button" onClick={onToggleCollapse}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-50">
            <ChevronsUpDown size={13} />
            {allCollapsed ? "Expand All" : "Collapse All"}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({ status, lastSavedAt }: { status: SaveStatus; lastSavedAt: string | null }) {
  switch (status) {
    case "saving":
      return <span className="flex items-center gap-1 text-xs text-blue-600"><Loader2 size={12} className="animate-spin" /> Saving...</span>;
    case "saved":
      return <span className="flex items-center gap-1 text-xs text-green-600"><Check size={12} /> Saved</span>;
    case "error":
      return <span className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} /> Save failed</span>;
    default:
      return null;
  }
}
