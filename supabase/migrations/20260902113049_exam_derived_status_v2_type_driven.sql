
CREATE VIEW exam_derived_status AS

WITH
date_rows AS (
  SELECT
    e.id                                              AS exam_id,
    e.slug,
    e.pillar,
    (NOW() AT TIME ZONE 'Asia/Kolkata')::date         AS today_ist,
    (d->>'date')::date                                AS date_val,
    COALESCE(
      NULLIF(d->>'type', ''),
      CASE
        WHEN lower(d->>'label') LIKE '%exam city%'
          OR lower(d->>'label') LIKE '%city intim%'   THEN 'exam_city_intimation'
        WHEN lower(d->>'label') LIKE '%admit card%'
          OR lower(d->>'label') LIKE '%hall ticket%'  THEN 'admit_card'
        WHEN lower(d->>'label') LIKE '%answer key%'   THEN 'answer_key'
        WHEN lower(d->>'label') LIKE '%merit list%'   THEN 'merit_list'
        WHEN lower(d->>'label') LIKE '%result%'
          OR lower(d->>'label') LIKE '%scorecard%'    THEN 'result'
        WHEN lower(d->>'label') LIKE '%counsell%'
          OR lower(d->>'label') LIKE '%allotment%'
          OR lower(d->>'label') LIKE '%josaa%'        THEN 'counselling'
        WHEN lower(d->>'label') LIKE '%interview%'    THEN 'interview'
        WHEN lower(d->>'label') LIKE '%last date%'
          OR lower(d->>'label') LIKE '%registration close%'
          OR lower(d->>'label') LIKE '%apply end%'    THEN 'application_end'
        WHEN lower(d->>'label') LIKE '%registration open%'
          OR lower(d->>'label') LIKE '%apply start%'  THEN 'application_start'
        WHEN lower(d->>'label') LIKE '%notification%' THEN 'notification'
        WHEN lower(d->>'label') LIKE '%rally%'
          OR lower(d->>'label') LIKE '%physical test%'
          OR lower(d->>'label') LIKE '% pet %'        THEN 'exam_physical'
        WHEN lower(d->>'label') LIKE '%practical%'    THEN 'exam_practical'
        WHEN lower(d->>'label') LIKE '%walk%in%'      THEN 'walkin'
        WHEN lower(d->>'label') LIKE '%exam%'
          OR lower(d->>'label') LIKE '%prelims%'
          OR lower(d->>'label') LIKE '%mains%'
          OR lower(d->>'label') LIKE '%written%'      THEN 'exam_written'
        ELSE 'other'
      END
    )                                                 AS date_type,
    COALESCE(NULLIF(d->>'state', ''), 'confirmed')   AS effective_state
  FROM exams e
  JOIN exam_editions ee ON ee.id = e.current_edition_id
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(NULLIF(ee.important_dates, 'null'::jsonb), '[]'::jsonb)
  ) AS d
  WHERE e.is_published = true
    AND (d->>'date') IS NOT NULL
    AND (d->>'date') <> ''
    AND (d->>'date')::date IS NOT NULL
),

date_summary AS (
  SELECT
    exam_id, slug, pillar, today_ist,
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND date_type IN ('exam_written','exam_practical')
    )                                                 AS exam_start_confirmed,
    MAX(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND date_type IN ('exam_written','exam_practical')
    )                                                 AS exam_end_confirmed,
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed' AND date_type = 'application_start'
    )                                                 AS app_open_confirmed,
    MAX(date_val) FILTER (
      WHERE effective_state = 'confirmed' AND date_type = 'application_end'
    )                                                 AS app_close_confirmed,
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed' AND date_type = 'notification'
    )                                                 AS notification_confirmed,
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed' AND date_type = 'admit_card'
    )                                                 AS admit_card_confirmed,
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND date_type IN ('result','merit_list')
    )                                                 AS result_confirmed,
    bool_or(effective_state = 'cancelled')            AS any_cancelled,
    -- Cancelled with no confirmed future exam replacement (the key distinction)
    bool_or(
      effective_state = 'cancelled'
      AND date_type IN ('exam_written','exam_practical','exam_physical')
    )                                                 AS has_cancelled_exam,
    bool_or(
      effective_state = 'confirmed'
      AND date_type IN ('exam_written','exam_practical','exam_physical')
      AND date_val > (SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
    )                                                 AS has_confirmed_future_exam,
    bool_or(effective_state = 'postponed')            AS any_postponed,
    bool_or(effective_state = 'confirmed')            AS has_confirmed_dates,
    bool_or(effective_state IN ('confirmed','expected')) AS has_any_dates,
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND date_val >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
    )                                                 AS next_confirmed_date
  FROM date_rows
  GROUP BY exam_id, slug, pillar, today_ist
),

