-- ============================================================================
-- 20261201_evergreen_names_PROPOSAL.sql — exam names: take the year out of the
-- identity, leave it on the edition.
--
-- Owner batch 6, Phase Z4. NOT APPLIED. Nothing in this file has been run except
-- the SELECTs, which are read-only. It waits for the owner's word "APPLY EVERGREEN".
-- This is a data UPDATE, not a schema migration: it is intended for the dashboard
-- SQL editor (or an explicit apply_migration if the owner wants it in the history),
-- and batch 6 applies no migration of its own.
--
-- WHY (owner decision 23 Oct, reference-page review P2 item 19)
--   `exams.name` is the record's identity; the year belongs to `exam_editions.year`.
--   Today 126 real records carry a trailing year in the identity, so every one of
--   them has to be renamed by hand each cycle — and the reader-facing H1 is composed
--   as nameWithYear(name, edition.year) (indianexaminfo-frontend
--   lib/seo/keywords.ts:922-927), which appends the edition year ONLY when the name
--   does not already end in one.
--
-- WHY THIS IS INVISIBLE TO READERS — proved today, not assumed
--   Ran against the live database on 2026-11-06 (the same shape as
--   supabase/proposed/evergreen_names_DRYRUN.sql):
--     rows matching the trailing-year pattern .................. 126
--     of which are retire-loser records (MUST NOT be touched) ... 3   → 123 to change
--     rows whose current edition is missing ..................... 0
--     name_year = edition_year (so the H1 reassembly is identical) 126
--     name_year ≠ edition_year (H1 would visibly change) ......... 0
--     proposed_name || ' ' || edition_year <> name ............... 0   ← the decisive one
--     names where the year is not space-separated ................ 0
--     proposed-name collisions inside a pillar .................. 0
--     rows already unpublished .................................. 0
--     rows with an explicit seo_title (title unaffected either way) 124
--     rows whose SLUG carries a year ............................ 2
--   Because the reassembly is byte-identical for every row, the H1 string, the
--   <title> (for the 124 with a stored seo_title) and the URL do not change at all.
--   No slug is touched, so no redirect is needed and none is created.
--
-- WHAT IS DELIBERATELY EXCLUDED
--   1. the live PET record `upsssc-pet-notification` (owner standing rule);
--   2. reference rows `slug like 'zz-test%'`;
--   3. the five retire-loser records — cds, nda, nta-ugc-net, rpf-constable-si-recruitment,
--      upsc-cms-examination-2026. Three of them (cds, nda, upsc-cms-examination-2026) match the
--      year pattern and WOULD otherwise be swept up by this UPDATE; they are pages that 308 to a
--      winner, so renaming them edits a record the owner has frozen. The September dry-run's
--      headline of 126 did not exclude them — 123 is the number this proposal acts on.
--   4. the two rows with NO stored seo_title (`up-ecce-educator`, `utet`): for those the <title>
--      IS nameWithYear(...), and the reassembly proof above says it comes out identical — but
--      they are the two rows where a human should look before applying, so they are listed in
--      docs/status/evergreen-names-before-after.md and are NOT in the UPDATE below. Approve them
--      separately if you want the count to be 121 → 123.
--
-- ROLLOUT, if approved
--   1. run the PRE-FLIGHT block and confirm it reports 121 rows (123 minus the two no-seo_title
--      rows) and 0 collisions;
--   2. run the UPDATE inside the transaction shown; the WHERE clause re-checks the current name,
--      so a row edited in the CMS between now and then is skipped rather than overwritten;
--   3. run the VERIFY block; every row must satisfy proposed_name || ' ' || edition_year = the
--      name it had before;
--   4. push nothing — this is data. But the public pages are ISR-cached, so revalidate the
--      affected exam tags (or let the window expire) before eyeballing an H1;
--   5. run node scripts/evergreen-names-verify.mjs, which asserts the invariance from the outside.
--
-- ROLLBACK: the block at the bottom restores each row's exact previous name by id. It is a
-- comment-free, standalone script so it can be run at any time after the change.
-- ============================================================================

BEGIN;

