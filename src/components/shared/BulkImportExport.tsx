/**
 * BulkImportExport — Shared component for bulk Excel import/export.
 * Used across all pillar list pages: entrance exams, govt exams, board exams, etc.
 *
 * Import flow (safety):
 *   1. File select → previewImportFromExcel (READ-ONLY dry-run, writes nothing)
 *   2. Render preview: NEW EDITIONS block first (archives cycles), then destructive
 *      summary (field clears, date-state changes), then routine counts.
 *   3. If anything destructive → editor must type CONFIRM. Purely additive → one click.
 *   4. Only then importExamsFromExcel actually writes.
 */
import React, { useRef, useState } from "react";
import { Download, Upload, FileSpreadsheet, Loader2, X, CheckCircle2, AlertCircle, AlertTriangle, Archive } from "lucide-react";
import { toast } from "sonner";
import {
  exportExamsToExcel, importExamsFromExcel, downloadImportTemplate,
  previewImportFromExcel, type ImportResult, type ImportPreview,
} from "@/lib/utils/excelBulkOps";
import { getErrorMessage } from "@/lib/utils";

interface BulkImportExportProps {
  /** Database pillar value: "entrance-exam" | "sarkari-naukri" | "board-university" */
  pillar: string;
  /** Display label for the pillar: "Entrance Exams", "Govt Exams", etc. */
  pillarLabel: string;
  /** Called after a successful import to refresh the list */
  onImportComplete?: () => void;
}

