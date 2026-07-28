/**
 * ModulePanelHeader — Shows save status indicator and "Add Custom Module" button.
 */
import React from "react";
import { Plus, Check, Loader2, AlertCircle } from "lucide-react";
import type { SaveStatus } from "@/types/modules";

interface Props {
  aggregateStatus: SaveStatus;
  lastSavedAt: string | null;
  onAddCustomModule?: () => void;
}

export function ModulePanelHeader({ aggregateStatus, lastSavedAt, onAddCustomModule }: Props) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-700">Content Modules</h3>
        <StatusIndicator status={aggregateStatus} lastSavedAt={lastSavedAt} />
      </div>
      {onAddCustomModule && (
        <button
          type="button"
          onClick={onAddCustomModule}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          <Plus size={14} /> Add Custom Module
        </button>
      )}
    </div>
  );
}

function StatusIndicator({ status, lastSavedAt }: { status: SaveStatus; lastSavedAt: string | null }) {
  switch (status) {
    case "saving":
      return (
        <span className="flex items-center gap-1 text-xs text-blue-600">
          <Loader2 size={12} className="animate-spin" /> Saving...
        </span>
      );
    case "saved":
      return (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <Check size={12} /> Saved
          {lastSavedAt && <span className="text-slate-400 ml-1">{new Date(lastSavedAt).toLocaleTimeString()}</span>}
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={12} /> Save failed
        </span>
      );
    default:
      return null;
  }
}
