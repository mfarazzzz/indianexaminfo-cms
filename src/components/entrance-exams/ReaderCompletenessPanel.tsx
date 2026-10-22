/**
 * ReaderCompletenessPanel — the exam editor's "What readers will see" checklist
 * (owner brief 22 Oct, item 2). Compact, READ-ONLY: one row per reader block,
 * each computed by computeReaderCompleteness from the SAME predicates the
 * frontend applies (mirrored hasData + the live-update filters + the
 * attested-URL rule). A row names the exact place to fix and clicking the row
 * jumps there THROUGH the unsaved-changes guard (onJump = guardedSetActiveTab).
 *
 * It writes nothing and saves nothing; it renders no data the record doesn't
 * have (empty rows say "no data", blocked rows say WHY: an editor-disabled
 * module, or a reader change that has not shipped yet).
 */
import { useState } from "react";
import { ChevronDown, CheckCircle2, MinusCircle, ShieldAlert } from "lucide-react";
import type { ReaderCompletenessRow, ReaderStatus } from "@/lib/exams/readerCompleteness";
import { summarizeReaderCompleteness } from "@/lib/exams/readerCompleteness";
import type { RailTabId } from "@/pages/entrance-exams/editorSections";

interface Props {
  rows: ReaderCompletenessRow[];
  /** Same target the rail uses; the PARENT routes it through the guard. */
  onJump: (tabId: RailTabId) => void;
}

const STATUS_META: Record<ReaderStatus, { label: string; dot: string; icon: typeof CheckCircle2 }> = {
  filled: { label: "filled", dot: "text-emerald-600", icon: CheckCircle2 },
  empty: { label: "no data", dot: "text-slate-400", icon: MinusCircle },
  blocked: { label: "blocked", dot: "text-amber-600", icon: ShieldAlert },
  "n/a": { label: "n/a", dot: "text-slate-300", icon: MinusCircle },
};

export function ReaderCompletenessPanel({ rows, onJump }: Props) {
  const [open, setOpen] = useState(true);
  if (rows.length === 0) return null; // nothing computed yet (record still loading) — no empty shell

  const summary = summarizeReaderCompleteness(rows);

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
        <ChevronDown className={`w-3.5 h-3.5 ml-auto text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <ul className="border-t border-slate-100 divide-y divide-slate-50 pb-1">
          {rows.map((r) => {
            const meta = STATUS_META[r.status];
            const Icon = meta.icon;
            return (
              <li key={r.key} data-testid={`reader-row-${r.key}`}>
                <button
                  type="button"
                  onClick={() => onJump(r.targetTab)}
                  title={`Fix in: ${r.fixHint}`}
                  className="w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
                >
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.dot}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-slate-700 leading-snug">{r.label}</span>
                    <span className="block text-[11px] text-slate-400 leading-snug">
                      {r.status === "filled" ? r.fixHint : `Fix: ${r.fixHint}`}
                    </span>
                  </span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 mt-0.5 ${meta.dot}`}>
                    {meta.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
