-- E3 support: force a password change at first login after an admin sets a temporary password.
-- Default false; set true by the admin-temp-password edge function; cleared by the set-password flow.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.must_change_password IS
  'When true, the user is forced to set a new password before reaching any other route (admin-set temporary password). Cleared once the user sets their own password.';;
