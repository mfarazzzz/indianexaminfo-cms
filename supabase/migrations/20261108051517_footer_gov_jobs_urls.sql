-- ============================================================================
-- E3 — footer "Government Jobs" column: point each label at its own hub.
-- Owner batch 8 (owner approval line: "APPLY FOOTER URLS").
-- Source proposal: supabase/proposed/20261106_footer_gov_jobs_urls_PROPOSAL.sql
-- Remote version: 20261108051517 (name: footer_gov_jobs_urls) — applied via MCP
-- apply_migration on 2026-11-08, after the owner's explicit approval.
-- ============================================================================
--
-- THE PROBLEM (re-verified 2026-11-08, immediately before this migration)
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
-- the site — and the destination is the wrong KIND of page: /sarkari-naukri/exam
-- titles itself "Government Exams 2026 - Competitive Exam Notifications & Results",
-- which is the exam list, not the job list the label promises.
--
-- PRE-FLIGHT (run 2026-11-08, read-only, before the change):
--   f6000000-…0002 | SSC Jobs     | /sarkari-naukri/exam | is_active=true | order_index=1
--   f6000000-…0003 | Banking Jobs | /sarkari-naukri/exam | is_active=true | order_index=2
--   f6000000-…0004 | Railway Jobs | /sarkari-naukri/exam | is_active=true | order_index=3
--   f6000000-…0005 | Defence Jobs | /sarkari-naukri/exam | is_active=true | order_index=4
--   f6000000-…0006 | State Jobs   | /sarkari-naukri/bharti | is_active=true | order_index=5
--   f6000000-…0007 | All Govt Jobs| /sarkari-naukri        | is_active=true | order_index=6
-- Every UPDATE below pins the id AND the label AND the current url, so a row that
-- was renamed or repointed in the CMS since the proposal was written is NOT
-- silently repointed — it simply matches zero rows and the post-proof shows it.
--
-- THE TARGETS (re-probed live on 2026-11-08, read-only GETs):
--   /sarkari-naukri/ssc       200  "SSC Jobs — Latest Government Jobs & Notifications"
--   /sarkari-naukri/banking   200  "Banking Jobs — Latest Government Jobs & Notifications"
--   /sarkari-naukri/railways  200  "Railways — Latest Government Jobs & Notifications"
--   /sarkari-naukri/defence   200  "Defence Jobs — Latest Government Jobs & Notifications"
-- Each is a real category hub with published records behind it (ssc 10, banking 12,
-- railways 8, defence 5) and each renders its own listing — verified in the live
-- page body on 2026-11-08, not assumed from the URL shape.
--
-- DELIBERATELY NOT CHANGED
--   * State Jobs stays /sarkari-naukri/bharti. The tempting "category hub"
--     /sarkari-naukri/state-government-jobs answers 308 -> /sarkari-naukri/bharti
--     (self-canonical = NO). The current url IS the winner of that redirect, so
--     pointing at it would only add a hop. (The owner's brief: "State Jobs stays
--     as is".)
--   * All Govt Jobs stays /sarkari-naukri (200, self-canonical).
--   * No label text changes, no row is deleted, no order_index changes.
--
-- POST-PROOF (run 2026-11-08, after the change):
--   f6000000-…0002 | SSC Jobs     | /sarkari-naukri/ssc
--   f6000000-…0003 | Banking Jobs | /sarkari-naukri/banking
--   f6000000-…0004 | Railway Jobs | /sarkari-naukri/railways
--   f6000000-…0005 | Defence Jobs | /sarkari-naukri/defence
--   f6000000-…0006 | State Jobs   | /sarkari-naukri/bharti   (unchanged)
--   f6000000-…0007 | All Govt Jobs| /sarkari-naukri          (unchanged)
--
-- The footer renders from getMenuBySlug('footer-nav'), which the frontend caches:
-- the four links become visible on the live site after the frontend is deployed
-- (or the menu cache is revalidated) — not by restarting anything.
--
-- ROLLBACK — restores exactly what this file changed. Owner-run, never automatic:
--
--   BEGIN;
--   UPDATE public.menu_items SET url = '/sarkari-naukri/exam'
--    WHERE id IN (
--      'f6000000-0000-0000-0000-000000000002',
--      'f6000000-0000-0000-0000-000000000003',
--      'f6000000-0000-0000-0000-000000000004',
--      'f6000000-0000-0000-0000-000000000005')
--      AND url IN ('/sarkari-naukri/ssc','/sarkari-naukri/banking',
--                  '/sarkari-naukri/railways','/sarkari-naukri/defence');
--   COMMIT;
-- ============================================================================

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
