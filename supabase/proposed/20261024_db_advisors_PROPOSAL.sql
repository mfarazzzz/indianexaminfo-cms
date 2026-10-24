-- ─────────────────────────────────────────────────────────────────────────────
-- PROPOSED — DO NOT move into supabase/migrations/ without the owner's approval
-- (a CMS push may apply every file in migrations/). Nothing here has been run.
--
-- PHASE 2c — Supabase advisor findings → grouped fixes (read-only source).
-- Generated 2026-10-24 from the Supabase MCP `get_advisors` (security +
-- performance) against project cwbhhcqsrbuoybeaondk. Every finding is quoted
-- from the tool output; the SQL below is a PROPOSAL only. Apply per-group on the
-- owner's word, each in its own reviewed migration.
--
-- Running totals from the advisors:
--   SECURITY  ERROR 1 (security_definer_view) · WARN 6 (search_path) + 2
--             (extension_in_public) + 10 (anon SD fn) + 19 (auth SD fn) + 1
--             (leaked-password) · INFO 6 (rls_enabled_no_policy)
--   PERF      WARN 31 (auth_rls_initplan) + 98 (multiple_permissive_policies) + 1
--             (duplicate_index) · INFO 52 (unindexed_foreign_keys) + 60
--             (unused_index) + 2 (no_primary_key)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ─────────────────────────────────────────────────────────────────────────────
-- D2 DECISION (owner batch 2) — SAFE SUBSET vs HOLD, proven in a rolled-back txn.
--
-- SAFE SUBSET (the only thing proposed for "APPLY ADVISORS SAFE"):
--   1) A3 — the six ALTER FUNCTION … SET search_path (exact SQL below).
--   2) Drop the DUPLICATE content_posts index. Both are identical
--      `USING btree (content_type)` (verified via pg_indexes). KEEP
--      content_posts_content_type_idx — the foundational migration 20260702150704
--      creates it (`create index if not exists content_posts_content_type_idx on
--      content_posts(content_type)`). DROP idx_content_posts_content_type (added later
--      by 20260703110444, byte-identical):
--         DROP INDEX CONCURRENTLY IF EXISTS public.idx_content_posts_content_type;
--   PROOF NOTHING PERSISTS UNTIL APPLIED: the six ALTERs + the DROP were run inside
--   BEGIN … ROLLBACK; the post-rollback check returned fns_pinned_after_rollback=0 and
--   dup_index_present_after_rollback=1 — nothing changed on the live DB.
--
-- HOLD (do NOT apply yet — each needs its own owner review):
--   • REVOKE EXECUTE on SECURITY DEFINER functions referenced INSIDE RLS policies —
--     revoking them would break every policy. pg_policies references exactly:
--       auth.uid(), current_user_has_permission(), current_user_role().
--     So current_user_has_permission / current_user_role are OFF-LIMITS for REVOKE.
--   • extension_in_public moves (pg_trgm, pg_net) — schema-move risk.
--   • auth_rls_initplan rewrites (31 policies) — each is a policy change; batch carefully.
--   • unindexed_foreign_keys (52) — CREATE INDEX CONCURRENTLY; confirm the entity* legacy
--     tables are live first.
--   • unused_index drops (60) — verify idx_scan=0 over a window before dropping.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP A — SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

-- A1. rls_enabled_no_policy (INFO, 6 tables) — RLS ON but no policy ⇒ the table
--     is readable by NOBODY (safe by default). These are backup / ops tables:
--       broken_result_urls_backup_20260928, faq_placeholder_cleanup_backup,
--       faq_placeholder_cleanup_removed, menu_items_entrance_exam_url_backup_20260927,
--       message_rate_limits, revalidate_debounce
--     Recommendation: NO policy needed (leave locked). The *_backup / *_removed /
--     *_20260927/28 tables are migration scratch — DROP them once the owner
--     confirms no rollback needs them (see A1-drop, commented). message_rate_limits
--     and revalidate_debounce are written by edge/server code (service role) and
--     correctly need no anon/authenticated policy.
-- A1-drop (owner-confirmed only; destructive — NOT applied):
--   -- DROP TABLE IF EXISTS public.broken_result_urls_backup_20260928;
--   -- DROP TABLE IF EXISTS public.faq_placeholder_cleanup_backup;
--   -- DROP TABLE IF EXISTS public.faq_placeholder_cleanup_removed;
--   -- DROP TABLE IF EXISTS public.menu_items_entrance_exam_url_backup_20260927;

