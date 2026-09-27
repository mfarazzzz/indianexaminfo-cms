-- menu_items: stored /entrance-exam URLs -> final /admission destinations (zero hops).
-- 21 rows across entrance-exams-mega (16), footer-nav (3), main-nav (1), primary-nav (1).
-- Applied via Supabase MCP on 2026-09-27 (recorded version 20260927052259).
-- Backup first (same pattern as admission_move_backup_20260925).
CREATE TABLE public.menu_items_entrance_exam_url_backup_20260927 AS
SELECT * FROM public.menu_items WHERE url LIKE '%/entrance-exam%';

ALTER TABLE public.menu_items_entrance_exam_url_backup_20260927 ENABLE ROW LEVEL SECURITY;

-- Hub links (no trailing segment)
UPDATE public.menu_items SET url = '/admission' WHERE url = '/entrance-exam';

-- All other links: swap the pillar segment, then strip a trailing year suffix
-- (-2025/-2026) so year-suffixed links land exactly where the year-cleanup
-- redirect rules would send them -- in zero hops.
UPDATE public.menu_items
SET url = regexp_replace(replace(url, '/entrance-exam/', '/admission/'), '-(2025|2026)$', '')
WHERE url LIKE '%/entrance-exam/%';
