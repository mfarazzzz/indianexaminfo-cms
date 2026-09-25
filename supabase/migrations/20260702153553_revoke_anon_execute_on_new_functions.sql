
-- Revoke anon access to all SECURITY DEFINER functions
-- These are CMS-only helpers and should never be callable without auth

revoke execute on function public.acquire_content_lock(text, uuid, uuid, integer) from anon;
revoke execute on function public.release_content_lock(text, uuid, uuid) from anon;
revoke execute on function public.save_content_version(text, uuid, uuid, text) from anon;

-- Also revoke authenticated on functions that are internal/trigger-only
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- save_content_version and lock functions are intentionally callable by authenticated users
-- (they check auth.uid() inside and the CMS calls them via the Supabase client)
-- so we leave authenticated EXECUTE on those.

-- Verify current_user_role stays revoked for anon (set in earlier migration)
revoke execute on function public.current_user_role() from anon;
;
