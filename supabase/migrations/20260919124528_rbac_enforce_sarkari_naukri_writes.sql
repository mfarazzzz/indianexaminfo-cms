-- sarkari_naukri writes were auth.uid() IS NOT NULL. Gate with the post vocabulary
-- (create_post to insert/edit, publish_post to publish). workflow_status is the publish column.
DROP POLICY IF EXISTS staff_insert_sarkari ON public.sarkari_naukri;   -- INSERT auth.uid() IS NOT NULL
DROP POLICY IF EXISTS staff_update_sarkari ON public.sarkari_naukri;   -- UPDATE USING auth.uid() IS NOT NULL

CREATE POLICY staff_insert_sarkari ON public.sarkari_naukri
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_has_permission('create_post')
    AND (workflow_status <> 'published' OR current_user_has_permission('publish_post'))
  );

CREATE POLICY staff_update_sarkari ON public.sarkari_naukri
  FOR UPDATE TO authenticated
  USING (
    current_user_has_permission('edit_any_post')
    OR (created_by = auth.uid() AND current_user_has_permission('edit_own_post'))
  )
  WITH CHECK (
    current_user_has_permission('edit_any_post')
    OR (created_by = auth.uid() AND current_user_has_permission('edit_own_post'))
  );

-- Publish-transition gate (workflow_status text -> 'published').
CREATE OR REPLACE FUNCTION public.enforce_sarkari_publish_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.workflow_status = 'published'
     AND OLD.workflow_status IS DISTINCT FROM 'published'
     AND NOT current_user_has_permission('publish_post')
  THEN
    RAISE EXCEPTION 'permission denied: publishing requires the publish_post permission'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_sarkari_publish ON public.sarkari_naukri;
CREATE TRIGGER trg_enforce_sarkari_publish
  BEFORE UPDATE ON public.sarkari_naukri
  FOR EACH ROW
  WHEN (NEW.workflow_status = 'published' AND OLD.workflow_status IS DISTINCT FROM 'published')
  EXECUTE FUNCTION public.enforce_sarkari_publish_permission();;
