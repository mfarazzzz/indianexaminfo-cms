/**
 * R2.1 — the editor shell's section rail.
 *
 * Presentational only: it lists the registry sections in registry order, marks
 * the one being viewed, and reports a click. It decides NOTHING: the parent
 * routes the click through `guardedSetActiveTab` (the single unsaved-changes
 * gate) and owns the dirty flags, so the rail can never move the editor somewhere
 * the guard would not have allowed.
 *
 * Layout rule (editor-refactor §2 rule 7): the rail is always visible and the
 * shell must fit 1366x768 without horizontal scroll — a fixed-width column that
 * scrolls its OWN list vertically, beside a `min-w-0` content area.
 */
import type { RailItem, RailTabId, DirtyFlags } from "@/pages/entrance-exams/editorSections";
import { sectionIsDirty } from "@/pages/entrance-exams/editorSections";

interface Props {
  items: RailItem[];
  /** the tab currently open — every section pointing at it reads as current. */
  activeTab: string;
  /**
   * Switch to the tab AND, when the section has a surface on it, scroll to it.
   * `sectionSlug` is the module_registry slug the parent matches against a
   * data-fix-target on the card that edits that section (P2 item 17), so a rail
   * click lands the editor on the thing they named, not at the top of a tab.
   */
  onSection: (tabId: RailTabId, sectionSlug?: string) => void;
  dirty: DirtyFlags;
}

export function EditorSectionRail({ items, activeTab, onSection, dirty }: Props) {
  if (items.length === 0) return null; // registry still loading, or a failed read: the tabs below still work

  return (
    <nav
      aria-label="Sections"
      data-testid="editor-section-rail"
      className="w-52 shrink-0 self-start sticky top-4 rounded-lg border border-slate-200 bg-white"
    >
      <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
        Sections
      </p>
      <ul className="max-h-[calc(100vh-8rem)] overflow-y-auto py-1">
        {items.map((item) => {
          const current = item.tabId === activeTab;
          const isDirty = sectionIsDirty(item.tabId, dirty);
          return (
            <li key={item.slug} data-testid={`rail-item-${item.slug}`}>
              <button
                type="button"
                onClick={() => onSection(item.tabId, item.slug)}
                aria-current={current ? "page" : undefined}
                title={item.label}
                className={`w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-[13px] leading-snug border-l-2 ${
                  current
                    ? "border-blue-600 bg-blue-50/60 text-blue-700 font-medium"
                    : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {/* unsaved work on the surface holding this section (R2.1: a dot,
                    not a per-section save — that lands in R2.5) */}
                {isDirty && (
                  <span
                    aria-label="unsaved changes"
                    data-testid={`rail-dirty-${item.slug}`}
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