all_exams AS (
  SELECT
    e.id AS exam_id, e.slug, e.pillar,
    (NOW() AT TIME ZONE 'Asia/Kolkata')::date AS today_ist,
    NULL::date AS exam_start_confirmed, NULL::date AS exam_end_confirmed,
    NULL::date AS app_open_confirmed,   NULL::date AS app_close_confirmed,
    NULL::date AS notification_confirmed, NULL::date AS admit_card_confirmed,
    NULL::date AS result_confirmed,
    false AS any_cancelled,      false AS has_cancelled_exam,
    false AS has_confirmed_future_exam, false AS any_postponed,
    false AS has_confirmed_dates, false AS has_any_dates,
    NULL::date AS next_confirmed_date
  FROM exams e
  WHERE e.is_published = true
    AND e.id NOT IN (SELECT DISTINCT exam_id FROM date_rows)
),

combined AS (SELECT * FROM date_summary UNION ALL SELECT * FROM all_exams),

status_derived AS (
  SELECT *,
    CASE
      WHEN any_cancelled AND has_cancelled_exam
        AND NOT has_confirmed_future_exam               THEN 'cancelled'
      WHEN any_postponed                                THEN 'postponed'
      WHEN result_confirmed IS NOT NULL
        AND result_confirmed <= today_ist               THEN 'result-declared'
      WHEN exam_end_confirmed IS NOT NULL
        AND exam_end_confirmed <= today_ist
        AND (result_confirmed IS NULL
             OR result_confirmed > today_ist)           THEN 'result-awaited'
      WHEN exam_start_confirmed IS NOT NULL
        AND exam_start_confirmed <= today_ist
        AND exam_end_confirmed > today_ist              THEN 'ongoing'
      WHEN admit_card_confirmed IS NOT NULL
        AND admit_card_confirmed <= today_ist
        AND (exam_start_confirmed IS NULL
             OR exam_start_confirmed > today_ist)       THEN 'admit-card-out'
      WHEN app_close_confirmed IS NOT NULL
        AND app_close_confirmed < today_ist
        AND (exam_start_confirmed IS NULL
             OR exam_start_confirmed > today_ist)       THEN 'registration-closed'
      WHEN app_open_confirmed IS NOT NULL
        AND app_open_confirmed <= today_ist
        AND app_close_confirmed >= today_ist            THEN 'registration-open'
      WHEN notification_confirmed IS NOT NULL
        AND notification_confirmed <= today_ist
        AND (app_open_confirmed IS NULL
             OR app_open_confirmed > today_ist)         THEN 'notified'
      WHEN has_confirmed_dates
        AND next_confirmed_date IS NOT NULL             THEN 'upcoming'
      WHEN has_any_dates AND NOT has_confirmed_dates    THEN 'upcoming'
      ELSE                                              'dates-awaited'
    END                                                 AS derived_status
  FROM combined
)

SELECT
  exam_id,
  slug,
  pillar,
  today_ist,
  derived_status,
  has_confirmed_dates,
  (has_confirmed_dates AND derived_status <> 'dates-awaited') AS strip_eligible,
  next_confirmed_date,
  -- Band columns — each strip band queries its own column
  app_close_confirmed    AS app_close_date,
  admit_card_confirmed   AS admit_card_date,
  result_confirmed       AS result_date,
  exam_start_confirmed   AS exam_start_date,
  exam_end_confirmed     AS exam_end_date
FROM status_derived;

GRANT SELECT ON exam_derived_status TO anon, authenticated;
;
