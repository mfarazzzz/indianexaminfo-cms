-- =====================================================================================
-- C4 PROPOSAL — archiving expired vacancies  (NOT APPLIED)
-- Owner batch 7, Phase C4. Waits for the owner's exact word: "APPLY ARCHIVE VACANCIES".
-- =====================================================================================
--
-- HEADLINE, AND IT IS THE WHOLE POINT OF THIS FILE: with the database as it stands today,
-- THE DEFENSIBLE ARCHIVE COUNT IS ZERO. Not "small" — zero. Two reasons, both measured:
--
--   1. Nothing can be PROVEN expired. An expired recruitment is a closed application window,
--      and `application_end_date` is NULL on all 361 rows
--      (select count(*) from sarkari_naukri where application_end_date is null;  => 361).
--      The date-based rule below therefore matches 0 rows today:
--        select count(*) from sarkari_naukri
--         where application_end_date is not null and application_end_date < current_date;  => 0
--
--   2. The one signal that DOES look usable is the `status` column, and it is not.
--      Measured distribution (live, 2026-11-06):
--        completed          = 300
--        result-declared    =  56
--        application-open   =   5
--      356 of 361 rows say "over", while the frontend deliberately ignores that column:
--      lib/seo/structured-data.ts:207 "Deliberately does NOT read item.status (the stored
--      column is 98.6% wrong)" and lib/sarkari/deriveStatus.ts:5 "Derives reader-facing
--      status from the three structured dates ONLY. Replaces the stored
--      sarkari_naukri.status column (98.6% wrong)". Archiving on a column the product
--      already disowns would delete 356 URLs on a guess.
--
-- AND THE COST IF IT IS DONE ANYWAY: these 361 pages are not a long tail. Per the owner's
-- Search Console exports, ~500 of 548 clicks (91%) arrive on flat /sarkari-naukri/<slug>
-- vacancy pages, and twenty of them carry 84% of the impressions. `anon_read_published`
-- only serves rows with workflow_status = 'published', so an archived vacancy stops
-- resolving for readers immediately — and unlike the retired exam duplicates there is no
-- winner page to 308 to, because the notice really is over and the URL has no successor.
-- Archiving the top-20 would remove the site's main traffic source.
--
-- WHAT THIS PROPOSAL IS FOR, THEN: it is the mechanism to run AFTER C2's bulk fill, when
-- dates exist and expiry becomes a fact rather than a guess. It is written to be re-runnable
-- and to leave the traffic-carrying pages alone unless they are proven closed.
--
-- The mechanism is the one the platform already uses — no deletion anywhere:
--   CHECK ((workflow_status = ANY (ARRAY['draft','review','published','archived'])))
-- on sarkari_naukri.workflow_status, the same value Phase R used for the exam duplicates.

-- ------------------------------------------------------------------ PRE-FLIGHT (read only)
-- Run these first and expect them to still be true when the fill has happened:
--   select count(*) from public.sarkari_naukri;                                   -- 361
--   select count(*) from public.sarkari_naukri
--    where application_end_date is null;                                          -- 361 today, 0 after the fill
--   select count(*) from public.sarkari_naukri
--    where application_end_date < current_date;                                   -- 0 today  <-- the real number to look at
--   select count(*) from public.sarkari_naukri                                    -- 20  (the traffic set)
--    where slug in ('up-swasthya-vibhag-ambulance-driver-2026',
--                    'up-district-hospital-ward-boy-2026-gorakhpur',
--                    'tamil-nadu-anganwadi-worker-2026-chennai',
--                    'gujarat-anganwadi-worker-helper-bharti-2026-ahmedabad',
--                    'up-swasthya-vibhag-pharmacist-2026','jharkhand-forest-guard-2026',
--                    'up-nagar-nigam-safai-karmi-2026-lucknow',
--                    'uttarakhand-anganwadi-bharti-2026-haridwar',
--                    'rajasthan-health-dept-radiographer-2026','ibps-clerk-2026-prelims-result',
--                    'up-nagar-nigam-safai-karmi-2026-kanpur',
--                    'up-fisheries-dept-matsya-mitra-2026',
--                    'west-bengal-gram-panchayat-sahayak-2026',
--                    'karnataka-anganwadi-2026-belgaum',
--                    'rajasthan-forest-guard-vanrakshak-2026','rajasthan-pwd-work-charged-2026',
--                    'bihar-anganwadi-bharti-2026-east-champaran',
--                    'up-asha-worker-bharti-2026-varanasi',
--                    'up-nagar-palika-parishad-clerk-2026','mp-mahila-supervisor-icds-2026');
--
-- TWO SAFEGUARDS, deliberate and both required before any run:
--   (a) a grace window, so a notice whose last date passed yesterday is not pulled the
--       moment the site revalidates — 30 days here;
--   (b) the twenty high-traffic slugs are EXCLUDED by default. Their value is the reader
--       who arrives from Google looking for that job; a "Dates awaited"/closed page with a
--       notice link still answers the query, and 404 does not. To archive one of those,
--       name it explicitly in the second statement.

