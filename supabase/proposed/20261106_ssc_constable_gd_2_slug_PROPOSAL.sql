-- ============================================================================
-- W3 PROPOSAL — ssc-constable-gd-2: what is actually mislabelled, and the fix
-- Owner batch 6, Phase W3. NOT APPLIED. NEEDS A DECISION before anything runs.
-- No migration was created or executed in batch 6; this file is a proposal.
-- ============================================================================
--
-- WHAT SEPTEMBER CLAIMED (docs/PROGRAMME_BACKLOG.md, row B):
--   "ssc-constable-gd-2 named 'Delhi Police Constable' — confirmed mislabel",
--   High (misinformation on a live page), effort S.
--
-- WHAT IS TRUE ON 2026-11-06 — the record, read from the live database:
--
--   slug                ssc-constable-gd-2
--   name                Delhi Police Constable
--   short_name          Delhi Police
--   pillar              government-exam
--   category            police-paramilitary  ("Police & Paramilitary")
--   conducting_body     SSC
--   official_website    https://ssc.gov.in
--   seo_title           Delhi Police Constable 2026
--   seo_description     "Delhi Police Constable 2026 through SSC - 7500 vacancies."
--   is_published        true     workflow_status: published     canonical_url: null
--   is_verified         false    content_source: manual
--   created_at          2026-07-11   updated_at 2026-09-25
--   current edition     year 2026, label "Delhi Police 2026", status upcoming,
--                       notification_date 2026-11-28, vacancy 7500,
--                       fee {general:100}, eligibility 18-25 / 12th pass,
--                       edition updated 2026-09-02
--
--   Live page: https://www.indianexaminfo.com/sarkari-naukri/police-paramilitary/ssc-constable-gd-2
--              -> 200, title "Delhi Police Constable 2026", h1 "Delhi Police Constable 2026",
--                 canonical = its own URL.
--
-- THE FINDING IS NOT WHAT SEPTEMBER SAID, AND THAT MATTERS
-- The NAME is not a mislabel. Delhi Police Constable (Executive) recruitment is run by the
-- Staff Selection Commission — that is exactly what the record's own data says
-- (conducting_body SSC, official_website ssc.gov.in, "through SSC" in its description), and it
-- is what the SSC site shows: ssc.gov.in's own notice board carries
-- "Sub-Inspectors in Delhi Police and Central Armed Police Forces Examination, 2026"
-- (https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_capf_2026.pdf),
-- and third-party trackers describe the Constable (Executive) recruitment as an SSC exam
-- ("SSC Delhi Police Constable (Executive)", 7,201/7,565-post figures). This agent has NOT read
-- the official Constable (Executive) notification PDF, so the post count and the
-- 2026-11-28 notification date remain UNVERIFIED — see "Before applying anything" below.
--
-- What IS wrong is the SLUG. `ssc-constable-gd-2` reads as "SSC Constable GD, second one", and
-- a real, different SSC GD Constable record exists alongside it:
--
--   ssc-gd-constable     "SSC GD Constable"        SSC   vacancy 35,000  notification 2026-11-01
--   ssc-constable-gd-2   "Delhi Police Constable"  SSC   vacancy  7,500  notification 2026-11-28
--   ssc-head-constable   "SSC Head Constable in Delhi Police"  SSC  vacancy 835
--
-- So the risk on this page is not misinformation about the exam — it is a URL that invites the
-- reader (and any tool matching on the slug) to believe it is the SSC GD page, plus a `-2`
-- suffix that looks like a duplicate the site forgot to clean up.
--
-- IS ANYTHING ELSE POINTING AT THE SLUG? Checked, all zero except its own rows:
--   content_posts.related_exam_slugs 0 · content_posts.canonical_url 0 ·
--   blog_posts.related_exam_slugs 0 · menu_items (url) 0 · menu_items (exam_id) 0 ·
--   taxonomy_redirects 0 · social_posts.landing_url 0 · exam_editions 1 (its own edition)
-- A slug change is therefore contained: the only external consequence is the public URL.

