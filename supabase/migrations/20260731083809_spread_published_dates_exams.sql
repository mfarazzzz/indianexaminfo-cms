
-- Spread exams published_at from July 10 to July 31 (max ~20 per day)
-- Assign random dates with random times between 8:00-22:59
WITH numbered AS (
  SELECT id, 
    ROW_NUMBER() OVER (ORDER BY random()) as rn,
    COUNT(*) OVER () as total
  FROM exams
),
dated AS (
  SELECT id,
    -- Spread across July 10-31 (22 days), random hour 8-22, random minute
    ('2026-07-10'::date + ((rn - 1) * 22 / total)::int)::timestamp
    + (8 + floor(random() * 15))::int * interval '1 hour'
    + floor(random() * 60)::int * interval '1 minute'
    + floor(random() * 60)::int * interval '1 second'
    as new_date
  FROM numbered
)
UPDATE exams SET 
  updated_at = dated.new_date,
  created_at = dated.new_date - (floor(random() * 3) + 1)::int * interval '1 day'
FROM dated 
WHERE exams.id = dated.id;
;
