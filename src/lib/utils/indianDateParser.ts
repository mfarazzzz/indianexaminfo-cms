/**
 * indianDateParser.ts — Shared deterministic date parser for Indian date formats.
 *
 * Indian government notifications use DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY formats
 * where the DAY comes first, MONTH second, YEAR last.
 *
 * This module provides:
 * - parseDateText(): converts any Indian date string to ISO YYYY-MM-DD
 * - validateAndFixDate(): validates an AI-returned date and fixes if possible
 * - INDIAN_DATE_PROMPT_RULES: standard instructions to include in AI prompts
 *
 * Used by: autofill.ts, moduleAI.ts, noticeReview/noticePipeline (S2)
 *
 * S2.2 additions (UP notices are Hindi-first):
 * - Devanagari month names ("5 अक्टूबर 2026")
 * - range separators beyond "to" ("05.10.2026 से 07.10.2026", "से … तक")
 * - clock times with day-part qualifiers ("सायं 06:00 बजे" → 18:00)
 * - time-of-day words → canonical time_text ("अपराह्न" → "afternoon")
 * - parseDateWindow(): a whole date-expression → {date, end_date,
 *   start_time, end_time, time_text} for the FX3 C1 row keys.
 */

// ── Month name lookup ─────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

/** Devanagari month names as printed on UP/state notices (both spellings). */
const HINDI_MONTH_MAP: Record<string, string> = {
  "जनवरी": "01", "जनो": "01",
  "फरवरी": "02", "फ़रवरी": "02", "फरबरी": "02",
  "मार्च": "03",
  "अप्रैल": "04", "एप्रिल": "04",
  "मई": "05",
  "जून": "06", "जुन": "06",
  "जुलाई": "07", "जुला": "07",
  "अगस्त": "08",
  "सितम्बर": "09", "सितंबर": "09", "सितं": "09",
  "अक्तूबर": "10", "अक्टूबर": "10", "अक्टोबर": "10",
  "नवम्बर": "11", "नवंबर": "11",
  "दिसम्बर": "12", "दिसंबर": "12", "दिसा": "12",
};

const HINDI_MONTH_ALT = Object.keys(HINDI_MONTH_MAP).join("|");

/** Day-part words → canonical English time_text (stored value) / 24h bias. */
const DAYPART: { words: RegExp; text: string; bias: "am" | "pm" | "noon" }[] = [
  { words: /सुबह|प्रातः|प्रातःकालीन|\bmorning\b|\bam\b/i, text: "morning", bias: "am" },
  { words: /अपराह्न|दोपहर|दופहर|noon|afternoon/i, text: "afternoon", bias: "pm" },
  { words: /सायं|शाम|सायंकाल|\bevening\b|\bpm\b/i, text: "evening", bias: "pm" },
  { words: /रात्रि|रात|\bnight\b/i, text: "night", bias: "pm" },
];

// ── Range + time helpers (S2.2) ──────────────────────────────────────────────

/**
 * Split a date RANGE expression into [start, end] parts. Handles the English
 * "to"/"until" plus the Hindi "से"/"तक" and spaced dashes used on notices:
 * "05.10.2026 से 07.10.2026", "05 Oct – 07 Oct", "05.10.2026 to 07.10.2026".
 * "तक" is a suffix marker ("… से 07.10.2026 तक"), stripped before splitting.
 * Returns the whole text as the single part when it is not a range.
 */
export function splitDateRange(text: string): [string, string?] {
  let t = text.trim().replace(/\s+/g, " ");
  // NB: no \b around तक — JS \b is ASCII-only and Devanagari is non-\w.
  t = t.replace(/(?:\s+|^)(?:तक|upto|up\s*to)\s*$/i, "").trim();
  const sep = /\s+(?:to|until|से|-|–|—)\s+/i;
  const parts = t.split(sep).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) return [parts[0], parts[1]];
  if (parts.length > 2) {
    // Reformat like "5 to 7 to 9" — first stays start, LAST becomes end.
    return [parts[0], parts[parts.length - 1]];
  }
  return [t.length ? t : text.trim()];
}

