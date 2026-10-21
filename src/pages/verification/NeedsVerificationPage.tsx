/**
 * NeedsVerificationPage — S3.2 / D6 triage (owner decision 1: the list is ALL
 * unverified exams — the "system-seeded" label is dropped — with the live
 * count shown, plus verifications older than 90 days flagged "re-check").
 *
 * Default sort (decision 2): NEAREST UPCOMING DATE first — the pages readers
 * are about to land on get verified before they age. No-date rows sink to the
 * bottom, featured records break ties. GSC traffic is a later optional add-on.
 *
 * Every row shows WHY it cannot be verified yet (no dates, no official URL,
 * …) using the SAME rules as the editor's Verify button
 * (lib/exams/verification.buildQueueRow) — the list can never disagree with
 * the control. A click opens that record's editor on the Dates & Status tab.
 * Verification itself happens ONE record at a time in the editor — there is
 * deliberately no bulk action anywhere.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, ShieldAlert, RefreshCw, ExternalLink } from "lucide-react";
import { getVerificationQueue } from "@/services/examService";
import type { VerificationQueueRow } from "@/lib/exams/verification";
import { adminListForPillar } from "@/config/pillarAdminLists";
import { getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const PILLARS = ["", "entrance-exam", "government-exam", "govt-vacancy", "board-exam", "university-exam"] as const;

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const NeedsVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canPublish = permissions.includes("publish_exam");
  const [rows, setRows] = useState<VerificationQueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pillar, setPillar] = useState<string>("");

  useEffect(() => {
    let live = true;
    getVerificationQueue()
      .then((r) => { if (live) setRows(r); })
      .catch((e) => { if (live) setError(getErrorMessage(e)); });
    return () => { live = false; };
  }, []);

  const shown = useMemo(() => (rows ?? []).filter((r) => !pillar || r.pillar === pillar), [rows, pillar]);
  const counts = useMemo(() => ({
    total: shown.length,
    ready: shown.filter((r) => r.reasons.length === 0).length,
    recheck: shown.filter((r) => r.needsRecheck).length,
  }), [shown]);

  const openRecord = (r: VerificationQueueRow) => {
    navigate(`${adminListForPillar(r.pillar).path}/${r.id}?tab=edition`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-600" />
          Needs verification
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Every exam record without an editor verification, sorted by the nearest upcoming date — verify the pages
          readers are about to land on first. Verifications older than 90 days are flagged re-check. Records are
          verified one at a time in the editor; there is no bulk action. The public page keeps showing the honest
          "Not yet verified" notice until an editor verifies a record.
        </p>
        {!canPublish && (
          <p className="text-[11px] text-slate-500 mt-1" data-testid="needs-verify-no-permission-hint">
            You can review this list, but verifying a record requires the Publish Exam permission.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600" data-testid="needs-verify-count">{counts.total} in queue</span>
          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700" data-testid="needs-verify-ready">{counts.ready} ready to verify now</span>
          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700">{counts.total - counts.ready} need data first</span>
          {counts.recheck > 0 && (
            <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700" data-testid="needs-verify-recheck">{counts.recheck} to re-check</span>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Pillar
          <select
            data-testid="needs-verify-pillar-filter"
            value={pillar}
            onChange={(e) => setPillar(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            {PILLARS.map((p) => (
              <option key={p || "all"} value={p}>{p === "" ? "All" : adminListForPillar(p).label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-rose-700">Could not load the queue: {error}</p>}
      {!error && rows === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the verification queue…
        </div>
      )}
      {!error && rows !== null && (
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="min-w-[860px] w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2 font-medium">Exam</th>
                <th className="px-3 py-2 font-medium">Pillar</th>
                <th className="px-3 py-2 font-medium">Dates?</th>
                <th className="px-3 py-2 font-medium">Official URL?</th>
                <th className="px-3 py-2 font-medium">Next date</th>
                <th className="px-3 py-2 font-medium">Verified</th>
                <th className="px-3 py-2 font-medium">Why blocked / next step</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => openRecord(r)}
                  data-testid={`needs-verify-row-${r.slug}`}
                >
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-800">{r.name}</span>
                    <span className="block text-[10px] text-slate-400 font-mono">{r.slug}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{adminListForPillar(r.pillar).label}</td>
                  <td className="px-3 py-2">{r.hasDates ? <span className="text-emerald-700">Yes</span> : <span className="text-rose-600">No</span>}</td>
                  <td className="px-3 py-2">{r.hasOfficialUrl ? <span className="text-emerald-700">Yes</span> : <span className="text-rose-600">No</span>}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.nextDate ? (
                      <span>{fmtDate(r.nextDate)}{r.daysToNext !== null ? ` (${r.daysToNext}d)` : ""}</span>
                    ) : (
                      <span className="text-slate-400">none upcoming</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.needsRecheck ? (
                      <span className="inline-flex items-center gap-1 text-orange-700" data-testid="needs-verify-recheck-flag">
                        <RefreshCw size={11} /> re-check ({fmtDate(r.verifiedAt)})
                      </span>
                    ) : r.verifiedAt ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700"><ShieldCheck size={11} /> {fmtDate(r.verifiedAt)}</span>
                    ) : (
                      <span className="text-slate-400">never</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-amber-700">
                    {r.reasons.length === 0 ? (
                      <span className="text-emerald-700 font-medium">Ready — open and verify</span>
                    ) : (
                      <span title={r.reasons.join(" · ")}>{r.reasons.join(" · ")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-400"><ExternalLink size={12} /></td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Nothing in the queue for this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default NeedsVerificationPage;
