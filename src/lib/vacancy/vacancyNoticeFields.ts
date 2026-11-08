/**
 * vacancyNoticeFields.ts — DETERMINISTIC field proposals for a pasted job notice.
 *
 * The owner-approved rule for this platform: FACTS in OUR words, never the notice's
 * prose. So nothing here writes to the record by itself. Every value this module
 * produces is a PROPOSAL that the editor accepts or edits, and every proposal
 * carries the SOURCE LINE it came from, so the editor can check the fact against
 * the notice without guessing.
 *
 * WHAT IS DETERMINISTIC HERE (no model, no network, no OCR, no URL fetching):
 *   • the three window dates — the notice's own "Label: date" lines, parsed by the
 *     SHARED extractor (extractNoticeDateLines) so the CMS has ONE date parser;
 *   • the vacancy count — a number on a line that names posts/vacancies;
 *   • the fee — category → amount pairs, amounts only (never the notice's wording);
 *   • the age limit — a composed "18-32 years" string, never the notice's sentence;
 *   • the title — the notice's own first line (see the copy-guard note below).
 *
 * THE COPY GUARD (isTooCloseToSource, the SAME one the entrance-exam pipeline uses)
 * runs on EVERY proposal, and each proposal carries the guard's VERDICT so the
 * editor can see what happened:
 *   "data"        — the value is composed from facts (a date, a count, a category →
 *                   amount map, a min-max range). There is no wording to copy, so
 *                   the guard has nothing to compare — this is a RECORDED decision,
 *                   not a skipped check.
 *   "name-exempt" — the value is a factual NAME (the document's title, a body's
 *                   name). A title is the name of a public document and an
 *                   organisation is its proper name; neither is copyrightable
 *                   expression, and the platform must name them accurately to be
 *                   findable. A name that reads like a SENTENCE (five words or
 *                   more) is NOT exempt — it goes through the guard.
 *   "passed"      — the value is wording, the guard compared it with the source
 *                   line, and it is far enough from the notice's own words.
 *   "refused"     — the value is wording and too close to the notice's own words.
 *                   It is NOT proposed: the editor is told why and writes their own.
 */

import { extractNoticeDateLines, parseDateList } from "@/lib/ai/noticeDateLines";
import { isTooCloseToSource } from "@/lib/ai/noticeSteps";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VacancyFieldKey =
  | "notificationDate"
  | "applicationStartDate"
  | "applicationEndDate"
  | "vacancyCount"
  | "applicationFee"
  | "ageLimit"
  | "title"
  | "organization";

export type VacancyFieldKind = "date" | "number" | "text" | "json";

/** What the copy guard decided about a proposed value. */
export type GuardVerdict = "data" | "name-exempt" | "passed" | "refused";

export interface VacancyProposal {
  field: VacancyFieldKey;
  /** Human label of the field the proposal would fill. */
  label: string;
  /** The proposed value, ready for the form (null when nothing could be found). */
  value: string | number | Record<string, string> | null;
  /** The value rendered for the UI (a JSON blob is flattened). */
  display: string;
  /** THE SOURCE LINE — the verbatim notice line the proposal came from. */
  sourceLine: string;
  kind: VacancyFieldKind;
  /** The copy guard's verdict for this value. */
  guard: GuardVerdict;
  /** Why a value was NOT proposed (the copy guard refused it). */
  refused?: string;
}

export interface VacancyExtraction {
  proposals: VacancyProposal[];
  /** Notices: a relative date ("To be notified"), a date we did not use. */
  notes: string[];
  /** Two lines claimed the same slot — the winner is stated. */
  conflicts: string[];
  /** Lines that carried a date but matched no window slot (shown for transparency). */
  unmatched: string[];
}

export interface ExtractVacancyOptions {
  /** The cycle year used to complete a date that carries no year. */
  year?: number;
}

// ── Field labels ──────────────────────────────────────────────────────────────

export const VACANCY_FIELD_LABELS: Record<VacancyFieldKey, string> = {
  notificationDate: "Notification date",
  applicationStartDate: "Application start",
  applicationEndDate: "Last date to apply",
  vacancyCount: "Total posts",
  applicationFee: "Application fee",
  ageLimit: "Age limit",
  title: "Title",
  organization: "Organisation",
};

