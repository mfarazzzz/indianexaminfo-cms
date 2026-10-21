-- ─────────────────────────────────────────────────────────────────────────────
-- PROPOSAL (NOT APPLIED) — S3.2 verify columns require publish_exam at the DB
-- Date: 2026-10-21. Owner protocol: proposal only; apply ONLY on explicit order.
--
-- WHY (evidence, all re-verified live against cwbhhcqsrbuoybeaondk on 2026-10-21)
-- The S3.2 verify control stamps exams.is_verified / verified_at / verified_by.
-- The reader claim ("Verified by IndianExamInfo editorial team · <date>",
-- frontend commit 794c4b6) is a PUBLIC-TRUST action — the owner locked it at the
-- same permission tier as publishing (D6: "uses publish_exam permission").
--
-- Live policies on exams (pg_policies, verbatim):
--   exams_update  USING/WITH CHECK:
--     current_user_has_permission('edit_any_exam')
--     OR (created_by = auth.uid() AND current_user_has_permission('create_exam'))
-- → gates WHO may UPDATE AT ALL, but NOT which columns.
--
-- Live triggers on exams (information_schema.triggers, verbatim list):
--   set_updated_at, trg_derive_is_published, trg_enforce_exam_publish,
--   trg_exams_fts, trg_set_updated_by
-- → the ONLY column-sensitive gate is trg_enforce_exam_publish, and it covers
--   ONLY the workflow_status → 'published' transition. Nothing guards the
--   verified columns.
--
-- Live role → permission matrix (roles/role_permissions/permissions):
--   role            publish_exam  edit_any_exam  active_users
--   super-admin     true          true           23
--   admin           true          true            0
--   editor          true          true            0
--   content-intern  FALSE         TRUE            0
--   writer          false         false           3
--   ad-manager      false         false           0
--   viewer          (no perms)    (no perms)      0
--
-- → PROOF RESULT: "a user with publish_exam CAN update the verified columns"
--   holds today (they all also hold edit_any_exam). But "a user WITHOUT
--   publish_exam cannot" is FALSE: the existing role `content-intern` holds
--   edit_any_exam without publish_exam and could pass exams_update while
--   flipping is_verified on any exam (0 active users today, but the role is
--   real and assignable — roles are editable via manage_roles, so this is not
--   guaranteed by construction). A client-side assertPermission is NOT the
--   guarantee; RLS/trigger is. Hence this migration.
--
-- LIVE COUNTS (context for impact) — exams are NOT touched by this migration:
--   verified today:                    0 of 398  (is_verified=false everywhere)
--   unverified per pillar:             entrance-exam 128, government-exam 105,
--                                      govt-vacancy 100, board-exam 38,
--                                      university-exam 27                    = 398
--   ready to verify now (preconditions pass): entrance 25, government 97,
--                                      govt-vacancy 98, board 38, university 27 = 285
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DESIGN: mirror the PROVEN publish-transition pattern (migrations
-- 20260919124348 / 20260919124407): a SECURITY DEFINER BEFORE UPDATE trigger
-- fired ONLY when the verified columns change, rejecting unless the caller
-- holds publish_exam. Service_role (no end-user JWT claims) bypasses, exactly
-- as the publish trigger does; RLS policies are UNTOUCHED, so every existing
-- edit flow is unaffected.
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
     -- same service_role carve-out as enforce_exam_publish_permission:
     -- end-user JWTs always carry request.jwt.claims; service_role does not.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- KNOBS / NOTES
-- 1) trg_set_updated_by (existing) stamps exams.updated_by = auth.uid() on ANY
--    end-user update INCLUDING a verify-only write (verified live:
--    `IF auth.uid() IS NOT NULL THEN NEW.updated_by := auth.uid()`). That is
--    acceptable: the frontend "Last Updated" reads the EDITION's updated_by
--    (mapRow editionUpdatedBy), not exams.updated_by, so a verification click
--    does not masquerade as a content edit on the reader line. No change here.
-- 2) Un-verify writes (is_verified=false, verified_at/by=NULL) are covered by
--    the same trigger — they change the same columns.
-- 3) This trigger does NOT restrict READS (verified_at/by remain in DETAIL_SELECT
--    via `*`; the frontend already folds verified_by into a boolean and never
--    exposes the uuid — frontend commit 794c4b6, test examService.verified.test.ts).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION (run after applying; read-only assertions first)
-- A) Definition landed:
--    SELECT tgname FROM pg_trigger WHERE tgrelid='public.exams'::regclass
--      AND tgname='trg_enforce_exam_verify';                                    -- 1 row
-- B) POSITIVE: impersonate a publisher — expect the stamp to succeed:
--    (dashboard SQL console has no end-user JWT → claims NULL → bypass; to test
--    honestly use an authenticated REST call as an editor user, e.g. PostgREST
--    with an editor JWT: PATCH exams?id=eq.<pet-id> {"is_verified":true,
--    "verified_at":"now","verified_by":"<uid>"} → 204.)
-- C) NEGATIVE: PATCH the same columns as a content-intern user → 42501 with the
--    message above; the row is unchanged (re-select to confirm).
-- D) NEUTRAL: a content-intern editing an ordinary column (e.g. seo_description)
--    → still 204 (the WHEN clause never fires). This proves the gate is
--    column-scoped and no existing flow regresses.
--
-- ROLLBACK (leave no residue, same convention as the publish-gate rework):
--    DROP TRIGGER IF EXISTS trg_enforce_exam_verify ON public.exams;
--    DROP FUNCTION IF EXISTS public.enforce_exam_verify_permission();
-- ─────────────────────────────────────────────────────────────────────────────
