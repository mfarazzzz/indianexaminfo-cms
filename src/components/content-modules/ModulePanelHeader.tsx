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
}

export function ModulePanelHeader({ aggregateStatus, lastSavedAt, staleCount, allCollapsed, onToggleCollapse }: Props) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-700">Content Modules</h3>
        <StatusIndicator status={aggregateStatus} lastSavedAt={lastSavedAt} />
        {(staleCount ?? 0) > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            {staleCount} stale
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
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
