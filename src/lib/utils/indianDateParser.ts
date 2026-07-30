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
 * Used by: entranceExamAI.ts, tabAI.ts, autofill.ts, moduleAI.ts
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

// ── Core parser ───────────────────────────────────────────────────────────────

/**
 * Parse any date text (Indian or international formats) into ISO YYYY-MM-DD.
 * Returns empty string if parsing fails.
 *
 * Handles:
 * - "2026-08-03" (ISO)
 * - "Aug 3, 2026" / "August 3, 2026"
 * - "3 Aug 2026" / "03 August 2026" / "6th September, 2026"
 * - "11.05.2026" (DD.MM.YYYY Indian dot format)
 * - "03-08-2026" / "03/08/2026" (DD-MM-YYYY / DD/MM/YYYY)
 * - "First week of January 2027"
 * - "End of October, 2026"
 * - "January 2027" (month + year only)
 * - Date ranges: takes first date from "15.06.2026 to 18.06.2026"
 */
export function parseDateText(text: string, defaultYear?: number): string {
  if (!text) return "";

  // Handle date ranges — take the first date
  const rangeParts = text.split(/\s+to\s+/i);
  const t = rangeParts[0].trim();

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
