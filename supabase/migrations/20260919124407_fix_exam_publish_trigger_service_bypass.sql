CREATE OR REPLACE FUNCTION public.enforce_exam_publish_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  -- Privileged server contexts (service_role / superuser / the postgres owner)
  -- bypass; end users acting through the anon/authenticated JWT do not.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.workflow_status = 'published'
     AND OLD.workflow_status IS DISTINCT FROM 'published'
     AND NOT current_user_has_permission('publish_exam')
  THEN
    RAISE EXCEPTION 'permission denied: publishing an exam requires the publish_exam permission'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;;
