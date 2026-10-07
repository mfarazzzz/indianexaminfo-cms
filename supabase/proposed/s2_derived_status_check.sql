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
    {"label":"State Rank Release","date":"2026-08-10","type":"other","kind":"rank_release","state":"confirmed"},
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

-- Expected result (as of 06 Oct 2026, AFTER the S2.2a gate): 'registration-
-- closed' — the rank row is stored type "other" (kind rank_release) for this
-- merit-based record, so result_confirmed stays NULL and the VIEW never reads
-- "result-declared". Run 2) once with the rank row's type changed back to
-- "merit_list" to see the pre-gate false 'result-declared' this fix prevents.
-- Never 'dates-awaited' either way: any confirmed dated row sets
-- has_confirmed_dates, which is what the VIEW's ELSE branch requires.

-- ══════════════════════════════════════════════════════════════════════════════
-- 3) S2.9a SIMULATION — the ordinary RECRUITMENT application window
--    (SYNTHETIC sample: "Online application: 01.11.2026 to 30.11.2026 (up to
--    11:59 PM)"). The window is stored as TWO rows — application_start +
--    application_end — exactly as the pipeline keeps it (S2.9a never merges a
--    status-read type). Re-running the VIEW's own cascade over these rows at two
--    "today" values must give registration-open BEFORE 30 Nov and
--    registration-closed AFTER it. READ-ONLY; no tables touched.
-- ── TWO-ROW form (correct) ────────────────────────────────────────────────────
with rows(d) as (
  select jsonb_array_elements($$[
    {"label":"Online application opens","date":"2026-11-01","type":"application_start","kind":"registration_start","state":"confirmed"},
    {"label":"Online application closes","date":"2026-11-30","end_time":"23:59","type":"application_end","kind":"registration_end","state":"confirmed"}
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
    max(date_val) filter (where effective_state='confirmed' and date_type='application_end')   as app_close
  from date_rows
),
days(today_ist) as (
  values ('2026-11-15'::date), ('2026-12-05'::date)
)
select
  d.today_ist,
  s.app_open,
  s.app_close,
  case
    when s.app_close is not null and s.app_close <  d.today_ist then 'registration-closed'
    when s.app_open is not null and s.app_open <= d.today_ist
         and s.app_close >= d.today_ist                        then 'registration-open'
    else 'other-branch'
  end as derived_status_like_the_view
from days d cross join summary s
order by d.today_ist;
-- Expect: 2026-11-15 → registration-open; 2026-12-05 → registration-closed.

-- ── SINGLE-ROW collapsed form (the S2.9 regression S2.9a prevents) ───────────
-- Same window, but merged into one application_start row carrying an end_date.
-- The VIEW reads ONLY d->>'date' and needs a separate application_end ROW for
-- app_close, so app_close is NULL: the record is 'other-branch' (never
-- registration-open, never registration-closed) at BOTH dates. This is exactly
-- why registration must stay two rows.
with rows(d) as (
  select jsonb_array_elements($$[
    {"label":"Online application","date":"2026-11-01","end_date":"2026-11-30","end_time":"23:59","type":"application_start","kind":"registration_start","state":"confirmed"}
  ]$$::jsonb)
),
date_rows as (
  select (d->>'date')::date                           as date_val,
         coalesce(nullif(d->>'type',''),'other')      as date_type,
         coalesce(nullif(d->>'state',''),'confirmed') as effective_state
  from rows
),
summary as (
  select
    min(date_val) filter (where effective_state='confirmed' and date_type='application_start') as app_open,
    max(date_val) filter (where effective_state='confirmed' and date_type='application_end')   as app_close
  from date_rows
),
days(today_ist) as ( values ('2026-11-15'::date), ('2026-12-05'::date) )
select
  d.today_ist, s.app_open, s.app_close,
  case
    when s.app_close is not null and s.app_close <  d.today_ist then 'registration-closed'
    when s.app_open is not null and s.app_open <= d.today_ist
         and s.app_close >= d.today_ist                        then 'registration-open'
    else 'other-branch'   -- app_close NULL: the collapsed row never closes
  end as derived_status_like_the_view
from days d cross join summary s
order by d.today_ist;
-- Expect: 'other-branch' at BOTH dates — app_close is NULL — proving the
-- collapse is the regression and the two-row shape is required.