-- ── OPTION A (recommended): rename the slug, ship a redirect with it ────────
-- URL goes from /sarkari-naukri/police-paramilitary/ssc-constable-gd-2 to
--         /sarkari-naukri/police-paramilitary/delhi-police-constable-executive-2026
--
-- Two halves, and the second is not SQL — do not run one without the other:
--   1. this UPDATE (below);
--   2. a redirect entry so the old, already-indexed URL 308s instead of 404ing. The project's
--      own convention for retiring a duplicate page is config/retireRedirects.ts
--      (indianexaminfo-frontend), whose invariant test asserts every destination is a real,
--      intended canonical page. Add:
--        { source: "/sarkari-naukri/police-paramilitary/ssc-constable-gd-2",
--          destination: "/sarkari-naukri/police-paramilitary/delhi-police-constable-executive-2026" }
--      and push; the host builds it.
--   3. revalidate the affected page after the change (the CMS publish path already does this; a
--      bare SQL UPDATE does not — an ISR-cached page would keep showing the old slug until its
--      window expires).
--
-- Cost of doing (1) without (2): the old URL 404s, and it is currently in the live sitemap and
-- self-canonicalised, so that is a lost indexed page and a broken inbound link set. That is why
-- this file is a proposal and not an applied change.

BEGIN;

-- Guard: exactly one row, still carrying the legacy slug and the expected name. If this returns
-- 0 rows, stop — the record has already been renamed or deleted and the rest must not run.
SELECT id, slug, name, updated_at
FROM public.exams
WHERE slug = 'ssc-constable-gd-2' AND name = 'Delhi Police Constable';

UPDATE public.exams
   SET slug = 'delhi-police-constable-executive-2026'
 WHERE slug = 'ssc-constable-gd-2'
   AND name = 'Delhi Police Constable'
   AND id = (SELECT id FROM public.exams WHERE slug = 'ssc-constable-gd-2');

-- Verify: one row on the new slug, none on the old.
SELECT 'new' AS which, slug, name, pillar, category_id IS NOT NULL AS has_category
FROM public.exams WHERE slug = 'delhi-police-constable-executive-2026'
UNION ALL
SELECT 'old', slug, name, pillar, category_id IS NOT NULL FROM public.exams WHERE slug = 'ssc-constable-gd-2';

-- Expected: new = 1 row, old = 0 rows. Then add the redirect, push, and revalidate.

COMMIT;

-- ── OPTION B: change nothing ────────────────────────────────────────────────
-- Defensible: the page tells the truth about the exam, and the slug is an internal identifier
-- that most readers never parse. Cost: the `-2` legacy slug keeps looking like an uncleaned
-- duplicate to anyone auditing the sitemap, and the URL keeps misleading slug-based tooling.

-- ── OPTION C (do this first regardless): verify the record ──────────────────
-- `is_verified = false`, `content_source = manual`, and the edition's notification_date is
-- 2026-11-28 — 22 days in the future as of this refresh, last touched 2026-09-02. Whatever the
-- slug decision, the dates and the 7,500 figure should be checked against the SSC notification
-- before the page is relied on, through the normal verify flow (which requires publish_exam and
-- writes only the three verified columns). A wrong date on a future exam page is a bigger user
-- harm than an ugly slug.

-- ── ROLLBACK for Option A ───────────────────────────────────────────────────
-- BEGIN;
-- UPDATE public.exams SET slug = 'ssc-constable-gd-2'
--  WHERE slug = 'delhi-police-constable-executive-2026' AND name = 'Delhi Police Constable';
-- COMMIT;
-- Then remove the redirect entry from config/retireRedirects.ts and push, so the original URL
-- serves the page again rather than pointing at a slug that no longer exists.

-- ── NOT TOUCHED BY THIS PROPOSAL ────────────────────────────────────────────
-- name, short_name, seo_title, seo_description, category, conducting_body, official_website,
-- the edition and its dates. No DELETE anywhere. The five retire-loser records
-- (upsc-cms-examination-2026, cds, nda, nta-ugc-net, rpf-constable-si-recruitment) are not
-- referenced here and are not part of this change.
