-- CHECK constraint: application_start_date must not exceed application_end_date.
-- Safe: all 361 rows today have both columns NULL; the CHECK passes on NULL.
-- Generated 2026-09-27. DO NOT APPLY without owner approval.

ALTER TABLE public.sarkari_naukri
  ADD CONSTRAINT sarkari_naukri_app_date_order
  CHECK (
    application_start_date IS NULL
    OR application_end_date IS NULL
    OR application_start_date <= application_end_date
  );
