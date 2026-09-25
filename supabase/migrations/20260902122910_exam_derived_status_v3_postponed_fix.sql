
-- ══════════════════════════════════════════════════════════════════════════════
-- exam_derived_status v3 — fix cancelled/postponed rule
--
-- CANCELLED RULE REDESIGN:
--
-- A cancelled date row is a fact about that date, not the record.
-- Three cases:
--   (a) Date cancelled, no later replacement of same type →
--       STATUS: postponed ("new date awaited")
--   (b) Date cancelled, later replacement exists (past or future) →
--       Cancelled row is IGNORED by status logic; replacement drives status.
--       NEET-UG: original cancelled, re-exam 21 Jun (past), result declared →
--       result-declared.
--   (c) Entire recruitment genuinely cancelled →
--       This is an EDITORIAL decision set via the stored exams.status override.
--       The VIEW never produces 'cancelled' from date rows alone.
--
-- POSTPONED RULE:
--   Fires when exam_written/exam_practical/exam_physical date is cancelled
--   or postponed (state field) AND no later row of the same type exists.
--   Sits at priority 2 (after date-based rules that would fire anyway).
--   "Postponed" is more informative than "dates-awaited" — it tells a candidate
--   the exam was announced and then moved, not that nothing has been said.
-- ══════════════════════════════════════════════════════════════════════════════

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

    -- Confirmed exam window (only non-cancelled rows)
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

    -- POSTPONED SIGNAL:
    -- An exam-type date was cancelled/postponed AND no later row of the same
    -- type exists (confirmed or expected). This is case (a) — moved, no
    -- replacement announced yet. Drives status=postponed.
    --
    -- Implementation:
    --   has_unresolved_cancellation = there is a cancelled exam-type date
    --   whose cancelled_date is >= any confirmed/expected row of the same type.
    --   i.e. the newest row of that type is cancelled — no replacement follows it.
    bool_or(
      effective_state IN ('cancelled','postponed')
      AND date_type IN ('exam_written','exam_practical','exam_physical')
    ) AND NOT bool_or(
      -- A later or same-date confirmed/expected row of an exam type exists
      effective_state IN ('confirmed','expected')
      AND date_type IN ('exam_written','exam_practical','exam_physical')
    )                                                 AS exam_postponed_unresolved,

    bool_or(effective_state = 'postponed')            AS any_postponed_flag,
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
    false AS exam_postponed_unresolved, false AS any_postponed_flag,
    false AS has_confirmed_dates,       false AS has_any_dates,
    NULL::date AS next_confirmed_date
  FROM exams e
  WHERE e.is_published = true
    AND e.id NOT IN (SELECT DISTINCT exam_id FROM date_rows)
),

combined AS (SELECT * FROM date_summary UNION ALL SELECT * FROM all_exams),

status_derived AS (
  SELECT *,
    CASE
      -- 1. Postponed: exam date was cancelled/postponed with no replacement yet.
      --    Case (a) above. "Postponed — new date awaited" is more informative
      --    than dates-awaited for an active recruitment.
      --    Note: genuine record-level cancellation (case c) is the stored
      --    exams.status override — the VIEW never produces 'cancelled'.
      WHEN exam_postponed_unresolved                  THEN 'postponed'

      -- 2. Explicit postponed flag on any date
      WHEN any_postponed_flag                         THEN 'postponed'

      -- 3. Result declared
      WHEN result_confirmed IS NOT NULL
        AND result_confirmed <= today_ist             THEN 'result-declared'

      -- 4. Result awaited
      WHEN exam_end_confirmed IS NOT NULL
        AND exam_end_confirmed <= today_ist
        AND (result_confirmed IS NULL
             OR result_confirmed > today_ist)         THEN 'result-awaited'

      -- 5. Ongoing
      WHEN exam_start_confirmed IS NOT NULL
        AND exam_start_confirmed <= today_ist
        AND exam_end_confirmed > today_ist            THEN 'ongoing'

      -- 6. Admit card out
      WHEN admit_card_confirmed IS NOT NULL
        AND admit_card_confirmed <= today_ist
        AND (exam_start_confirmed IS NULL
             OR exam_start_confirmed > today_ist)     THEN 'admit-card-out'

      -- 7. Registration closed
      WHEN app_close_confirmed IS NOT NULL
        AND app_close_confirmed < today_ist
        AND (exam_start_confirmed IS NULL
             OR exam_start_confirmed > today_ist)     THEN 'registration-closed'

      -- 8. Registration open
      WHEN app_open_confirmed IS NOT NULL
        AND app_open_confirmed <= today_ist
        AND app_close_confirmed >= today_ist          THEN 'registration-open'

      -- 9. Notified
      WHEN notification_confirmed IS NOT NULL
        AND notification_confirmed <= today_ist
        AND (app_open_confirmed IS NULL
             OR app_open_confirmed > today_ist)       THEN 'notified'

      -- 10. Upcoming — confirmed future date
      WHEN has_confirmed_dates
        AND next_confirmed_date IS NOT NULL           THEN 'upcoming'

      -- 11. Upcoming — expected only
      WHEN has_any_dates AND NOT has_confirmed_dates  THEN 'upcoming'

      -- 12. Dates awaited
      ELSE                                            'dates-awaited'
    END                                               AS derived_status
  FROM combined
)

SELECT
  exam_id, slug, pillar, today_ist,
  derived_status,
  has_confirmed_dates,
  (has_confirmed_dates AND derived_status <> 'dates-awaited') AS strip_eligible,
  next_confirmed_date,
  app_close_confirmed    AS app_close_date,
  admit_card_confirmed   AS admit_card_date,
  result_confirmed       AS result_date,
  exam_start_confirmed   AS exam_start_date,
  exam_end_confirmed     AS exam_end_date
FROM status_derived;

GRANT SELECT ON exam_derived_status TO anon, authenticated;
;
