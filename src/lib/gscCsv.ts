/**
 * gscCsv.ts — parser for the Google Search Console "Performance → Pages" CSV
 * export (the exact format sample-checked in
 * docs/seo/gsc-pages-2026-09-27.csv):
 *
 *   url,host,path,clicks,impressions,ctr,position
 *
 * The loader only needs page (url), clicks and impressions; the remaining
 * columns are ignored. Parsing is RFC-4180-correct (quoted cells may contain
 * commas — GSC quotes any cell that needs it — and doubled quotes escape
 * inside a quoted cell; both \n and \r\n line endings are handled). Numeric
 * cells may arrive quoted with thousands separators ("1,234") and are parsed
 * accordingly.
 *
 * Pure module: no browser/Supabase imports, unit-tested against the real
 * export in gscCsv.test.ts.
 */

export interface GscPageRow {
  /** The page URL exactly as exported (scheme + host included). */
  url: string;
  clicks: number;
  impressions: number;
}

export interface ParsedGscCsv {
  rows: GscPageRow[];
  /** Data lines that were malformed (missing url or non-numeric metrics). */
  skipped: number;
}

export class GscCsvError extends Error {}

/** Split one CSV text into rows of cells (RFC 4180: quotes, , and CRLF). */
export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;

  const endField = () => { record.push(field); field = ''; };
  const endRecord = () => { endField(); records.push(record); record = []; };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }  // "" escape
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { endField(); i += 1; continue; }
    if (ch === '\r') {
      // CRLF or lone CR ends the record
      if (text[i + 1] === '\n') i += 1;
      endRecord(); i += 1; continue;
    }
    if (ch === '\n') { endRecord(); i += 1; continue; }
    field += ch; i += 1;
  }
  // flush a trailing record not ended by a newline
  if (field !== '' || record.length > 0) endRecord();

  return records;
}

/** "1,234" / " 186 " -> 186; anything non-numeric -> null. */
function toInt(cell: string | undefined): number | null {
  if (cell === undefined) return null;
  const cleaned = cell.trim().replace(/,/g, '');
  if (cleaned === '' || !/^-?\d+$/.test(cleaned)) return null;
  return parseInt(cleaned, 10);
}

/**
 * Parse a GSC Performance→Pages export. Throws GscCsvError when the header is
 * missing/foreign; silently ignores extra columns; counts malformed data lines
 * as `skipped` rather than failing the whole import.
 */
export function parseGscPagesCsv(text: string): ParsedGscCsv {
  const records = parseCsvRecords(text).filter(
    (r) => r.some((c) => c.trim() !== ''),   // drop blank lines
  );
  if (records.length === 0) throw new GscCsvError('CSV is empty.');

  const header = records[0].map((h) => h.trim().toLowerCase().replace(/^/, ''));
  const idxUrl = header.indexOf('url');
  const idxClicks = header.indexOf('clicks');
  const idxImpr = header.indexOf('impressions');
  if (idxUrl === -1 || idxClicks === -1 || idxImpr === -1) {
    throw new GscCsvError(
      'Not a Search Console Pages export: header must contain url, clicks and impressions ' +
      `(got: ${header.join(', ') || 'nothing'}).`,
    );
  }

  const rows: GscPageRow[] = [];
  let skipped = 0;
  for (const rec of records.slice(1)) {
    const url = (rec[idxUrl] ?? '').trim();
    const clicks = toInt(rec[idxClicks]);
    const impressions = toInt(rec[idxImpr]);
    if (!url || clicks === null || impressions === null) { skipped += 1; continue; }
    rows.push({ url, clicks, impressions });
  }
  return { rows, skipped };
}
