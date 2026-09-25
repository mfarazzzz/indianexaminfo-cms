-- Fix mutable search_path on 3 functions
ALTER FUNCTION public.update_entity_search_vector()
  SET search_path = public;

ALTER FUNCTION public.check_duplicate_entity(p_name text, p_conducting_body_id uuid, p_threshold double precision)
  SET search_path = public;

ALTER FUNCTION public.check_slug_available(p_slug text, p_conducting_body_id uuid, p_exclude_entity_id uuid)
  SET search_path = public;

-- Revoke anon EXECUTE on get_auth_user_emails (should only be callable by admin via authenticated)
REVOKE EXECUTE ON FUNCTION public.get_auth_user_emails() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_user_emails() FROM public;
GRANT EXECUTE ON FUNCTION public.get_auth_user_emails() TO authenticated;

-- Also revoke anon on save_content_version (never called from the public site)
REVOKE EXECUTE ON FUNCTION public.save_content_version(text, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_content_version(text, uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.save_content_version(text, uuid, uuid, text) TO authenticated;

-- Revoke anon on content lock functions
REVOKE EXECUTE ON FUNCTION public.acquire_content_lock(text, uuid, uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.acquire_content_lock(text, uuid, uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.acquire_content_lock(text, uuid, uuid, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.release_content_lock(text, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_content_lock(text, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.release_content_lock(text, uuid, uuid) TO authenticated;;
