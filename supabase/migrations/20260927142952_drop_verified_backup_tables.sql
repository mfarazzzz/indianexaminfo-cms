-- A1: Drop verified one-off backup tables.
-- Owner approved the drop after a LIVE re-count on 2026-09-27 confirmed each
-- table still matched its expected row count:
--   region_seed_backup_20260713000021  = 404 rows  (expected 404)
--   uni_merge_backup_20260925          =  12 rows  (expected 12)
--   admission_move_backup_20260925     =   4 rows  (expected 4)
-- KEPT (not dropped here): menu_items_entrance_exam_url_backup_20260927 (21 rows),
--   retained until 2026-10-04 per owner decision.
--
-- Applied via Supabase MCP; remote recorded version 20260927142952.

DROP TABLE IF EXISTS public.region_seed_backup_20260713000021;
DROP TABLE IF EXISTS public.uni_merge_backup_20260925;
DROP TABLE IF EXISTS public.admission_move_backup_20260925;
