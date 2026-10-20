-- Enable RLS on the one-off FAQ placeholder-cleanup audit backup tables.
-- They were created by 20260930155640_faq_placeholder_cleanup.sql with RLS OFF,
-- exposing 3 + 4 rows to the anon key. Verified (2026-10-20) that NOTHING reads
-- them at runtime: no function, view, trigger or rule references them, and the
-- only repo mentions are the creating migration and two code comments. They are
-- write-once audit backups, so RLS with NO policies (deny-all to anon/authenticated)
-- is the correct hardening. Applied via MCP; version 20261020092758.
ALTER TABLE public.faq_placeholder_cleanup_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_placeholder_cleanup_removed ENABLE ROW LEVEL SECURITY;
