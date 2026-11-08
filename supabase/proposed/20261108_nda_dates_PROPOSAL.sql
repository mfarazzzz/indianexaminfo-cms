-- N PROPOSAL — NDA 2026: align the exam dates with the reported UPSC dates
-- Owner batch 8, Phase N. *** NOT APPLIED. ***
-- This file is a PROPOSAL OF RECORD. Nothing in it has been run against the
-- live database. It waits for the owner's exact word: "APPLY NDA DATES",
-- and that word should only be given AFTER the owner has read the official
-- UPSC notices (upsc.gov.in -> "Notice Inviting Applications" for NDA I and
-- NDA II 2026). The values below come from SECONDARY reporting only.
-- ============================================================================
--
-- THE PROBLEM (read-only probe of the live database, 2026-11-08)
--
-- Three exam rows describe the same exam. Two are archived retire-losers
-- that 308 to the winner:
--
--   slug         pillar             published  workflow_status  current_edition_id
--   nda-exam     government-exam    yes        published        8c2c258f-...   <- WINNER
--   nda          entrance-exam      no         archived         bcb31ec2-...
--   upsc-nda     government-exam    no         archived         ef82cea5-...
--
-- The owner's cross-check against the news reports disagrees with what we
-- store. Live values on the WINNER's current edition
-- (exam_editions.id = 8c2c258f-d6e5-4e60-9e30-a1db13224ed2,
--  year 2026, session 'main', edition_label 'NDA 2026', is_current true):
--
--   label              our date      day    reported date  day    source of ours
--   -----------------  -----------   ----   -------------  ----   ---------------
--   NDA (I) Exam       2026-04-13    Mon    2026-04-12     Sun    this edition
--   NDA (II) Exam      2026-09-14    Mon    2026-09-13     Sun    this edition
--   NDA I Notification 2025-12-18    Thu    2025-12-10     Wed    CARRIED from the retired `nda`
--
-- Both reported EXAM dates are Sundays; both of our stored exam dates are
-- Mondays. That is consistent with the general convention of UPSC exams
-- being held on Sundays, and it is the reason the discrepancy is worth
-- acting on -- but it is a convention, not the notice. A Sunday/Monday
-- reading is NOT a confirmation.
--
-- A SECOND FACT WORTH THE OWNER'S ATTENTION: the reported NDA II date
-- (13 September 2026) is EXACTLY the value the archived `nda` loser already
-- carries. The reported NDA I date (12 April 2026) matches NEITHER record
-- (the loser carries 19 April 2026, the winner 13 April 2026). So the
-- reports may be reproducing a stale record rather than the notice, at
-- least for NDA II. Confirm against upsc.gov.in, not against a news page.
--
-- WHY THE EDITION IS THE ONLY ROW TO TOUCH
--   * `exams` rows are the evergreen identity. `nda-exam` is the published
--     one; `nda` and `upsc-nda` are archived and 308 to it through
--     config/retireRedirects.ts in the frontend. Editing a loser changes
--     nothing a reader can see and revives a dead record.
--   * The NDA (I) / NDA (II) split is carried INSIDE one edition row, via
--     the `stage_label` key of each `important_dates` element. There is no
--     per-session edition row anywhere in the database -- all 416 editions
--     use session = 'main'. So one row holds both papers of the 2026 cycle,
--     and the proposal edits it in place.
--
-- WHAT IS DELIBERATELY NOT CHANGED
--   * `verified` stays false on every entry. The owner reading the official
--     notice is what flips it; a proposal that set it true would be
--     asserting a verification this file cannot perform. The optional
--     statement for that is at the very bottom, clearly marked, and is NOT
--     part of the change above.
--   * `exam_editions.notification_date` is left alone. It currently holds
--     '2026-04-13', which is the EXAM date rather than a notification date
--     -- a separate defect, on a separate column, with its own meaning.
--     Fixing it is a different decision and is listed as an open item.
--   * `state` ('confirmed'), `isUrgent`, `type`, `stage_label` and the array
--     ORDER are untouched. The rebuild below preserves the original order
--     element for element.
--   * The archived `nda` and `upsc-nda` editions are untouched, including
--     the 19 April / 13 September pair they carry.
--   * No row is created or deleted. No slug, URL or redirect changes.
--
-- HOW TO CHECK IT WORKED AFTER APPLYING
--   1. re-run the VERIFY SELECT at the bottom: the three dates must show
--      2026-04-12, 2026-09-13 and 2025-12-10, and the other three entries
--      must be byte-identical to what the pre-flight printed;
--   2. the entry count must still be 6 and the order unchanged;
--   3. the frontend tag for the exam is revalidated automatically -- the
--      `trg_revalidate_on_dates_change` trigger fires only when
--      `important_dates` actually changed, and it never fails a save;
--   4. open https://www.indianexaminfo.com/sarkari-naukri/defence/nda-exam
--      and confirm the Important Dates block shows the new dates.
--
-- ROLLBACK: run the ROLLBACK block at the bottom. It restores the three
-- exact dates this file changes, by label, and is safe to run at any time.
--
-- Waiting for the owner's word: "APPLY NDA DATES".

