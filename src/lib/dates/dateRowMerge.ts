/**
 * dateRowMerge.ts — S2.5: match and update, never duplicate.
 *
 * One record per cycle, many notices (design doc "Domain reference", §15):
 * every later notice must ADD to the edition timeline, not overwrite it and
 * not create a twin row. The rules, in order:
 *
 *  1. BLANK STANDARD SLOT — a proposed row whose label matches an existing
 *     blank row fills it (overlay; existing metadata survives via spread).
 *  2. TRUE DUPLICATE — same kind AND same date window (and neither is an
 *     extension) → untouched. The row already exists; no twin is written.
 *  3. EXTENSION (kind "extension") — NEVER overwrites the earlier row. The
 *     new row is APPENDED carrying `supersedes: { label, date }` pointing at
 *     the most recent same-type row it replaces (the owner's "revision shown
 *     as Extended", domain ref (b)).
 *  4. NEW DATED EVENT — a Phase-3 choice filling next to a Phase-2 one is a
 *     different event: append. Earlier rows are KEPT (the site shows them as
 *     past; S3 renders the done markers — the stored data never lies).
 *
 * Pure + generic over the row shape so both the editor (DateRow) and the
 * golden test can use it.
 */

export interface MergeableRow {
  label: string;
  date: string;
  type?: string;
  kind?: string;
  end_date?: string;
  [key: string]: unknown;
}

export interface MergeResult<T> {
  rows: T[];
  filled: number;      // blank standard slots that received a date
  added: number;       // genuinely new rows appended (incl. extensions)
  duplicatesIgnored: number;
  superseding: number; // appended rows that carry a supersedes link
}

const norm = (s: string | undefined | null): string => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** True when two rows describe the very same event occurrence. */
function sameOccurrence(a: MergeableRow, b: MergeableRow): boolean {
  if (a.kind && b.kind && a.kind === "extension") return false; // extension ≠ the row it extends
  if (b.kind && a.kind && b.kind === "extension") return false;
  const sameWindow = a.date === b.date && (a.end_date ?? "") === (b.end_date ?? "");
  if (a.kind && b.kind) return a.kind === b.kind && sameWindow;
  return norm(a.label) === norm(b.label) && sameWindow;
}

/**
 * Merge PROPOSED rows (already accepted in the review drawer) into EXISTING
 * edition rows. Returns the new array + counts for the honest toast/report.
 * Existing rows are never mutated or removed; proposed rows are spread whole.
 */
export function mergeAcceptedDateRows<T extends MergeableRow>(existing: T[], proposed: T[]): MergeResult<T> {
  const rows = [...existing];
  let filled = 0;
  let added = 0;
  let duplicatesIgnored = 0;
  let superseding = 0;

  for (const p of proposed) {
    // 1. Fill a blank standard slot by label (never by index — order can move).
    const blankIdx = rows.findIndex(
      (d) => (!d.date || String(d.date).trim() === "") && norm(d.label) === norm(p.label),
    );
    if (blankIdx >= 0) {
      rows[blankIdx] = { ...rows[blankIdx], ...p, type: rows[blankIdx].type ?? p.type, kind: rows[blankIdx].kind ?? p.kind };
      filled++;
      continue;
    }

    // 2. Same occurrence already on the timeline → ignore (no duplicate twin).
    if (rows.some((d) => d.date && sameOccurrence(d, p))) {
      duplicatesIgnored++;
      continue;
    }

    // 3. Extension → append WITH a supersedes link to the row it replaces.
    if (p.kind === "extension") {
      const replaced = pickSuperseded(rows, p);
      const row = replaced ? { ...p, supersedes: { label: replaced.label, date: replaced.date } } : { ...p };
      rows.push(row as T);
      added++;
      if (replaced) superseding++;
      continue;
    }

    // 4. New dated event → append; earlier rows stay.
    rows.push({ ...p } as T);
    added++;
  }

  return { rows, filled, added, duplicatesIgnored, superseding };
}

/**
 * The row an extension replaces: the most recently DATED row of the same
 * coarse type (the extended deadline) — INCLUDING a prior extension row, so
 * chained extensions supersede in order (8 Jul ← 3 Aug ← later news).
 * ISO dates compare lexicographically. Returns null when nothing plausible
 * precedes it.
 */
export function pickSuperseded<T extends MergeableRow>(rows: T[], extension: T): T | null {
  let best: T | null = null;
  for (const d of rows) {
    if (!d.date) continue;
    if (d.date >= extension.date) continue;          // must be the EARLIER deadline
    if (extension.type && d.type && d.type !== extension.type) continue;
    if (!best || d.date > best.date) best = d;
  }
  return best;
}
