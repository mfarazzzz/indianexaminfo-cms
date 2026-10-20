-- ============================================================================
-- A PHASE 2 — RETIRE THE 5 DUPLICATE EXAM RECORDS  (PROPOSAL — DO NOT APPLY)
-- ============================================================================
-- STATUS: PREPARED ONLY. NO ROWS WRITTEN THIS TURN.
--
-- ⛔  APPLY ONLY AFTER the owner types the exact words "APPLY RETIRE" AND has
--     confirmed the FRONTEND deploy with the Phase-1 redirects live (so no loser
--     URL 404s between the two steps). Until then this file is inert.
--
-- MECHANISM — the SAME path the CMS editor uses to unpublish/archive: set
--   workflow_status. The trigger derive_is_published_from_workflow() then sets
--   is_published = (workflow_status = 'published') automatically. We NEVER write
--   is_published directly. Winner records are untouched and stay published.
--
-- Phase-1 redirects already map every loser URL to its winner (config/
-- retireRedirects.ts), so retiring the loser record leaves no inbound link dead.
--
-- Winners (stay published): upsc-cms, cds-exam, nda-exam, ugc-net, rpf-constable
-- Losers (archive):         upsc-cms-examination-2026, cds, nda, nta-ugc-net,
--                           rpf-constable-si-recruitment
-- aiims-nursing / aiims-nursing-officer are DIFFERENT exams — NOT touched.
--
-- CYCLE NOTE (owner): NDA, CDS and UGC NET run TWICE a year (I/II, June/December).
--   Dates that differ between a pair are usually DIFFERENT CYCLES, not errors —
--   carry the missing cycle into the winner. UPSC CMS is ONE cycle a year: its
--   pair CONFLICTS (exam 20-Jul vs 02-Aug; vacancy 827 vs 1358) and BOTH are
--   unverified seeds → DO NOT copy; the winner is re-sourced from the official
--   notice by the owner.
-- ----------------------------------------------------------------------------
-- CARRY-OVER TABLE (owner ticks before applying; nothing copied automatically):
--
--   [ ] NDA  → winner nda-exam lacks these CYCLED rows (from loser `nda`):
--         NDA I  Notification   2025-12-18   (type notification)
--         NDA I  Result         2026-06-15   (type result)
--         NDA I  SSB Interview  2026-07-15   (type interview)
--         NDA II Notification   2026-06-15   (type notification)
--         ⚠ exam-date discrepancies for the SAME cycle — reconcile, do not
--           overwrite: NDA I 13-Apr (winner) vs 19-Apr (loser);
--                         NDA II 14-Sep (winner) vs 13-Sep (loser).
--   [ ] UGC NET → winner ugc-net lacks the DECEMBER cycle (from loser nta-ugc-net):
--         UGC NET December 2026   2026-12-14   (type exam_written)
--         ⚠ June exam-date discrepancy — reconcile: winner 01-Jun/18-Jun vs
--           loser 08-Jun.
--   [x] CDS  → loser `cds` has NO dates. Nothing to carry.
--   [x] RPF  → loser rpf-constable-si-recruitment is an EMPTY stub (0 dates,
--              no vacancy/fee/eligibility). Nothing to carry.
--   [ ] UPSC CMS → DO NOT COPY. Conflicting unverified seed (see cycle note).
--              Winner upsc-cms is re-sourced from the official notice by owner.
--
-- BEFORE (live, read-only 2026-10-20): published exams = 398.
-- AFTER  this script: published exams = 393 (5 archived). The 5 losers drop out
--   of app/sitemap.ts on the next crawl (is_published=false → not eligible); the
--   Phase-1 308s keep their old URLs resolving to the winners. Category/related
--   -exam counts shift by the 5 removed records.
-- ============================================================================

BEGIN;

-- Archive the five losers through the editor's workflow path (trigger flips
-- is_published). Guarded to published rows only so a re-run is a no-op.
UPDATE exams SET workflow_status = 'archived'
 WHERE slug IN (
   'upsc-cms-examination-2026',
   'cds',
   'nda',
   'nta-ugc-net',
   'rpf-constable-si-recruitment'
 )
 AND workflow_status = 'published';

-- Verification (expect: 5 rows archived, winners still published, is_published
-- flipped false for the losers by the trigger).
-- SELECT slug, workflow_status, is_published FROM exams
--  WHERE slug = ANY(ARRAY['upsc-cms','upsc-cms-examination-2026','cds','cds-exam',
--                         'nda','nda-exam','nta-ugc-net','ugc-net',
--                         'rpf-constable','rpf-constable-si-recruitment'])
--  ORDER BY slug;
-- SELECT count(*) AS published_now FROM exams WHERE is_published = true;   -- 393

-- COMMIT;   -- owner runs COMMIT only after ticking the carry-over table above.
ROLLBACK;   -- default: safe no-op if this file is ever executed by mistake.