BEGIN;

-- ── PRE-FLIGHT: what the winner's current edition says right now ──────────
-- Expected: 6 elements, in this order --
--   NDA I Notification  2025-12-18  notification  stage_label 'NDA I'
--   NDA (I) Exam        2026-04-13  exam_written  stage_label ''
--   NDA I Result        2026-06-15  result        stage_label 'NDA I'
--   NDA II Notification 2026-06-15  notification  stage_label 'NDA II'
--   NDA I SSB Interview 2026-07-15  interview     stage_label 'NDA I'
--   NDA (II) Exam       2026-09-14  exam_written  stage_label ''
SELECT x.id AS edition_id,
       x.exam_id,
       e.slug AS exam_slug,
       x.year,
       x.session,
       x.edition_label,
       x.is_current,
       x.status,
       x.notification_date,
       jsonb_array_length(x.important_dates) AS date_elements,
       d.ord,
       d.el->>'label' AS label,
       d.el->>'date'  AS date,
       d.el->>'type'  AS type,
       d.el->>'state' AS state,
       d.el->>'verified' AS verified,
       d.el->>'stage_label' AS stage_label
  FROM public.exam_editions x
  JOIN public.exams e ON e.id = x.exam_id
  CROSS JOIN LATERAL jsonb_array_elements(x.important_dates)
       WITH ORDINALITY AS d(el, ord)
 WHERE x.id = '8c2c258f-d6e5-4e60-9e30-a1db13224ed2'
   AND x.exam_id = '4d89b138-74fd-475d-b691-1b4811bd9156'
   AND e.slug = 'nda-exam'
 ORDER BY d.ord;

-- ── THE CHANGE: three dates, three guarded statements ─────────────────────
-- Each statement rebuilds the array with jsonb_agg(... ORDER BY ord), so
-- the six elements keep their exact order and every key other than `date`
-- survives byte-for-byte. Each statement is additionally guarded on the
-- CURRENT value of that label: if the row was edited since this file was
-- written, the guard fails and the statement updates 0 rows instead of
-- silently overwriting a newer value. Watch the row counts.
--
-- 1. NDA (I) Exam:  2026-04-13  ->  2026-04-12   (reported; Sunday)
UPDATE public.exam_editions x
   SET important_dates = (
         SELECT jsonb_agg(
                  CASE
                    WHEN d.el->>'label' = 'NDA (I) Exam'
                     AND d.el->>'date'  = '2026-04-13'
                    THEN jsonb_set(d.el, '{date}', to_jsonb('2026-04-12'::date))
                    ELSE d.el
                  END
                  ORDER BY d.ord)
           FROM jsonb_array_elements(x.important_dates)
                WITH ORDINALITY AS d(el, ord)
       )
 WHERE x.id = '8c2c258f-d6e5-4e60-9e30-a1db13224ed2'
   AND x.exam_id = '4d89b138-74fd-475d-b691-1b4811bd9156'
   AND x.important_dates @> '[{"label":"NDA (I) Exam","date":"2026-04-13"}]'::jsonb;
-- Expected: UPDATE 1

-- 2. NDA (II) Exam: 2026-09-14  ->  2026-09-13   (reported; Sunday)
UPDATE public.exam_editions x
   SET important_dates = (
         SELECT jsonb_agg(
                  CASE
                    WHEN d.el->>'label' = 'NDA (II) Exam'
                     AND d.el->>'date'  = '2026-09-14'
                    THEN jsonb_set(d.el, '{date}', to_jsonb('2026-09-13'::date))
                    ELSE d.el
                  END
                  ORDER BY d.ord)
           FROM jsonb_array_elements(x.important_dates)
                WITH ORDINALITY AS d(el, ord)
       )
 WHERE x.id = '8c2c258f-d6e5-4e60-9e30-a1db13224ed2'
   AND x.exam_id = '4d89b138-74fd-475d-b691-1b4811bd9156'
   AND x.important_dates @> '[{"label":"NDA (II) Exam","date":"2026-09-14"}]'::jsonb;
-- Expected: UPDATE 1

-- 3. NDA I Notification: 2025-12-18  ->  2025-12-10   (reported; Wednesday)
UPDATE public.exam_editions x
   SET important_dates = (
         SELECT jsonb_agg(
                  CASE
                    WHEN d.el->>'label' = 'NDA I Notification'
                     AND d.el->>'date'  = '2025-12-18'
                    THEN jsonb_set(d.el, '{date}', to_jsonb('2025-12-10'::date))
                    ELSE d.el
                  END
                  ORDER BY d.ord)
           FROM jsonb_array_elements(x.important_dates)
                WITH ORDINALITY AS d(el, ord)
       )
 WHERE x.id = '8c2c258f-d6e5-4e60-9e30-a1db13224ed2'
   AND x.exam_id = '4d89b138-74fd-475d-b691-1b4811bd9156'
   AND x.important_dates @> '[{"label":"NDA I Notification","date":"2025-12-18"}]'::jsonb;
-- Expected: UPDATE 1

