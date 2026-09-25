-- T3.2-T3.5: Drop tables referenced by NEITHER the frontend nor the CMS.
-- Confirmed: no other frontend/service shares this Supabase project.

-- Migration artifacts
DROP TABLE IF EXISTS _migration_log_sarkari CASCADE;
DROP TABLE IF EXISTS entity_migration_log_preview CASCADE;
DROP TABLE IF EXISTS entity_migration_log CASCADE;

-- Dormant generic-CMS stack (order respects FK deps)
DROP TABLE IF EXISTS cms_ad_events CASCADE;
DROP TABLE IF EXISTS cms_ads CASCADE;
DROP TABLE IF EXISTS cms_microsite_items CASCADE;
DROP TABLE IF EXISTS cms_internal_links CASCADE;
DROP TABLE IF EXISTS cms_places CASCADE;
DROP TABLE IF EXISTS cms_restaurants CASCADE;
DROP TABLE IF EXISTS cms_institutions CASCADE;
DROP TABLE IF EXISTS cms_events CASCADE;
DROP TABLE IF EXISTS cms_holidays CASCADE;
DROP TABLE IF EXISTS cms_authors CASCADE;
DROP TABLE IF EXISTS cms_tags CASCADE;
DROP TABLE IF EXISTS cms_site_settings CASCADE;

-- Unused media tables (keeping `media` which is actively used by the CMS)
DROP TABLE IF EXISTS cms_media_variants CASCADE;
DROP TABLE IF EXISTS cms_media CASCADE;
DROP TABLE IF EXISTS media_library CASCADE;
DROP TABLE IF EXISTS entity_media CASCADE;

-- Never-wired platform features
DROP TABLE IF EXISTS redirects CASCADE;
DROP TABLE IF EXISTS related_content CASCADE;
DROP TABLE IF EXISTS content_versions CASCADE;
DROP TABLE IF EXISTS editorial_comments CASCADE;

-- module_block (exists in DB, code references entity_module_block which doesn't exist)
DROP TABLE IF EXISTS module_block CASCADE;
-- entity_broken_link (0 rows, 0 references)
DROP TABLE IF EXISTS entity_broken_link CASCADE;;
