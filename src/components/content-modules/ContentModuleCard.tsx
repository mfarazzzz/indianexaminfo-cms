/**
 * ContentModuleCard — Collapsible card with data mode support.
 * Shows: toggle, mode selector, AI Fill, stale indicator, expand/collapse.
 * Renders content based on mode: auto (read-only), hybrid (auto+notes), manual (full editor).
 */
import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, GripVertical, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { ModuleContentEditor } from "./ModuleContentEditor";
import type { ModuleDefinition, ModuleContentData, SaveStatus } from "@/types/modules";
import type { DataMode } from "@/lib/modules/dataBindingService";
import type { DragHandleProps } from "@/components/shared/DraggableList";

interface Props {
  module: ModuleDefinition;
  enabled: boolean;
  editionId: string | null;
  content: ModuleContentData | null;
  mode: DataMode;
  isStale: boolean;
  autoContent: Record<string, unknown> | null;
  onToggle: (enabled: boolean) => void;
  onModeChange: (mode: DataMode) => void;
  onAIFill: (slug: string) => void;
  onSync: (slug: string) => void;
  onStatusChange?: (slug: string, status: SaveStatus) => void;
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
   * Real drag handle (Group B / reorderable modules only). When absent, NO grip
   * is shown — the old decorative always-on grip was a lie for non-reorderable
   * rows. Present handle => this row genuinely reorders _config.moduleOrder.
   */
  dragHandleProps?: DragHandleProps;
  isDragging?: boolean;
}

