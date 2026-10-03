/**
 * ContentModuleCard — Collapsible module card.
 * Shows: enable toggle, honest Live/Hidden badge, AI Fill, full content editor.
 *
 * R0.2 (2026-10-04): the Auto/Hybrid/Manual mode dropdown was REMOVED with owner
 * approval. The mode was a session-only editor-view override (never persisted —
 * _config.modes has no reader anywhere, frontend included) that switched the card
 * between a read-only preview, a preview+notes, and the full editor. Every module
 * now gets the full editor directly, which is the honest surface: what you edit
 * here is exactly what is stored. The per-module enable toggle stays — enabledModules
 * IS read by the frontend.
 */
import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, GripVertical, Sparkles, Loader2 } from "lucide-react";
import { ModuleContentEditor } from "./ModuleContentEditor";
import type { ModuleDefinition, ModuleContentData, SaveStatus } from "@/types/modules";
import type { DragHandleProps } from "@/components/shared/DraggableList";

interface Props {
  module: ModuleDefinition;
  enabled: boolean;
  editionId: string | null;
  content: ModuleContentData | null;
  onToggle: (enabled: boolean) => void;
  onAIFill: (slug: string) => void;
  onStatusChange?: (slug: string, status: SaveStatus) => void;
  /** Reports this module's unsaved (debouncing/in-flight) state up to the panel
   *  so the unsaved-changes guard treats a pending autosave as dirty. */
  onPendingChange?: (slug: string, pending: boolean) => void;
  aiLoading?: boolean;
  /** Controlled collapse state from parent (Collapse All / Expand All) */
  forceCollapsed?: boolean;
  /**
   * Whether this section has renderable content by the shared frontend rule
   * (sectionRegistry.hasData). When false, the section is HIDDEN on the live
   * site regardless of the enable toggle — presence of data is the only switch.
   * Undefined = not evaluated (e.g. slug has no registry mapping); no badge.
   */
  hasLiveContent?: boolean;
  /**
   * Set for COLUMN-BACKED modules (eligibility, important-dates, selection-process,
   * vacancy-details, faqs, syllabus, academic-info). Their content lives in a typed
   * column, not content_modules — so the on/off toggle is a no-op and an
   * "Off — has content" badge would be false. When set, this card renders a
   * read-only source row (no toggle, no Off badge) that deep-links to
   * the tab where the content is actually edited.
   */
  columnBacked?: { sourceTab: string; tabId: string; live?: boolean };
  /** Deep-link handler to another editor tab (used by the column-backed source row). */
  onNavigateTab?: (tabId: string) => void;
  /**
   * Real drag handle (Group B / reorderable modules only). When absent, NO grip
   * is shown — the old decorative always-on grip was a lie for non-reorderable
   * rows. Present handle => this row genuinely reorders _config.moduleOrder.
   */
  dragHandleProps?: DragHandleProps;
  isDragging?: boolean;
}

