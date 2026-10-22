-- ══════════════════════════════════════════════════════════════════════════════
-- PREPARED — DO NOT RUN until the owner types "REMOVE TEST PAGES".
--
-- Deletes EXACTLY the five reference TEST records created for the "reference test
-- exam pages" task and all their children. It targets ONLY rows whose slug starts
-- with `zz-test-` (and the recorded exam ids below). It never touches real content.
--
-- Live counts at seed time (2026-10-22): exams=5, exam_editions=10,
-- content_posts=29, exam_syllabus_subjects=0, exam_resources=0.
--
-- Recorded ids (children deleted first, then the exam):
--   entrance    exam 11111111-1111-4111-8111-111111111111  editions 22222222-…, 33333333-…
--   government  exam 44444444-4444-4444-8444-444444444444  editions 55555555-…, 66666666-…
--   govt-vacancy exam 77777777-7777-7777-8777-777777777777 editions 88888888-…, 99999999-…
--   board       exam cccccccc-cccc-4ccc-8ccc-cccccccccccc   editions dddddddd-…, eeeeeeee-…
--   university  exam aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee   editions bbbbbbbb-cccc-…, cccccccc-dddd-…
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1) exam-linked updates (all seeded posts use zz-test- slugs)
DELETE FROM public.content_posts
 WHERE slug LIKE 'zz-test-%'
    OR exam_id IN (SELECT id FROM public.exams WHERE slug LIKE 'zz-test-%');

-- 2) editions (children of the exams)
DELETE FROM public.exam_syllabus_subjects
 WHERE exam_id IN (SELECT id FROM public.exams WHERE slug LIKE 'zz-test-%');
DELETE FROM public.exam_resources
 WHERE exam_id IN (SELECT id FROM public.exams WHERE slug LIKE 'zz-test-%');
DELETE FROM public.exam_editions
 WHERE exam_id IN (SELECT id FROM public.exams WHERE slug LIKE 'zz-test-%');

-- 3) the exams themselves (clears the current_edition_id FK cycle first)
UPDATE public.exams SET current_edition_id = NULL
 WHERE slug LIKE 'zz-test-%';
DELETE FROM public.exams
 WHERE slug LIKE 'zz-test-%';

-- Verify (expect all zeros) before committing:
--   SELECT count(*) FROM public.exams WHERE slug LIKE 'zz-test-%';
COMMIT;
