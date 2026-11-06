/**
 * VacancyBulkFill — the spreadsheet path for the 361 vacancy rows (owner batch 7, C2b).
 *
 * One card, three steps, in the order the owner actually works:
 *   1. Export   → an .xlsx with every vacancy, the twenty slugs that carry 84% of the
 *                 Search Console impressions first, current values included.
 *   2. Fill it  → offline, in Excel/Sheets.
 *   3. Import   → the shared spreadsheet gate, then a PREVIEW of every single change
 *                 (value, repair note, skip reason, warning, error) and only then a
 *                 confirm that writes.
 *
 * What this screen cannot do is the point: it never creates a row, never clears a cell,
 * and never replaces a value that is already set unless "overwrite" is ticked. All the
 * rules live in src/lib/utils/vacancyBulkOps.ts (pinned by its test file); this component
 * only shows the plan honestly and asks before writing.
 */
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Loader2, TableProperties } from "lucide-react";
import { ALLOWED_EXTENSIONS } from "@/lib/utils/spreadsheetUpload";
import {
  exportVacanciesForFill, fetchVacancyCurrentByIds, readVacancySheet,
  planVacancyRows, applyVacancyPlans, type VacancyRowPlan,
} from "@/lib/utils/vacancyBulkOps";

interface Props { onImportComplete?: () => void }

type Preview = { plans: VacancyRowPlan[]; counts: { rows: number; writable: number; blocked: number; noChange: number }; fileName: string };
type Report = { updated: number; refused: number; untouched: number; failures: { row: number; id: string | null; message: string }[] };

const VISIBLE_ROWS = 50;

export function VacancyBulkFill({ onImportComplete }: Props) {
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState<"export" | "preview" | "apply" | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = async () => {
    setBusy("export");
    try {
      const { count } = await exportVacanciesForFill();
      toast.success(`${count} vacancy rows exported — the 20 highest-traffic slugs first`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally { setBusy(null); }
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setBusy("preview"); setReport(null);
    try {
      const [{ records }, current] = await Promise.all([readVacancySheet(file), fetchVacancyCurrentByIds()]);
      const { plans, counts } = planVacancyRows(records, current, { overwrite });
      setPreview({ plans, counts, fileName: file.name });
      if (counts.rows === 0) toast.warning("That sheet has no data rows.");
    } catch (err) {
      setPreview(null);
      toast.error(err instanceof Error ? err.message : "Could not read that file");
    } finally { setBusy(null); }
  };

  const onApply = async () => {
    if (!preview) return;
    setBusy("apply");
    try {
      const res = await applyVacancyPlans(preview.plans);
      setReport(res);
      setPreview(null);
      if (res.updated > 0) toast.success(`${res.updated} vacancy row${res.updated === 1 ? "" : "s"} updated`);
      if (res.failures.length > 0) toast.error(`${res.failures.length} row(s) failed to write — see the report`);
      onImportComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally { setBusy(null); }
  };

  const rows = preview?.plans ?? [];
  const shown = rows.slice(0, VISIBLE_ROWS);
  // Pre-computed, because the repo forbids a bare `.length` comparison inside JSX: it can
  // render "0" into the page. src/noJsxLengthLeak.test.ts enforces that on every .tsx.
  const moreRowsHidden = rows.length > shown.length;

  return (
    <section aria-label="Bulk fill vacancy dates and links" className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <TableProperties size={16} className="text-blue-600" /> Bulk fill dates and links
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Export the vacancy rows, fill the dates and official links in the sheet, import it back.
            Nothing is created and nothing is overwritten here unless you tick the box — every change is
            shown before it is written.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onExport} disabled={busy !== null}
            className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50">
            {busy === "export" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export sheet
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Upload size={14} /> Choose filled sheet
          </button>
          <input ref={fileRef} type="file" accept={ALLOWED_EXTENSIONS.join(",")}
            className="sr-only" data-testid="vacancy-file-input"
            onChange={(e) => { void onPick(e.target.files?.[0]); e.currentTarget.value = ""; }} />
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={overwrite} className="mt-0.5"
          onChange={(e) => setOverwrite(e.target.checked)} />
        <span>
          <span className="font-medium">Overwrite values that are already set.</span>{" "}
          Leave this off to fill only the blanks — with it on, an import can replace verified dates,
          and the database then voids that row&apos;s verification until an editor checks it again.
        </span>
      </label>

      {preview && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
          <p className="font-medium text-slate-800">
            Preview of “{preview.fileName}”: {preview.counts.rows} rows read ·{" "}
            <span className="text-green-700">{preview.counts.writable} will be written</span> ·{" "}
            <span className="text-red-700">{preview.counts.blocked} blocked with errors</span> ·{" "}
            {preview.counts.noChange} nothing to change
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-2 font-medium">Row</th>
                  <th className="py-1 pr-2 font-medium">Slug</th>
                  <th className="py-1 pr-2 font-medium">Will write</th>
                  <th className="py-1 pr-2 font-medium">Skipped / notes</th>
                  <th className="py-1 font-medium">Errors</th>
                </tr>
              </thead>
              <tbody className="align-top divide-y divide-slate-200">
                {shown.map((p) => (
                  <tr key={`${p.rowNumber}-${p.id ?? "noid"}`} data-testid={`preview-row-${p.rowNumber}`}>
                    <td className="py-1 pr-2 text-slate-500">{p.rowNumber}</td>
                    <td className="py-1 pr-2 font-mono text-slate-700">{p.slug ?? "(no slug)"}</td>
                    <td className="py-1 pr-2 text-slate-700">
                      {Object.entries(p.writes).map(([k, v]) => <div key={k}><span className="text-slate-400">{k} =</span> {String(v)}</div>)}
                      {Object.keys(p.writes).length === 0 && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-1 pr-2 text-slate-500">
                      {p.skipped.map((s, i) => <div key={`s${i}`}>{s.column}: {s.reason}</div>)}
                      {p.warnings.map((w, i) => <div key={`w${i}`} className="text-amber-700">⚠ {w}</div>)}
                    </td>
                    <td className="py-1 text-red-700">{p.errors.map((e, i) => <div key={i}>{e}</div>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {moreRowsHidden && (
            <p className="text-slate-500">Showing the first {VISIBLE_ROWS} of {rows.length} rows — the report after applying covers all of them.</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={onApply} disabled={busy !== null || preview.counts.writable === 0}
              data-testid="vacancy-apply"
              className="flex items-center gap-2 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {busy === "apply" ? <Loader2 size={12} className="animate-spin" /> : null}
              Apply {preview.counts.writable} row{preview.counts.writable === 1 ? "" : "s"}
            </button>
            <button type="button" onClick={() => setPreview(null)} disabled={busy !== null}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {report && (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs space-y-1" data-testid="vacancy-report">
          <p className="font-medium text-slate-800">
            Import finished: {report.updated} updated · {report.refused} refused (errors) · {report.untouched} nothing to change
            {report.failures.length > 0 && <> · <span className="text-red-700">{report.failures.length} database failures</span></>}
          </p>
          {report.failures.map((f) => (
            <p key={`${f.row}-${f.id ?? ""}`} className="text-red-700">row {f.row}: {f.message}</p>
          ))}
          <p className="text-slate-500">
            Rows whose verification was voided by the database need re-verifying from the vacancy screen
            before they can appear as job postings again.
          </p>
        </div>
      )}
    </section>
  );
}
