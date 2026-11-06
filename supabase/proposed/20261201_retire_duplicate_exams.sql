-- =====================================================================================
-- PHASE R — APPLY RETIRE: carry the loser cycles into the winners, then archive the
-- seven duplicate exam records. No deletion. Owner approval line for this work:
-- "APPLY RETIRE" (owner batch 7, 2026-11-06).
--
-- Pairs (winner keeps ONE canonical page per exam; the public URL of each loser is
-- already a static 308 in the frontend config, so archiving never creates a dead link
-- once that build is deployed):
--   upsc-cms-examination-2026  -> upsc-cms          (308 in config/retireRedirects.ts)
--   cds                        -> cds-exam          (308 in config/retireRedirects.ts)
--   nda                        -> nda-exam          (308 in config/retireRedirects.ts)
--   nta-ugc-net                -> ugc-net           (308 in config/retireRedirects.ts)
--   rpf-constable-si-recruitment -> rpf-constable   (308 in config/retireRedirects.ts)
--   upsc-nda                   -> nda-exam          (308 added by Phase A1, commit 1ecdb2a)
--   upsc-cds                   -> cds-exam          (308 already in config/redirects.ts:71-72)
--
-- PRE-FLIGHT MEASURED IMMEDIATELY BEFORE APPLYING (live DB):
--   exams total 404; all seven losers exist, workflow_status='published',
--     is_published=true, is_verified=false, verified_at NULL, exactly 1 edition each
--     with is_current=true; winners likewise published (upsc-cms, cds-exam, nda-exam,
--     ugc-net, rpf-constable).
--   references to the loser slugs — searched with EXACT semantics (array containment,
--     path-segment equality, jsonb element equality), never substring, because '%nda%'
--     matches inside words:
--     content_posts.related_exam_slugs 0, blog_posts.related_exam_slugs 0,
--     cms_education_news.related_exams 0, menu_items.url 0, social_posts.landing_url 0,
--     taxonomy_redirects 0 rows at all, navigation_config 0, exams.canonical_url 0.
--     => NOTHING to repoint. (One unrelated defect surfaced while looking: the news row
--     'upsc-exam-calendar-2026-complete-schedule' references upsc-cse-2026,
--     upsc-ese-2026 and upsc-nda-2026, and NONE of those three exams exists.)
--   sitemap view public.exam_content_types_with_data filters
--     is_published = true AND workflow_status = 'published' AND slug !~~ 'zz-test-%'
--     and currently has 399 rows; all 7 losers are inside it.
--   enum exam_workflow_status = draft | published | archived  ('archived' is legal).
--
-- CARRY-OVER RULE: never overwrite a non-empty winner value. A candidate date is
-- skipped when the winner already holds an entry with the same label OR the same
-- (type, date) pair, so the statement is idempotent and re-runnable. Slots that were
-- already occupied and therefore NOT touched are reported in the migration's proof:
--   nda-exam.notification_date = 2026-04-13 stays (the NDA I notification 2025-12-18
--     arrives as an important-dates row instead), and the winner's own exam dates
--     2026-04-13 / 2026-09-14 are NOT replaced by the loser's 2026-04-19 / 2026-09-13.
--     That disagreement is reported to the owner, not resolved here.
--   ugc-net.notification_date stays NULL; only the December 2026 exam date is carried.
--   UPSC CMS, CDS, RPF: no carry-over, exactly as the owner specified.
--
-- The public dates list, the deadline strip, the status line and the JobPosting/exam
-- JSON-LD all read exam_editions.important_dates (services/examService.ts:157 builds
-- exam.dates from it; lib/exam/dateChange.ts:4 calls it "the ONE canonical schedule"),
-- so this migration writes that column. content_modules is read only by the editorial
-- presence gate for sections like admit-card/result, never for the dates list.
-- =====================================================================================

