-- 20261106090649_retire_duplicate_exams_carry_over_and_archive.sql
--
-- PHASE R — "APPLY RETIRE" (owner batch 7, 2026-11-06). Applied to project
-- cwbhhcqsrbuoybeaondk through Supabase MCP apply_migration on 2026-11-06 and recorded
-- by that tool as version 20261106090649, name retire_duplicate_exams_carry_over_and_archive.
-- Design document and rollback text: supabase/proposed/20261201_retire_duplicate_exams.sql
--
-- One canonical page per exam. Seven duplicate exam records are ARCHIVED (never deleted)
-- and the cycles that only the losers carried are copied into the winners first, so no
-- reader loses a date. Every loser URL was already a static 308 in the frontend config
-- except upsc-nda, whose 308 ships in frontend commit 1ecdb2a.
--
--   loser                            -> winner
--   upsc-cms-examination-2026                          upsc-cms
--   cds            (/admission/defence-entrance/cds)   cds-exam
--   nda            (/admission/defence-entrance/nda)   nda-exam
--   nta-ugc-net    (/sarkari-naukri/teaching/...)      ugc-net (/admission/research-fellowships/)
--   rpf-constable-si-recruitment                       rpf-constable
--   upsc-nda       (/sarkari-naukri/upsc/upsc-nda)     nda-exam
--   upsc-cds       (/sarkari-naukri/upsc/upsc-cds)     cds-exam
--
-- PRE-FLIGHT (measured immediately before applying; all seven losers were published,
-- unverified, with exactly one current edition each, and NOTHING referenced their slugs:
-- content_posts/blog_posts/cms_education_news related arrays 0, menu_items 0,
-- social_posts 0, taxonomy_redirects table empty, navigation_config 0, canonical_url 0 —
-- searched with array/path-element equality, never substring, because '%nda%' matches
-- inside ordinary words).
--
-- PROVED TWICE in transactions that aborted themselves before applying:
--   exams_total 404 -> 404 (no deletion)      published 404 -> 397 (exactly -7)
--   view public.exam_content_types_with_data 399 -> 392, losers inside it 7 -> 0
--   nda-exam important_dates 2 -> 6 (+4 carried), ugc-net 6 -> 7 (+1 carried)
--   re-running the carry-over added nothing (idempotent)
--   winner fingerprints (slug|name|workflow_status|is_published|is_verified|
--     notification_date|vacancy|official_website) unchanged = true
--
-- APPLIED STATE, re-measured after the apply:
--   exams_total=404 published=397 archived=7 view_rows=392 losers_still_in_view=0
--   nda-exam dates now: 2025-12-18 NDA I Notification, 2026-04-13 NDA (I) Exam (its own,
--     never overwritten), 2026-06-15 NDA I Result, 2026-06-15 NDA II Notification,
--     2026-07-15 NDA I SSB Interview, 2026-09-14 NDA (II) Exam (its own)
--   ugc-net carries {date 2026-12-14, label "December 2026 Exam"}
--   all five winners still workflow_status=published, is_published=true
--
-- SLOTS DELIBERATELY NOT TOUCHED (the owner's "never overwrite a non-empty value"):
--   nda-exam.notification_date stayed 2026-04-13, and the winner's own exam dates
--   2026-04-13 / 2026-09-14 were NOT replaced by the loser's 2026-04-19 / 2026-09-13.
--   That disagreement between the two records is reported to the owner rather than
--   resolved here; it needs a human look at the notices, not a migration.
--   stage_label of the carried NDA II Notification is "NDA II" (the source row carried
--   "NDA I" on both cycles; the owner asked for the II rows to be labelled by cycle).
--
-- THE WRITE STORE: exam_editions.important_dates is the ONE canonical schedule the
-- frontend reads (services/examService.ts:157 builds exam.dates from it; lib/exam/
-- dateChange.ts:4 says the strip, the status line, the dates list and the JSON-LD all
-- read it). Verified live after the apply: nda-exam's page contains "NDA I Notification",
-- "NDA II Notification" and "SSB Interview", and ugc-net's contains
-- "December 2026 Exam".
--
-- trg_derive_is_published sets is_published = (workflow_status = 'published') in the same
-- statement, so each loser left the anon-visible set, the sitemap view and the hub
-- listings at once. Each archived row keeps its own editions, resources, syllabus and
-- activity history in place; nothing is dropped.
--
-- LIVE-AFTER MEASURED ON PRODUCTION (frontend build stamp 11afc80, the batch-6 tip):
--   6 of 7 losers answer 308 with a relative Location to their winner. upsc-nda still
--   answers 200 from the ISR cache and is still listed in the live sitemap.xml, because
--   its 308 lives in the UNPUSHED frontend commit 1ecdb2a; when that build ships, the
--   redirect wins before any data read and both symptoms disappear.
--   All five winners: 200 and self-canonical.
--   sitemap.xml still 874 <url> entries (cached; the six already-redirected losers were
--   already absent because the sitemap guard reads config/redirects.ts).

-- ---------------------------------------------------------------- PART 1 — NDA cycles
UPDATE public.exam_editions ed SET important_dates = (
    SELECT COALESCE(jsonb_agg(d.obj ORDER BY (d.obj ->> 'date')::date, d.obj ->> 'label'), '[]'::jsonb) FROM (
      SELECT obj FROM jsonb_array_elements(COALESCE(ed.important_dates,'[]'::jsonb)) AS keep(obj)
      UNION ALL
      SELECT c.obj FROM (VALUES
        (jsonb '{"date":"2025-12-18","type":"notification","label":"NDA I Notification","state":"confirmed","isUrgent":false,"verified":false,"stage_label":"NDA I"}'),
        (jsonb '{"date":"2026-06-15","type":"result","label":"NDA I Result","state":"confirmed","isUrgent":false,"verified":false,"stage_label":"NDA I"}'),
        (jsonb '{"date":"2026-07-15","type":"interview","label":"NDA I SSB Interview","state":"confirmed","isUrgent":true,"verified":false,"stage_label":"NDA I"}'),
        (jsonb '{"date":"2026-06-15","type":"notification","label":"NDA II Notification","state":"confirmed","isUrgent":true,"verified":false,"stage_label":"NDA II"}')) c(obj)
      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(ed.important_dates,'[]'::jsonb)) AS w(obj)
                         WHERE w.obj ->> 'label' = c.obj ->> 'label'
                            OR (w.obj ->> 'type' = c.obj ->> 'type' AND w.obj ->> 'date' = c.obj ->> 'date'))
    ) d) WHERE ed.id = '8c2c258f-d6e5-4e60-9e30-a1db13224ed2';

