
-- Root cause of the UPDATE/DELETE "new row violates RLS" errors: exam_resources had
-- ONLY a public SELECT policy (is_published=true AND deleted_at IS NULL). The CMS soft-
-- deletes (sets deleted_at) and toggles is_published via UPDATE, then chains .select() to
-- return the row — but the updated row no longer matches the public SELECT policy, so the
-- post-update read finds nothing and Postgres reports an RLS violation. Also, editing an
-- unpublished/soft-deleted row was impossible because it was invisible to begin with.
--
-- Fix: mirror the `exams` table exactly, which has BOTH a public-read AND a staff-read-all
-- SELECT policy. Add the staff (authenticated) read-all policy so the CMS can see and edit
-- every resource regardless of published/deleted state.
create policy staff_read_all_exam_resources on exam_resources
  for select using (auth.uid() is not null);
;
