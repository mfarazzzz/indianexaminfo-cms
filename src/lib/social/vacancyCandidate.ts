/**
 * vacancyCandidate.ts — the CMS side of the VACANCY → Telegram candidate hook
 * (owner batch 8, H3).
 *
 * THE TWO COPIES OF THE source_type VALUE.
 * `VACANCY_SOURCE_TYPE` below and the one in
 * `supabase/functions/_shared/social.ts` MUST be the same string: the CMS writes the
 * request body and the Edge Function writes the row. The `src` tree does not import
 * from the Edge Function tree (the same reason `src/lib/testContent.ts` exists as a
 * mirror of the shared edge rule), so the value is written twice — and
 * `src/lib/social/vacancyCandidate.test.ts` pins the two copies together so they
 * cannot drift.
 *
 * WHY A VACANCY GETS ITS OWN EVENT NAME.
 * The idempotency key is `channel|source_type|source_id|event`. An exam has two events
 * ("published" and "verified") because those are two different announcements. A vacancy
 * has ONE: the owner asked for "a vacancy that becomes verified+published", so both
 * acts converge on the SAME key. Without that, publishing a row that was verified
 * earlier and then verifying it again would leave TWO drafts of one notice in the
 * queue — and approving both would post the same vacancy twice.
 */
export const VACANCY_SOURCE_TYPE = "sarkari_naukri";

/** The single event a vacancy candidate carries. */
export const VACANCY_CANDIDATE_EVENT = "published";

/**
 * May this row become a candidate at all?
 *
 * Both facts have to hold: the row is PUBLISHED (a reader can reach it) and it is
 * VERIFIED (somebody checked it against the official notification). An unverified row
 * is a draft somebody is still working on, and a closed window is not worth a channel
 * post. The database is the authority — the Edge Function re-checks both facts — but
 * checking here means the common case never spends a request.
 */
export function mayQueueVacancyCandidate(row: {
  workflowStatus?: string | null;
  verifiedAt?: string | null;
}): boolean {
  return row?.workflowStatus === "published" && !!row?.verifiedAt;
}