export function ContentModuleCard({
  module, enabled, editionId, content, mode, isStale, autoContent,
  onToggle, onModeChange, onAIFill, onSync, onStatusChange, aiLoading, forceCollapsed,
  hasLiveContent, dragHandleProps, isDragging,
}: Props) {
  // Item 4: collapsed by default — the tab was an enormous scroll with every
  // module expanded. Name + badges + toggle stay visible; content only on expand.
  const [expanded, setExpanded] = useState(false);

  // Respond to Collapse All / Expand All from parent
  useEffect(() => {
    if (forceCollapsed !== undefined) {
      setExpanded(!forceCollapsed);
    }
  }, [forceCollapsed]);

  // Collapse when disabled (e.g. Disable All)
  useEffect(() => {
    if (!enabled) setExpanded(false);
  }, [enabled]);

  const isPassThrough = ["important-dates", "news"].includes(module.slug) && mode === "auto";
  const isFaqAuto = module.slug === "faqs" && mode === "auto";

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

        {/* Module name + stale indicator. Item 1: ml-1 gap so the toggle never
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
          {isStale && enabled && mode !== "manual" && (
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Content may be stale" />
          )}
          {mode === "auto" && enabled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium shrink-0">Auto</span>
          )}
          {mode === "hybrid" && enabled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium shrink-0">Hybrid</span>
          )}
        </button>

        {/* Controls */}
        {enabled && (
          <div className="flex items-center gap-1 shrink-0">
            <select value={mode} onChange={(e) => onModeChange(e.target.value as DataMode)}
              title="Auto = content is pulled from the Dates/SEO/Identity tabs (read-only here). Hybrid = auto content plus your own notes. Manual = you edit everything here directly."
              className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 bg-white">
              <option value="auto">Auto</option>
              <option value="hybrid">Hybrid</option>
              <option value="manual">Manual</option>
            </select>
            {isStale && mode !== "manual" && (
              <button type="button" onClick={() => onSync(module.slug)} title="Sync now"
                className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded">
                <RefreshCw size={13} />
              </button>
            )}
            {mode !== "auto" || !["important-dates", "news"].includes(module.slug) ? (
              <button type="button" onClick={() => onAIFill(module.slug)} disabled={aiLoading} title="AI Fill"
                className="p-1 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded disabled:opacity-50">
                {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              </button>
            ) : null}
            <button type="button" onClick={() => setExpanded(!expanded)} className="p-1 text-slate-400 hover:text-slate-600">
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      {enabled && expanded && (
        <div className="px-4 pb-4 border-t border-slate-100">
          {mode === "auto" && autoContent && (
            <div className="py-3">
              {isPassThrough && (
                <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded mb-3">
                  📌 This content is automatically pulled from the {module.slug === "important-dates" ? "Dates & Status" : "News"} tab. Edit it there.
                </p>
              )}
              {isFaqAuto && (
                <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded mb-3">
                  📌 FAQs are automatically pulled from the SEO tab. Edit them there or switch to Manual mode.
                </p>
              )}
              <AutoContentDisplay content={autoContent} moduleSlug={module.slug} />
            </div>
          )}
          {mode === "hybrid" && (
            <div className="py-3 space-y-4">
              {autoContent && (
                <div className="bg-slate-50 rounded p-3 border border-slate-100">
                  <p className="text-[10px] uppercase text-slate-400 font-semibold mb-2">Auto-Generated</p>
                  <AutoContentDisplay content={autoContent} moduleSlug={module.slug} />
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase text-slate-500 font-semibold mb-2">Additional Notes (Manual)</p>
                <ModuleContentEditor editionId={editionId} moduleSlug={module.slug} fields={module.fields}
                  initialContent={content} onStatusChange={(s) => onStatusChange?.(module.slug, s)} />
              </div>
            </div>
          )}
          {mode === "manual" && (
            <ModuleContentEditor editionId={editionId} moduleSlug={module.slug} fields={module.fields}
              initialContent={content} onStatusChange={(s) => onStatusChange?.(module.slug, s)} />
          )}
        </div>
      )}
    </div>
  );
}

function AutoContentDisplay({ content, moduleSlug }: { content: Record<string, unknown>; moduleSlug: string }) {
  if (moduleSlug === "important-dates") {
    const dates = (content.dates as any[]) ?? [];
    if (dates.length === 0) return <p className="text-xs text-slate-400 italic">No dates available yet.</p>;
    return (
      <div className="space-y-1">
        {dates.map((d: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-slate-700">{d.label}</span>
            <span className={`font-mono text-xs ${d.isUrgent ? "text-red-600 font-semibold" : "text-slate-500"}`}>
              {d.date ? new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (moduleSlug === "faqs") {
    const items = (content.items as any[]) ?? [];
    if (items.length === 0) return <p className="text-xs text-slate-400 italic">No FAQs available. Add them in the SEO tab.</p>;
    return (
      <div className="space-y-2">
        {items.map((faq: any, i: number) => (
          <div key={i} className="border border-slate-100 rounded p-2">
            <p className="text-sm font-medium text-slate-700">{faq.question}</p>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{typeof faq.answer === "string" ? faq.answer.replace(/<[^>]*>/g, "").slice(0, 150) : ""}</p>
          </div>
        ))}
      </div>
    );
  }
  if (moduleSlug === "overview") {
    const body = content.body as string;
    const summary = content.summary as string;
    return (
      <div>
        {summary && <p className="text-sm text-slate-600 font-medium mb-2">{summary}</p>}
        {body && <div className="prose prose-sm max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: body }} />}
        {!body && !summary && <p className="text-xs text-slate-400 italic">No data to generate overview from yet.</p>}
      </div>
    );
  }
  // Item 2: never leak raw JSON like "items: []" into the UI. Skip empty
  // values and render a calm empty state when nothing meaningful is present.
  const meaningful = Object.entries(content).filter(([k, v]) => {
    if (k === "_meta") return false;
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  });
  if (meaningful.length === 0) {
    return <p className="text-xs text-slate-400 italic">No content yet.</p>;
  }
  return (
    <div className="space-y-1 text-sm">
      {meaningful.map(([key, val]) => (
        <div key={key}>
          <span className="text-xs text-slate-400">{key}: </span>
          <span className="text-slate-600">{typeof val === "string" ? val.slice(0, 100) : JSON.stringify(val).slice(0, 100)}</span>
        </div>
      ))}
    </div>
  );
}
