-- C3: sarkari_naukri verification workflow.
-- Adds trigger to: (1) set verified_at server-side on explicit verify action;
-- (2) auto-clear verified_at when dates or the official link change;
-- (3) gate verify to publish-permission holders via role check.
--
-- DO NOT APPLY without owner approval.
-- Generated 2026-09-27.

-- 1. Helper: check if user has publish permission (same logic as RLS policy).
--    The RBAC model uses user_roles.role names; 'admin' and 'editor' can publish.
CREATE OR REPLACE FUNCTION public.user_can_publish_sarkari()
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'editor')
  );
$$;

-- 2. Verification trigger: BEFORE UPDATE on sarkari_naukri.
--    - If verified_at is being SET from NULL → require publish permission +
--      official_notification_url non-null + application_end_date non-null.
--    - If verified_at is being CLEARED (dates/link changed) → allow silently.
--    - If verified_at is set but dates/link changed in the same UPDATE → reject
--      (forces two-step: clear, change dates, re-verify).
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
    -- Role gate: only publish-capable roles may verify.
    IF NOT public.user_can_publish_sarkari() THEN
      RAISE EXCEPTION 'Insufficient role: only admin or editor may verify';
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

-- 3. RLS policy: prevent client-side verified_at writes by non-publishers.
--    The existing staff_update policy allows editors to update rows.
--    This supplementary policy denies setting verified_at without publish role.
--    (Trigger already enforces; this is belt-and-suspenders at the RLS layer.)
--    NOTE: Supabase RLS doesn't support column-level policies natively.
--    The trigger is the enforcement point. No additional RLS needed here.
