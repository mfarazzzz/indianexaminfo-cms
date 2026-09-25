
-- ── exam_derived_status VIEW ──────────────────────────────────────────────────
--
-- Derives a meaningful status from actual date data rather than a stored string.
--
-- CONTRACT (read by homepage strip, attention feed, status badges):
--   derived_status   : the computed status string (see rules below)
--   has_confirmed_dates : true when at least one date has effective_state='confirmed'
--   strip_eligible   : true when the record may appear in the homepage deadline strip
--                      (has_confirmed_dates AND status is not 'dates-awaited')
--                      An 'upcoming' backed only by 'expected' dates has
--                      strip_eligible=false and MUST NOT appear in "closing soon".
--
-- TIMEZONE: all date comparisons use Asia/Kolkata.
--   (NOW() AT TIME ZONE 'Asia/Kolkata')::date — never naked CURRENT_DATE.
--   The DB is UTC; CURRENT_DATE flips at 00:00 UTC = 05:30 IST, which would
--   produce wrong status for Indian users during the early morning window.
--
-- MULTI-DATE HANDLING (e.g. GDS with two "Exam Date" rows):
--   exam_start = MIN of all exam-date-labelled rows  (has exam begun?)
--   exam_end   = MAX of all exam-date-labelled rows  (has exam finished?)
--   app_close  = MAX of all application-close rows   (is registration over?)
--   This means an exam is 'ongoing' from the first shift until after the last.
--
-- DATE STATE (forward-compatible):
--   Today's schema has no 'state' column; every row is treated as 'confirmed'.
--   When 'state' is added, replace the COALESCE(d->>'state','confirmed') expression
--   — the rest of the VIEW is unchanged.
--   Only 'confirmed' dates drive status transitions and strip eligibility.
--   'expected' dates appear in the detail table as "DD Mon YYYY (expected)"
--   but never drive status and never set strip_eligible=true.
--
-- STATUS RULES (first match wins, evaluated in priority order):
--   cancelled      ANY key date explicitly cancelled
--   postponed      ANY key date explicitly postponed
--   result-declared result date confirmed AND passed
--   result-awaited  exam done, result not yet out
--   ongoing         exam started (first shift passed), last shift not yet done
--   admit-card-out  admit card released, exam not yet started
--   registration-closed  app window confirmed closed, exam future
--   registration-open    app window currently open (confirmed)
--   notified        notification out, registration not open yet
--   upcoming        at least one confirmed future date
--   upcoming        no confirmed dates but at least one expected date
--   dates-awaited   no confirmed or expected dates at all

CREATE OR REPLACE VIEW exam_derived_status AS

WITH
-- Step 1: unpack important_dates for current editions only
date_rows AS (
  SELECT
    e.id                                              AS exam_id,
    e.slug,
    e.pillar,
    (NOW() AT TIME ZONE 'Asia/Kolkata')::date         AS today_ist,
    (d->>'date')::date                                AS date_val,
    lower(trim(d->>'label'))                          AS label,
    -- Forward-compatible: treat missing 'state' as 'confirmed'
    COALESCE(d->>'state', 'confirmed')                AS effective_state,
    d->>'label'                                       AS raw_label
  FROM exams e
  JOIN exam_editions ee ON ee.id = e.current_edition_id
  -- unnest; rows with null/empty date are excluded
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(NULLIF(ee.important_dates, 'null'::jsonb), '[]'::jsonb)
  ) AS d
  WHERE e.is_published = true
    AND (d->>'date') IS NOT NULL
    AND (d->>'date') <> ''
    AND (d->>'date')::date IS NOT NULL
),

-- Step 2: aggregate key date windows per exam
-- Using label-keyword matching since current data has no standard 'type' column.
-- When the 'type' column lands, replace the LIKE conditions with:
--   WHERE type = 'exam_date' etc.
date_summary AS (
  SELECT
    exam_id,
    slug,
    pillar,
    today_ist,

    -- Exam window: MIN=first shift started, MAX=last shift done
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND (label LIKE '%exam date%' OR label LIKE '%exam dates%'
          OR label LIKE '%exam window%' OR label LIKE '%written exam%')
    )                                                 AS exam_start_confirmed,
    MAX(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND (label LIKE '%exam date%' OR label LIKE '%exam dates%'
          OR label LIKE '%exam window%' OR label LIKE '%written exam%')
    )                                                 AS exam_end_confirmed,

    -- Application window
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND (label LIKE '%registration open%' OR label LIKE '%application start%'
          OR label LIKE '%apply from%' OR label LIKE '%application begin%'
          OR label LIKE '%registration begin%')
    )                                                 AS app_open_confirmed,
    MAX(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND (label LIKE '%registration close%' OR label LIKE '%last date%'
          OR label LIKE '%application end%' OR label LIKE '%apply before%'
          OR label LIKE '%closing date%')
    )                                                 AS app_close_confirmed,

    -- Notification
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND (label LIKE '%notification%' OR label LIKE '%advertisement%')
    )                                                 AS notification_confirmed,

    -- Admit card
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND (label LIKE '%admit card%' OR label LIKE '%hall ticket%')
    )                                                 AS admit_card_confirmed,

    -- Result
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND (label LIKE '%result%' OR label LIKE '%merit list%'
          OR label LIKE '%scorecard%')
    )                                                 AS result_confirmed,

    -- Cancelled / postponed signals (any key date)
    bool_or(effective_state = 'cancelled')            AS any_cancelled,
    bool_or(effective_state = 'postponed')            AS any_postponed,

    -- Confirmed presence flags (for strip eligibility)
    bool_or(effective_state = 'confirmed')            AS has_confirmed_dates,
    bool_or(effective_state IN ('confirmed','expected')) AS has_any_dates,

    -- Nearest upcoming confirmed date (for strip ordering)
    MIN(date_val) FILTER (
      WHERE effective_state = 'confirmed'
        AND date_val >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
    )                                                 AS next_confirmed_date

  FROM date_rows
  GROUP BY exam_id, slug, pillar, today_ist
),

