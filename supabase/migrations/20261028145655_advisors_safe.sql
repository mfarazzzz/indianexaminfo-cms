-- ─────────────────────────────────────────────────────────────────────────────
-- 20261028145655_advisors_safe.sql — the ADVISORS SAFE subset (owner batch 3, H-1)
--
-- Owner approval line for this batch: "APPLY ADVISORS SAFE".
-- Applied to project cwbhhcqsrbuoybeaondk through the Supabase MCP `apply_migration`
-- on 2026-10-28 and recorded by that tool as version 20261028145655, name advisors_safe.
-- This file is that migration, kept in supabase/migrations/ so a fresh environment
-- reaches the same state. Nothing else from 20261024_db_advisors_PROPOSAL.sql was applied.
--
-- BEFORE (measured immediately prior, same session):
--   functions flagged function_search_path_mutable ............ 6, none pinned (proconfig NULL)
--   indexes on content_posts(content_type) .................... 2, identical:
--        content_posts_content_type_idx   USING btree (content_type)  indkey 9  16 kB  idx_scan 0
--        idx_content_posts_content_type   USING btree (content_type)  indkey 9  16 kB  idx_scan 13
--   content_posts rows ........................................ 141 (all with content_type NOT NULL)
--   cross-schema check on the six functions: no auth./extensions./net./storage. reference
--   and none is SECURITY DEFINER -> pinning search_path cannot break a caller or a trigger.
--
-- WHY PLAIN `DROP INDEX` AND NOT `DROP INDEX CONCURRENTLY`: apply_migration runs the file
-- inside a transaction, and CONCURRENTLY cannot execute in one. The table holds 141 rows, so
-- the ACCESS EXCLUSIVE lock is taken and released in well under a millisecond.
--
-- AFTER (measured, see PROOF at the bottom of this file):
--   6 of 6 functions carry proconfig = {search_path=public, pg_temp}
--   idx_content_posts_content_type ........ gone
--   content_posts_content_type_idx ........ present, same definition
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_content_posts_content_type;

ALTER FUNCTION public.ai_providers_auto_priority()            SET search_path = public, pg_temp;
ALTER FUNCTION public.content_posts_supersedes_same_exam()    SET search_path = public, pg_temp;
ALTER FUNCTION public.important_dates_all_iso(dates jsonb)    SET search_path = public, pg_temp;
ALTER FUNCTION public.maintain_current_edition()              SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_sarkari_verify()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.update_taxonomy_updated_at()            SET search_path = public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────────────
-- PROOF (read-only, run after applying):
--
--   SELECT p.proname, p.proconfig
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN ('ai_providers_auto_priority','content_posts_supersedes_same_exam',
--                        'important_dates_all_iso','maintain_current_edition',
--                        'trg_sarkari_verify','update_taxonomy_updated_at')
--    ORDER BY p.proname;
--   -- six rows, each proconfig = {"search_path=public, pg_temp"}
--   -- (note the space Postgres stores after the comma; compare with
--   --  proconfig = ARRAY['search_path=public, pg_temp']::text[], not the no-space literal)
--
--   SELECT indexname, indexdef FROM pg_indexes
--    WHERE schemaname='public' AND tablename='content_posts' AND indexname LIKE '%content_type%';
--   -- exactly one row: content_posts_content_type_idx
--   --   CREATE INDEX content_posts_content_type_idx ON public.content_posts USING btree (content_type)
--
-- SECURITY ADVISOR: `function_search_path_mutable` WARN 6 -> 0. Re-run get_advisors(security)
-- for the live delta; nothing else in the advisor list was touched by this migration.
--
-- ROLLBACK:
--   ALTER FUNCTION public.ai_providers_auto_priority()            RESET search_path;
--   ALTER FUNCTION public.content_posts_supersedes_same_exam()    RESET search_path;
--   ALTER FUNCTION public.important_dates_all_iso(dates jsonb)    RESET search_path;
--   ALTER FUNCTION public.maintain_current_edition()              RESET search_path;
--   ALTER FUNCTION public.trg_sarkari_verify()                    RESET search_path;
--   ALTER FUNCTION public.update_taxonomy_updated_at()            RESET search_path;
--   CREATE INDEX IF NOT EXISTS idx_content_posts_content_type
--     ON public.content_posts (content_type);
-- ─────────────────────────────────────────────────────────────────────────────
