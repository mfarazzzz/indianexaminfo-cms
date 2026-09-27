-- C3: sarkari_naukri verification workflow.
-- Adds trigger to: (1) set verified_at server-side on explicit verify action;
-- (2) auto-clear verified_at when dates or the official link change;
-- (3) gate verify to publish-permission holders via current_user_has_permission.
--
-- PERMISSIONS, NOT ROLE NAMES. The gate is
--   current_user_has_permission('publish_post')
-- which is a SECURITY DEFINER helper evaluated on auth.uid() (the JWT subject).
-- Do NOT use `current_user`/`roles.name` here: inside a SECURITY DEFINER
-- function `current_user` resolves to the FUNCTION OWNER, not the caller
-- (the 19 Sep lesson — see 20260919125019_fix_publish_triggers_use_auth_uid_not_current_user).
-- Super Admin passes because the 'Super Admin' role is granted the publish_post
-- permission (verified live), as are Admin and Editor; Content Intern / Writer /
-- Ad Manager / Viewer are not.
--
-- DO NOT APPLY without owner approval.
-- Generated 2026-09-27.

-- Verification trigger function: BEFORE UPDATE on sarkari_naukri.
--   - If verified_at is being SET from NULL → require publish_post permission +
--     official_notification_url non-null + application_end_date non-null.
--   - If verified_at is already set and a gated field changes → auto-clear.
-- Runs as SECURITY INVOKER (the caller's identity) so auth.uid() is the real
-- CMS user performing the verify; the permission helper is itself SECURITY
-- DEFINER and can read the RBAC tables without recursing into RLS.
CREATE OR REPLACE FUNCTION public.trg_sarkari_verify()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- Verify being SET (NULL → non-NULL): enforce preconditions.
  IF OLD.verified_at IS NULL AND NEW.verified_at IS NOT NULL THEN
    -- Set server clock; ignore any client-supplied value.
    NEW.verified_at := now();

    -- Preconditions: must have official link + application_end_date.
    IF NEW.official_notification_url IS NULL OR NEW.official_notification_url = '' THEN
      RAISE EXCEPTION 'Cannot verify: official_notification_url must be set';
    END IF;
    IF NEW.application_end_date IS NULL THEN
      RAISE EXCEPTION 'Cannot verify: application_end_date must be set';
    END IF;
    -- Permission gate: only publish-permission holders may verify.
    -- Evaluated on auth.uid(); Super Admin / Admin / Editor pass.
    IF NOT current_user_has_permission('publish_post') THEN
      RAISE EXCEPTION 'permission denied: verifying requires the publish_post permission'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Auto-clear: if any of the three dates or official link changed and the
  -- row was previously verified, clear verified_at automatically.
  IF OLD.verified_at IS NOT NULL AND NEW.verified_at IS NOT NULL THEN
    IF (OLD.notification_date IS DISTINCT FROM NEW.notification_date
        OR OLD.application_start_date IS DISTINCT FROM NEW.application_start_date
        OR OLD.application_end_date IS DISTINCT FROM NEW.application_end_date
        OR OLD.official_notification_url IS DISTINCT FROM NEW.official_notification_url)
    THEN
      NEW.verified_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sarkari_naukri_verify ON public.sarkari_naukri;
CREATE TRIGGER sarkari_naukri_verify
  BEFORE UPDATE ON public.sarkari_naukri
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sarkari_verify();

-- RLS note: the existing staff_update_sarkari policy already governs who may
-- UPDATE a row at all (edit_any_post / edit_own_post). The verify-specific
-- permission (publish_post) and preconditions are enforced in the trigger above
-- — Supabase RLS has no column-level policies, so the trigger is the
-- enforcement point for verified_at. No additional RLS is introduced here.
