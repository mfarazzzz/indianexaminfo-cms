-- C3: sarkari_naukri verification workflow.
-- Trigger (BEFORE INSERT OR UPDATE) that:
--   (1) sets verified_at server-side (now()) on an explicit verify action;
--   (2) enforces preconditions + the publish_post permission whenever a row
--       becomes verified (including an INSERT that arrives already verified);
--   (3) auto-clears verified_at when a gated field changes;
--   (4) makes verified_at immutable to clients on a still-verified row whose
--       gated fields did NOT change (blocks backdating / arbitrary writes);
--   (5) still allows an explicit UN-verify (verified_at -> NULL).
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
-- Generated 2026-09-27 (J2 revision same day).

CREATE OR REPLACE FUNCTION public.trg_sarkari_verify()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- ── INSERT ──────────────────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    IF NEW.verified_at IS NOT NULL THEN
      -- A row cannot be born verified without clearing the same bar as verify.
      NEW.verified_at := now();
      IF NEW.official_notification_url IS NULL
         OR NEW.official_notification_url !~* '^https?://' THEN
        RAISE EXCEPTION 'Cannot verify: official_notification_url must be an http(s) URL';
      END IF;
      IF NEW.application_end_date IS NULL THEN
        RAISE EXCEPTION 'Cannot verify: application_end_date must be set';
      END IF;
      IF NOT current_user_has_permission('publish_post') THEN
        RAISE EXCEPTION 'permission denied: verifying requires the publish_post permission'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- ── UPDATE ──────────────────────────────────────────────────────────────
  -- (a) Being verified now (NULL -> non-NULL): enforce the full bar.
  IF OLD.verified_at IS NULL AND NEW.verified_at IS NOT NULL THEN
    NEW.verified_at := now();  -- server clock; ignore any client-supplied value
    IF NEW.official_notification_url IS NULL
       OR NEW.official_notification_url !~* '^https?://' THEN
      RAISE EXCEPTION 'Cannot verify: official_notification_url must be an http(s) URL';
    END IF;
    IF NEW.application_end_date IS NULL THEN
      RAISE EXCEPTION 'Cannot verify: application_end_date must be set';
    END IF;
    IF NOT current_user_has_permission('publish_post') THEN
      RAISE EXCEPTION 'permission denied: verifying requires the publish_post permission'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- (b) Explicit UN-verify (non-NULL -> NULL): always allowed.
  IF OLD.verified_at IS NOT NULL AND NEW.verified_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- (c) Still verified (non-NULL -> non-NULL): gated field changed => auto-clear;
  --     otherwise the client may NOT rewrite verified_at — keep the OLD value.
  IF OLD.verified_at IS NOT NULL AND NEW.verified_at IS NOT NULL THEN
    IF (OLD.notification_date          IS DISTINCT FROM NEW.notification_date
        OR OLD.application_start_date  IS DISTINCT FROM NEW.application_start_date
        OR OLD.application_end_date    IS DISTINCT FROM NEW.application_end_date
        OR OLD.official_notification_url IS DISTINCT FROM NEW.official_notification_url)
    THEN
      NEW.verified_at := NULL;              -- content moved → verification void
    ELSE
      NEW.verified_at := OLD.verified_at;   -- immutable to clients (blocks backdating)
    END IF;
    RETURN NEW;
  END IF;

  -- (d) NULL -> NULL: nothing to enforce.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sarkari_naukri_verify ON public.sarkari_naukri;
CREATE TRIGGER sarkari_naukri_verify
  BEFORE INSERT OR UPDATE ON public.sarkari_naukri
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sarkari_verify();

-- RLS note: the existing staff_insert_sarkari / staff_update_sarkari policies
-- already govern who may write a row at all (create_post / edit_any_post /
-- edit_own_post, and publish_post for the published workflow state). This
-- trigger is the enforcement point for verified_at specifically — Supabase RLS
-- has no column-level policies. No additional RLS is introduced here.