export function ContentModuleCard({
  module, enabled, editionId, content,
  onToggle, onAIFill, onStatusChange, onPendingChange, aiLoading, forceCollapsed,
  hasLiveContent, columnBacked, onNavigateTab, dragHandleProps, isDragging,
}: Props) {
  // ── Column-backed module: read-only source row ─────────────────────────────
  // No toggle (it's a no-op), no "Off — has content" (false here). Just
  // the name, an honest Live/Hidden signal from the column, and a deep link to the
  // tab that actually edits this content.
  if (columnBacked) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
        <span className="text-sm text-slate-600 flex-1 min-w-0 truncate">{module.name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 font-medium shrink-0"
          title="This section's content comes from a field in another tab, not from this module list. Edit it where the link below points.">
          from {columnBacked.sourceTab.replace(/ tab$/i, "")}
        </span>
        {columnBacked.live === true && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium shrink-0" title="This section has content and is visible on the live site">Live</span>
        )}
        {columnBacked.live === false && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium shrink-0" title="Hidden on the live site — no content in the source field yet.">Hidden — no content yet</span>
        )}
        <button type="button" onClick={() => onNavigateTab?.(columnBacked.tabId)}
          className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline shrink-0">
          Edit in {columnBacked.sourceTab} →
        </button>
      </div>
    );
  }

  // Item 4: collapsed by default — the tab was an enormous scroll with every
  // module expanded. Name + badges + toggle stay visible; content only on expand.
  const [expanded, setExpanded] = useState(false);

  // Respond to Collapse All / Expand All from parent
  useEffect(() => {
    if (forceCollapsed !== undefined) {
      setExpanded(!forceCollapsed);
    }
  }, [forceCollapsed]);

  // Collapse when disabled (e.g. the editor turns a module off)
  useEffect(() => {
    if (!enabled) setExpanded(false);
  }, [enabled]);

  const isPassThrough = ["important-dates", "news"].includes(module.slug);
  const isFaqAuto = module.slug === "faqs";

  const handleToggle = () => {
    const newEnabled = !enabled;
    onToggle(newEnabled);
    if (newEnabled) setExpanded(true);
    if (!newEnabled) setExpanded(false);
  };

  return (
    <div className={`border rounded-lg transition-colors ${enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50/50"} ${isDragging ? "opacity-60 shadow-lg" : ""}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Real drag handle — ONLY for reorderable (Group B) rows. No handle = not reorderable. */}
        {dragHandleProps ? (
          <button type="button" aria-label={`Drag to reorder ${module.name}`}
            className="cursor-grab text-slate-300 hover:text-slate-500 touch-none shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            {...dragHandleProps.attributes} {...dragHandleProps.listeners}>
            <GripVertical size={16} />
          </button>
        ) : (
          <span className="w-1 shrink-0" aria-hidden />
        )}

        {/* Toggle switch */}
        <button type="button" onClick={handleToggle}
          className={`relative w-8 h-[18px] rounded-full transition-colors shrink-0 ${enabled ? "bg-blue-600" : "bg-slate-300"}`}
          aria-label={`${enabled ? "Disable" : "Enable"} ${module.name}`}>
          <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-[16px]" : "translate-x-[2px]"}`} />
        </button>

        {/* Module name. Item 1: ml-1 gap so the toggle never
            clips the first character of the name (")verview", ":ligibility"…). */}
        <button type="button" onClick={() => enabled && setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 text-left min-w-0 ml-1" disabled={!enabled}>
          <span className={`text-sm font-medium truncate ${enabled ? "text-slate-700" : "text-slate-400"}`}>{module.name}</span>
          {/* Three-state badge:
              Off (no content)  = disabled, nothing to show anyway.
              Off (has content) = disabled, but content exists — turning it on
                                  would immediately make it Live. Amber to signal
                                  this is hiding something.
              Live              = enabled + has content — visible on site.
              Hidden            = enabled + no content — fill it to publish.
              When hasLiveContent is undefined (no registry mapping), Off always
              shows when disabled; no Live/Hidden badge when enabled. */}
          {!enabled && hasLiveContent !== true && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 font-medium shrink-0"
              title="Module is off — will not render on the site even if it has content. Enable it to make it available.">
              Off
            </span>
          )}
          {!enabled && hasLiveContent === true && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium shrink-0"
              title="Module is off but has content — enable it to make this section visible on the site.">
              Off — has content
            </span>
          )}
          {enabled && hasLiveContent === true && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium shrink-0" title="This section has content and is visible on the live site">Live</span>
          )}
          {enabled && hasLiveContent === false && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium shrink-0" title="Hidden on the live site — this section has no content yet. Fill it to make the tab, page and sitemap entry appear.">Hidden — no content yet</span>
          )}
        </button>

        {/* Controls */}
        {enabled && (
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => onAIFill(module.slug)} disabled={aiLoading} title="AI Fill"
              className="p-1 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded disabled:opacity-50">
              {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            </button>
            <button type="button" onClick={() => setExpanded(!expanded)} className="p-1 text-slate-400 hover:text-slate-600">
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </div>

      {enabled && (
        <div className={`px-4 pb-4 border-t border-slate-100${expanded ? "" : " hidden"}`}>
          {isPassThrough && (
            <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded mt-3">
              📌 The site reads this section from the {module.slug === "important-dates" ? "Dates & Status" : "News"} tab. What you type here is stored on this module only.
            </p>
          )}
          {isFaqAuto && (
            <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded mt-3">
              📌 The site reads FAQs from the SEO tab. What you type here is stored on this module only.
            </p>
          )}
          <div className="py-3">
            <ModuleContentEditor editionId={editionId} moduleSlug={module.slug} fields={module.fields}
              initialContent={content} onStatusChange={(s) => onStatusChange?.(module.slug, s)}
              onPendingChange={(p) => onPendingChange?.(module.slug, p)} />
          </div>
        </div>
      )}
    </div>
  );
}
