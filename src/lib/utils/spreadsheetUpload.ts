/**
 * spreadsheetUpload.ts — the gate in front of XLSX.read (owner batch 6, Phase X2).
 *
 * WHY. Bulk import parses a file someone else made. Two call sites do it —
 * `importExamsFromExcel` and `previewImportFromExcel` — and before this module both went
 * straight to `XLSX.read(await file.arrayBuffer(), { type: "array" })` with no size bound, no
 * row bound and no check that the bytes match the extension. The SheetJS advisories that have no
 * npm fix (prototype pollution, ReDoS) are reachable through exactly that call, and a large or
 * malformed workbook is also just a hang: the parse is synchronous, so it blocks the tab.
 *
 * THE ORDER MATTERS. Cheap checks first, and nothing that costs memory before the checks that
 * cost nothing:
 *   1. extension allow-list           (no reads)
 *   2. declared file size             (no reads)
 *   3. read the bytes, re-check length (the declared size is not trustworthy)
 *   4. magic bytes → the real format, and it must AGREE with the extension
 *   5. parse (wrapped, with a clear message)
 *   6. row count from the sheet's !ref, BEFORE sheet_to_json materialises the rows
 *
 * WHAT THIS DOES NOT DO. It cannot move the parse off the main thread; a 5 MB workbook still
 * occupies the tab while SheetJS reads it. The cap bounds the worst case rather than removing it.
 * A worker (the `xlsxworker.js` the vendored package ships) is the next step if that ever matters.
 */
import * as XLSX from "xlsx";

/** Largest file accepted, in bytes. A real exam sheet is a few hundred KB. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Most data rows accepted. Above this the sheet is not an exam list, it is a dump. */
export const MAX_IMPORT_ROWS = 5_000;

/** What the file picker accepts, kept in one place so the UI and the guard cannot drift. */
export const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;

export type SpreadsheetKind = "xlsx" | "xls" | "csv";

export interface ParsedUpload {
  kind: SpreadsheetKind;
  fileName: string;
  bytes: number;
  /** Sheet name the rows came from — the first non-empty one. */
  sheetName: string;
  /** Row count from the sheet range, INCLUDING the header row. */
  rowCount: number;
  /** rowCount minus the header — the rows an import would actually process. */
  dataRows: number;
  /** Header-mapped objects, exactly what `sheet_to_json` returns. */
  rows: Record<string, unknown>[];
}

/** Every rejection is a plain Error with a sentence a staff member can act on. */
function reject(detail: string): never {
  throw new Error(detail);
}

function extensionOf(name: string): string {
  const dot = name.toLowerCase().lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];                      // PK\x03\x04  (.xlsx is a zip)
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .xls container

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((b, i) => bytes[i] === b);
}

/**
 * detectKind — what the BYTES say, independent of the name. `csv` is the fallback for anything
 * that is neither container, which is then validated as text before it is parsed.
 */
export function detectKind(bytes: Uint8Array): SpreadsheetKind | "unknown" {
  if (startsWith(bytes, ZIP_MAGIC)) return "xlsx";
  if (startsWith(bytes, OLE2_MAGIC)) return "xls";
  return "csv";
}

/** A CSV is text: a NUL byte in the first 8 KB means it is not a CSV pretending to be one. */
function assertLooksLikeText(bytes: Uint8Array): void {
  const window = Math.min(bytes.length, 8192);
  for (let i = 0; i < window; i++) if (bytes[i] === 0x00) {
    reject("This file is not a readable spreadsheet — it contains binary data where text was expected. Export it again as .xlsx or .csv.");
  }
}

/**
 * readSpreadsheetUpload — the only sanctioned way to hand an uploaded file to SheetJS.
 *
 * @param file the File from the picker
 * @param limits overridable for tests; production uses the exported constants
 */
export async function readSpreadsheetUpload(
  file: File,
  limits: { maxBytes?: number; maxRows?: number } = {},
): Promise<ParsedUpload> {
  const maxBytes = limits.maxBytes ?? MAX_UPLOAD_BYTES;
  const maxRows = limits.maxRows ?? MAX_IMPORT_ROWS;

  // 1. extension
  const ext = extensionOf(file.name ?? "");
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    reject(`Unsupported file type "${ext || "(no extension)"}". Import an .xlsx, .xls or .csv file exported from this CMS or from Excel.`);
  }

  // 2. declared size — before any read
  if (typeof file.size === "number" && file.size > maxBytes) {
    reject(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB, and imports are limited to ${(maxBytes / 1024 / 1024).toFixed(0)} MB. Remove rows you are not importing and try again.`);
  }

  // 3. bytes, then the same check on what was really read
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength > maxBytes) {
    reject(`That file is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB once read, and imports are limited to ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);
  }
  if (bytes.byteLength === 0) reject("The file is empty.");

  // 4. container vs name
  const kind = detectKind(bytes);
  if (kind === "unknown") reject("This file is not a spreadsheet.");
  if (kind === "csv" && ext === ".csv") assertLooksLikeText(bytes);
  if (kind !== "csv" && ext === ".csv") {
    reject(`"${file.name}" has a .csv name but its contents are a ${kind === "xlsx" ? "modern .xlsx workbook" : "legacy .xls workbook"}. Rename it to the right extension or re-export it — a .csv file must contain plain text.`);
  }
  if (kind === "csv" && ext !== ".csv") {
    reject(`"${file.name}" is named ${ext} but its contents are plain text. Save it as .csv, or export it from Excel as .xlsx.`);
  }
  if (ext !== ".csv" && kind !== ext.replace(".", "")) {
    reject(`"${file.name}" claims to be ${ext} but the file is a ${kind} workbook.`);
  }

  // 5. parse
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array" });
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    reject(`Could not open "${file.name}" as a spreadsheet (${why}). Re-export it from Excel and try again.`);
  }

  // first sheet that actually has cells
  const sheetName = wb.SheetNames.find((n) => {
    const ws = wb.Sheets[n];
    return ws && ws["!ref"];
  });
  if (!sheetName) reject("Empty spreadsheet — no sheet found.");
  const ws = wb.Sheets[sheetName]!;

  // 6. bound the rows from the range BEFORE materialising them. The cap is on DATA rows, which is
  // what an import processes; the range also counts the header row, so it is subtracted here.
  const range = XLSX.utils.decode_range(ws["!ref"] as string);
  const rowCount = range.e.r - range.s.r + 1;
  const dataRows = Math.max(0, rowCount - 1);
  if (dataRows > maxRows) {
    reject(`That sheet has ${dataRows.toLocaleString("en-IN")} data rows and imports are limited to ${maxRows.toLocaleString("en-IN")}. Split it into smaller sheets — one per region or month is usually right.`);
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  if (rows.length === 0) reject("No data rows found in the spreadsheet.");

  return { kind, fileName: file.name, bytes: bytes.byteLength, sheetName, rowCount, dataRows, rows };
}