/** A name with this many words or more reads like a sentence, not a name. */
const NAME_MAX_WORDS = 4;

// ── Date slots ───────────────────────────────────────────────────────────────

type DateSlot = "notification" | "application_start" | "application_end";

interface DateCandidate {
  date: string;
  sourceLine: string;
  label: string;
  /** A revision ("Revised last date", "Extended") beats a plain line. */
  revision: boolean;
  order: number;
}

/** The notice's own issue line is provenance, never a date slot. */
const ISSUE_LINE = /^\s*(?:post\s*date|date\s*(?:of\s*)?(?:post|publish)|updated\s*(?:on|date)?|published\s*(?:on|date)?|last\s*updated|reference|ref\.?\s*no|notice\s*(?:no|date))/i;
/** A fee deadline is not the application deadline. */
const FEE_LABEL = /fee|payment|charges?/i;

/** Classify a notice label into one of the three window slots (or null). */
export function classifyVacancyDateLabel(label: string): DateSlot | null {
  const l = (label ?? "").trim();
  if (!l || ISSUE_LINE.test(l)) return null;
  if (FEE_LABEL.test(l)) return null;
  if (/\b(notification|advertisement|advt|bulletin)\b/i.test(l) && /\b(date|issued?|release|released|no|number)\b/i.test(l)) {
    return "notification";
  }
  if (/\b(publish|publication)\b/i.test(l) && /\b(date|on)\b/i.test(l)) return "notification";
  if (/\b(application|online\s*application|form|registration|filling)\b/i.test(l) &&
      /\b(start|starts|begin|begins|open|opens|commence|commences|from)\b/i.test(l)) {
    return "application_start";
  }
  if (/\b(application|online\s*application|form|registration)\b/i.test(l) &&
      /\b(end|ends|close|closes|closed|deadline|last|upto|up\s*to|till|until)\b/i.test(l)) {
    return "application_end";
  }
  if (/\b(last\s*date|closing\s*date|close\s*date|deadline|due\s*date|last\s*day)\b/i.test(l)) {
    return "application_end";
  }
  return null;
}

const REVISION_WORDS = /revis|reschedul|postpon|extend|extended|corrected|updated|new\s+last\s*date|changed/i;

/** "Label: value" — the shape the shared extractor reads. */
const LABEL_VALUE = /^\s*([^:]{3,60}?)\s*[:\-–]\s*(.+)$/;
/** "Label    12.09.2026" — a two-column layout pasted as text (2+ spaces). */
const LABEL_SPACED_DATE =
  /^\s*([A-Za-z][A-Za-z ()/.&-]{3,60}?)\s{2,}(\d{1,2}[-./]\d{1,2}[-./]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\.?\s*\d{0,4})\s*$/;

/** The window's own slot list, in the order the reader cares about. */
const SLOT_ORDER: DateSlot[] = ["notification", "application_start", "application_end"];

function pickSlotDate(cands: DateCandidate[], slot: DateSlot): { date: string | null; conflicts: string[] } {
  if (cands.length === 0) return { date: null, conflicts: [] };
  const distinct = Array.from(new Set(cands.map((c) => c.date))).sort();
  const conflicts: string[] = [];
  if (distinct.length > 1) {
    const revisions = cands.filter((c) => c.revision);
    const winner = revisions.length
      ? revisions[revisions.length - 1]
      : (slot === "application_end" ? cands[cands.length - 1] : cands[0]);
    const losers = distinct.filter((d) => d !== winner.date);
    conflicts.push(
      `${losers.join(", ")} overridden by ${winner.date} (${winner.label}) — using the revised / stated date`,
    );
    return { date: winner.date, conflicts };
  }
  // One distinct date: for the END slot take the latest occurrence of it.
  if (slot === "application_end") return { date: distinct[distinct.length - 1], conflicts };
  return { date: distinct[0], conflicts };
}

// ── Vacancy count ────────────────────────────────────────────────────────────

