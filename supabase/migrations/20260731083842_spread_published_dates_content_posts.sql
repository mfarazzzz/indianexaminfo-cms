
-- Spread content_posts published_at from July 10 to July 31
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY random()) as rn,
    COUNT(*) OVER () as total
  FROM content_posts
),
dated AS (
  SELECT id,
    ('2026-07-10'::date + ((rn - 1) * 22 / total)::int)::timestamp
    + (8 + floor(random() * 14))::int * interval '1 hour'
    + floor(random() * 60)::int * interval '1 minute'
    + floor(random() * 60)::int * interval '1 second'
    as new_date
  FROM numbered
)
UPDATE content_posts SET 
  published_at = dated.new_date,
  updated_at = dated.new_date + floor(random() * 90)::int * interval '1 minute',
  created_at = dated.new_date - (floor(random() * 4) + 1)::int * interval '1 day'
FROM dated
WHERE content_posts.id = dated.id;
;
