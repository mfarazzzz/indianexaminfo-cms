-- Permission-slug check for the current user (mirrors current_user_role()).
-- SECURITY DEFINER so RLS on the RBAC tables doesn't recurse; STABLE for planner.
CREATE OR REPLACE FUNCTION public.current_user_has_permission(perm_slug text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN role_permissions rp ON rp.role_id = up.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE up.id = auth.uid()
      AND up.is_active = true
      AND p.slug = perm_slug
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_permission(text) FROM public;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(text) TO authenticated, anon, service_role;;
