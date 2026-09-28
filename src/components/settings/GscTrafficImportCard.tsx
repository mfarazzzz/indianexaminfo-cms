/**
 * GscTrafficImportCard — Settings → SEO: "Import Search Console pages CSV".
 *
 * The owner downloads the Performance → Pages export from Search Console
 * (columns: url,host,path,clicks,impressions,ctr,position), enters the
 * reporting period manually, and this card upserts page/clicks/impressions
 * into page_traffic (migration 20260928042556). Re-importing the same period
 * refreshes the numbers; a different period stacks alongside it.
 *
 * Gated by manage_settings: the card is hidden without it AND the service
 * pre-checks the permission AND the table's RLS INSERT/UPDATE policies require
 * it — three layers, DB authoritative (there is NO delete policy).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { P } from "@/config/permissions";
import { parseGscPagesCsv, GscCsvError } from "@/lib/gscCsv";
import { importPageTraffic, getLatestTrafficPeriod } from "@/services/pageTrafficService";
import { getErrorMessage } from "@/lib/utils";

const inputCls =
  "w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

export function GscTrafficImportCard() {
  const { permissions } = useAuth();
  const canImport = permissions.includes(P.MANAGE_SETTINGS);

  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [importing, setImporting] = useState(false);
  const [latest, setLatest] = useState<{ periodStart: string; periodEnd: string; pages: number } | null>(null);

  const loadLatest = useCallback(async () => {
    try { setLatest(await getLatestTrafficPeriod()); } catch { /* hint only — never blocks */ }
  }, []);

  useEffect(() => { if (canImport) void loadLatest(); }, [canImport, loadLatest]);

  if (!canImport) return null;

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Choose the Search Console Pages CSV first."); return; }
    if (!periodStart || !periodEnd) { toast.error("Enter the reporting period (start and end date)."); return; }
    setImporting(true);
    try {
      const text = await file.text();
      const { rows, skipped } = parseGscPagesCsv(text);
      const result = await importPageTraffic(rows, periodStart, periodEnd);
      toast.success(
        `Imported ${result.upserted} pages for ${result.periodStart} → ${result.periodEnd}` +
        (skipped > 0 ? ` (${skipped} malformed line${skipped === 1 ? "" : "s"} skipped)` : ""),
      );
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      void loadLatest();
    } catch (err) {
      toast.error(err instanceof GscCsvError ? err.message : getErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Import Search Console pages CSV</h3>
      <p className="mt-1 text-xs text-slate-500">
        Upload the Google Search Console <em>Performance → Pages</em> export (page, clicks,
        impressions) for a reporting period. Re-importing the same period updates the numbers.
      </p>
      {latest && (
        <p className="mt-1 text-xs text-slate-400">
          Latest loaded period: {latest.periodStart} → {latest.periodEnd} ({latest.pages} pages)
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">CSV file</label>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className={inputCls}
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Period start</label>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Period end</label>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button onClick={handleImport} disabled={importing || !fileName}
          className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {importing ? "Importing…" : "Import into page_traffic"}
        </button>
        {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
      </div>
    </div>
  );
}
