
-- Drop all existing policies and recreate cleanly
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_manage_users" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;

-- Users can always read their own profile (simple auth.uid() — no recursion)
CREATE POLICY "users_read_own_profile"
  ON public.user_profiles
  FOR SELECT
  USING (id = auth.uid());

-- Admins can read all profiles via direct subquery (avoids current_user_role() recursion)
CREATE POLICY "admin_read_all_profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.slug IN ('super-admin', 'admin')
    )
  );

-- Admins can insert/update/delete other profiles
CREATE POLICY "admin_manage_users"
  ON public.user_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.slug IN ('super-admin', 'admin')
    )
  );

-- Users can update their own profile
CREATE POLICY "users_update_own_profile"
  ON public.user_profiles
  FOR UPDATE
  USING (id = auth.uid());
;
