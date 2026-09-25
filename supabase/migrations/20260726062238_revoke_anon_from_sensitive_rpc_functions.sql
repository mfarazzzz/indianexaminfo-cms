-- Security fix: revoke anon access to SECURITY DEFINER functions that should
-- only be callable by authenticated (admin) users.
--
-- get_auth_user_emails: reads auth.users emails, guarded internally by role check
--   but was callable by anon over REST → unauthenticated email enumeration vector.
--
-- Other SECURITY DEFINER functions flagged by the advisor are also locked down here
-- since they have no legitimate anon use case.

REVOKE EXECUTE ON FUNCTION public.get_auth_user_emails() FROM anon;
REVOKE EXECUTE ON FUNCTION public.acquire_content_lock(text, uuid, uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_content_lock(text, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_content_version(text, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_write_entity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_publish_entity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.elms_audit_trigger_fn() FROM anon;

-- Fix the three mutable-search-path functions flagged by the advisor.
-- Setting search_path to '' prevents schema injection attacks.

ALTER FUNCTION public.update_entity_search_vector() SET search_path = '';
ALTER FUNCTION public.check_duplicate_entity(text, uuid, double precision) SET search_path = '';
ALTER FUNCTION public.check_slug_available(text, uuid, uuid) SET search_path = '';;
