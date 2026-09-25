-- Tighten self-update: a user may edit their own name/avatar but MUST NOT be able to
-- change their own role_id, is_active, or must_change_password (privilege escalation /
-- forced-change bypass). Enforced with WITH CHECK comparing against the existing row.
DROP POLICY IF EXISTS users_update_own_profile ON public.user_profiles;

CREATE POLICY users_update_own_profile ON public.user_profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role_id IS NOT DISTINCT FROM (SELECT up.role_id FROM public.user_profiles up WHERE up.id = auth.uid())
    AND is_active IS NOT DISTINCT FROM (SELECT up.is_active FROM public.user_profiles up WHERE up.id = auth.uid())
    AND must_change_password IS NOT DISTINCT FROM (SELECT up.must_change_password FROM public.user_profiles up WHERE up.id = auth.uid())
  );

-- Secure path to clear the forced-change flag: only after the caller has actually
-- authenticated (auth.uid() present). SECURITY DEFINER so the tightened self-update
-- WITH CHECK above cannot be used to flip the flag directly.
CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.user_profiles
     SET must_change_password = false
   WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.clear_must_change_password() FROM public;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;;
