-- ─────────────────────────────────────────────────────────────────────────────
-- evergreen_names_DRYRUN.sql — READ-ONLY. SELECT only. It writes nothing.
--
-- Owner decision 23 Oct (reference-page review, P2 item 19): exam names should be
-- evergreen — the YEAR belongs to the edition (exam_editions.year / edition_label),
-- not to the identity. 126 of the 398 real records currently carry a trailing year in
-- `exams.name` (entrance-exam 122/128, government-exam 3/105, govt-vacancy 1/101,
-- board-exam 0/38, university-exam 0/27), and ALL of them already have at least one
-- edition, so the year has somewhere else to live.
--
-- Run this and read it. Nothing here is applied: the UPDATE block at the bottom is
-- commented out on purpose and stays that way until the owner approves a batch.
-- The live PET record (upsssc-pet-notification) is excluded from the rows and from any
-- future batch by the owner's standing rule.
--
-- VERIFIED RESULT of running this (23 Oct, read-only):
--   rows_total 126 | h1_would_change 0 | no_current_edition 0 | collisions 0
--   title_pinned_by_seo_title 124 | slug_carries_year 2
--   by pillar: entrance-exam 122, government-exam 3, govt-vacancy 1 (board/university 0)
-- i.e. for EVERY row the name's year already equals the current edition year, so the H1
-- string is identical before and after and no URL changes. The two dated-slug rows and
-- the two rows with no stored seo_title are the only ones needing a human look.
--
-- What each column answers:
--   proposed_name      the name with its trailing year removed.
--   h1_changes         the page H1 is nameWithYear(name, edition.year) — it appends the
--                      edition year only when the name does not already end in one. So
--                      when the name's year EQUALS the edition year, the H1 string is
--                      IDENTICAL before and after; anything else is a visible change.
--   title_changes      same logic for the <title>, except a record with an explicit
--                      seo_title is unaffected either way (it is stored literally).
--   year_specific      the name's year and the CURRENT edition year disagree — this is
--                      not a stale suffix, it is a record about a specific past cycle
--                      (or an edition that was never advanced). Review by hand.
--   name_collision     another record in the same pillar would end up with the same
--                      name after stripping. Fix the name, not the data.
--   slug_carries_year  the slug has a trailing -YYYY. The proposal does NOT touch slugs,
--                      so no URL changes and no redirect is needed; the flag is here so
--                      the mismatch (clean name, dated slug) is visible.
--   redirect_needed    always 'no' in this proposal, because no slug changes. Stated
--                      explicitly so nobody assumes a silent URL migration.
-- ─────────────────────────────────────────────────────────────────────────────

with base as (
  select
    e.id,
    e.slug,
    e.name,
    e.short_name,
    e.pillar,
    e.seo_title,
    e.workflow_status,
    ed.year                              as edition_year,
    ed.edition_label,
    substring(e.name from '(20[0-9]{2})$')::int as name_year
  from exams e
  left join exam_editions ed on ed.id = e.current_edition_id
  where e.slug not like 'zz-test-%'
    and e.slug <> 'upsssc-pet-notification'      -- the live PET record: never proposed
    and e.name ~ '(20[0-9]{2})$'
),
proposed as (
  select
    b.*,
    regexp_replace(b.name, '\s*(20[0-9]{2})\s*$', '') as proposed_name
  from base b
),
collisions as (
  select pillar, proposed_name, count(*) as n
  from proposed
  group by pillar, proposed_name
  having count(*) > 1
)
select
  p.id,
  p.slug,
  p.pillar::text                                       as pillar,
  p.name                                               as current_name,
  p.proposed_name,
  p.name_year,
  p.edition_year,
  coalesce(p.edition_label, '(no current edition)')    as edition_supplying_year,
  p.workflow_status::text                              as status,
  -- what the page prints today, and what it would print (the H1 is name + edition year
  -- when the name carries none; the <title> defers to an explicit seo_title when set).
  case when p.name ~ '(20[0-9]{2})$' then p.name
       else p.name || ' ' || coalesce(p.edition_year::text, '') end as h1_today,
  trim(p.proposed_name || ' ' || coalesce(p.edition_year::text, '')) as h1_after,
  coalesce(nullif(btrim(p.seo_title), ''),
           p.name || ' ' || coalesce(p.edition_year::text, '') || ' — Notification, Eligibility & Apply') as title_today,
  coalesce(nullif(btrim(p.seo_title), ''),
           trim(p.proposed_name || ' ' || coalesce(p.edition_year::text, '')) || ' — Notification, Eligibility & Apply') as title_after,
  case when coalesce(nullif(btrim(p.seo_title), ''), '') <> '' then 'no (seo_title is stored)'
       when p.name_year is distinct from p.edition_year        then 'YES — the year changes'
       else 'no — identical string' end                        as title_changes,
  case when p.name_year is distinct from p.edition_year then 'YES' else 'no' end as h1_changes,
  case when p.name_year is distinct from p.edition_year
       then 'REVIEW: year-specific record (name says ' || p.name_year || ', current edition is '
            || coalesce(p.edition_year::text, 'none') || ')'
       else 'no' end                                           as year_specific_flag,
  case when c.n is not null then 'YES — ' || c.n || ' records share this name after stripping'
       else 'no' end                                           as name_collision,
  case when p.slug ~ '-20[0-9]{2}$' then 'yes' else 'no' end    as slug_carries_year,
  'no'                                                          as redirect_needed
from proposed p
left join collisions c on c.pillar = p.pillar and c.proposed_name = p.proposed_name
order by (p.name_year is distinct from p.edition_year) desc, c.n nulls last, p.pillar, p.slug;

-- ─────────────────────────────────────────────────────────────────────────────
-- NOT RUN — the batch shape, kept here so the approval is about this exact text.
-- It is commented out deliberately; applying it is the owner's call, per pillar, after
-- the flagged rows above have been reviewed. Slugs are untouched, so no redirect map.
--
-- update exams e
-- set    name = regexp_replace(e.name, '\s*(20[0-9]{2})\s*$', ''),
--        updated_at = now()
-- from   exam_editions ed
-- where  ed.id = e.current_edition_id
--   and  e.slug not like 'zz-test-%'
--   and  e.slug <> 'upsssc-pet-notification'
--   and  e.name ~ '(20[0-9]{2})$'
--   and  substring(e.name from '(20[0-9]{2})$')::int = ed.year        -- only where the H1 is unchanged
--   and  e.pillar = 'entrance-exam';                                 -- one pillar per batch
-- ─────────────────────────────────────────────────────────────────────────────