-- ── VERIFY: the same edition, expected to show the new dates ──────────────
-- Expected:
--   NDA I Notification  2025-12-10
--   NDA (I) Exam        2026-04-12
--   NDA I Result        2026-06-15   (unchanged)
--   NDA II Notification 2026-06-15   (unchanged)
--   NDA I SSB Interview 2026-07-15   (unchanged)
--   NDA (II) Exam       2026-09-13
-- If the element count is not 6, or any of the three unchanged dates moved,
-- ROLLBACK and re-check rather than forcing it.
SELECT jsonb_pretty(x.important_dates) AS important_dates_after,
       jsonb_array_length(x.important_dates) AS date_elements,
       x.updated_at
  FROM public.exam_editions x
 WHERE x.id = '8c2c258f-d6e5-4e60-9e30-a1db13224ed2';

COMMIT;

-- ============================================================================
-- OPEN ITEMS -- UNVERIFIED, DECIDE SEPARATELY
-- ============================================================================
--
-- U1  The official UPSC notice has NOT been read. Every value in this file
--     comes from secondary reporting. Nothing here may be applied until the
--     owner has seen the notice itself.
--
-- U2  NDA (I) exam date: reported 12 April 2026 (Sunday). We store
--     2026-04-13 (Monday). The archived `nda` loser stores 2026-04-19
--     (Sunday). Three different Sundays-in-April stories exist; the notice
--     decides.
--
-- U3  NDA (II) exam date: reported 13 September 2026 (Sunday). We store
--     2026-09-14 (Monday). The reported value is IDENTICAL to the archived
--     loser's 2026-09-13, so this report may be echoing the retired record.
--
-- U4  NDA I notification date: reported 10 December 2025 (Wednesday). We
--     store 2025-12-18 (Thursday), which the 20261106090649 migration
--     CARRIED over from the retired `nda` loser -- i.e. our value is
--     inherited, not independently sourced.
--
-- U5  Every entry on this edition carries state = 'confirmed' while
--     verified = false. "confirmed" is a UI state, "verified" is the
--     honesty flag. This proposal leaves `verified` alone on purpose. If the
--     owner wants the three edited entries marked verified once the notice
--     is read, add this statement to the change block above:
--
--       UPDATE public.exam_editions x
--          SET important_dates = (
--                SELECT jsonb_agg(
--                         CASE WHEN d.el->>'label' IN
--                                    ('NDA (I) Exam','NDA (II) Exam','NDA I Notification')
--                              THEN jsonb_set(d.el, '{verified}', 'true'::jsonb)
--                              ELSE d.el END
--                         ORDER BY d.ord)
--                  FROM jsonb_array_elements(x.important_dates)
--                       WITH ORDINALITY AS d(el, ord))
--        WHERE x.id = '8c2c258f-d6e5-4e60-9e30-a1db13224ed2';
--
-- U6  `exam_editions.notification_date` on this edition holds '2026-04-13',
--     which is the EXAM date, not a notification date. The column and the
--     `important_dates` entry labelled 'NDA I Notification' are two
--     different things and they currently disagree in meaning. What the
--     column is supposed to hold for a bi-annual exam is a product decision
--     the owner has to make (first-paper notification? current-paper
--     notification?), so this proposal leaves it exactly as it is.
--
-- U7  The two NDA (I)/(II) exam entries carry stage_label = '' while every
--     other entry carries 'NDA I' or 'NDA II'. Untouched here; worth a
--     look if the reader page groups by stage.
--
-- U8  NDA I Result (2026-06-15), NDA II Notification (2026-06-15) and NDA I
--     SSB Interview (2026-07-15) were not reported by any source and are
--     untouched. NDA I Result and NDA II Notification share a date, which
--     may or may not be right.
--
-- ============================================================================
-- ROLLBACK -- restores exactly what this file changed. Run separately, never
-- in the same transaction as the change above.
-- ============================================================================
-- BEGIN;
-- UPDATE public.exam_editions x
--    SET important_dates = (
--          SELECT jsonb_agg(
--                   CASE
--                     WHEN d.el->>'label' = 'NDA (I) Exam'        AND d.el->>'date' = '2026-04-12'
--                     THEN jsonb_set(d.el, '{date}', to_jsonb('2026-04-13'::date))
--                     WHEN d.el->>'label' = 'NDA (II) Exam'       AND d.el->>'date' = '2026-09-13'
--                     THEN jsonb_set(d.el, '{date}', to_jsonb('2026-09-14'::date))
--                     WHEN d.el->>'label' = 'NDA I Notification'  AND d.el->>'date' = '2025-12-10'
--                     THEN jsonb_set(d.el, '{date}', to_jsonb('2025-12-18'::date))
--                     ELSE d.el
--                   END
--                   ORDER BY d.ord)
--            FROM jsonb_array_elements(x.important_dates)
--                 WITH ORDINALITY AS d(el, ord))
--  WHERE x.id = '8c2c258f-d6e5-4e60-9e30-a1db13224ed2'
--    AND x.exam_id = '4d89b138-74fd-475d-b691-1b4811bd9156';
-- COMMIT;
