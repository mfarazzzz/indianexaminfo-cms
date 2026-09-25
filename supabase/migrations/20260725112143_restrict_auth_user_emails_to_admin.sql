
-- The auth_user_emails view (SELECT id, email FROM auth.users) is currently
-- readable by any authenticated user. It should only be accessible to admins.
--
-- Since views can't have RLS, and we can't conditionally grant SELECT per-role
-- in Postgres without RLS, the cleanest fix is to:
-- 1. Drop the SECURITY DEFINER view
-- 2. Replace it with a SECURITY INVOKER function that checks role internally
--
-- This way the function is callable but returns empty for non-admins.

-- Drop the old view
DROP VIEW IF EXISTS public.auth_user_emails;

-- Create a function that returns emails only for admins
CREATE OR REPLACE FUNCTION public.get_auth_user_emails()
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.roles r ON r.id = up.role_id
    WHERE up.id = auth.uid()
    AND r.slug IN ('super-admin', 'admin')
  );
$$;

-- Only authenticated can call it (anon gets nothing)
REVOKE EXECUTE ON FUNCTION public.get_auth_user_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_emails() TO authenticated;

COMMENT ON FUNCTION public.get_auth_user_emails() IS 
  'Returns auth.users emails for admin-tier users only. Replaces the former auth_user_emails view which was accessible to all authenticated users. Used by userService.ts getUserProfiles().';
;
