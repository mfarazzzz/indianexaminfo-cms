
-- The previous REVOKE FROM anon didn't take effect because anon inherits
-- EXECUTE from the PUBLIC role (Postgres default). Must revoke from PUBLIC
-- and then explicitly grant back to roles that need it.

-- Revoke from PUBLIC (removes the default grant that anon inherits)
REVOKE EXECUTE ON FUNCTION public.acquire_content_lock(text, uuid, uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_publish_entity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.elms_audit_trigger_fn() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_content_lock(text, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_content_version(text, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_role_slug() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_write_entity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_duplicate_entity(text, uuid, double precision) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_slug_available(text, uuid, uuid) FROM PUBLIC;

-- Grant EXECUTE back to authenticated (CMS users need these)
GRANT EXECUTE ON FUNCTION public.acquire_content_lock(text, uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_publish_entity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_content_lock(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_content_version(text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_duplicate_entity(text, uuid, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_slug_available(text, uuid, uuid) TO authenticated;

-- RLS helper functions — grant to authenticated for policy evaluation
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role_slug() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_entity() TO authenticated;
;
