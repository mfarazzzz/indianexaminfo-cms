-- BUGFIX: inside SECURITY DEFINER functions current_user is the function owner
-- (postgres), so the old `current_user IN ('service_role','postgres',...)` bypass
-- ALWAYS matched and disabled the publish gate. Key the bypass off the presence of
-- an authenticated end user instead: enforce whenever auth.uid() IS NOT NULL (a real
-- user JWT); skip only for server/service contexts that have no end-user uid.

CREATE OR REPLACE FUNCTION public.enforce_exam_publish_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- no end user (service/server job) — not subject to the UI publish gate
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
$$;

CREATE OR REPLACE FUNCTION public.enforce_post_publish_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status::text = 'published'
     AND OLD.status::text IS DISTINCT FROM 'published'
     AND NOT current_user_has_permission('publish_post')
  THEN
    RAISE EXCEPTION 'permission denied: publishing a post requires the publish_post permission'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_sarkari_publish_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
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
$$;;
