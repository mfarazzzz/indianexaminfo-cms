/**
 * noticeDateLines.ts — S2.15 deterministic date-line extraction.
 *
 * The reliability fix: an "Important Dates" block in a pasted notice is regular
 * "Label: date(s)" text. We parse it OURSELF, straight from the source, so a
 * flaky / low-yield model answer cannot silently drop a date (the UPSSSC PET
 * case: "Revised PET Written Exam Dates: 25, 30 October 2026 & 01 November 2026"
 * came back as ONE row). These rows are independent of the AI; when merged, a
 * deterministic row always WINS over a model row for the same date + type.
 *
 * Rules kept conservative and pure (no network, no DOM):
 *  • one row per calendar date; a multi-date list ("25, 30 Oct & 1 Nov",
 *    "25-27 Oct", "25 & 26 October") expands to separate rows;
 *  • a bare day inherits the month/year of the next dated token in the line;
 *  • a line whose value carries no date but reads as relative / to-be-notified
 *    ("After Exam", "Exam Date Out") becomes a NOTE, never a dated row;
 *  • CONFLICT (2b): when two lines claim the same VIEW type with different
 *    dates, the one that says revised/rescheduled/postponed/new/changed OR sits
 *    in the dated block wins; the loser's dates are NOT proposed and a visible
 *    conflict warning is produced. We never silently pick.
 */
import { normalizeLabel, typeForKind, type DateEventKind } from "@/lib/dates/normalizeLabel";
import { parseDateText } from "@/lib/utils/indianDateParser";
import type { PipelineDateRow, PipelineNote } from "@/lib/ai/noticePipeline";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A value that means "a date exists but is not fixed yet" — a note, not a row. */
const RELATIVE_VALUE = /after\s+(the\s+)?exam|to\s*be\s*(announced|declared|notified|released|updated)|\btbn\b|\btba\b|will\s*be|\bout\b|tentative|notified\s*soon|subject\s*to/i;

/** A line label that is a heading, not a date ("Important Dates", "Exam Details"). */
const DATED_BLOCK_HEADING = /^\s*(?:important|key|critical|significant)\s*dates?\s*:?\s*$/i;
const BLOCK_END_HEADING = /^\s*(?:exam\s*details|eligibility|application\s*fee|fee\s*structure|selection\s*(process|procedure)|how\s*to|important\s*links|useful\s*links|some\s*(?:useful|important)|trending|notes?\b|document[s]?\s*(required|list)|vacancy|age\s*limit|admit\s*card\s*(details)?\s*$)/i;

/** The notice's OWN issue/reference line — provenance, never an exam date. */
const ISSUE_LINE = /^\s*(?:post\s*date|date\s*(?:of\s*)?(?:post|publish)|updated\s*(?:on|date)?|published\s*(?:on|date)?|last\s*updated|reference|ref\.?\s*no|notice\s*(?:no|date))\b/i;

/**
 * Expand a date VALUE into individual ISO calendar dates (sorted, unique).
 * Handles discrete lists, "&"/"and"/"और", a bare-day that inherits the next
 * token's month/year, and a "D-D Month Year" day range.
 */
export function parseDateList(value: string, year?: number): string[] {
  if (!value) return [];
  const normalized = value
    .replace(/&/g, ",")
    .replace(/\band\b/gi, ",")
    .replace(/और/g, ",");
  const tokens = normalized.split(/[,;]/).map((t) => t.trim()).filter(Boolean);

  const out = new Set<string>();
  let pendingDays: number[] = [];

  for (const tok of tokens) {
    // "25-27 Oct 2026" / "25–27 October" — a day range within one month.
    const range = tok.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(.+)$/);
    if (range) {
      const from = parseInt(range[1], 10);
      const to = parseInt(range[2], 10);
      const anchor = parseDateText(`1 ${range[3]}`, year); // any day → gives YYYY-MM
      if (anchor && from >= 1 && to >= from && to - from <= 40) {
        const [y, m] = anchor.split("-");
        for (let d = from; d <= to; d++) out.add(`${y}-${m}-${String(d).padStart(2, "0")}`);
        pendingDays = [];
        continue;
      }
    }
    // A bare day ("25") — hold it; it inherits the NEXT token's month/year.
    if (/^\d{1,2}$/.test(tok)) {
      const d = parseInt(tok, 10);
      if (d >= 1 && d <= 31) pendingDays.push(d);
      continue;
    }
    const iso = parseDateText(tok, year) || (!/\d{4}/.test(tok) && year ? parseDateText(`${tok} ${year}`, year) : "");
    if (!iso) continue;
    // Resolve any held bare days against THIS token's month/year, then the date.
    const [y, m] = iso.split("-");
    for (const d of pendingDays) out.add(`${y}-${m}-${String(d).padStart(2, "0")}`);
    pendingDays = [];
    out.add(iso);
  }

  return Array.from(out).filter(Boolean).sort();
}

