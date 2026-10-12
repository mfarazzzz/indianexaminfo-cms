-- S2.13 follow-up: exam_editions was the ONE parent-child table missing its staff-read SELECT
-- policy (exams / exam_resources / exam_syllabus / exam_syllabus_subjects all already have one).
-- Without it, createEntranceExam's `.insert().select().single()` on a DRAFT parent fails with
-- 42501 "new row violates row-level security policy for table exam_editions", because the
-- INSERT...RETURNING representation is filtered by public_read_exam_editions (parent must be
-- published). Keep public_read_exam_editions UNCHANGED.
--
-- Live counts (read-only, 2026-10-12, project cwbhhcqsrbuoybeaondk):
--   exams = 397 (all published, is_published=true; drafts 0)   exam_editions = 399
--   auth.users = 3   user_profiles = 3 (active 3)   profiles with NO role = 1   auth users without a profile = 0
--   => a non-staff (role-less) authenticated account exists, so the SIBLING form
--      (auth.uid() IS NOT NULL) is NOT used; the TIGHTER form is applied instead, matching this
--      table's OWN exam_editions_update gate. Creator holds create_exam, so the fix works.
--
-- NOTE: exam_syllabus_subjects already has staff_read_all_exam_syllabus_subjects (auth.uid() IS NOT NULL);
--       no change made there (an earlier report that it was missing was incorrect).
--
-- Version 20261012142358 — applied to the remote DB via MCP apply_migration before this file was
-- written, so schema_migrations already holds this version and the Supabase GitHub integration
-- will NOT re-apply it on push-to-main.
DROP POLICY IF EXISTS staff_read_all_exam_editions ON public.exam_editions;
CREATE POLICY staff_read_all_exam_editions
  ON public.exam_editions AS PERMISSIVE
  FOR SELECT TO authenticated
  USING (
    current_user_has_permission('create_exam')
    OR current_user_has_permission('edit_any_exam')
  );
