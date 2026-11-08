-- ============================================================================
-- W2 PROPOSAL — footer "Government Jobs" column: point each label at its own hub
-- Owner batch 6, Phase W2. APPLIED 2026-11-08 (owner batch 8 approval line:
-- "APPLY FOOTER URLS"). Remote version 20261108051517 (footer_gov_jobs_urls);
-- the applied file is supabase/migrations/20261108051517_footer_gov_jobs_urls.sql.
-- This file stays as the proposal of record — the applied migration carries the
-- same SQL plus the pre-flight, the post-proof and the rollback block.
-- ============================================================================
--
-- THE PROBLEM (re-verified 2026-11-06, backlog refresh V1)
-- menu_items, menu slug 'footer-nav', heading 'Government Jobs':
--
--   id                                   label            url                     order
--   f6000000-0000-0000-0000-000000000002  SSC Jobs        /sarkari-naukri/exam     1
--   f6000000-0000-0000-0000-000000000003  Banking Jobs    /sarkari-naukri/exam     2
--   f6000000-0000-0000-0000-000000000004  Railway Jobs    /sarkari-naukri/exam     3
--   f6000000-0000-0000-0000-000000000005  Defence Jobs    /sarkari-naukri/exam     4
--   f6000000-0000-0000-0000-000000000006  State Jobs      /sarkari-naukri/bharti   5
--   f6000000-0000-0000-0000-000000000007  All Govt Jobs   /sarkari-naukri          6
--
-- Four different labels, one destination, on a block that renders on every page of
-- the site. And the destination is the wrong KIND of page: /sarkari-naukri/exam
-- titles itself "Government Exams 2026 - Competitive Exam Notifications & Results",
-- which is the exam list, not the job list the label promises.
--
-- WHY THE PROPOSED TARGETS ARE SAFE — each was probed on the LIVE site first
-- (node .git/w2-hub-probe.mjs, read-only GETs, 2026-11-06):
--
--   /sarkari-naukri/ssc        200  self-canonical=yes  "SSC Jobs - Latest Government Jobs & Notifications"      ELIGIBLE
--   /sarkari-naukri/banking    200  self-canonical=yes  "Banking Jobs - Latest Government Jobs & Notifications"   ELIGIBLE
--   /sarkari-naukri/railways   200  self-canonical=yes  "Railways - Latest Government Jobs & Notifications"       ELIGIBLE
--   /sarkari-naukri/defence    200  self-canonical=yes  "Defence Jobs - Latest Government Jobs & Notifications"   ELIGIBLE
--
-- Each is a real category hub with published records behind it (categories x exams,
-- published only): ssc 10, banking 12, railways 8, defence 5. None of the four is a
-- redirect source, so none creates a chain, and none is withheld from the sitemap.
--
-- WHAT IS DELIBERATELY NOT CHANGED
--   * State Jobs stays /sarkari-naukri/bharti. The tempting "category hub"
--     /sarkari-naukri/state-government-jobs was probed too and answers
--     308 -> /sarkari-naukri/bharti (self-canonical=NO). The current URL is the
--     winner of that redirect, so changing it would only add a hop.
--   * All Govt Jobs stays /sarkari-naukri (200, self-canonical).
--   * No label text changes, no row is deleted, no order_index changes.
--
-- HOW TO CHECK IT WORKED AFTER APPLYING
--   1. re-run the verification SELECT at the bottom; four urls must have moved;
--   2. the footer renders from getMenuBySlug('footer-nav'), which the frontend
--      caches — confirm on https://www.indianexaminfo.com/ that the four links now
--      carry /ssc, /banking, /railways, /defence (a redeploy or a revalidation is
--      what makes it visible, not a restart);
--   3. click each of the four and confirm 200 + the hub's own canonical.
--
-- ROLLBACK: run the ROLLBACK block at the bottom. It restores the four exact urls
-- this file changes, by id, and is safe to run at any time.

