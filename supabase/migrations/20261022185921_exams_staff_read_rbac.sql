-- exams RLS: replace the broad staff-read (auth.uid() IS NOT NULL) with RBAC.
-- Owner-approved 23 Oct. Anon/published unchanged (public_read_published_exams).
-- edit_any_exam roles read all exams; a record's owner always reads their own.
-- Transactionally verified: super-admin sees all drafts, a writer sees only
-- published + their own, anon sees published only; probes rolled back.
-- Rollback: DROP POLICY staff_read_exams_rbac; recreate staff_read_all_exams.

DROP POLICY IF EXISTS staff_read_all_exams ON public.exams;

CREATE POLICY staff_read_exams_rbac ON public.exams
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('edit_any_exam') OR created_by = auth.uid());
