/**
 * fieldTypes.ts — the field-type system (validation only, this pass).
 *
 * A field references a TYPE; the normaliser/validator is a property of the type,
 * not re-implemented per field. This is the single place that decides what each
 * kind of input accepts, rejects, and coerces. It does NOT change stored shapes,
 * does NOT migrate data, and is NOT wired into save — callers use `validate()` to
 * refuse bad input at entry (see the editor inputs) with a message saying why.
 *
 * The url type composes the EXISTING normalizeUrl so the CMS and the Postgres
 * CHECK on exams.official_website agree instead of the DB being the only guard.
 */
import { normalizeUrl, sanitizeHtml } from "@/lib/utils";

export type FieldTypeName =
  | "url"
  | "url-list"
  | "iso-date"
  | "short-text"
  | "label"
  | "integer"
  | "richtext"
  | "enum";

export interface ValidationResult {
  ok: boolean;
  /** The coerced value when ok (e.g. trimmed/normalised); original when not. */
  value: string;
  /** Human message when !ok — shown at the input, says what is wrong. */
  error?: string;
}

export interface FieldType {
  name: FieldTypeName;
  /** Validate + coerce a raw string. Empty is always OK (fields are optional here). */
  validate(raw: string, opts?: { options?: readonly string[] }): ValidationResult;
}

const ok = (value: string): ValidationResult => ({ ok: true, value });
const bad = (value: string, error: string): ValidationResult => ({ ok: false, value, error });

const isEmpty = (raw: string | null | undefined): boolean =>
  raw === null || raw === undefined || raw.trim() === "";

// ── url ──────────────────────────────────────────────────────────────────────
// Accepts: one http(s) URL, no whitespace/comma. Rejects: multiple URLs, spaces,
// non-http junk. Coerces: bare domain -> https://, trims. Mirrors normalizeUrl,
// which is exactly what the DB CHECK on official_website enforces.
const urlType: FieldType = {
  name: "url",
  validate(raw) {
    if (isEmpty(raw)) return ok("");
    const normalised = normalizeUrl(raw);
    if (!normalised) {
      if (/[\s,]/.test(raw.trim())) {
        return bad(raw, "Enter a single URL — remove extra links, spaces or commas.");
      }
      return bad(raw, "Enter a valid web address, e.g. https://example.gov.in");
    }
    return ok(normalised);
  },
};

// ── url-list ───────────────────────────────────────────────────────────────
// Accepts: whitespace/comma/newline-separated URLs. Each candidate runs through url.
// Returns the cleaned list joined by newline (storage shape unchanged — still a string
// here; a true array shape is a later step, out of scope for validation-only).
const urlListType: FieldType = {
  name: "url-list",
  validate(raw) {
    if (isEmpty(raw)) return ok("");
    const parts = raw.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
    const cleaned: string[] = [];
    for (const p of parts) {
      const n = normalizeUrl(p);
      if (!n) return bad(raw, `"${p}" is not a valid URL. Fix or remove it.`);
      cleaned.push(n);
    }
    return ok(cleaned.join("\n"));
  },
};

// ── iso-date ──────────────────────────────────────────────────────────────
// Accepts: YYYY-MM-DD. Rejects: prose ("to be announced"), times, partials.
// Coerces: common human formats (DD/MM/YYYY, DD-MM-YYYY, "12 Jan 2026") -> ISO
// where unambiguous; otherwise rejects (so prose can't sit in a date field).
const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};
const isoDateType: FieldType = {
  name: "iso-date",
  validate(raw) {
    if (isEmpty(raw)) return ok("");
    const t = raw.trim();
    // Already ISO (date or datetime) -> keep the date part.
    const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
      if (!isNaN(d.getTime())) return ok(`${iso[1]}-${iso[2]}-${iso[3]}`);
      return bad(raw, "Not a real calendar date.");
    }
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      const dd = dmy[1].padStart(2, "0"), mm = dmy[2].padStart(2, "0");
      if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31)
        return ok(`${dmy[3]}-${mm}-${dd}`);
      return bad(raw, "Day or month is out of range.");
    }
    // "12 Jan 2026" / "12 January 2026"
    const human = t.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
    if (human) {
      const mm = MONTHS[human[2].slice(0, 3).toLowerCase()];
      if (mm) return ok(`${human[3]}-${mm}-${human[1].padStart(2, "0")}`);
    }
    return bad(raw, 'Enter a date as YYYY-MM-DD. Prose like "to be announced" belongs in a notes field.');
  },
};

// ── label ──────────────────────────────────────────────────────────────────
// A short human label (e.g. an Important-Dates event name). Rejects URLs and
// date/status content that belong in sibling fields — the exact label-pollution bug.
const labelType: FieldType = {
  name: "label",
  validate(raw) {
    if (isEmpty(raw)) return ok("");
    const t = raw.trim();
    if (/https?:\/\//i.test(t)) return bad(raw, "A label shouldn't contain a URL — put links in the link field.");
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return bad(raw, "A label shouldn't be a date — use the date field.");
    if (t.length > 80) return bad(raw, "Label is too long (max 80 characters) — this looks like a description.");
    if (/[\r\n]/.test(t)) return bad(raw, "Label must be a single line.");
    return ok(t);
  },
};

// ── short-text ───────────────────────────────────────────────────────────────
// Single-line-ish plain text. Strips HTML tags; rejects extreme length.
const shortTextType: FieldType = {
  name: "short-text",
  validate(raw) {
    if (isEmpty(raw)) return ok("");
    const stripped = raw.replace(/<[^>]*>/g, "").trim();
    if (stripped.length > 500) return bad(raw, "Too long for this field (max 500 characters).");
    return ok(stripped);
  },
};

// ── integer ──────────────────────────────────────────────────────────────────
// Whole number. Strips ₹/commas/spaces. Rejects prose and decimals.
const integerType: FieldType = {
  name: "integer",
  validate(raw) {
    if (isEmpty(raw)) return ok("");
    const cleaned = raw.replace(/[₹,\s]/g, "");
    if (!/^-?\d+$/.test(cleaned)) return bad(raw, "Enter a whole number (digits only).");
    return ok(cleaned);
  },
};

// ── richtext ──────────────────────────────────────────────────────────────
// Sanitised HTML via the existing allowlist. Never rejects (sanitises instead).
const richtextType: FieldType = {
  name: "richtext",
  validate(raw) {
    if (isEmpty(raw)) return ok("");
    return ok(sanitizeHtml(raw));
  },
};

// ── enum ──────────────────────────────────────────────────────────────────
// One of a fixed option set (case-insensitive match). Rejects anything else.
const enumType: FieldType = {
  name: "enum",
  validate(raw, opts) {
    if (isEmpty(raw)) return ok("");
    const options = opts?.options ?? [];
    const hit = options.find((o) => o.toLowerCase() === raw.trim().toLowerCase());
    if (!hit) return bad(raw, `Must be one of: ${options.join(", ")}.`);
    return ok(hit);
  },
};

export const FIELD_TYPES: Record<FieldTypeName, FieldType> = {
  url: urlType,
  "url-list": urlListType,
  "iso-date": isoDateType,
  "short-text": shortTextType,
  label: labelType,
  integer: integerType,
  richtext: richtextType,
  enum: enumType,
};

/** Validate a raw value against a named type. Unknown type => pass-through (fail-open). */
export function validateField(
  type: FieldTypeName | string,
  raw: string,
  opts?: { options?: readonly string[] },
): ValidationResult {
  const ft = FIELD_TYPES[type as FieldTypeName];
  if (!ft) return { ok: true, value: raw };
  return ft.validate(raw, opts);
}