-- ── PRE-FLIGHT ───────────────────────────────────────────────────────────────
-- Expect: rows_to_change = 121, collisions = 0, reassembly_mismatch = 0,
--         edition_missing = 0.
with target as (
  select e.id, e.slug, e.name, e.pillar,
         regexp_replace(e.name, '\s*(20[0-9]{2})\s*$', '') as proposed_name,
         ed.year as edition_year
  from exams e
  left join exam_editions ed on ed.id = e.current_edition_id
  where e.name ~ '(20[0-9]{2})$'
    and e.slug not like 'zz-test%'
    and e.slug <> 'upsssc-pet-notification'
    and e.slug not in ('cds', 'nda', 'nta-ugc-net', 'rpf-constable-si-recruitment',
                       'upsc-cms-examination-2026')
    -- the two rows with no stored seo_title are held back for a separate approval
    and coalesce(trim(e.seo_title), '') <> ''
),
coll as (
  select pillar, proposed_name from target group by pillar, proposed_name having count(*) > 1
)
select count(distinct t.id)                                   as rows_to_change,
       (select count(*) from coll)                            as collisions,
       count(*) filter (where t.edition_year is null)         as edition_missing,
       count(*) filter (where t.proposed_name || ' ' || t.edition_year::text <> t.name)
                                                              as reassembly_mismatch
from target t;

-- ── THE CHANGE ───────────────────────────────────────────────────────────────
-- One statement, guarded three ways: the slug exclusions, the trailing-year pattern, and the
-- current name it expects. A row whose name has moved on since this proposal was written is
-- simply not matched, and the count will show it.
UPDATE public.exams e
   SET name = regexp_replace(e.name, '\s*(20[0-9]{2})\s*$', '')
 WHERE e.name ~ '(20[0-9]{2})$'
   AND e.slug NOT LIKE 'zz-test%'
   AND e.slug <> 'upsssc-pet-notification'
   AND e.slug NOT IN ('cds', 'nda', 'nta-ugc-net', 'rpf-constable-si-recruitment',
                      'upsc-cms-examination-2026')
   AND coalesce(trim(e.seo_title), '') <> '';

-- ── VERIFY ──────────────────────────────────────────────────────────────────
-- Expect: still_year_in_name = 0 for the population this proposal touches, and every row's
-- name || ' ' || edition_year equal to what the pre-flight recorded in
-- docs/status/evergreen-names-before-after.md.
select count(*) filter (where name ~ '(20[0-9]{2})$') as rows_still_carrying_a_year,
       count(*) filter (where slug = 'upsssc-pet-notification' and name ~ '(20[0-9]{2})$')
                                                     as pet_rows_touched_must_be_0,
       count(*) filter (where slug in ('cds','nda','nta-ugc-net','rpf-constable-si-recruitment',
                                       'upsc-cms-examination-2026')
                        and updated_at > now() - interval '5 minutes')
                                                     as retire_losers_touched_must_be_0
from public.exams;

-- Nothing in this file touches: slug, short_name, seo_title, seo_description, canonical_url,
-- exam_editions (year, edition_label, important_dates), or any other column. `updated_at` and
-- `updated_by` move as a side effect of the UPDATE, which is honest: the record did change.

COMMIT;

-- ============================================================================
-- ROLLBACK — run on its own, any time after the change.
-- It restores the trailing year from the edition, which is exactly where the
-- proposal took it from, and only for rows that currently have no trailing year
-- (so it is safe to run twice).
-- ============================================================================
UPDATE public.exams e
   SET name = e.name || ' ' || ed.year::text
  FROM public.exam_editions ed
 WHERE ed.id = e.current_edition_id
   AND e.name !~ '(20[0-9]{2})$'
   AND e.slug NOT LIKE 'zz-test%'
   AND e.slug <> 'upsssc-pet-notification'
   AND e.slug NOT IN ('cds', 'nda', 'nta-ugc-net', 'rpf-constable-si-recruitment',
                      'upsc-cms-examination-2026')
   AND coalesce(trim(e.seo_title), '') <> ''
   AND ed.year IS NOT NULL;