-- ---------------------------------------------------------------- PART 1 — NDA cycles
UPDATE public.exam_editions ed
   SET important_dates = (
        SELECT COALESCE(jsonb_agg(d.obj ORDER BY (d.obj ->> 'date')::date, d.obj ->> 'label'), '[]'::jsonb)
          FROM (
                SELECT obj FROM jsonb_array_elements(COALESCE(ed.important_dates, '[]'::jsonb)) AS keep(obj)
                UNION ALL
                SELECT c.obj FROM (VALUES
                  (jsonb '{"date":"2025-12-18","type":"notification","label":"NDA I Notification","state":"confirmed","isUrgent":false,"verified":false,"stage_label":"NDA I"}'),
                  (jsonb '{"date":"2026-06-15","type":"result","label":"NDA I Result","state":"confirmed","isUrgent":false,"verified":false,"stage_label":"NDA I"}'),
                  (jsonb '{"date":"2026-07-15","type":"interview","label":"NDA I SSB Interview","state":"confirmed","isUrgent":true,"verified":false,"stage_label":"NDA I"}'),
                  (jsonb '{"date":"2026-06-15","type":"notification","label":"NDA II Notification","state":"confirmed","isUrgent":true,"verified":false,"stage_label":"NDA II"}')
                ) AS c(obj)
                WHERE NOT EXISTS (
                    SELECT 1
                      FROM jsonb_array_elements(COALESCE(ed.important_dates, '[]'::jsonb)) AS w(obj)
                     WHERE w.obj ->> 'label' = c.obj ->> 'label'
                        OR (w.obj ->> 'type' = c.obj ->> 'type' AND w.obj ->> 'date' = c.obj ->> 'date')
                )
          ) d
   )
 WHERE ed.id = '8c2c258f-d6e5-4e60-9e30-a1db13224ed2';   -- nda-exam, year 2026, is_current

-- ------------------------------------------------- PART 2 — UGC NET December 2026 date
UPDATE public.exam_editions ed
   SET important_dates = (
        SELECT COALESCE(jsonb_agg(d.obj ORDER BY (d.obj ->> 'date')::date, d.obj ->> 'label'), '[]'::jsonb)
          FROM (
                SELECT obj FROM jsonb_array_elements(COALESCE(ed.important_dates, '[]'::jsonb)) AS keep(obj)
                UNION ALL
                SELECT c.obj FROM (VALUES
                  (jsonb '{"date":"2026-12-14","type":"exam_written","label":"December 2026 Exam","state":"confirmed","isUrgent":true,"verified":false,"stage_label":""}')
                ) AS c(obj)
                WHERE NOT EXISTS (
                    SELECT 1
                      FROM jsonb_array_elements(COALESCE(ed.important_dates, '[]'::jsonb)) AS w(obj)
                     WHERE w.obj ->> 'label' = c.obj ->> 'label'
                        OR (w.obj ->> 'type' = c.obj ->> 'type' AND w.obj ->> 'date' = c.obj ->> 'date')
                )
          ) d
   )
 WHERE ed.id = 'a4763046-a678-4da7-8262-89f2e4262d21';   -- ugc-net, year 2026, is_current

-- ------------------------------------------------------------------ PART 3 — archive
-- trg_derive_is_published sets is_published = (workflow_status = 'published') in the
-- same statement, so each loser leaves the anon-visible set, the sitemap view and every
-- hub listing at once. The rows, their editions, resources and syllabus stay untouched.
UPDATE public.exams
   SET workflow_status = 'archived'
 WHERE slug IN ('upsc-cms-examination-2026', 'cds', 'nda', 'nta-ugc-net',
                'rpf-constable-si-recruitment', 'upsc-nda', 'upsc-cds')
   AND workflow_status <> 'archived';

-- ---------------------------------------------------------------------------- ROLLBACK
-- (kept here so the retire can be undone in one statement if the owner asks)
-- BEGIN;
-- UPDATE public.exams SET workflow_status = 'published'
--  WHERE slug IN ('upsc-cms-examination-2026','cds','nda','nta-ugc-net',
--                 'rpf-constable-si-recruitment','upsc-nda','upsc-cds');
-- UPDATE public.exam_editions SET important_dates =
--   (SELECT jsonb_agg(obj ORDER BY (obj->>'date')::date) FROM jsonb_array_elements(important_dates) e(obj)
--     WHERE NOT (obj->>'label' IN ('NDA I Notification','NDA I Result','NDA I SSB Interview',
--                                  'NDA II Notification','December 2026 Exam')))
--  WHERE id IN ('8c2c258f-d6e5-4e60-9e30-a1db13224ed2','a4763046-a678-4da7-8262-89f2e4262d21');
-- COMMIT;
