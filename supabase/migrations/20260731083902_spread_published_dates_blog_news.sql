
-- Spread blog_posts published_at from July 10 to July 31
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY random()) as rn,
    COUNT(*) OVER () as total
  FROM blog_posts
),
dated AS (
  SELECT id,
    ('2026-07-10'::date + ((rn - 1) * 22 / total)::int)::timestamp
    + (9 + floor(random() * 13))::int * interval '1 hour'
    + floor(random() * 60)::int * interval '1 minute'
    as new_date
  FROM numbered
)
UPDATE blog_posts SET 
  published_at = dated.new_date,
  updated_at = dated.new_date + floor(random() * 60)::int * interval '1 minute',
  created_at = dated.new_date - (floor(random() * 3) + 1)::int * interval '1 day'
FROM dated
WHERE blog_posts.id = dated.id;

-- Spread cms_education_news
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY random()) as rn,
    COUNT(*) OVER () as total
  FROM cms_education_news
),
dated AS (
  SELECT id,
    ('2026-07-10'::date + ((rn - 1) * 22 / total)::int)::timestamp
    + (7 + floor(random() * 16))::int * interval '1 hour'
    + floor(random() * 60)::int * interval '1 minute'
    as new_date
  FROM numbered
)
UPDATE cms_education_news SET 
  published_at = dated.new_date,
  updated_at = dated.new_date + floor(random() * 45)::int * interval '1 minute',
  created_at = dated.new_date - (floor(random() * 4) + 1)::int * interval '1 day'
FROM dated
WHERE cms_education_news.id = dated.id;
;