export function BulkImportExport({ pillar, pillarLabel, onImportComplete }: BulkImportExportProps) {
  const [exporting, setExporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportExamsToExcel(pillar, pillarLabel);
      toast.success(`Exported ${pillarLabel} to Excel`);
    } catch (err) {
      toast.error("Export failed: " + getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  // Step 1: file selected → run the read-only preview. NO writes.
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast.error("Please upload an Excel file (.xlsx, .xls) or CSV (.csv)");
      return;
    }
    setImportResult(null);
    setPreview(null);
    setConfirmText("");
    setPendingFile(file);
    setPreviewing(true);
    try {
      const p = await previewImportFromExcel(file, pillar);
      setPreview(p);
    } catch (err) {
      toast.error("Preview failed: " + getErrorMessage(err));
      setPendingFile(null);
    } finally {
      setPreviewing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Step 4: editor confirmed → run the real import (writes).
  const handleApply = async () => {
    if (!pendingFile) return;
    setImporting(true);
    try {
      const result = await importExamsFromExcel(pendingFile, pillar);
      setImportResult(result);
      if (result.errors.length === 0) {
        toast.success(`Import complete: ${result.created} created, ${result.updated} updated`);
      } else {
        toast.warning(`Import done with ${result.errors.length} errors. Check details below.`);
      }
      onImportComplete?.();
    } catch (err) {
      toast.error("Import failed: " + getErrorMessage(err));
    } finally {
      setImporting(false);
      setPreview(null);
      setPendingFile(null);
      setConfirmText("");
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setPendingFile(null);
    setConfirmText("");
  };

  const handleDownloadTemplate = () => {
    downloadImportTemplate(pillar, pillarLabel);
    toast.success("Template downloaded — fill it out and import");
  };

  const gs = preview?.guardSummary;
  const confirmOk = preview && (!preview.requiresConfirm || confirmText.trim().toUpperCase() === "CONFIRM");

  return (
    <div className="space-y-3">
      {/* Buttons row */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Export Excel
        </button>

        <button
          type="button"
          onClick={handleImportClick}
          disabled={importing || previewing}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {previewing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Import Excel
        </button>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors"
        >
          <FileSpreadsheet size={14} />
          Download Template
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* ── Preview / confirm panel (dry-run result; nothing written yet) ── */}
      {preview && (
        <div className="rounded-md border border-slate-300 bg-white p-4 text-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">
              Import preview — {preview.totalRows} row{preview.totalRows === 1 ? "" : "s"} (nothing has been written yet)
            </span>
            <button type="button" onClick={handleCancel} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={16} />
            </button>
          </div>

          {/* Block 1 (FIRST): new editions — archives current cycles. Most destructive. */}
          {preview.newEditions.length > 0 && (
            <div className="rounded border border-red-300 bg-red-50 p-3">
              <div className="flex items-center gap-2 font-semibold text-red-800 mb-2">
                <Archive size={15} />
                {preview.newEditions.length} row{preview.newEditions.length === 1 ? "" : "s"} will create NEW EDITIONS — the current edition of each will be ARCHIVED and disappear from the live page
              </div>
              <ul className="space-y-1 text-red-700">
                {preview.newEditions.map((ne) => (
                  <li key={ne.slug}>
                    • <span className="font-medium">{ne.name}</span> — current cycle {ne.fromYear ?? "?"} archived, new cycle {ne.toYear ?? "?"} created
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Block 2: other destructive changes — field clears + date-state changes. */}
          {gs && (gs.rowsClearingFields > 0 || gs.rowsChangingDateState > 0 || gs.urlsNotNormalized > 0) && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-2 font-semibold text-amber-800 mb-2">
                <AlertTriangle size={15} /> Destructive changes
              </div>
              <ul className="space-y-1 text-amber-800">
                {gs.rowsChangingDateState > 0 && <li>• {gs.rowsChangingDateState} row(s) will change a date's state — see transitions below</li>}
                {gs.rowsClearingFields > 0 && <li>• {gs.rowsClearingFields} row(s) will CLEAR an existing field (blank cell overwrites)</li>}
                {gs.urlsNotNormalized > 0 && <li>• {gs.urlsNotNormalized} URL(s) will be written un-normalized</li>}
              </ul>
              {/* Explicit per-row date-state transitions — the line to act on. */}
              <div className="mt-2 space-y-1">
                {preview.rows.flatMap((r) =>
                  r.dateStateChanges.map((c, i) => (
                    <div key={`${r.slug}-${i}`} className="text-amber-900">
                      {r.name} — {c.label}: <span className="font-medium">{c.fromState ?? "(none)"} → {c.toState}</span>
                    </div>
                  ))
                )}
                {preview.rows.filter((r) => r.droppedDateTypes.length > 0).map((r) => (
                  <div key={`${r.slug}-drop`} className="text-amber-900">
                    {r.name} — will DROP existing date types: {r.droppedDateTypes.join(", ")}
                  </div>
                ))}
                {preview.rows.filter((r) => r.fieldsCleared.length > 0).map((r) => (
                  <div key={`${r.slug}-clear`} className="text-amber-900">
                    {r.name} — will clear: {r.fieldsCleared.join(", ")}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Block 3: routine, additive counts. */}
          <div className="flex flex-wrap gap-4 text-slate-600">
            <span>{preview.createExam} new exam(s)</span>
            <span>{preview.updateEdition} edition update(s)</span>
            {preview.skip > 0 && <span>{preview.skip} skipped</span>}
          </div>

          {/* Confirm / cancel */}
          <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
            {preview.requiresConfirm ? (
              <>
                <span className="text-slate-700">
                  This import includes destructive changes. Type <span className="font-mono font-semibold">CONFIRM</span> to proceed:
                </span>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CONFIRM"
                  className="rounded border border-slate-300 px-2 py-1 text-sm w-32"
                />
              </>
            ) : (
              <span className="text-slate-600">All changes are additive — safe to apply.</span>
            )}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!confirmOk || importing}
                className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Apply import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import results */}
      {importResult && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {importResult.errors.length === 0 ? (
                <CheckCircle2 size={16} className="text-green-600" />
              ) : (
                <AlertCircle size={16} className="text-amber-600" />
              )}
              <span className="font-medium text-slate-700">
                Import Results: {importResult.created} created, {importResult.updated} updated
                {importResult.errors.length > 0 && `, ${importResult.errors.length} errors`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setImportResult(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={14} />
            </button>
          </div>

          {importResult.errors.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {importResult.errors.map((err, i) => (
                <div key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                  Row {err.row} ({err.name}): {err.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