BEGIN;

-- (1) every vacancy whose window is provably closed by more than the grace period,
--     excluding the traffic set. Review the count before committing.
UPDATE public.sarkari_naukri
   SET workflow_status = 'archived'
 WHERE workflow_status = 'published'
   AND application_end_date IS NOT NULL
   AND application_end_date < (current_date - 30)
   AND slug NOT IN ('up-swasthya-vibhag-ambulance-driver-2026',
                    'up-district-hospital-ward-boy-2026-gorakhpur',
                    'tamil-nadu-anganwadi-worker-2026-chennai',
                    'gujarat-anganwadi-worker-helper-bharti-2026-ahmedabad',
                    'up-swasthya-vibhag-pharmacist-2026',
                    'jharkhand-forest-guard-2026',
                    'up-nagar-nigam-safai-karmi-2026-lucknow',
                    'uttarakhand-anganwadi-bharti-2026-haridwar',
                    'rajasthan-health-dept-radiographer-2026',
                    'ibps-clerk-2026-prelims-result',
                    'up-nagar-nigam-safai-karmi-2026-kanpur',
                    'up-fisheries-dept-matsya-mitra-2026',
                    'west-bengal-gram-panchayat-sahayak-2026',
                    'karnataka-anganwadi-2026-belgaum',
                    'rajasthan-forest-guard-vanrakshak-2026',
                    'rajasthan-pwd-work-charged-2026',
                    'bihar-anganwadi-bharti-2026-east-champaran',
                    'up-asha-worker-bharti-2026-varanasi',
                    'up-nagar-palika-parishad-clerk-2026',
                    'mp-mahila-supervisor-icds-2026');

-- (2) optional, only with the owner naming the slugs: archive a traffic page that is proven
--     closed. Kept as a comment so it cannot run by accident.
-- UPDATE public.sarkari_naukri SET workflow_status = 'archived'
--  WHERE workflow_status = 'published'
--    AND application_end_date < (current_date - 30)
--    AND slug IN ( /* owner fills in */ );

-- ------------------------------------------------------------- VERIFY, INSIDE THE SAME tx
-- 0 must be the answer, or the grace period/exclusions are wrong:
SELECT count(*) AS still_published_but_closed_beyond_grace
  FROM public.sarkari_naukri
 WHERE workflow_status = 'published'
   AND application_end_date < (current_date - 30);

-- nothing may vanish from the sitemap for a row we cannot prove is over:
SELECT count(*) AS archived_without_an_end_date
  FROM public.sarkari_naukri
 WHERE workflow_status = 'archived' AND application_end_date IS NULL;

-- the traffic set must be untouched unless step (2) named it:
SELECT count(*) AS traffic_pages_archived
  FROM public.sarkari_naukri
 WHERE workflow_status = 'archived'
   AND slug IN ('up-swasthya-vibhag-ambulance-driver-2026','ibps-clerk-2026-prelims-result');

COMMIT;

-- ------------------------------------------------------------------------------ ROLLBACK
-- Restores every row this file could have touched (the write only ever moves
-- published -> archived, so the inverse is exact):
-- BEGIN;
-- UPDATE public.sarkari_naukri SET workflow_status = 'published'
--  WHERE workflow_status = 'archived'
--    AND application_end_date < (current_date - 30);      -- same predicate, reversed
-- COMMIT;
-- If the archive list was curated by hand, restore by slug instead:
-- UPDATE public.sarkari_naukri SET workflow_status = 'published' WHERE slug = ANY(ARRAY[...]);

-- -------------------------------------------------------------------------------- NOTES
-- * Sitemap and readers: the frontend's vacancy sitemap entries come from
--   getSarkariNaukriSitemapEntries() over published rows, so an archived row leaves the
--   sitemap on the next regeneration. There is no successor URL, so the page becomes a
--   404 — which is the correct outcome for a notice that finished long ago, and the reason
--   for the 30-day grace and the traffic exclusion.
-- * Phase C2's importer cannot archive: it writes only the seven whitelisted data columns
--   and cannot create or delete rows. Archiving stays a deliberate, reviewed SQL step.
-- * Do NOT confuse this with `status`. If the owner wants the status column to stop being
--   wrong, that is a separate, documented backfill from the dates (the same deriveStatus
--   rule the readers already use), not an archive trigger.
-- * Measured today: statement (1) would update 0 rows. This proposal is staged so the
--   count can be reviewed after the bulk fill, not guessed now.
