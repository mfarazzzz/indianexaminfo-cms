-- CHECK constraint: application_start_date must not exceed application_end_date.
-- Safe: all 361 rows today have both columns NULL; the CHECK passes on NULL.
-- Generated 2026-09-27. STATUS: APPLIED to the remote on 27 Sep 2026 by the
-- Supabase GitHub integration when commit 3a2b6e5 was pushed to main
-- (push 13:32:46Z -> apply 13:33:21Z). It was never intended to reach
-- migrations/ before owner approval — see AGENTS.md (proposed/ discipline).

ALTER TABLE public.sarkari_naukri
  ADD CONSTRAINT sarkari_naukri_app_date_order
  CHECK (
    application_start_date IS NULL
    OR application_end_date IS NULL
    OR application_start_date <= application_end_date
  );
