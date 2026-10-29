-- Batch 5, Phase Q — REVOKE EXECUTE on the eight SECURITY DEFINER *trigger* functions.
-- Owner approval line: "APPLY REVOKES (the 8 trigger functions ONLY; do NOT touch
-- acquire_content_lock, release_content_lock, save_content_version, can_publish_entity)".
-- Applied 29 Oct as version 20261029030406 (name revoke_trigger_fn_execute).
--
-- WHY THESE EIGHT
-- The security advisor flags SECURITY DEFINER functions a caller can execute over
-- /rest/v1/rpc/... — 10 for `anon`, 19 for `authenticated`. Eight of them are trigger
-- functions (prorettype = trigger): their bodies are `RETURN NEW` / RAISE guards meant to run
-- as part of a statement. Seven also carried the default PUBLIC grant, which is what made them
-- reachable anonymously:
--   pre-flight (array_to_string(proacl,' ; ') for each, 29 Oct):
--     derive_is_published_from_workflow   "=X/postgres ; postgres=X/postgres ; anon=X ; authenticated=X ; service_role=X"  1 trigger
--     set_updated_by                      (same, PUBLIC-granted)                                                          3 triggers
--     enforce_exam_publish_permission     (same)                                                                          1 trigger
--     enforce_exam_verify_permission      (same)                                                                          1 trigger
--     enforce_post_publish_permission     (same)                                                                          3 triggers
--     enforce_sarkari_publish_permission  (same)                                                                          1 trigger
--     enforce_syllabus_weightage_unit     (same)                                                                          1 trigger
--     elms_audit_trigger_fn               "postgres=X ; authenticated=X ; service_role=X"  (no PUBLIC, no anon)           13 triggers
--
-- WHY THIS DOES NOT BREAK THE TRIGGERS
-- A trigger is fired by the statement machinery, which does not consult the invoking role's
-- EXECUTE privilege on the trigger function. Proven rather than assumed, in a transaction that
-- was rolled back immediately before this migration ran (throwaway users + two throwaway
-- roles, probe target = a `zz-test-` exam so no reader-facing record was touched even
-- transiently):
--   PRE_APPLY_PROOF profiles_created_by_handle_new_user=2
--     BEFORE:set_updated_by_fired=true derive_is_published_false=true
--     BEFORE:enforce_blocked_publish=true
--     after_revoke_anon_executable=0 after_revoke_authenticated_executable=0
--     AFTER:set_updated_by_fired=true derive_is_published_true=true
--     AFTER:enforce_blocked_publish=true
--     AFTER:direct_call_denied=TRUE
--     policy_functions_ok: rows_visible=404 has_permission=true
-- Re-run after applying, against the real applied state (again rolled back):
--   POST_APPLY_PROOF set_updated_by_fired=true derive_false=true
--     verify_gate_raised=true msg=permission denied: verifying an exam requires the publish_
--     publish_gate_raised=true syllabus_update_ran=true direct_call_denied=TRUE
--     rls_exam_rows_visible_404=404 has_permission=true
-- `handle_new_user` creating both throwaway profiles is a ninth trigger function proving the
-- same point; its grants were already correct.
--
-- ADVISOR DELTA (measured, get_advisors security, before → after)
--   anon_security_definer_function_executable          10 → 3   (-7)
--   authenticated_security_definer_function_executable 19 → 11  (-8)
--   security_definer_view (ERROR)   1 → 1   extension_in_public 2 → 2
--   rls_enabled_no_policy (INFO)    6 → 6   auth_leaked_password_protection 1 → 1
--   no new lint category appeared.
--
-- DELIBERATELY NOT TOUCHED
--   * Functions used inside RLS policy expressions — a policy is evaluated as the querying
--     role, so revoking EXECUTE turns reads/writes into "permission denied for function":
--       current_user_has_permission (62 policies), current_user_role (21),
--       can_write_entity (20), get_my_role_slug (5), has_role (1 — entity_delete).
--   * Functions the application calls via .rpc():
--       clear_must_change_password  src/pages/auth/SetPasswordPage.tsx:78
--       get_auth_user_emails         src/services/userService.ts:15
--       current_user_has_permission  supabase/functions/ai-fill/index.ts:500,
--                                    supabase/functions/revalidate-frontend/index.ts:200
--       message_rate_limit_attempt   supabase/functions/submit-message/index.ts:221 (service_role only)
--       revalidate_should_fire       supabase/functions/revalidate-frontend/index.ts:236 (service_role only)
--   * acquire_content_lock, release_content_lock, save_content_version, can_publish_entity —
--     zero call sites today, but migration 20260702153553_revoke_anon_execute_on_new_functions
--     records the opposite intent ("save_content_version and lock functions are intentionally
--     callable by authenticated users"), so they stay granted until the owner says otherwise.
--
-- Nothing is dropped and no function body changes; only grants. service_role keeps EXECUTE on
-- all eight (the migrations runner and the Edge Functions are service_role).

REVOKE EXECUTE ON FUNCTION public.derive_is_published_from_workflow()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_by()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_exam_publish_permission()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_exam_verify_permission()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_post_publish_permission()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_sarkari_publish_permission() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_syllabus_weightage_unit()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.elms_audit_trigger_fn()              FROM PUBLIC, anon, authenticated;

-- Rollback — re-grants exactly what the pre-flight measured (owner-run; never automatic):
--   GRANT EXECUTE ON FUNCTION public.derive_is_published_from_workflow()  TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.set_updated_by()                     TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.enforce_exam_publish_permission()    TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.enforce_exam_verify_permission()     TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.enforce_post_publish_permission()    TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.enforce_sarkari_publish_permission() TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.enforce_syllabus_weightage_unit()    TO PUBLIC, anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.elms_audit_trigger_fn()              TO authenticated;
--   -- service_role was never revoked, so it needs no re-grant.