-- Step 3: also handle exams with NO date rows (blank important_dates)
all_exams AS (
  SELECT
    e.id                                              AS exam_id,
    e.slug,
    e.pillar,
    (NOW() AT TIME ZONE 'Asia/Kolkata')::date         AS today_ist,
    NULL::date    AS exam_start_confirmed,
    NULL::date    AS exam_end_confirmed,
    NULL::date    AS app_open_confirmed,
    NULL::date    AS app_close_confirmed,
    NULL::date    AS notification_confirmed,
    NULL::date    AS admit_card_confirmed,
    NULL::date    AS result_confirmed,
    false         AS any_cancelled,
    false         AS any_postponed,
    false         AS has_confirmed_dates,
    false         AS has_any_dates,
    NULL::date    AS next_confirmed_date
  FROM exams e
  WHERE e.is_published = true
    AND e.id NOT IN (SELECT DISTINCT exam_id FROM date_rows)
),

combined AS (
  SELECT * FROM date_summary
  UNION ALL
  SELECT * FROM all_exams
),

-- Step 4: apply status rules in priority order
status_derived AS (
  SELECT
    exam_id,
    slug,
    pillar,
    today_ist,
    has_confirmed_dates,
    has_any_dates,
    next_confirmed_date,
    exam_start_confirmed,
    exam_end_confirmed,
    app_open_confirmed,
    app_close_confirmed,
    result_confirmed,
    CASE
      -- 1. Cancelled (explicit state)
      WHEN any_cancelled                                          THEN 'cancelled'
      -- 2. Postponed (explicit state)
      WHEN any_postponed                                          THEN 'postponed'
      -- 3. Result declared
      WHEN result_confirmed    IS NOT NULL
        AND result_confirmed   <= today_ist                       THEN 'result-declared'
      -- 4. Result awaited (exam done, result not out yet)
      WHEN exam_end_confirmed  IS NOT NULL
        AND exam_end_confirmed <= today_ist
        AND (result_confirmed IS NULL OR result_confirmed > today_ist)
                                                                  THEN 'result-awaited'
      -- 5. Ongoing (first shift started, last shift not done)
      WHEN exam_start_confirmed IS NOT NULL
        AND exam_start_confirmed <= today_ist
        AND exam_end_confirmed   > today_ist                      THEN 'ongoing'
      -- 6. Admit card out
      WHEN admit_card_confirmed IS NOT NULL
        AND admit_card_confirmed <= today_ist
        AND (exam_start_confirmed IS NULL OR exam_start_confirmed > today_ist)
                                                                  THEN 'admit-card-out'
      -- 7. Registration closed (app window ended, exam future)
      WHEN app_close_confirmed IS NOT NULL
        AND app_close_confirmed < today_ist
        AND (exam_start_confirmed IS NULL OR exam_start_confirmed > today_ist)
                                                                  THEN 'registration-closed'
      -- 8. Registration open
      WHEN app_open_confirmed  IS NOT NULL
        AND app_open_confirmed  <= today_ist
        AND app_close_confirmed >= today_ist                      THEN 'registration-open'
      -- 9. Notified (notification out, registration not open yet)
      WHEN notification_confirmed IS NOT NULL
        AND notification_confirmed <= today_ist
        AND (app_open_confirmed IS NULL OR app_open_confirmed > today_ist)
                                                                  THEN 'notified'
      -- 10. Upcoming — at least one confirmed future date
      WHEN has_confirmed_dates
        AND next_confirmed_date IS NOT NULL                       THEN 'upcoming'
      -- 11. Upcoming — only expected dates, no confirmed
      WHEN has_any_dates
        AND NOT has_confirmed_dates                               THEN 'upcoming'
      -- 12. Dates awaited — nothing at all
      ELSE                                                         'dates-awaited'
    END                                                           AS derived_status

  FROM combined
)

-- Final output
SELECT
  exam_id,
  slug,
  pillar,
  today_ist,
  derived_status,
  has_confirmed_dates,
  -- strip_eligible: the ONE column the homepage strip must filter on.
  -- Rules 10+11 both produce 'upcoming', but only rule 10 is strip-eligible.
  -- An 'upcoming' backed by expected dates only has has_confirmed_dates=false
  -- and therefore strip_eligible=false. This is the enforcement point.
  (has_confirmed_dates AND derived_status <> 'dates-awaited')    AS strip_eligible,
  next_confirmed_date,
  -- Nearest confirmed application close (for "closing soon" strip ordering)
  app_close_confirmed                                             AS app_close_date,
  exam_start_confirmed                                            AS exam_start_date,
  result_confirmed                                                AS result_date
FROM status_derived;
;