-- ------------------------------------------------- PART 2 — UGC NET December 2026 date
UPDATE public.exam_editions ed SET important_dates = (
    SELECT COALESCE(jsonb_agg(d.obj ORDER BY (d.obj ->> 'date')::date, d.obj ->> 'label'), '[]'::jsonb) FROM (
      SELECT obj FROM jsonb_array_elements(COALESCE(ed.important_dates,'[]'::jsonb)) AS keep(obj)
      UNION ALL
      SELECT c.obj FROM (VALUES
        (jsonb '{"date":"2026-12-14","type":"exam_written","label":"December 2026 Exam","state":"confirmed","isUrgent":true,"verified":false,"stage_label":""}')) c(obj)
      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(ed.important_dates,'[]'::jsonb)) AS w(obj)
                         WHERE w.obj ->> 'label' = c.obj ->> 'label'
                            OR (w.obj ->> 'type' = c.obj ->> 'type' AND w.obj ->> 'date' = c.obj ->> 'date'))
    ) d) WHERE ed.id = 'a4763046-a678-4da7-8262-89f2e4262d21';

-- ------------------------------------------------------------------ PART 3 — archive
UPDATE public.exams SET workflow_status = 'archived'
 WHERE slug IN ('upsc-cms-examination-2026','cds','nda','nta-ugc-net',
                'rpf-constable-si-recruitment','upsc-nda','upsc-cds')
   AND workflow_status <> 'archived';
