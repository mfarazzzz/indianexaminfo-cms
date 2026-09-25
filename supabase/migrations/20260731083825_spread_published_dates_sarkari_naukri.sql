
-- Spread sarkari_naukri published_at from July 10 to July 31
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY random()) as rn,
    COUNT(*) OVER () as total
  FROM sarkari_naukri
),
dated AS (
  SELECT id,
    ('2026-07-10'::date + ((rn - 1) * 22 / total)::int)::timestamp
    + (7 + floor(random() * 16))::int * interval '1 hour'
    + floor(random() * 60)::int * interval '1 minute'
    + floor(random() * 60)::int * interval '1 second'
    as new_date
  FROM numbered
)
UPDATE sarkari_naukri SET 
  published_at = dated.new_date,
  updated_at = dated.new_date + floor(random() * 120)::int * interval '1 minute',
  created_at = dated.new_date - (floor(random() * 5) + 1)::int * interval '1 day'
FROM dated
WHERE sarkari_naukri.id = dated.id;
;
