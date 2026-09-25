
-- FIX: SECURITY DEFINER functions exposed to anon via /rest/v1/rpc/
-- 
-- Functions used in RLS policies MUST remain SECURITY DEFINER (they need
-- elevated access to read user_profiles/roles during policy evaluation).
-- But they should NOT be directly callable by anon via the REST API.
--
-- Functions NOT used in RLS should also not be anon-callable.

-- NOT used in RLS — no reason for anon to call these ever
REVOKE EXECUTE ON FUNCTION public.acquire_content_lock(text, uuid, uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_publish_entity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.elms_audit_trigger_fn() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_content_lock(text, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_content_version(text, uuid, uuid, text) FROM anon;

-- USED in RLS — still need to be callable for policy evaluation, but
-- should not be directly invocable via /rest/v1/rpc/ by anon.
-- Revoking EXECUTE from anon on these will NOT break RLS evaluation
-- because Postgres evaluates RLS using the function owner's privileges
-- (SECURITY DEFINER), not the caller's EXECUTE grant.
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role_slug() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_write_entity() FROM anon;
;
