/**
 * NoticeReviewDrawer.tsx — S2.4: the review screen that stands between an
 * extraction and the form. First piece of the new editor shell (R2 will grow
 * around it; nothing here belongs to the old tabs).
 *
 * One row per proposed change: field · current · proposed · source quote ·
 * confidence · Accept/Reject. Accept starts checked ONLY where the current
 * value is empty and confidence ≥ 0.7. Flagged items (low confidence, no CMS
 * option, no form field yet) are listed at the top WITH A REASON. "Apply
 * accepted" writes to the FORM ONLY — the editor saves; the AI never does
 * (R1.6). The fill report sits on top: proposed / accepted / flagged and why.
 */
import React, { useMemo, useState } from "react";
import type { ReviewRow, FillReport } from "./noticeReview";
import type { LikelyMatch } from "@/lib/ai/noticeMatch";

interface Props {
  open: boolean;
  rows: ReviewRow[];
  report: FillReport;
  /** What the extraction ran on — shown so the editor sees the source scope. */
  providerNote: string;
  /** S2.5: a likely existing record this notice belongs to (new records only). */
  match?: LikelyMatch | null;
  /** Open that record and review there — the extraction rides with it. */
  onOpenMatch?: (match: LikelyMatch) => void;
  onClose: () => void;
  /** Apply the accepted rows to the FORM (no DB write — the editor saves). */
  onApply: (accepted: ReviewRow[]) => void;
}

const ConfidenceTag: React.FC<{ value: number }> = ({ value }) => {
  const pct = Math.round(value * 100);
  const cls = value >= 0.7 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  return <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${cls}`}>{pct}%</span>;
};

export const NoticeReviewDrawer: React.FC<Props> = ({ open, rows, report, providerNote, match, onOpenMatch, onClose, onApply }) => {
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  // S2.5: "Review here anyway" hides the match banner without losing the rows.
  const [matchDismissed, setMatchDismissed] = useState(false);
  // Seed per-open from the row defaults (Accept only where empty + confident).
  const seed = useMemo(() => {
    const s: Record<string, boolean> = {};
    for (const r of rows) s[r.id] = r.defaultAccept;
    return s;
  }, [rows]);
  const [initialisedFor, setInitialisedFor] = React.useState<ReviewRow[] | null>(null);
  if (initialisedFor !== rows) {
    setInitialisedFor(rows);
    setAccepted(seed);
    setMatchDismissed(false);
  }

  if (!open) return null;

  const acceptedRows = rows.filter((r) => accepted[r.id] && !r.noFieldYet);
  const flagged = rows.filter((r) => !r.defaultAccept);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Review AI changes">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} data-testid="drawer-scrim" />
      <aside className="relative w-full max-w-[520px] h-full bg-white shadow-xl flex flex-col">
        {/* Header: report */}
        <header className="px-4 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Review the notice changes</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none" aria-label="Close">×</button>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{providerNote}</p>
          <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{report.proposed} proposed</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{report.defaultAccepted} ready to accept</span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700">{report.flagged} flagged</span>
            {report.noFieldYet > 0 && (
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700">{report.noFieldYet} with no field yet</span>
            )}
          </div>
        </header>

        {/* S2.5: one record per cycle — offer to review on the record it belongs to */}
        {match && onOpenMatch && !matchDismissed && (
          <div className="px-4 py-3 border-b border-blue-200 bg-blue-50" data-testid="drawer-match-notice">
            <p className="text-xs text-blue-900">
              This notice looks like it belongs to{" "}
              <strong>{match.exam.name}</strong>
              {match.exam.workflowStatus ? ` (${match.exam.workflowStatus})` : ""}.
              Open it and review the changes there?
            </p>
            <p className="text-[11px] text-blue-700 mt-0.5">Why: {match.reasons.join(", ")} — match {Math.round(match.score * 100)}%</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onOpenMatch(match)}
                className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-semibold"
                data-testid="drawer-open-match"
              >
                Open {match.exam.name}
              </button>
              <button
                onClick={() => setMatchDismissed(true)}
                className="px-2.5 py-1 rounded border border-blue-300 text-blue-700 text-xs"
                data-testid="drawer-review-anyway"
              >
                Review here anyway (new record)
              </button>
            </div>
          </div>
        )}

        {/* Flagged summary at the top — reasons first, rows below */}
        {(report.lowConfidence.length > 0 || report.missingOptions.length > 0) && (
          <div className="px-4 py-2 border-b border-slate-100 bg-amber-50/50 text-[11px] text-amber-800 space-y-0.5" data-testid="drawer-flagged-summary">
            {report.lowConfidence.length > 0 && <p>Low confidence: {report.lowConfidence.join(", ")}</p>}
            {report.missingOptions.length > 0 && <p>Missing options / no field: {report.missingOptions.join("; ")}</p>}
          </div>
        )}

        {/* Rows */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-slate-500">Nothing was extracted. The notice text may not be about this exam.</p>
          )}
          {flagged.length > 0 && (
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {flagged.length} item(s) need a deliberate decision
            </p>
          )}
          {rows.map((r) => (
            <div key={r.id} className={`rounded border p-3 ${r.noFieldYet ? "border-rose-200 bg-rose-50/40" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{r.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    current: <span className="text-slate-600">{r.current || "—"}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    proposed: <span className="text-slate-800 font-medium">{r.proposed}</span>
                  </p>
                </div>
                <ConfidenceTag value={r.confidence} />
              </div>
              {r.sourceQuote && (
                <blockquote className="mt-1.5 border-l-2 border-slate-200 pl-2 text-[11px] italic text-slate-500 line-clamp-3" title="Verbatim from the notice">
                  “{r.sourceQuote}”
                </blockquote>
              )}
              {r.noFieldYet && (
                <p className="mt-1 text-[11px] text-rose-700">The form has no field for this yet — it is never auto-applied. Note for S3.</p>
              )}
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  disabled={r.noFieldYet}
                  checked={!!accepted[r.id] && !r.noFieldYet}
                  onChange={(e) => setAccepted((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                  className="rounded"
                />
                Accept
              </label>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400">
            Applying writes to the form only — you save. Nothing goes live by itself.
          </p>
          <button
            onClick={() => onApply(acceptedRows)}
            disabled={acceptedRows.length === 0}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold disabled:bg-slate-300"
            data-testid="drawer-apply"
          >
            Apply accepted ({acceptedRows.length})
          </button>
        </footer>
      </aside>
    </div>
  );
};
