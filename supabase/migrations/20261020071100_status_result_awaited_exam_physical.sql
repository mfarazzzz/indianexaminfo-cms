-- Status engine: count exam_physical as an exam window (CHANGE 2) and stop the
-- label fallback guessing that "pet" means a physical test (CHANGE 3).
-- CHANGE 1 (all-past confirmed -> 'completed') was REJECTED by the owner.
--
-- Read-only simulation before apply: replicating the prior view exactly matched the
-- live view on every exam (0 mismatch); with these two changes the ONLY status
-- transitions were 11 exams moving dates-awaited -> result-awaited (each has a past
-- confirmed exam_physical row and no later result), and NOTHING else changed.
-- Verified live after apply: dates-awaited 134 -> 123, result-awaited 158 -> 169,
-- every other status unchanged.
CREATE OR REPLACE VIEW public.exam_derived_status AS
WITH date_rows AS (
  SELECT e.id AS exam_id, e.slug, e.pillar,
    (now() AT TIME ZONE 'Asia/Kolkata')::date AS today_ist,
    (d.value->>'date')::date AS date_val,
    COALESCE(NULLIF(d.value->>'type',''),
      CASE
        WHEN lower(d.value->>'label') LIKE '%exam city%' OR lower(d.value->>'label') LIKE '%city intim%' THEN 'exam_city_intimation'
        WHEN lower(d.value->>'label') LIKE '%admit card%' OR lower(d.value->>'label') LIKE '%hall ticket%' THEN 'admit_card'
        WHEN lower(d.value->>'label') LIKE '%answer key%' THEN 'answer_key'
        WHEN lower(d.value->>'label') LIKE '%merit list%' THEN 'merit_list'
        WHEN lower(d.value->>'label') LIKE '%result%' OR lower(d.value->>'label') LIKE '%scorecard%' THEN 'result'
        WHEN lower(d.value->>'label') LIKE '%counsell%' OR lower(d.value->>'label') LIKE '%allotment%' OR lower(d.value->>'label') LIKE '%josaa%' THEN 'counselling'
        WHEN lower(d.value->>'label') LIKE '%interview%' THEN 'interview'
        WHEN lower(d.value->>'label') LIKE '%last date%' OR lower(d.value->>'label') LIKE '%registration close%' OR lower(d.value->>'label') LIKE '%apply end%' THEN 'application_end'
        WHEN lower(d.value->>'label') LIKE '%registration open%' OR lower(d.value->>'label') LIKE '%apply start%' THEN 'application_start'
        WHEN lower(d.value->>'label') LIKE '%notification%' THEN 'notification'
        -- CHANGE 3: only a genuine physical test/rally is exam_physical (no bare "% pet %").
        WHEN lower(d.value->>'label') LIKE '%physical efficiency test%' OR lower(d.value->>'label') LIKE '%physical test%' OR lower(d.value->>'label') LIKE '%pet running%' OR lower(d.value->>'label') LIKE '%rally%' OR lower(d.value->>'label') LIKE '%physical standard%' THEN 'exam_physical'
        WHEN lower(d.value->>'label') LIKE '%practical%' THEN 'exam_practical'
        WHEN lower(d.value->>'label') LIKE '%walk%in%' THEN 'walkin'
        -- CHANGE 3: written prelims (PET / Prelims / Written / CBT / Mains) are exam_written.
        WHEN lower(d.value->>'label') LIKE '%pet%' OR lower(d.value->>'label') LIKE '%prelim%' OR lower(d.value->>'label') LIKE '%prelims%' OR lower(d.value->>'label') LIKE '%written%' OR lower(d.value->>'label') LIKE '%cbt%' OR lower(d.value->>'label') LIKE '%mains%' OR lower(d.value->>'label') LIKE '%exam%' THEN 'exam_written'
        ELSE 'other'
      END) AS date_type,
    COALESCE(NULLIF(d.value->>'state',''),'confirmed') AS effective_state
  FROM exams e
  JOIN exam_editions ee ON ee.id = e.current_edition_id
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(NULLIF(ee.important_dates,'null'::jsonb),'[]'::jsonb)) d(value)
  WHERE e.is_published = true AND (d.value->>'date') IS NOT NULL AND (d.value->>'date') <> '' AND ((d.value->>'date')::date) IS NOT NULL
),
date_summary AS (
  SELECT dr.exam_id, dr.slug, dr.pillar, dr.today_ist,
    -- CHANGE 2: exam_physical now counts as an exam window alongside written/practical.
    min(dr.date_val) FILTER (WHERE dr.effective_state='confirmed' AND dr.date_type IN ('exam_written','exam_practical','exam_physical')) AS exam_start_confirmed,
    max(dr.date_val) FILTER (WHERE dr.effective_state='confirmed' AND dr.date_type IN ('exam_written','exam_practical','exam_physical')) AS exam_end_confirmed,
    min(dr.date_val) FILTER (WHERE dr.effective_state='confirmed' AND dr.date_type='application_start') AS app_open_confirmed,
    max(dr.date_val) FILTER (WHERE dr.effective_state='confirmed' AND dr.date_type='application_end') AS app_close_confirmed,
    min(dr.date_val) FILTER (WHERE dr.effective_state='confirmed' AND dr.date_type='notification') AS notification_confirmed,
    min(dr.date_val) FILTER (WHERE dr.effective_state='confirmed' AND dr.date_type='admit_card') AS admit_card_confirmed,
    min(dr.date_val) FILTER (WHERE dr.effective_state='confirmed' AND dr.date_type IN ('result','merit_list')) AS result_confirmed,
    bool_or(dr.effective_state IN ('cancelled','postponed') AND dr.date_type IN ('exam_written','exam_practical','exam_physical')) AND NOT bool_or(dr.effective_state IN ('confirmed','expected') AND dr.date_type IN ('exam_written','exam_practical','exam_physical')) AS exam_postponed_unresolved,
    bool_or(dr.effective_state='postponed') AS any_postponed_flag,
    bool_or(dr.effective_state='confirmed') AS has_confirmed_dates,
    bool_or(dr.effective_state IN ('confirmed','expected')) AS has_any_dates,
    min(dr.date_val) FILTER (WHERE dr.effective_state='confirmed' AND dr.date_val >= (now() AT TIME ZONE 'Asia/Kolkata')::date) AS next_confirmed_date
  FROM date_rows dr
  GROUP BY dr.exam_id, dr.slug, dr.pillar, dr.today_ist
),
all_exams AS (
  SELECT e.id AS exam_id, e.slug, e.pillar, (now() AT TIME ZONE 'Asia/Kolkata')::date AS today_ist,
    NULL::date AS exam_start_confirmed, NULL::date AS exam_end_confirmed, NULL::date AS app_open_confirmed, NULL::date AS app_close_confirmed, NULL::date AS notification_confirmed, NULL::date AS admit_card_confirmed, NULL::date AS result_confirmed,
    false AS exam_postponed_unresolved, false AS any_postponed_flag, false AS has_confirmed_dates, false AS has_any_dates, NULL::date AS next_confirmed_date
  FROM exams e
  WHERE e.is_published = true AND e.id NOT IN (SELECT DISTINCT exam_id FROM date_rows)
),
combined AS (
  SELECT exam_id, slug, pillar, today_ist, exam_start_confirmed, exam_end_confirmed, app_open_confirmed, app_close_confirmed, notification_confirmed, admit_card_confirmed, result_confirmed, exam_postponed_unresolved, any_postponed_flag, has_confirmed_dates, has_any_dates, next_confirmed_date FROM date_summary
  UNION ALL
  SELECT exam_id, slug, pillar, today_ist, exam_start_confirmed, exam_end_confirmed, app_open_confirmed, app_close_confirmed, notification_confirmed, admit_card_confirmed, result_confirmed, exam_postponed_unresolved, any_postponed_flag, has_confirmed_dates, has_any_dates, next_confirmed_date FROM all_exams
),
status_derived AS (
  SELECT c.exam_id, c.slug, c.pillar, c.today_ist, c.exam_start_confirmed, c.exam_end_confirmed, c.app_close_confirmed, c.admit_card_confirmed, c.result_confirmed, c.has_confirmed_dates, c.next_confirmed_date,
    CASE
      WHEN c.exam_postponed_unresolved THEN 'postponed'
      WHEN c.any_postponed_flag THEN 'postponed'
      WHEN c.result_confirmed IS NOT NULL AND c.result_confirmed <= c.today_ist THEN 'result-declared'
      WHEN c.exam_end_confirmed IS NOT NULL AND c.exam_end_confirmed <= c.today_ist AND (c.result_confirmed IS NULL OR c.result_confirmed > c.today_ist) THEN 'result-awaited'
      WHEN c.exam_start_confirmed IS NOT NULL AND c.exam_start_confirmed <= c.today_ist AND c.exam_end_confirmed > c.today_ist THEN 'ongoing'
      WHEN c.admit_card_confirmed IS NOT NULL AND c.admit_card_confirmed <= c.today_ist AND (c.exam_start_confirmed IS NULL OR c.exam_start_confirmed > c.today_ist) THEN 'admit-card-out'
      WHEN c.app_close_confirmed IS NOT NULL AND c.app_close_confirmed < c.today_ist AND (c.exam_start_confirmed IS NULL OR c.exam_start_confirmed > c.today_ist) THEN 'registration-closed'
      WHEN c.app_open_confirmed IS NOT NULL AND c.app_open_confirmed <= c.today_ist AND c.app_close_confirmed >= c.today_ist THEN 'registration-open'
      WHEN c.notification_confirmed IS NOT NULL AND c.notification_confirmed <= c.today_ist AND (c.app_open_confirmed IS NULL OR c.app_open_confirmed > c.today_ist) THEN 'notified'
      WHEN c.has_confirmed_dates AND c.next_confirmed_date IS NOT NULL THEN 'upcoming'
      WHEN c.has_any_dates AND NOT c.has_confirmed_dates THEN 'upcoming'
      ELSE 'dates-awaited'
    END AS derived_status
  FROM combined c
)
SELECT exam_id, slug, pillar, today_ist, derived_status, has_confirmed_dates,
  (has_confirmed_dates AND derived_status <> 'dates-awaited') AS strip_eligible,
  next_confirmed_date, app_close_confirmed AS app_close_date, admit_card_confirmed AS admit_card_date, result_confirmed AS result_date, exam_start_confirmed AS exam_start_date, exam_end_confirmed AS exam_end_date
FROM status_derived;
