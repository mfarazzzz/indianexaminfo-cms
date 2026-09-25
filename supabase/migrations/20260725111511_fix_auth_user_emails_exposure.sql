
-- FIX: auth_user_emails view exposes auth.users emails to anon
-- This is an active security exposure — any unauthenticated request to
-- /rest/v1/auth_user_emails can enumerate all user emails.
--
-- The view is used by ONE place: userService.ts.getUserProfiles() which
-- runs in an authenticated CMS admin context only. The code gracefully
-- falls back if the view is inaccessible.
--
-- Fix: Revoke all anon privileges. Keep authenticated SELECT only.
-- Remove INSERT/UPDATE/DELETE from all non-service roles (the view is
-- marked is_updatable=YES which is dangerous over auth.users).

-- Revoke everything from anon
REVOKE ALL ON public.auth_user_emails FROM anon;

-- Revoke write access from authenticated (should never write through this view)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.auth_user_emails FROM authenticated;

-- Keep only SELECT for authenticated (the CMS admin needs to resolve emails)
-- authenticated already has SELECT, but be explicit after the revoke
GRANT SELECT ON public.auth_user_emails TO authenticated;
;
