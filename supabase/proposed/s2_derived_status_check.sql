-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSED — READ-ONLY, NOT APPLIED (S2.2 verification item (a)).
-- Question the owner asked: with the D.El.Ed Phase-3 rows stored as
-- type 'counselling' (+ kinds), what does exam_derived_status return?
-- It must NOT be 'dates-awaited'.  (The exact counselling stage —
-- "Counselling – Phase 3 open" — is E1/S3 work; the current VIEW has no
-- counselling stage in its cascade. See the report.)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) LIVE RECORD: the current derived status of the UP D.El.Ed record.
--    Run as-is in the SQL editor (SELECT only).
-- select s.slug, s.derived_status, s.has_confirmed_dates, s.next_confirmed_date,
--        s.app_close_date, s.result_date
--   from exam_derived_status s
--   join exams e on e.id = s.exam_id
--  where e.slug = 'up-deled-entrance';   -- adjust if the slug differs

-- 2) SIMULATION: the Phase-3 row set exactly as S2.2 writes it (cumulative
--    edition timeline: the earlier registration/notification rows from the
--    Jun–Aug notices PLUS the four new Phase-3 counselling rows). Re-runs the
--    VIEW's own CASE cascade over synthetic rows — no tables touched.
with rows(d) as (
  select jsonb_array_elements($$[
    {"label":"Notification Release","date":"2026-06-09","type":"notification","kind":"notification","state":"confirmed"},
    {"label":"Registration Opens","date":"2026-06-15","type":"application_start","kind":"registration_start","state":"confirmed"},
    {"label":"Registration Closes","date":"2026-07-08","type":"application_end","kind":"registration_end","state":"confirmed"},
    {"label":"Registration Extended to 03.08.2026","date":"2026-08-03","type":"application_end","kind":"extension","state":"confirmed"},
    {"label":"State Rank Release","date":"2026-08-10","type":"merit_list","kind":"rank_release","state":"confirmed"},
    {"label":"Phase-3 चयन पूर्णकरण / Choice Filling","date":"2026-10-05","end_date":"2026-10-07","end_time":"18:00","time_text":"afternoon","type":"counselling","kind":"choice_filling","phase":"Phase-3","state":"confirmed"},
    {"label":"Seat Allotment","date":"2026-10-08","type":"counselling","kind":"allotment","phase":"Phase-3","state":"confirmed"},
    {"label":"Document Verification / Admission","date":"2026-10-09","end_date":"2026-10-14","end_time":"17:00","type":"counselling","kind":"document_verification","phase":"Phase-3","state":"confirmed"},
    {"label":"Institution Locking / FREEZE","date":"2026-10-15","type":"counselling","kind":"institute_lock","phase":"Phase-3","state":"confirmed"}
  ]$$::jsonb)
),
date_rows as (
  select
    (d->>'date')::date                              as date_val,
    coalesce(nullif(d->>'type',''), 'other')        as date_type,
    coalesce(nullif(d->>'state',''), 'confirmed')   as effective_state
  from rows
),
summary as (
  select
    min(date_val) filter (where effective_state='confirmed' and date_type='application_start') as app_open,
    max(date_val) filter (where effective_state='confirmed' and date_type='application_end')   as app_close,
    min(date_val) filter (where effective_state='confirmed' and date_type in ('result','merit_list')) as result_confirmed,
    min(date_val) filter (where effective_state='confirmed' and date_val >= (now() at time zone 'Asia/Kolkata')::date) as next_confirmed,
    bool_or(effective_state='confirmed')            as has_confirmed
  from date_rows
)
select
  case
    when result_confirmed is not null and result_confirmed <= (now() at time zone 'Asia/Kolkata')::date
      then 'result-declared'          -- ⚠ the merit_list rank row drives this — see note
    when app_close is not null and app_close < (now() at time zone 'Asia/Kolkata')::date
      then 'registration-closed'      -- the counselling rows never produce 'dates-awaited'
    when next_confirmed is not null and has_confirmed then 'upcoming'
    else 'dates-awaited'
  end as derived_status_like_the_view,
  app_open, app_close, result_confirmed, next_confirmed
from summary;

-- Expected result (as of 06 Oct 2026): the simulation answers
-- 'registration-closed' when the rank/merit row is EXCLUDED (the four Phase-3
-- rows + the application rows), and never 'dates-awaited' — any dated,
-- confirmed row makes has_confirmed_dates true, which is what the VIEW's
-- ELSE branch requires. Run 2) with the State Rank Release row removed to
-- see both outcomes.
