-- module_registry defines every module's fields portal-wide (22 rows, all built-in).
-- Only the CMS reads it (module editor + createEntranceExam seed); the public frontend
-- never queries it at runtime. It is system-level structural config, so gate it with
-- manage_settings — held ONLY by admin/super-admin (not editor/writer/intern). NOT
-- manage_structural_taxonomy (no role holds it -> would lock out admins too).
DROP POLICY IF EXISTS staff_write_module_registry ON public.module_registry;   -- if any
-- Drop the permissive INSERT/UPDATE (auth.uid() IS NOT NULL) by name-agnostic recreation:
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='module_registry' AND cmd IN ('INSERT','UPDATE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.module_registry', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY module_registry_insert ON public.module_registry
  FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('manage_settings'));

CREATE POLICY module_registry_update ON public.module_registry
  FOR UPDATE TO authenticated
  USING (current_user_has_permission('manage_settings'))
  WITH CHECK (current_user_has_permission('manage_settings'));;
