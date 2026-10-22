/**
 * verification.ts — S3.2/D6: the ONE place the "can this record be verified?"
 * rules live. Used by the editor header control (EntranceExamEditorPage) and
 * by the "Needs verification" triage queue (buildQueueRow), so the two can
 * never disagree about why a row is blocked.
 *
 * Locked decisions (owner, 21 Oct):
 *  – Verification is PER EXAM (exams.is_verified/verified_at/verified_by); the
 *    action label says "Verify this exam" — the stamp is on the record, never
 *    on a single cycle.
 *  – Only a publish_exam holder may verify (CMS-layer assert first; the
 *    database-level trigger ships separately with the owner-approved proposal
 *    — copy must NOT claim DB enforcement until it is applied).
 *  – The reader never sees a personal name — this layer only exposes
 *    verifiedAt; verified_by stays an internal uuid.
 *  – Verifications older than RECHECK_AFTER_DAYS are flagged "re-check" in the
 *    triage queue (no automatic expiry on the reader side — decision 5).
 */

export const RECHECK_AFTER_DAYS = 90;

/** Anything with a stored date — the editor's DateRow and the edition's
 *  jsonb rows both fit. */
export interface DateLike { date?: string | null }

/** Strict ISO calendar date: YYYY-MM-DD AND a real day (2026-02-30 fails). */
export function isoDateValid(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validDates(dates: DateLike[] | null | undefined): string[] {
  return (dates ?? []).map((d) => d?.date).filter(isoDateValid);
}

/** True when two rows share the same date — a same-day duplicate is a data
 *  contradiction, so verification must not paper over it. */
export function hasDuplicateDay(dates: DateLike[] | null | undefined): boolean {
  const v = validDates(dates);
  return new Set(v).size !== v.length;
}

/** Nearest FUTURE date (strictly after today) or null. todayISO = YYYY-MM-DD. */
export function pickNextUpcomingDate(dates: DateLike[] | null | undefined, todayISO: string): string | null {
  let best: string | null = null;
  for (const d of validDates(dates)) {
    if (d > todayISO && (best === null || d < best)) best = d;
  }
  return best;
}

/** Whole days from today to the date, negative if past, null for no date. */
export function daysUntil(dateISO: string | null, todayISO: string): number | null {
  if (!dateISO) return null;
  const a = Date.parse(`${todayISO}T00:00:00Z`);
  const b = Date.parse(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export interface VerifyStateInput {
  name: string;
  conductingBody: string;
  officialWebsite: string;
  selectionAnswered: boolean;
  dates: DateLike[] | null | undefined;
  /** The editor's unsaved-changes flag — the triage queue has no live form, so
   *  it passes false and its reasons are the DATA reasons only. */
  hasUnsavedChanges: boolean;
  /** Holds publish_exam (CMS-layer permission). */
  canPublish: boolean;
}

/**
 * Every reason the Verify action is blocked, in human words, in check order.
 * Empty = ready to verify. The UI shows the FIRST one inline; the queue shows
 * them all in the row.
 */
export function verifyBlockReasons(i: VerifyStateInput): string[] {
  const reasons: string[] = [];
  if (!i.canPublish) reasons.push("Requires the Publish Exam permission");
  if (!i.name.trim()) reasons.push("Exam name is empty");
  if (!i.conductingBody.trim()) reasons.push("Conducting body is empty");
  if (!i.officialWebsite.trim()) reasons.push("Official website is missing");
  if (!i.selectionAnswered) reasons.push("Answer \u201CHow are candidates selected?\u201D first");
  if (validDates(i.dates).length === 0) reasons.push("Add at least one valid important date");
  if (hasDuplicateDay(i.dates)) reasons.push("Remove duplicate same-day date rows");
  if (i.hasUnsavedChanges) reasons.push("Save your unsaved changes first");
  return reasons;
}

export function readyToVerify(i: VerifyStateInput): boolean {
  return verifyBlockReasons(i).length === 0;
}

/** A verification older than RECHECK_AFTER_DAYS — a triage FLAG only; the
 *  reader notice stays gone (decision 5: no automatic expiry). daysUntil
 *  returns NEGATIVE for past stamps, so "older" means days < -90 (strictly
 *  older: exactly 90 days is NOT yet a re-check). */
export function needsRecheck(verifiedAt: string | null | undefined, todayISO: string): boolean {
  if (!verifiedAt) return false;
  const stamp = verifiedAt.slice(0, 10);
  if (!isoDateValid(stamp)) return false;
  const days = daysUntil(stamp, todayISO);
  return days !== null && days < -RECHECK_AFTER_DAYS;
}

// ── Triage queue row (pure — the service maps DB rows into this) ────────────

export interface QueueSourceRow {
  id: string;
  slug: string;
  name: string;
  pillar: string;
  conducting_body?: string | null;
  official_website?: string | null;
  selection_model?: string | null;
  is_featured?: boolean;
  is_verified?: boolean | null;
  verified_at?: string | null;
  /** The CURRENT edition's jsonb important_dates (embedded select). */
  current_ed?: { important_dates?: unknown } | null;
}

export interface VerificationQueueRow {
  id: string;
  slug: string;
  name: string;
  pillar: string;
  isFeatured: boolean;
  hasDates: boolean;
  hasOfficialUrl: boolean;
  nextDate: string | null;
  daysToNext: number | null;
  verifiedAt: string | null;
  needsRecheck: boolean;
  /** Data-side verify blockers (empty = ready to verify now). */
  reasons: string[];
}

/** Build one triage row. Permission/unsaved flags are the EDITOR's context, so
 *  the queue deliberately omits them — reasons here are the data reasons a
 *  reviewer can see from the list. */
export function buildQueueRow(r: QueueSourceRow, todayISO: string): VerificationQueueRow {
  const dates = Array.isArray(r.current_ed?.important_dates)
    ? (r.current_ed!.important_dates as DateLike[])
    : [];
  const nextDate = pickNextUpcomingDate(dates, todayISO);
  const reasons = verifyBlockReasons({
    name: r.name ?? "",
    conductingBody: r.conducting_body ?? "",
    officialWebsite: r.official_website ?? "",
    selectionAnswered: !!r.selection_model,
    dates,
    hasUnsavedChanges: false,
    canPublish: true,
  });
  const verifiedAt = r.is_verified ? (r.verified_at ?? null) : null;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    pillar: r.pillar,
    isFeatured: !!r.is_featured,
    hasDates: validDates(dates).length > 0,
    hasOfficialUrl: !!(r.official_website ?? "").trim(),
    nextDate,
    daysToNext: daysUntil(nextDate, todayISO),
    verifiedAt,
    needsRecheck: needsRecheck(verifiedAt, todayISO),
    reasons,
  };
}

/** Triage order (decision 2): nearest upcoming date first, no-date rows last,
 *  then featured. Rows with a date tie-break by date, then featured. */
export function sortQueueRows(rows: VerificationQueueRow[]): VerificationQueueRow[] {
  return [...rows].sort((a, b) => {
    if (a.nextDate !== b.nextDate) {
      if (a.nextDate === null) return 1;
      if (b.nextDate === null) return -1;
      return a.nextDate < b.nextDate ? -1 : 1;
    }
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