// The label that carries the post count. TWO BRANCHES, because a `\b` after a
// PUNCTUATION branch can never hold: "Vacancies: 750" ends the match on ":", and a
// word boundary needs a word char on one side and a non-word char on the other —
// ":" and " " are both non-word, so the boundary does not exist and the branch was
// DEAD. The measurement on 2026-11-08 found exactly that: the count was silently
// dropped for every "Vacancies: N" notice. The word-ending branches keep their `\b`;
// the punctuation branch does not need one.
const COUNT_LINE =
  /\b(?:total\s*(?:no\.?|number)?\s*(?:of\s*)?(?:vacanc\w*|posts?|positions?)|number\s+of\s+(?:vacanc\w*|posts?|positions?)|total\s+posts?)\b|\bvacanc(?:y|ies)\s*[:\-–]/i;
/** A number with Indian/US comma grouping. */
const NUMBER = /(\d{1,3}(?:,\d{3})+|\d{1,6})/;

// ── Fee ──────────────────────────────────────────────────────────────────────

const FEE_CATEGORY =
  /\b(general|gen|obc|sc|st|pwbd|ewb?|urs?|bc|dsc|urc|male|female|other|all)\b/i;
const FEE_HEADING = /application\s*fee|fee\s*(details|structure|for)|charges?\s*structure/i;
const FEE_BLOCK_END = /eligibility|age\s*limit|selection\s*(process|procedure)|how\s*to|important\s*links|vacancy|documents?\s*(required|list)|for\s*more\s*details/i;
/** "General/OBC: Rs 100/-" — the label, the amount, in that order. */
const FEE_PAIR =
  /([A-Za-z][A-Za-z0-9\/&.\-]*(?:\s+[A-Za-z][A-Za-z0-9\/&.\-]*)*?)\s*(?:[:\-–]\s*)?(?:rs\.?|₹|inr)\s*(\d{1,5})/gi;

/** Category → amount, amounts only. The notice's wording is never carried over. */
function feePairsFromLine(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(FEE_PAIR.source, FEE_PAIR.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    let label = m[1]
      .replace(/^(application\s*fee|fee|charges?)\s+/i, "")
      .replace(/[\s–\-:.]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!label || !FEE_CATEGORY.test(label)) continue;
    if (!out[label]) out[label] = m[2];
  }
  return out;
}

function extractFee(lines: string[]): { value: Record<string, string>; sourceLine: string } | null {
  let block: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!FEE_HEADING.test(line)) continue;
    block = [line];
    for (let j = i + 1; j < lines.length && block.length < 8; j++) {
      const next = (lines[j] ?? "").trim();
      if (!next) continue;
      if (FEE_BLOCK_END.test(next)) break;
      block.push(next);
    }
    break;
  }
  if (block.length === 0) return null;
  const pairs: Record<string, string> = {};
  let sourceLine = "";
  for (const line of block) {
    const found = feePairsFromLine(line);
    for (const [k, v] of Object.entries(found)) {
      if (pairs[k]) continue;
      pairs[k] = v;
      if (!sourceLine) sourceLine = line;
    }
  }
  return Object.keys(pairs).length ? { value: pairs, sourceLine } : null;
}

// ── Age limit ────────────────────────────────────────────────────────────────

const AGE_HEADING = /age\s*(limit|criteria|relaxation)|minimum\s*age|maximum\s*age/i;
const AGE_RANGE = /(\d{1,2})\s*(?:-|–|to|and)\s*(\d{1,2})\s*(?:years?|yrs?)/i;
const AGE_MIN = /(?:minimum|min\.?|not\s+less\s+than|at\s+least)\s*(?:age\s*)?[:\-–]?\s*(\d{1,2})\s*(?:years?|yrs?)/i;
const AGE_MAX = /(?:maximum|max\.?|not\s+exceeding|upto|up\s+to|not\s+more\s+than|below|less\s+than)\s*(?:age\s*)?[:\-–]?\s*(\d{1,2})\s*(?:years?|yrs?)/i;

function extractAgeLimit(lines: string[]): { value: string; sourceLine: string } | null {
  for (const raw of lines) {
    const line = raw.trim();
    if (!AGE_HEADING.test(line) && !AGE_RANGE.test(line)) continue;
    const range = line.match(AGE_RANGE);
    if (range) return { value: `${range[1]}-${range[2]} years`, sourceLine: line };
    const min = line.match(AGE_MIN);
    const max = line.match(AGE_MAX);
    if (min && max) return { value: `${min[1]}-${max[1]} years`, sourceLine: line };
    if (max) return { value: `up to ${max[1]} years`, sourceLine: line };
    if (min) return { value: `from ${min[1]} years`, sourceLine: line };
  }
  return null;
}

