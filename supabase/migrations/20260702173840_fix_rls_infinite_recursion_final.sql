
-- Drop all user_profiles policies
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_manage_users" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;

-- Create a SECURITY DEFINER helper that bypasses RLS to check role
-- This avoids any recursive RLS evaluation
CREATE OR REPLACE FUNCTION public.get_my_role_slug()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT r.slug
  FROM public.user_profiles up
  JOIN public.roles r ON r.id = up.role_id
  WHERE up.id = auth.uid()
  LIMIT 1;
$$;

-- Simple own-row read: no function calls, no recursion
CREATE POLICY "users_read_own_profile"
  ON public.user_profiles
  FOR SELECT
  USING (id = auth.uid());

-- Admin read all: uses the security definer function (no RLS recursion)
CREATE POLICY "admin_read_all_profiles"
  ON public.user_profiles
  FOR SELECT
  USING (public.get_my_role_slug() IN ('super-admin', 'admin'));

-- Admin full management
CREATE POLICY "admin_manage_users"
  ON public.user_profiles
  FOR ALL
  USING (public.get_my_role_slug() IN ('super-admin', 'admin'));

-- Own profile update
CREATE POLICY "users_update_own_profile"
  ON public.user_profiles
  FOR UPDATE
  USING (id = auth.uid());
;
