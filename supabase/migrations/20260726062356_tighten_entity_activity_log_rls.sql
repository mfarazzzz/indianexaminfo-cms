-- Security fix: entity_activity_log had an always-true INSERT policy.
-- Tighten to staff roles only.

DROP POLICY IF EXISTS activity_log_insert ON public.entity_activity_log;
CREATE POLICY activity_log_insert_staff ON public.entity_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role_slug() IN ('super-admin', 'admin', 'editor')
  );;
