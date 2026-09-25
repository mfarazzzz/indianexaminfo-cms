
-- ── Step 1: Backup before touching any data ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public._backup_20260902_date_state AS
SELECT
  ee.id                  AS edition_id,
  e.id                   AS exam_id,
  e.slug,
  e.updated_at           AS exam_updated_at,
  ee.important_dates     AS important_dates_before
FROM exam_editions ee
JOIN exams e ON e.id = ee.exam_id
WHERE ee.is_current = true
  AND ee.important_dates IS NOT NULL
  AND jsonb_array_length(ee.important_dates) > 0;

-- ── Step 2: Add 'state' to every date row in important_dates ─────────────────
-- Rules:
--   Human-edited exams (updated_at >= 2026-08-01): state = 'confirmed'
--     These 38 exams had human attention; their dates are real.
--   Seed-only exams (updated_at < 2026-08-01): state = 'expected'
--     These 256 exams were never touched after bulk seeding in July.
--     'expected' means: date may be plausible but not officially verified.
--     They will not drive status transitions or strip eligibility.
--
-- Implementation: jsonb_agg over unnested rows, adding 'state' to each object,
-- then replace important_dates with the rebuilt array.

UPDATE exam_editions ee
SET important_dates = (
  SELECT jsonb_agg(
    row_obj || jsonb_build_object(
      'state',
      CASE
        WHEN e.updated_at >= '2026-08-01' THEN 'confirmed'
        ELSE 'expected'
      END
    )
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(ee.important_dates) WITH ORDINALITY AS t(row_obj, ordinality)
  JOIN exams e ON e.id = ee.exam_id
)
FROM exams e
WHERE e.id = ee.exam_id
  AND ee.is_current = true
  AND ee.important_dates IS NOT NULL
  AND jsonb_array_length(ee.important_dates) > 0;
;
