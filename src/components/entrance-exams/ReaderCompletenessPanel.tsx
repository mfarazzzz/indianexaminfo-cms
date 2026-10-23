/**
 * ReaderCompletenessPanel — the exam editor's "What readers will see" checklist
 * (owner brief 22 Oct, item 2; shape revised by the reference-page review, 23 Oct,
 * item 15). READ-ONLY: one row per reader block, each computed by
 * computeReaderCompleteness from the SAME predicates the frontend applies (mirrored
 * hasData + the live-update filters including SUPERSEDED + the attested-URL rule).
 *
 * Four decisions the review locked:
 *  • COLLAPSED by default. The editor came to write, not to read a dashboard; the
 *    header line ("9 filled · 2 empty · 1 blocked") carries the whole signal until
 *    it is opened.
 *  • Opened, the rows that need work come FIRST (orderRowsForFixFirst) — blocked,
 *    then empty, then n/a, then the filled ones at the bottom.
 *  • Every row that can be fixed has a real "Fix →" button: it switches to the right
 *    tab THROUGH the unsaved-changes guard and focuses the field there. The whole row
 *    is no longer a button, so the label text can wrap instead of being clipped.
 *  • A row never claims a reader surface the frontend does not render.
 */
import { useState } from "react";
import { ChevronDown, CheckCircle2, MinusCircle, ShieldAlert, ArrowRight } from "lucide-react";
import type { ReaderCompletenessRow, ReaderStatus } from "@/lib/exams/readerCompleteness";
import { summarizeReaderCompleteness, orderRowsForFixFirst } from "@/lib/exams/readerCompleteness";
import type { RailTabId } from "@/pages/entrance-exams/editorSections";
import { TAB_LABELS } from "@/pages/entrance-exams/editorSections";

interface Props {
  rows: ReaderCompletenessRow[];
  /** Same target the rail uses; the PARENT routes it through the guard and focuses
   *  the field named by `focusKey` when the row has one. */
  onJump: (tabId: RailTabId, focusKey?: string) => void;
}

const STATUS_META: Record<ReaderStatus, { label: string; dot: string; icon: typeof CheckCircle2 }> = {
  filled: { label: "filled", dot: "text-emerald-600", icon: CheckCircle2 },
  empty: { label: "no data", dot: "text-slate-400", icon: MinusCircle },
  blocked: { label: "blocked", dot: "text-amber-600", icon: ShieldAlert },
  "n/a": { label: "n/a", dot: "text-slate-300", icon: MinusCircle },
};

export function ReaderCompletenessPanel({ rows, onJump }: Props) {
  // Collapsed by default (P2 item 15) — the summary line is the whole resting state.
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null; // nothing computed yet (record still loading) — no empty shell

  const summary = summarizeReaderCompleteness(rows);
  const ordered = orderRowsForFixFirst(rows);
  const needsWork = ordered.filter((r) => r.status !== "filled" && r.status !== "n/a").length;

  return (
    <section
      aria-label="What readers will see"
      data-testid="reader-completeness-panel"
      className="rounded-lg border border-slate-200 bg-white"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          What readers will see
        </span>
        <span className="text-[11px] text-slate-400">{summary}</span>
        {needsWork > 0 && (
          <span className="text-[11px] font-medium text-amber-700" data-testid="reader-needs-work">
            {needsWork} to fix
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 ml-auto text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <ul className="border-t border-slate-100 divide-y divide-slate-50 pb-1">
          {ordered.map((r) => {
            const meta = STATUS_META[r.status];
            const Icon = meta.icon;
            return (
              <li key={r.key} data-testid={`reader-row-${r.key}`} className="flex items-start gap-2 px-3 py-1.5">
                <Icon className={`w-3.5 h-3.5 mt-1 shrink-0 ${meta.dot}`} aria-hidden />
                {/* Plain text, free to wrap: the old layout put the whole row inside a
                     button whose fixed line-height clipped the description at small
                     viewport heights (P2 item 15). */}
                <div className="min-w-0 flex-1">
                  <span className="block text-[12px] text-slate-700 leading-snug break-words">{r.label}</span>
                  <span className="block text-[11px] text-slate-500 leading-snug break-words whitespace-normal">
                    {r.fixHint}
                  </span>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 mt-1 ${meta.dot}`}>
                  {meta.label}
                </span>
                {(r.status === "empty" || r.status === "blocked") && (
                  <button
                    type="button"
                    onClick={() => onJump(r.targetTab, r.focusKey)}
                    className="shrink-0 inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                    data-testid={`reader-fix-${r.key}`}
                    title={r.focusKey ? `Open “${TAB_LABELS[r.targetTab]}” and focus the field` : `Open “${TAB_LABELS[r.targetTab]}”`}
                  >
                    Fix <ArrowRight size={11} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
