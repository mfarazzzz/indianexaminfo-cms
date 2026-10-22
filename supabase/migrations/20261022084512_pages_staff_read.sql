-- pages RLS: staff-read gap (Finding 1 of the 2026-10-22 proposal).
-- Owner-approved 22 Oct WITH A CHANGE: the staff read is gated on the SAME RBAC
-- capability the writes use (manage_pages), not on any authenticated uid.
-- Anon keeps seeing published-only via public_read_pages. DELETE/INSERT/UPDATE
-- policies are untouched; the exams policies are untouched.
-- Rollback: DROP POLICY IF EXISTS staff_read_pages ON public.pages;

CREATE POLICY staff_read_pages ON public.pages
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('manage_pages'));
