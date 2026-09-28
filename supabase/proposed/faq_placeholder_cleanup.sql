-- faq_placeholder_cleanup.sql  (PROPOSED — owner review before promotion)
-- Sprint 0 Part 2, FAQ placeholders, owner decision 2026-09-28 (option D):
-- the site-side hiding rule is deterministic (bare placeholder TOKENS only —
-- see lib/sectionRegistry.ts meaningfulFaqs and content_has_data_fn.sql), so
-- these three exams, whose FAQ answers are full sentences saying the fact is
-- "not specified", are fixed at the CONTENT level instead of being hidden by
-- a heuristic.
--
-- What this does:
--   1. Creates faq_placeholder_cleanup_backup + faq_placeholder_cleanup_removed
--      (once) and snapshots the FULL pre-change faqs arrays of the affected
--      exams plus every removed entry, tagged run_id='sprint0-part2-2026-09-28'.
--   2. Removes ONLY FAQ entries whose answer contains the phrase
--      "not specified" (case-insensitive) from exams.faqs for
--      bihar-board-inter, cat, ibps-clerk.
--   3. ASSERTS the exact counts (verified against the live DB 2026-09-28:
--      bihar-board-inter 1 of 6, cat 2 of 15, ibps-clerk 1 of 6 — total 4
--      entries, across exactly 3 exams — the only 3 in the whole table
--      carrying the phrase). Any mismatch raises and aborts the transaction.
--
-- Entries kept (NOT "the fact is not specified" statements):
--   cat #12 "does not specify any nationality criteria" — states a fact from
--   the eligibility rules. bihar-board-inter #2/#4 say fee/eligibility are
--   "N/A … not announced yet" — weak content but outside this phrase-exact
--   cleanup; flagged for editorial follow-up, not removed here.
--
-- Safe to re-run: after the first application no answer contains the phrase,
-- so targets matches 0 rows, nothing is inserted or updated, and the assert
-- exits with a notice instead of failing.
--
-- PROOF (run 2026-09-28 via Supabase MCP inside begin; … rollback;):
--   removed exactly 4 entries — bihar-board-inter #3 (conducting body),
--   cat #2 (website), cat #4 (eligibility), ibps-clerk #3 (application fee);
--   lengths after: bihar-board-inter 6->5, cat 15->13, ibps-clerk 6->5;
--   phrase rows left in the whole table = 0; all DO assertions passed; rolled
--   back. An earlier variant failed on `jsonb_object_keys … as s` (missing
--   column alias) — the abort proved the assert path fires and leaves the DB
--   untouched (re-checked: 4 phrase rows, cat still 15, no backup tables).

create table if not exists public.faq_placeholder_cleanup_backup (
  id            uuid primary key default gen_random_uuid(),
  run_id        text        not null,
  exam_id       uuid        not null,
  slug          text        not null,
  faqs_before   jsonb,
  faqs_after    jsonb,
  removed_count int         not null,
  backed_up_at  timestamptz not null default now()
);

create table if not exists public.faq_placeholder_cleanup_removed (
  id            uuid primary key default gen_random_uuid(),
  run_id        text        not null,
  exam_id       uuid        not null,
  slug          text        not null,
  position      int         not null,           -- 1-based index in the old array
  question      text,
  answer        text,
  backed_up_at  timestamptz not null default now()
);

-- Snapshot + removal in one pass. The deletion predicate IS the backup-source
-- predicate: an entry is removed iff its answer contains "not specified".
with targets as (
  select e.id as exam_id, e.slug, e.faqs as faqs_before,
         coalesce((select jsonb_agg(f order by ord)
                   from jsonb_array_elements(e.faqs) with ordinality as t(f, ord)
                   where lower(coalesce(f ->> 'answer','')) not like '%not specified%'
                 ), '[]'::jsonb) as faqs_after
    from public.exams e
   where e.slug in ('bihar-board-inter','cat','ibps-clerk')
     and jsonb_typeof(e.faqs) = 'array'
     and exists (select 1 from jsonb_array_elements(e.faqs) as g
                  where lower(coalesce(g ->> 'answer','')) like '%not specified%')
),
removed as (
  select t.exam_id, t.slug, ord as position,
         f ->> 'question' as question, f ->> 'answer' as answer
    from targets t
    join jsonb_array_elements(t.faqs_before) with ordinality as x(f, ord) on true
   where lower(coalesce(f ->> 'answer','')) like '%not specified%'
),
bk as (
  insert into public.faq_placeholder_cleanup_backup
        (run_id, exam_id, slug, faqs_before, faqs_after, removed_count)
  select 'sprint0-part2-2026-09-28', exam_id, slug, faqs_before, faqs_after,
         jsonb_array_length(faqs_before) - jsonb_array_length(faqs_after)
    from targets
   returning 1
),
rk as (
  insert into public.faq_placeholder_cleanup_removed
        (run_id, exam_id, slug, position, question, answer)
  select 'sprint0-part2-2026-09-28', exam_id, slug, position, question, answer
    from removed
   returning 1
),
upd as (
  update public.exams e
     set faqs = t.faqs_after
    from targets t
   where e.id = t.exam_id
   returning e.slug
)
select count(*) as exams_updated,
       (select count(*) from bk) as backups_written,
       (select count(*) from rk) as entries_removed
  from upd;

-- Hard assertions. Raises on any mismatch; the migration transaction aborts.
do $$
declare
  v_run_id            text := 'sprint0-part2-2026-09-28';
  v_expected          jsonb := '{"bihar-board-inter":1,"cat":2,"ibps-clerk":1}'::jsonb;
  v_total_expected    int   := 4;
  v_removed           int;
  v_left              int;
  v_slug              text;
  v_cnt               int;
begin
  select count(*) into v_removed
    from public.faq_placeholder_cleanup_removed
   where run_id = v_run_id;

  select count(*) into v_left
    from public.exams e, jsonb_array_elements(e.faqs) f
   where jsonb_typeof(e.faqs) = 'array'
     and lower(coalesce(f ->> 'answer','')) like '%not specified%';

  if v_removed = 0 and v_left = 0 then
    raise notice 'FAQ cleanup: already applied (no phrase rows remain). OK to skip.';
    return;
  end if;

  if v_removed <> v_total_expected then
    raise exception 'FAQ cleanup aborted: expected % removed entries for run %, got %',
      v_total_expected, v_run_id, v_removed;
  end if;

  for v_slug, v_cnt in
    select slug, count(*) from public.faq_placeholder_cleanup_removed
     where run_id = v_run_id group by slug
  loop
    if v_expected ->> v_slug is null or v_cnt <> (v_expected ->> v_slug)::int then
      raise exception 'FAQ cleanup aborted: % expected % removals, got %',
        v_slug, coalesce(v_expected ->> v_slug, '0'), v_cnt;
    end if;
  end loop;

  -- Every expected exam must appear with its exact count (no silent misses).
  if (select count(*) from jsonb_object_keys(v_expected) as s(key)
       where not exists (
         select 1 from public.faq_placeholder_cleanup_removed r
          where r.run_id = v_run_id and r.slug = s.key)) <> 0 then
    raise exception 'FAQ cleanup aborted: an expected exam had no removals';
  end if;

  if v_left <> 0 then
    raise exception 'FAQ cleanup aborted: % answers still contain the phrase', v_left;
  end if;

  raise notice 'FAQ cleanup OK: 4 entries removed across 3 exams; 0 phrase rows left';
end $$;
