
-- T3-10: Drop cms_results (361 rows, fully migrated to sarkari_naukri)
-- Preconditions verified:
--   ✓ _migration_log_sarkari proves 361/361 rows migrated (source_table='cms_results')
--   ✓ sarkari_naukri.source_id preserves lineage to original cms_results.id
--   ✓ CMS route /results already redirects to /sarkari-naukri
--   ✓ No edge functions reference this table
--   ✓ No pg_cron jobs exist
--   ✓ No event triggers reference this table
--   ✓ Frontend /results page reads content_posts/exams, not cms_results

-- cms_results references cms_media (image_id FK) — safe to drop cms_results without affecting cms_media
DROP TABLE IF EXISTS public.cms_results;
;
