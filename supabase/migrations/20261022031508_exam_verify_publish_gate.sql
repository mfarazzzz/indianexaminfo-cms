-- ─────────────────────────────────────────────────────────────────────────────
-- 20261022031508_exam_verify_publish_gate.sql — S3.2 verify columns require
-- publish_exam at the DB layer. Owner APPROVED "APPLY VERIFY TRIGGER" (22 Oct,
-- with conditions); full review text + live evidence trail:
--   supabase/proposed/20261021_exam_verify_publish_rls_PROPOSAL.sql
-- Applied via MCP apply_migration as version 20261022031508 (created_by
-- mfarazzzz@gmail.com). Checks run after apply inside ONE transaction ending
-- in rollback (SET LOCAL ROLE authenticated + real claim subjects):
--   B positive (real super-admin/publish_exam holder)  -> verify update SUCCESS
--   C negative (writer user temp-granted content-intern -> edit_any_exam WITHOUT
--              publish_exam)                             -> BLOCKED 42501
--   C2 un-verify by the same intern                     -> BLOCKED 42501
--   D neutral (intern, ordinary column on an is_verified IS NULL row) -> SUCCESS,
--              trigger silent, row keeps NULL
--   D2 neutral (intern, is_verified=false sent unchanged on a false row) -> SUCCESS
--   Post-rollback: verified true-count=0, null-count=0, all touched rows and the
--   temp user role restored (nothing persisted).
-- Rollback (if ever needed):
--   DROP TRIGGER IF EXISTS trg_enforce_exam_verify ON public.exams;
--   DROP FUNCTION IF EXISTS public.enforce_exam_verify_permission();
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_exam_verify_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $fn$
BEGIN
  IF (
       NEW.is_verified IS DISTINCT FROM OLD.is_verified
    OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
    OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
  )
     AND NOT public.current_user_has_permission('publish_exam')
     -- service_role / no-end-user-JWT SQL keeps its bypass, exactly as the
     -- publish-transition trigger: end-user JWTs always carry claims.
     AND current_setting('request.jwt.claims', true) IS NOT NULL
  THEN
    RAISE EXCEPTION 'permission denied: verifying an exam requires the publish_exam permission'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enforce_exam_verify ON public.exams;
CREATE TRIGGER trg_enforce_exam_verify
  BEFORE UPDATE ON public.exams
  FOR EACH ROW
  WHEN (
    NEW.is_verified IS DISTINCT FROM OLD.is_verified
    OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
    OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
  )
  EXECUTE FUNCTION public.enforce_exam_verify_permission();
