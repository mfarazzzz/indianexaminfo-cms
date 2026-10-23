/**
 * evergreenName.ts — the "name ends with a year" rule, in ONE place.
 *
 * Owner decision 23 Oct (reference-page review, P2 item 19): exam names should be
 * evergreen — the YEAR belongs to the edition (exam_editions.year / edition_label),
 * not to the identity. The December batch migration (supabase/proposed/
 * evergreen_names_DRYRUN.sql) strips a trailing `20YY` from `exams.name`. THIS
 * predicate matches exactly the SAME shape — `(20[0-9]{2})\s*$` — so the editor's
 * soft hint and the future batch never disagree about which names carry a year.
 *
 * It is deliberately 20YY-only (not any 4 digits): a name ending in "1999" is not
 * what the migration targets and must not light the hint. Used ONLY as a
 * non-blocking advisory — it never prevents a save.
 */

/** Trailing edition-year token: a 20YY run at the very end, optional trailing spaces. */
const TRAILING_YEAR = /\s*20\d{2}\s*$/;

/** True when `name` ends with a 20YY year (the evergreen rule). Non-string-safe. */
export function nameEndsWithYear(name: string | null | undefined): boolean {
  return typeof name === "string" && TRAILING_YEAR.test(name);
}

/** The name with its trailing year removed — mirrors the migration's regexp_replace. */
export function stripTrailingYear(name: string): string {
  return name.replace(TRAILING_YEAR, "").trimEnd();
}