// ── Title / organisation ─────────────────────────────────────────────────────

const ORG_LABEL =
  /^\s*(?:issuing\s+)?(?:organisation|organization|department|dept\.?|authority|board|commission|council|university|company|bank|railways?|police\s+dept\.?)\b\s*[:\-–]\s*(.+)$/i;
/** A leading acronym run — the corpus's organisations look like "WCD Chhattisgarh". */
const ACRONYM_RUN = /^((?:[A-Z][A-Z&.\-]{1,9}\s*){1,3})/;

function extractTitle(lines: string[]): { value: string; sourceLine: string } | null {
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length > 140) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (/^\s*(?:important\s+dates?|short\s+information|eligibility|application\s*fee|vacancy\s+details)\s*:?\s*$/i.test(line)) continue;
    return { value: line, sourceLine: line };
  }
  return null;
}

function extractOrganization(lines: string[], title: string | null): { value: string; sourceLine: string } | null {
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(ORG_LABEL);
    if (m && m[1]) {
      const value = m[1].replace(/\s+/g, " ").trim();
      if (value && value.length <= 120) return { value, sourceLine: line };
    }
  }
  if (title) {
    const m = title.match(ACRONYM_RUN);
    if (m) {
      const value = m[1].replace(/\s+/g, " ").trim();
      if (value) return { value, sourceLine: title };
    }
  }
  return null;
}

// ── The copy guard's scope ───────────────────────────────────────────────────

/** A name with more than this many words reads like a sentence. */
function readsLikeSentence(value: string): boolean {
  return value.trim().split(/\s+/).filter(Boolean).length > NAME_MAX_WORDS;
}

/**
 * The guard's verdict for a WORDING value. Data and short names are recorded
 * (not silently skipped) — see the file header for why.
 */
export function guardWording(value: string, sourceLine: string): { verdict: GuardVerdict; refused?: string } {
  if (readsLikeSentence(value)) {
    // A long phrase is wording: it MUST clear the guard against the source line.
    if (isTooCloseToSource(value, sourceLine)) {
      return {
        verdict: "refused",
        refused: "This reads too much like the notice's own wording — write it in your own words.",
      };
    }
    return { verdict: "passed" };
  }
  return { verdict: "name-exempt" };
}

// ── The extractor ────────────────────────────────────────────────────────────

/**
 * Read a pasted notice and propose the fields a vacancy row needs.
 * PURE: no network, no fetch, no OCR, no model — the same input always gives the
 * same proposals, and every proposal shows the line it came from.
 */