-- ─── OWNER BATCH 7, A4 — RE-PROBED 2026-11-06, STILL NOT APPLIED ───────────────────
-- The batch-7 brief made this phase conditional ("apply only if the owner's approval
-- word appears below") and the only approval word in that prompt was APPLY RETIRE, so
-- nothing was applied. The re-probe the brief required was run anyway and it still
-- passes, so the file remains ready to run at any time:
--   /sarkari-naukri/ssc      200 self-canonical=yes  ELIGIBLE
--   /sarkari-naukri/banking  200 self-canonical=yes  ELIGIBLE
--   /sarkari-naukri/railways 200 self-canonical=yes  ELIGIBLE
--   /sarkari-naukri/defence  200 self-canonical=yes  ELIGIBLE
--   /sarkari-naukri/state-government-jobs  308 -> /sarkari-naukri/bharti  NOT ELIGIBLE
--     (unchanged reasoning: the current State Jobs url is already the winner of that
--     redirect, so pointing at it would only add a hop)
--   pre-flight rows: ids ending …0002/…0003/…0004/…0005 still carry the labels SSC
--     Jobs / Banking Jobs / Railway Jobs / Defence Jobs, url /sarkari-naukri/exam,
--     is_active=true and order_index 1-4 — exactly what the four UPDATEs pin below, so
--     each is expected to match one row and no other row.
-- Waiting for the owner's word: "APPLY FOOTER URLS".

BEGIN;

-- ── PRE-FLIGHT: what the four rows say right now ────────────────────────────
SELECT mi.id, mi.label, mi.url, mi.is_active, mi.order_index, mi.column_index
FROM public.menu_items mi
JOIN public.menus m ON m.id = mi.menu_id
WHERE m.slug = 'footer-nav'
  AND mi.id IN (
    'f6000000-0000-0000-0000-000000000002',
    'f6000000-0000-0000-0000-000000000003',
    'f6000000-0000-0000-0000-000000000004',
    'f6000000-0000-0000-0000-000000000005')
ORDER BY mi.order_index;

-- ── THE CHANGE: four labels, four honest destinations ───────────────────────
-- Each statement pins the label as well as the id, so a row whose label has been
-- renamed in the CMS since this proposal was written is NOT silently repointed.
UPDATE public.menu_items
   SET url = '/sarkari-naukri/ssc'
 WHERE id = 'f6000000-0000-0000-0000-000000000002'
   AND label = 'SSC Jobs'
   AND url = '/sarkari-naukri/exam';

UPDATE public.menu_items
   SET url = '/sarkari-naukri/banking'
 WHERE id = 'f6000000-0000-0000-0000-000000000003'
   AND label = 'Banking Jobs'
   AND url = '/sarkari-naukri/exam';

UPDATE public.menu_items
   SET url = '/sarkari-naukri/railways'
 WHERE id = 'f6000000-0000-0000-0000-000000000004'
   AND label = 'Railway Jobs'
   AND url = '/sarkari-naukri/exam';

UPDATE public.menu_items
   SET url = '/sarkari-naukri/defence'
 WHERE id = 'f6000000-0000-0000-0000-000000000005'
   AND label = 'Defence Jobs'
   AND url = '/sarkari-naukri/exam';

-- ── VERIFY: the same four rows, expected to show the new urls ───────────────
SELECT mi.id, mi.label, mi.url
FROM public.menu_items mi
JOIN public.menus m ON m.id = mi.menu_id
WHERE m.slug = 'footer-nav'
  AND mi.id IN (
    'f6000000-0000-0000-0000-000000000002',
    'f6000000-0000-0000-0000-000000000003',
    'f6000000-0000-0000-0000-000000000004',
    'f6000000-0000-0000-0000-000000000005')
ORDER BY mi.order_index;

-- Expected:
--   SSC Jobs      /sarkari-naukri/ssc
--   Banking Jobs  /sarkari-naukri/banking
--   Railway Jobs  /sarkari-naukri/railways
--   Defence Jobs  /sarkari-naukri/defence
--
-- If the numbers of updated rows are not 1/1/1/1, something renamed or repointed
-- these rows in the meantime: ROLLBACK and re-check rather than forcing it.

COMMIT;

-- ============================================================================
-- ROLLBACK — restores exactly what this file changed. Run separately, never in
-- the same transaction as the change above.
-- ============================================================================
-- BEGIN;
-- UPDATE public.menu_items SET url = '/sarkari-naukri/exam'
--  WHERE id IN (
--    'f6000000-0000-0000-0000-000000000002',
--    'f6000000-0000-0000-0000-000000000003',
--    'f6000000-0000-0000-0000-000000000004',
--    'f6000000-0000-0000-0000-000000000005')
--    AND url IN ('/sarkari-naukri/ssc','/sarkari-naukri/banking',
--                '/sarkari-naukri/railways','/sarkari-naukri/defence');
-- COMMIT;
