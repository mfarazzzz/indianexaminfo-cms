/**
 * ContentModuleCard — Collapsible card for a single content module.
 * Shows: drag handle, enable/disable toggle, name, expand/collapse.
 * When expanded + enabled: renders ModuleContentEditor.
 */
import React, { useState } from "react";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { ModuleContentEditor } from "./ModuleContentEditor";
import type { ModuleDefinition, ModuleContentData, SaveStatus } from "@/types/modules";

interface Props {
  module: ModuleDefinition;
  enabled: boolean;
  editionId: string | null;
  content: ModuleContentData | null;
  onToggle: (enabled: boolean) => void;
  onStatusChange?: (slug: string, status: SaveStatus) => void;
}

export function ContentModuleCard({ module, enabled, editionId, content, onToggle, onStatusChange }: Props) {
  const [expanded, setExpanded] = useState(enabled);

  const handleToggle = () => {
    const newEnabled = !enabled;
    onToggle(newEnabled);
    if (newEnabled) setExpanded(true);
    if (!newEnabled) setExpanded(false);
  };

  return (
    <div className={`border rounded-lg transition-colors ${enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50/50"}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="cursor-grab text-slate-300 hover:text-slate-500 touch-none">
          <GripVertical size={16} />
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          onClick={handleToggle}
          className={`relative w-8 h-[18px] rounded-full transition-colors shrink-0 ${enabled ? "bg-blue-600" : "bg-slate-300"}`}
          aria-label={`${enabled ? "Disable" : "Enable"} ${module.name}`}
        >
          <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-[16px]" : "translate-x-[2px]"}`} />
        </button>

        {/* Module name */}
        <button
          type="button"
          onClick={() => enabled && setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
          disabled={!enabled}
        >
          <span className={`text-sm font-medium truncate ${enabled ? "text-slate-700" : "text-slate-400"}`}>{module.name}</span>
          {module.description && <span className="text-xs text-slate-400 truncate hidden sm:inline">{module.description}</span>}
        </button>

        {/* Expand chevron */}
        {enabled && (
          <button type="button" onClick={() => setExpanded(!expanded)} className="p-1 text-slate-400 hover:text-slate-600 shrink-0">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </div>

      {/* Content editor */}
      {enabled && expanded && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <ModuleContentEditor
            editionId={editionId}
            moduleSlug={module.slug}
            fields={module.fields}
            initialContent={content}
            onStatusChange={(s) => onStatusChange?.(module.slug, s)}
          />
        </div>
      )}
    </div>
  );
}