/** Derive a date-line kind, correcting the bare-"PET" acronym trap: a written
 *  exam line that normalizeLabel typed exam_physical only because the exam is
 *  nicknamed "PET" is really the WRITTEN paper. */
function kindForLine(label: string): { kind: DateEventKind; type: string } {
  const norm = normalizeLabel(label);
  let kind = norm.kind;
  if (kind === "exam_physical" && !/\bphysical\b|\bpet\s*(test|running|rally)\b/i.test(label)) {
    kind = "exam_written";
  }
  return { kind, type: typeForKind(kind, undefined) };
}

const fmtDay = (iso: string): string => {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${MON[parseInt(m, 10) - 1]}`;
};
const fmtList = (dates: string[]): string => {
  if (dates.length === 0) return "";
  if (dates.length === 1) return fmtDay(dates[0]);
  return `${dates.slice(0, -1).map(fmtDay).join(", ")} & ${fmtDay(dates[dates.length - 1])}`;
};

export interface NoticeLineResult {
  rows: PipelineDateRow[];
  notes: PipelineNote[];
  /** Human conflict lines (2b): what was overridden and why. */
  conflicts: string[];
}

/**
 * Parse every "Label: date(s)" line of the pasted notice into deterministic rows
 * (source = "notice-line"), applying the conflict rule so a header/summary line
 * never fights the dated block.
 */
export function extractNoticeDateLines(sourceText: string, year: number, selectionModel?: string | null): NoticeLineResult {
  const lines = sourceText.replace(/\r\n/g, "\n").split("\n");
  interface Cand { label: string; dates: string[]; kind: DateEventKind; type: string; line: string; inBlock: boolean; isRevision: boolean; order: number; }
  const candidates: Cand[] = [];
  const notes: PipelineNote[] = [];
  let inBlock = false;

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    if (DATED_BLOCK_HEADING.test(line)) { inBlock = true; return; }
    if (BLOCK_END_HEADING.test(line)) { inBlock = false; return; }

    // A line may carry two "label: value" pairs separated by "|".
    for (const seg of line.split("|")) {
      const m = seg.match(/^\s*([^:]{3,60}?)\s*[:\-–]\s*(.+)$/);
      if (!m) continue;
      const label = m[1].replace(/\s+/g, " ").trim();
      const value = m[2].replace(/\s+/g, " ").trim();
      if (!label || ISSUE_LINE.test(label)) continue;
      if (value.length > 60) continue; // long prose (a "Short Information" paragraph) is not a date line

      const dates = parseDateList(value, year);
      if (dates.length === 0) {
        if (RELATIVE_VALUE.test(value)) notes.push({ text: `${label}: ${value}`, sourceQuote: line });
        continue;
      }
      const { kind, type } = kindForLine(label);
      const isRevision = /revis|reschedul|postpon|\bnew\b|chang/i.test(label + " " + value);
      candidates.push({ label, dates, kind, type, line, inBlock, isRevision, order: idx });
    }
  });

  // 2b — resolve conflicts per VIEW type: winner = revision, else in-block,
  // else more dates, else later line. Losers are dropped with a warning.
  const byType = new Map<string, Cand[]>();
  for (const c of candidates) (byType.get(c.type) ?? byType.set(c.type, []).get(c.type)!).push(c);

  const conflicts: string[] = [];
  const winners: Cand[] = [];
  for (const [, group] of byType) {
    if (group.length === 1) { winners.push(group[0]); continue; }
    const rank = (c: Cand): number => (c.isRevision ? 8 : 0) + (c.inBlock ? 4 : 0) + (c.dates.length >= 2 ? 2 : 0) + (c.order % 2);
    group.sort((a, b) => rank(b) - rank(a));
    const win = group[0];
    const distinct = group.filter((c) => c.dates.join(",") !== win.dates.join(","));
    if (distinct.length > 0) {
      const losers = distinct.map((c) => c);
      conflicts.push(`${losers.map((l) => `${l.label} (${fmtList(l.dates)})`).join("; ")} overridden by ${win.label} (${fmtList(win.dates)}) — using the revised / block dates`);
    }
    winners.push(win);
  }

  const rows: PipelineDateRow[] = [];
  for (const w of winners) {
    const type = typeForKind(w.kind, selectionModel);
    w.dates.forEach((date) => {
      rows.push({
        label: w.dates.length > 1 ? `${w.label} (${fmtDay(date)})` : w.label,
        date,
        type,
        kind: w.kind,
        isUrgent: type === "application_start" || type === "application_end",
        state: "confirmed",
        verified: false,
        source_quote: w.line,
        confidence: 1,
        source: "notice-line",
      });
    });
  }
  return { rows, notes, conflicts };
}

/**
 * Merge model rows with deterministic rows — union, de-duplicated by
 * date + VIEW type; a deterministic row is never overridden by a model row.
 */
export function mergeNoticeRows(modelRows: PipelineDateRow[], detRows: PipelineDateRow[]): PipelineDateRow[] {
  const byKey = new Map<string, PipelineDateRow>();
  for (const r of detRows) byKey.set(`${r.date}::${r.type}`, r);
  for (const r of modelRows) {
    const k = `${r.date}::${r.type}`;
    if (!byKey.has(k)) byKey.set(k, r); // deterministic wins on collision
  }
  return Array.from(byKey.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** An existing timeline row, minimally shaped for the supersede / slot logic. */
export interface ExistingRow { label: string; date: string; type?: string; kind?: string; verified?: boolean; state?: string }

/** The VIEW types that count as an "exam window" — a revision of these supersedes. */
const EXAM_WINDOW_TYPES = new Set(["exam_written", "exam_practical", "exam_physical"]);

/**
 * 2c — revision supersede. A revised exam window (written/practical/physical) is
 * ONE family: when the notice restates the exam date(s), an EXISTING row of any
 * exam-window type whose date is not in the new set is a removal candidate —
 * default-checked only when it was system-seeded / not human-verified; a
 * human-confirmed row needs an explicit tick. Rows already carrying a new date
 * are left alone.
 */
export function supersedeCandidates(existing: ExistingRow[], detRows: PipelineDateRow[]): { row: ExistingRow; replacedBy: string[]; defaultRemove: boolean }[] {
  const out: { row: ExistingRow; replacedBy: string[]; defaultRemove: boolean }[] = [];
  const newExamDates = new Set(detRows.filter((r) => EXAM_WINDOW_TYPES.has(r.type)).map((r) => r.date));
  if (newExamDates.size === 0) return out;
  const replacedBy = Array.from(newExamDates).sort();
  for (const row of existing) {
    if (!EXAM_WINDOW_TYPES.has(row.type ?? "")) continue;
    if (newExamDates.has(row.date)) continue; // already carries a current exam date
    out.push({ row, replacedBy, defaultRemove: !row.verified });
  }
  return out;
}

/** The drawer's full apply-plan for the deterministic rows against the record's
 *  existing timeline — what will be treated as already-present, what fills an
 *  empty standard slot, what is a genuinely new row, and what a revision
 *  supersedes. Pure; the editor renders this. Matches the form's "never
 *  duplicate a date already on the timeline" rule (keyed on the date). */
export interface DateMergePlan {
  alreadyPresent: PipelineDateRow[];
  fillSlots: { row: PipelineDateRow; slotIndex: number }[];
  addCustom: PipelineDateRow[];
  supersede: { row: ExistingRow; replacedBy: string[]; defaultRemove: boolean }[];
}
export function planDateMerge(existing: ExistingRow[], detRows: PipelineDateRow[]): DateMergePlan {
  const existingDates = new Set(existing.map((r) => r.date).filter(Boolean));
  const emptySlotByType = new Map<string, number>();
  existing.forEach((r, i) => {
    if (!r.date && r.type && !emptySlotByType.has(r.type)) emptySlotByType.set(r.type, i);
  });
  const plan: DateMergePlan = { alreadyPresent: [], fillSlots: [], addCustom: [], supersede: supersedeCandidates(existing, detRows) };
  for (const row of detRows) {
    if (existingDates.has(row.date)) { plan.alreadyPresent.push(row); continue; }
    const slot = emptySlotByType.get(row.type);
    if (slot !== undefined) { emptySlotByType.delete(row.type); plan.fillSlots.push({ row, slotIndex: slot }); }
    else plan.addCustom.push(row);
  }
  return plan;
}

/**
 * 2d — slot filling. An incoming row whose VIEW type matches an EXISTING EMPTY
 * standard slot fills that slot (returns its index) instead of adding a custom
 * row. Only when no empty slot of that type exists is it a new custom row
 * (index null). "Empty" = the existing row has no date yet.
 */
export function planSlotFill(incoming: PipelineDateRow[], existing: { type?: string; date?: string; label: string }[]): { date: string; type: string; slotIndex: number | null }[] {
  // Index the first empty (date-less) slot per type; once used it is no longer empty.
  const emptySlotByType = new Map<string, number>();
  existing.forEach((r, i) => {
    if (!r.date && r.type && !emptySlotByType.has(r.type)) emptySlotByType.set(r.type, i);
  });
  return incoming.map((r) => {
    const slot = emptySlotByType.get(r.type);
    if (slot === undefined) return { date: r.date, type: r.type, slotIndex: null };
    emptySlotByType.delete(r.type); // one fill per empty slot; later dates go custom
    return { date: r.date, type: r.type, slotIndex: slot };
  });
}
