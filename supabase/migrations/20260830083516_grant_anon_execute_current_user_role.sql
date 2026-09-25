-- Fix B (additive, non-destructive): allow anon to execute current_user_role().
-- The settings table has a FOR ALL policy (admin_write_settings) whose USING
-- calls current_user_role(); Postgres evaluates it on SELECT too. anon lacked
-- EXECUTE, so any settings read without a session threw "permission denied for
-- function current_user_role". The function is SECURITY DEFINER and returns
-- NULL when auth.uid() is null, so granting anon EXECUTE is harmless.
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon;;