/** Remove complete date numbers (DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY / ISO)
 *  so a clock lookup never mistakes the "05.10" of "05.10.2026" for 05:10. */
function withoutDates(side: string): string {
  return side
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
}

/** Extract a 24h HH:MM clock from one side of a range, honouring the day-part
 *  qualifier ("सायं 06:00 बजे" → "18:00", "सुबह 11:00" → "11:00", bare "18:00"
 *  kept). Returns null when the side carries no clock time. */
function extractClock(side: string): string | null {
  const m = withoutDates(side).match(/\b(\d{1,2})[:.](\d{2})(?::\d{2})?(?:\s*(?:baje|बजे))?\b/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  if (h <= 12) {
    const pm = /सायं|शाम|रात्रि|रात|\b(?:evening|night|pm)\b/i.test(side);
    const am = /सुबह|प्रातः|\b(?:morning|am)\b/i.test(side);
    if (pm && h < 12) h += 12;
    else if (pm && h === 12) h = 12; // "दोपहर/noon 12" stays 12
    else if (am && h === 12) h = 0;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** The canonical time_text for a side, when it carries a day-part WORD but no
 *  usable clock ("05.10.2026 (अपराह्न)" → "afternoon"). */
function extractTimeText(side: string): string {
  if (extractClock(side)) return "";
  for (const part of DAYPART) {
    if (part.words.test(side)) return part.text;
  }
  return "";
}

/** Remove clock/qualifier noise from a side so only the date remains. Colon
 *  clocks always; dotted clocks ONLY when बजे/baje marks them as a time — a
 *  bare "05.10" must survive as part of the date. */
function stripTime(side: string): string {
  return side
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\s*baje|\s*बजे)?/g, " ")
    .replace(/\b\d{1,2}\.\d{2}(?:\s*baje|\s*बजे)/g, " ")
    .replace(/(?:baje|बजे)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a full date expression into the FX3 C1 row keys. Fills ONLY what the
 * text carries; empty strings mean "not present" (serializeDateRowsForWrite
 * drops them). Never invents an end_date below the start date.
 *
 *  "05.10.2026 (अपराह्न) से 07.10.2026 सायं 06:00 बजे"
 *    → { date: "2026-10-05", end_date: "2026-10-07",
 *        start_time: "", end_time: "18:00", time_text: "afternoon" }
 *  "07.10.2026, 5:00 PM"   → { date: "2026-10-07", end_time: "17:00" }
 *  "5 अक्टूबर 2026"         → { date: "2026-10-05" }
 */
export function parseDateWindow(text: string, defaultYear?: number): {
  date: string; end_date: string; start_time: string; end_time: string; time_text: string;
} {
  const out = { date: "", end_date: "", start_time: "", end_time: "", time_text: "" };
  if (!text || !text.trim()) return out;

  const [startSide, endSide] = splitDateRange(text);

  out.date = parseDateText(stripTime(startSide), defaultYear);
  out.start_time = extractClock(startSide) ?? "";
  out.time_text = extractTimeText(startSide);

  if (endSide) {
    out.end_date = parseDateText(stripTime(endSide), defaultYear);
    const endClock = extractClock(endSide);
    if (endClock) out.end_time = endClock;
    else if (!out.time_text) out.time_text = extractTimeText(endSide);
    // A range whose start carries no clock but whose END has one keeps the
    // clock on the end (deadline) — done above. A single-side row that
    // carries its own time uses end_time (deadline semantics: "by 6 PM").
  } else {
    const clock = extractClock(startSide);
    if (clock) out.end_time = clock;
  }

  // Guard: never keep an end_date that cannot belong to this window.
  if (out.end_date && out.date && out.end_date < out.date) out.end_date = out.date;
  return out;
}

// ── Core parser ───────────────────────────────────────────────────────────────

/**
 * Parse any date text (Indian or international formats) into ISO YYYY-MM-DD.
 * Returns empty string if parsing fails.
 *
 * Handles:
 * - "2026-08-03" (ISO)
 * - "Aug 3, 2026" / "August 3, 2026"
 * - "3 Aug 2026" / "03 August 2026" / "6th September, 2026"
 * - "5 अक्टूबर 2026" (Devanagari month names)
 * - "11.05.2026" (DD.MM.YYYY Indian dot format)
 * - "03-08-2026" / "03/08/2026" (DD-MM-YYYY / DD/MM/YYYY)
 * - "First week of January 2027"
 * - "End of October, 2026"
 * - "January 2027" (month + year only)
 * - Date ranges: takes first date from "15.06.2026 to 18.06.2026" and
 *   "05.10.2026 से 07.10.2026" (use parseDateWindow for the whole window)
 */
export function parseDateText(text: string, defaultYear?: number): string {
  if (!text) return "";

  // Handle date ranges — take the first date
  const t = splitDateRange(text)[0].trim();

  // "2026-08-03" (already ISO) — check first to avoid misinterpretation
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // "Aug 3, 2026" / "August 3, 2026" / "AUG 03, 2026"
  m = t.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (m && MONTH_MAP[m[1].toLowerCase()]) {
    return `${m[3]}-${MONTH_MAP[m[1].toLowerCase()]}-${m[2].padStart(2, "0")}`;
  }

  // "3 Aug 2026" / "03 August 2026" / "6th September 2026" / "06th September, 2026"
  m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s*(\d{4})/);
  if (m && MONTH_MAP[m[2].toLowerCase()]) {
    return `${m[3]}-${MONTH_MAP[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  }

  // "5 अक्टूबर 2026" / "05 अगस्त 2026" (Hindi month between day and year)
  m = t.match(new RegExp(`(\\d{1,2})\\s*(?:वां|वीं|ठ)?\\s+(${HINDI_MONTH_ALT}),?\\s*(\\d{4})`));
  if (m && HINDI_MONTH_MAP[m[2]]) {
    return `${m[3]}-${HINDI_MONTH_MAP[m[2]]}-${m[1].padStart(2, "0")}`;
  }

  // "अक्टूबर 5, 2026" (Hindi month first)
  m = t.match(new RegExp(`(${HINDI_MONTH_ALT})\\s+(\\d{1,2}),?\\s*(\\d{4})`));
  if (m && HINDI_MONTH_MAP[m[1]]) {
    return `${m[3]}-${HINDI_MONTH_MAP[m[1]]}-${m[2].padStart(2, "0")}`;
  }

  // DD.MM.YYYY (Indian format with dots) — e.g., "11.05.2026"
  m = t.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  // DD-MM-YYYY or DD/MM/YYYY (Indian format: day first, month second)
  m = t.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  // "First week of January 2027"
  m = t.match(/first\s+week\s+of\s+([A-Za-z]+)\s+(\d{4})/i);
  if (m && MONTH_MAP[m[1].toLowerCase()]) {
    return `${m[2]}-${MONTH_MAP[m[1].toLowerCase()]}-07`;
  }

  // "End of OCTOBER, 2026" / "end of October 2026" / "By the end of OCTOBER, 2026"
  m = t.match(/end\s+of\s+([A-Za-z]+),?\s*(\d{4})/i);
  if (m && MONTH_MAP[m[1].toLowerCase()]) {
    return `${m[2]}-${MONTH_MAP[m[1].toLowerCase()]}-28`;
  }

  // "Last week of March 2027"
  m = t.match(/last\s+week\s+of\s+([A-Za-z]+)\s+(\d{4})/i);
  if (m && MONTH_MAP[m[1].toLowerCase()]) {
    return `${m[2]}-${MONTH_MAP[m[1].toLowerCase()]}-25`;
  }

  // "Mid January 2027" / "mid-February 2027"
  m = t.match(/mid[-\s]*([A-Za-z]+),?\s*(\d{4})/i);
  if (m && MONTH_MAP[m[1].toLowerCase()]) {
    return `${m[2]}-${MONTH_MAP[m[1].toLowerCase()]}-15`;
  }

  // "January 2027" / "OCTOBER 2026" (month + year only — use 15th as midpoint)
  m = t.match(/([A-Za-z]+),?\s*(\d{4})/);
  if (m && MONTH_MAP[m[1].toLowerCase()]) {
    return `${m[2]}-${MONTH_MAP[m[1].toLowerCase()]}-15`;
  }

  // DD.MM.YY or DD/MM/YY (2-digit year) — e.g., "11.05.26"
  m = t.match(/(\d{1,2})[./](\d{1,2})[./](\d{2})(?!\d)/);
  if (m) {
    const yr = parseInt(m[3]) < 50 ? `20${m[3]}` : `19${m[3]}`;
    return `${yr}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  return "";
}

// ── Date validation and fixing ────────────────────────────────────────────────

/**
 * Validate an AI-returned date string. If it's already YYYY-MM-DD, validate the
 * month/day ranges. If it looks like a raw date text, attempt to parse it.
 * Returns corrected YYYY-MM-DD or empty string.
 */
export function validateAndFixDate(dateStr: string): string {
  if (!dateStr || dateStr.trim() === "") return "";

  const trimmed = dateStr.trim();

  // Already ISO format — validate ranges
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, mo, d] = isoMatch;
    const month = parseInt(mo);
    const day = parseInt(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return trimmed; // Valid ISO date
    }
    // Invalid — try swapping month/day (AI may have put month first)
    if (day >= 1 && day <= 12 && month >= 1 && month <= 31) {
      return `${y}-${d.toString().padStart(2, "0")}-${month.toString().padStart(2, "0")}`;
    }
    return ""; // Unrecoverable
  }

  // Not ISO — try parsing as raw text
  return parseDateText(trimmed);
}

/**
 * Process an array of date objects from AI, validating/fixing each date field.
 * Works with any object that has a "date" string property.
 */
export function validateDatesArray<T extends { date: string }>(dates: T[]): T[] {
  return dates
    .map((d) => ({ ...d, date: validateAndFixDate(d.date) }))
    .filter((d) => d.date !== "" || !d.date); // Keep entries even if date is empty (unfilled)
}

// ── Prompt instructions ───────────────────────────────────────────────────────

/**
 * Standard prompt instructions about Indian date formats.
 * Include this in EVERY AI prompt that deals with date extraction.
 */
export const INDIAN_DATE_PROMPT_RULES = `
CRITICAL DATE FORMAT RULES (Indian dates):
- Indian government notifications use DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY (day FIRST, month SECOND, year LAST).
- 11.05.2026 = 11th May 2026 (NOT November 5th). 06-09-2026 = 6th September 2026 (NOT June 9th).
- 10.06.2026 = 10th June 2026. 15.01.2027 = 15th January 2027.
- When you see a numeric date like XX.YY.ZZZZ, the FIRST number is the DAY, the SECOND is the MONTH.
- Copy dates EXACTLY as written. Do NOT reformat to American MM/DD/YYYY.
- For "end of MONTH YEAR" → use the 28th of that month.
- For "first week of MONTH YEAR" → use the 7th of that month.
- Output all dates in YYYY-MM-DD format after correctly interpreting DD.MM.YYYY input.
- ALWAYS double-check: if the month value is > 12, you've swapped day and month — fix it.`;

/**
 * Shorter version for prompts that are already long.
 */
export const INDIAN_DATE_PROMPT_SHORT = `DATES: Indian format DD.MM.YYYY (day first). 11.05.2026 = May 11. 06-09-2026 = Sep 6. Output as YYYY-MM-DD.`;
