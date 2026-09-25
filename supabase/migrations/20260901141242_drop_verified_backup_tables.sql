
-- Dropping four backup tables with verified live data:
-- official_website: 2 rows, URLs corrected live (ibps-clerk, aiims-norcet)
-- official_website_mangled: 5 rows, single clean URLs now live (ctet, rpf, rrb-alp, rrb-je, rrb-ntpc)
-- selection_model: 402 rows, all 402 IDs verified present in exams with matching names
-- settings_policies: 3 rows, RLS policy text — policies live in pg_policies, not this table
DROP TABLE IF EXISTS public._backup_20260830_official_website;
DROP TABLE IF EXISTS public._backup_20260830_official_website_mangled;
DROP TABLE IF EXISTS public._backup_20260831_selection_model;
DROP TABLE IF EXISTS public._backup_20260830_settings_policies;
;
