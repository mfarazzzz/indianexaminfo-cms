/**
 * BulkImportExport — Shared component for bulk Excel import/export.
 * Used across all pillar list pages: entrance exams, govt exams, board exams, etc.
 */
import React, { useRef, useState } from "react";
import { Download, Upload, FileSpreadsheet, Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { exportExamsToExcel, importExamsFromExcel, downloadImportTemplate, type ImportResult } from "@/lib/utils/excelBulkOps";
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
  const [importing, setImporting] = useState(false);
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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast.error("Please upload an Excel file (.xlsx, .xls) or CSV (.csv)");
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const result = await importExamsFromExcel(file, pillar);
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
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    downloadImportTemplate(pillar, pillarLabel);
    toast.success("Template downloaded — fill it out and import");
  };

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
          disabled={importing}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
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

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

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