-- A2. security_definer_view (ERROR, 1) — public.exam_derived_status is SECURITY
--     DEFINER. This is BY DESIGN: it is a VIEW owned by postgres that the public
--     (anon) frontend reads to derive exam status without exposing the underlying
--     tables' RLS. Switching it to SECURITY INVOKER would make anon reads return
--     nothing (anon lacks rights on the base tables). Recommendation: KEEP, and
--     document the intent; no SQL change. (If the owner wants the lint silenced,
--     the honest fix is a comment in the view's defining migration, not a change.)

-- A3. function_search_path_mutable (WARN, 6) — pin search_path. Exact signatures
--     were read from pg_proc. Safe, additive, no behaviour change for callers.
ALTER FUNCTION public.ai_providers_auto_priority()            SET search_path = public, pg_temp;
ALTER FUNCTION public.content_posts_supersedes_same_exam()    SET search_path = public, pg_temp;
ALTER FUNCTION public.important_dates_all_iso(dates jsonb)    SET search_path = public, pg_temp;
ALTER FUNCTION public.maintain_current_edition()              SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_sarkari_verify()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.update_taxonomy_updated_at()            SET search_path = public, pg_temp;

-- A4. extension_in_public (WARN, 2) — move pg_trgm and pg_net out of public into
--     the `extensions` schema (Supabase's conventional home). RISK: any object
--     that references these by the unqualified public path (e.g. index ops using
--     gin_trgm_ops, or code calling net.http_post) must still resolve — Supabase
--     keeps `extensions` in the default search_path, so this is normally safe, but
--     review before applying. NOT applied.
--   CREATE SCHEMA IF NOT EXISTS extensions;
--   ALTER EXTENSION pg_trgm SET SCHEMA extensions;
--   ALTER EXTENSION pg_net  SET SCHEMA extensions;

-- A5. SECURITY DEFINER functions callable over PostgREST (WARN: 10 anon + 19 auth).
--     Most are TRIGGER-support / internal helpers that should never be reachable
--     via /rest/v1/rpc/*. Recommendation: REVOKE EXECUTE from anon (and from
--     authenticated where the CMS does not call it as an RPC). The functions the
--     CMS legitimately calls as RPCs (get_my_role_slug; acquire/release_content_lock
--     if the editor uses them over REST) must KEEP authenticated EXECUTE — VERIFY
--     each against the CMS service layer before revoking. Conservative set below
--     revokes only the clearly-internal trigger/enforcement helpers from PUBLIC and
--     anon; authenticated is left intact pending the owner's per-function call.
--     (Revoke from PUBLIC/anon is safe for trigger functions — triggers run as the
--     owning role, not through the API.)
--   REVOKE EXECUTE IN FUNCTION public.enforce_exam_publish_permission()   FROM PUBLIC, anon;
--   REVOKE EXECUTE IN FUNCTION public.enforce_exam_verify_permission()    FROM PUBLIC, anon;
--   REVOKE EXECUTE IN FUNCTION public.enforce_post_publish_permission()   FROM PUBLIC, anon;
--   REVOKE EXECUTE IN FUNCTION public.enforce_sarkari_publish_permission()FROM PUBLIC, anon;
--   REVOKE EXECUTE IN FUNCTION public.enforce_syllabus_weightage_unit()   FROM PUBLIC, anon;
--   REVOKE EXECUTE IN FUNCTION public.derive_is_published_from_workflow() FROM PUBLIC, anon;
--   REVOKE EXECUTE IN FUNCTION public.set_updated_by()                    FROM PUBLIC, anon;
--   REVOKE EXECUTE IN FUNCTION public.elms_audit_trigger_fn()             FROM PUBLIC, anon;
--   REVOKE EXECUTE IN FUNCTION public.clear_must_change_password()        FROM PUBLIC, anon;
--   REVOKE EXECUTE IN FUNCTION public.save_content_version(text,uuid,uuid,text) FROM PUBLIC, anon;
--   -- get_auth_user_emails exposes emails: restrict to admin service-role only.
--   REVOKE EXECUTE IN FUNCTION public.get_auth_user_emails()             FROM PUBLIC, anon, authenticated;
--   -- current_user_role()/current_user_has_permission() are used INSIDE policies;
--   -- they do not need REST EXECUTE. Revoke from anon; keep authenticated if the
--   -- CMS calls them as RPC (it does for permission checks) — verify first.
--   REVOKE EXECUTE IN FUNCTION public.current_user_role()                FROM PUBLIC, anon;
--   REVOKE EXECUTE IN FUNCTION public.current_user_has_permission(text)  FROM PUBLIC, anon;

-- A6. auth_leaked_password_protection (WARN, 1) — disabled. This is an Auth
--     setting, NOT SQL: enable "Leaked password protection" in Supabase Dashboard
--     → Authentication → Providers → Password (HaveIBeenPwned check). Owner action.


-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP B — PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════

-- B1. auth_rls_initplan (WARN, 31 policies) — policies that call auth.uid() /
--     current_user_has_permission() / current_user_role() per ROW. Wrap the call
--     in a scalar sub-select `(select ...)` so Postgres evaluates it ONCE per
--     query (initPlan) instead of per row. Same semantics, faster at scale.
--     Affected (table.policy): content_posts.staff_read_all_content,
--     content_posts.content_posts_update, content_posts.supersedes trigger n/a,
--     blog_posts.staff_read_all_blog, blog_posts.blog_posts_update,
--     media.staff_read_media, media.staff_upload_media, audit_log.staff_insert_audit,
--     ad_campaigns.staff_read_ads, advertisers.staff_read_advertisers,
--     ad_reports.staff_read_ad_reports, ad_creatives.staff_read_ad_creatives,
--     module_registry.staff_read_all_modules, cms_education_news.admin_only_delete,
--     cms_education_news.news_update, blog_authors.staff_write_blog_authors,
--     blog_authors.staff_update_blog_authors, user_profiles.users_read_own_profile,
--     user_profiles.users_update_own_profile, ai_request_logs.staff_read_ai_logs,
--     ai_request_logs.staff_write_ai_logs, exam_syllabus_subjects.staff_read_all_*,
--     exam_syllabus_subjects.admin_delete_*, exam_resources.admin_delete_*,
--     exam_resources.staff_read_all_*, exam_editions.admin_delete_*,
--     sarkari_naukri.admin_only_delete, sarkari_naukri.staff_update_sarkari,
--     exams.exams_update, exams.staff_read_exams_rbac, exam_syllabus.staff_read_all_*,
--     exam_syllabus.admin_delete_*.
--     Transform pattern (apply to each; example for the two exams policies):
--   DROP POLICY staff_read_exams_rbac ON public.exams;
--   CREATE POLICY staff_read_exams_rbac ON public.exams FOR SELECT TO authenticated
--     USING ( (select public.current_user_has_permission('edit_any_exam'))
--             OR created_by = (select auth.uid()) );
--   DROP POLICY exams_update ON public.exams;
--   CREATE POLICY exams_update ON public.exams FOR UPDATE TO authenticated
--     USING ( (select public.current_user_has_permission('edit_any_exam'))
--             OR (created_by = (select auth.uid())
--                 AND (select public.current_user_has_permission('create_exam'))) );
--     NOTE: staff_read_exams_rbac was applied 2026-10-22 (see that policy live);
--     this only re-wraps the calls. Do the same (select)-wrap for the other 29.

-- B2. unindexed_foreign_keys (INFO, 52) — add a covering index on each FK column
--     so the reverse-side (parent delete/update, join) is not a seq scan. Use
--     CREATE INDEX CONCURRENTLY (cannot run inside a migration transaction —
--     run each as a top-level statement). Several `entity*` / module_block_* /
--     reusable_component* tables look like a legacy CMS; CONFIRM the table is live
--     before indexing it (skip if dead — see B3). Representative full set:
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_ad_campaigns_approved_by      ON public.ad_campaigns (approved_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_ad_campaigns_created_by       ON public.ad_campaigns (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_ad_creatives_campaign_id      ON public.ad_creatives (campaign_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_ad_reports_zone_id            ON public.ad_reports (zone_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_advertisers_user_id           ON public.advertisers (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_blog_posts_created_by         ON public.blog_posts (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_blog_posts_locked_by          ON public.blog_posts (locked_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_blog_posts_updated_by         ON public.blog_posts (updated_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_cms_edu_news_created_by       ON public.cms_education_news (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_cms_edu_news_image_id         ON public.cms_education_news (image_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_content_posts_created_by      ON public.content_posts (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_content_posts_locked_by       ON public.content_posts (locked_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_content_posts_updated_by      ON public.content_posts (updated_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_exam_editions_created_by      ON public.exam_editions (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_exam_editions_updated_by      ON public.exam_editions (updated_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_exam_resources_created_by     ON public.exam_resources (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_exam_resources_related_res    ON public.exam_resources (related_resource_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_exams_created_by              ON public.exams (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_exams_locked_by               ON public.exams (locked_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_exams_subcategory_id          ON public.exams (subcategory_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_exams_updated_by              ON public.exams (updated_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_exams_verified_by             ON public.exams (verified_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_media_uploaded_by             ON public.media (uploaded_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_menu_items_category_id        ON public.menu_items (category_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_menu_items_exam_id            ON public.menu_items (exam_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_menus_updated_by              ON public.menus (updated_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_module_registry_created_by    ON public.module_registry (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_pages_updated_by              ON public.pages (updated_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_role_permissions_permission   ON public.role_permissions (permission_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sarkari_naukri_created_by     ON public.sarkari_naukri (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sarkari_naukri_image_id       ON public.sarkari_naukri (image_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sarkari_naukri_updated_by     ON public.sarkari_naukri (updated_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sarkari_naukri_verified_by    ON public.sarkari_naukri (verified_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_settings_updated_by           ON public.settings (updated_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_user_profiles_role_id         ON public.user_profiles (role_id);
-- (the remaining ~17 are on the legacy entity*/module_block_component_ref/
--  reusable_component/navigation_revisions/lifecycle_template_version/
--  contact_message_*/taxonomy_redirects tables — apply ONLY if those tables are
--  confirmed live; otherwise they belong with the B3 cleanup.)

-- B3. unused_index (INFO, 60) + duplicate_index (WARN, 1) — indexes the planner
--     has not used. Highest-confidence drops:
--       • duplicate: content_posts has BOTH content_posts_content_type_idx and
--         idx_content_posts_content_type (identical) — and BOTH are unused → drop
--         both (keep at most one if content_type is ever filtered alone).
--       • the whole `entity*` family (idx_entity_*, idx_module_*, idx_timeline_*,
--         idx_download_*, idx_link_*, idx_facets_*, idx_activity_*, idx_syllabus_*,
--         idx_exam_pattern_entity, idx_selection_entity, idx_taxonomy_*,
--         idx_redirects_old_path, idx_nav_revisions_*, idx_template_version_active,
--         idx_conducting_body_parent) — these back a legacy CMS surface; if the
--         tables are dead, drop the tables (with their indexes) rather than index.
--       • exams_tags_idx / exams_keywords_idx / exams_fts_idx and the *_fts_idx /
--         *_trgm on content_posts/blog_posts/sarkari_naukri — full-text/trigram
--         indexes unused because search goes another route; confirm the search
--         path before dropping (dropping saves write cost + space).
--     Use DROP INDEX CONCURRENTLY (top-level, not in a txn). Sample (NOT applied):
--   DROP INDEX CONCURRENTLY IF EXISTS public.content_posts_content_type_idx;
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_content_posts_content_type;
--   DROP INDEX CONCURRENTLY IF EXISTS public.exams_tags_idx;
--   DROP INDEX CONCURRENTLY IF EXISTS public.exams_keywords_idx;
--     Review the full 60 with the owner; do not bulk-drop FTS indexes blindly.

-- B4. multiple_permissive_policies (WARN, 98) — informational: several permissive
--     (SELECT) policies OR together. This is expected where a table has
--     public_read_published + staff_read_* (they should OR). No action unless a
--     specific policy widens access unintentionally — spot-check the exams /
--     content_posts / pages read policies during the B1 rewrite.

-- B5. no_primary_key (INFO, 2) — the two *_backup tables (A1) lack a PK; they are
--     migration scratch and are being recommended for DROP (A1-drop), which
--     resolves this too. No PK needed on a table slated for deletion.


-- ─────────────────────────────────────────────────────────────────────────────
-- APPLY-TIME CHECKS (per group, read-only first):
--   • B1: after re-wrapping, EXPLAIN a hot list query and confirm the policy
--     predicate shows as an InitPlan (one eval), not per-row.
--   • B2: `SELECT indexrelid::regclass FROM pg_stat_user_indexes` before/after;
--     confirm the new FK indexes are scanned for the parent-delete path.
--   • B3: `SELECT schemaname,relname,indexrelname,idx_scan FROM
--     pg_stat_user_indexes WHERE indexrelname IN (<drops>)` — confirm idx_scan=0
--     over a representative window before dropping.
--   • A5: grep the CMS/Frontend service layer for each RPC name to prove it is not
--     called over REST before REVOKE.
-- ROLLBACK:
--   • A3: ALTER FUNCTION ... RESET search_path.
--   • A5: GRANT EXECUTE ... TO anon/authenticated (restore).
--   • B1: recreate the original policy qual (drop the (select) wrap).
--   • B2: DROP INDEX CONCURRENTLY <new>.   B3: recreate dropped index.
-- ─────────────────────────────────────────────────────────────────────────────