export function extractVacancyFields(
  noticeText: string,
  opts: ExtractVacancyOptions = {},
): VacancyExtraction {
  const text = (noticeText ?? "").replace(/\r\n/g, "\n");
  const year = opts.year ?? new Date().getFullYear();
  const lines = text.split("\n");
  const proposals: VacancyProposal[] = [];
  const notes: string[] = [];
  const conflicts: string[] = [];
  const unmatched: string[] = [];

  // ── 1. The three window dates ──────────────────────────────────────────────
  const extracted = extractNoticeDateLines(text, year);
  for (const n of extracted.notes) notes.push(n.text);
  for (const c of extracted.conflicts) conflicts.push(c);

  const bySlot: Record<DateSlot, DateCandidate[]> = {
    notification: [],
    application_start: [],
    application_end: [],
  };

  // The shared extractor's rows (it already resolved "Important Dates" blocks,
  // multi-date lines and bare days).
  for (const row of extracted.rows) {
    const slot = (["notification", "application_start", "application_end"] as const).find((s) => s === row.type);
    if (!slot) {
      if (row.type === "other") unmatched.push(`${row.label}: ${row.date}`);
      continue;
    }
    bySlot[slot].push({
      date: row.date,
      sourceLine: row.source_quote,
      label: row.label,
      revision: REVISION_WORDS.test(row.source_quote ?? ""),
      order: 0,
    });
  }

  // The vacancy-specific pass: notice labels the shared extractor types as
  // "other" ("Closing Date", "Notification Issued") are window slots too.
  let order = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    order++;
    const m = line.match(LABEL_VALUE) ?? line.match(LABEL_SPACED_DATE);
    if (!m) continue;
    const label = (m[1] ?? "").replace(/\s+/g, " ").trim();
    const value = (m[2] ?? "").trim();
    if (!label || !value) continue;
    const slot = classifyVacancyDateLabel(label);
    if (!slot) continue;
    const dates = parseDateList(value, year);
    if (dates.length === 0) {
      if (/\b(to\s*be|will\s*be|tbn|tba|awaited|notified\s*soon|after\s+exam)\b/i.test(value)) {
        notes.push(`${label}: ${value}`);
      }
      continue;
    }
    // The shared extractor already produced this label+date — do not double it.
    if (bySlot[slot].some((c) => c.sourceLine === line && c.date === dates[0])) continue;
    for (const d of dates) {
      bySlot[slot].push({
        date: d,
        sourceLine: line,
        label,
        revision: REVISION_WORDS.test(line),
        order,
      });
    }
  }

  for (const slot of SLOT_ORDER) {
    const picked = pickSlotDate(bySlot[slot], slot);
    conflicts.push(...picked.conflicts);
    if (!picked.date) continue;
    const field = slot === "notification" ? "notificationDate"
      : slot === "application_start" ? "applicationStartDate"
      : "applicationEndDate";
    const winner = bySlot[slot].find((c) => c.date === picked.date);
    proposals.push({
      field,
      label: VACANCY_FIELD_LABELS[field],
      value: picked.date,
      display: picked.date,
      sourceLine: winner?.sourceLine ?? "",
      kind: "date",
      guard: "data",
    });
  }

  // ── 2. The vacancy count ───────────────────────────────────────────────────
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || !COUNT_LINE.test(line)) continue;
    const valuePart = (line.match(LABEL_VALUE)?.[2] ?? line).replace(/[^\d,]/g, " ");
    const n = valuePart.match(NUMBER);
    if (!n) continue;
    const count = parseInt(n[1].replace(/,/g, ""), 10);
    if (!Number.isFinite(count) || count <= 0 || count > 1000000) continue;
    proposals.push({
      field: "vacancyCount",
      label: VACANCY_FIELD_LABELS.vacancyCount,
      value: count,
      display: String(count),
      sourceLine: line,
      kind: "number",
      guard: "data",
    });
    break;
  }

  // ── 3. The fee (a category → amount map: data, not wording) ───────────────
  const fee = extractFee(lines);
  if (fee) {
    const flat = Object.entries(fee.value).map(([k, v]) => `${k}: ${v}`).join(", ");
    proposals.push({
      field: "applicationFee",
      label: VACANCY_FIELD_LABELS.applicationFee,
      value: fee.value,
      display: flat,
      sourceLine: fee.sourceLine,
      kind: "json",
      guard: "data",
    });
  }

  // ── 4. The age limit (two numbers we composed: data, not wording) ──────────
  const age = extractAgeLimit(lines);
  if (age) {
    proposals.push({
      field: "ageLimit",
      label: VACANCY_FIELD_LABELS.ageLimit,
      value: age.value,
      display: age.value,
      sourceLine: age.sourceLine,
      kind: "text",
      guard: "data",
    });
  }

  // ── 5. The title (a document's NAME) ───────────────────────────────────────
  const title = extractTitle(lines);
  if (title) {
    proposals.push({
      field: "title",
      label: VACANCY_FIELD_LABELS.title,
      value: title.value,
      display: title.value,
      sourceLine: title.sourceLine,
      kind: "text",
      guard: "name-exempt",
    });
  }

  // ── 6. The organisation (a name — but a long one is wording) ──────────────
  const org = extractOrganization(lines, title?.value ?? null);
  if (org) {
    const verdict = guardWording(org.value, org.sourceLine);
    proposals.push({
      field: "organization",
      label: VACANCY_FIELD_LABELS.organization,
      value: verdict.verdict === "refused" ? null : org.value,
      display: org.value,
      sourceLine: org.sourceLine,
      kind: "text",
      guard: verdict.verdict,
      refused: verdict.refused,
    });
  }

  return { proposals, notes, conflicts, unmatched };
}
