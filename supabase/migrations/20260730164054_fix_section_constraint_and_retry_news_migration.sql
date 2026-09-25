
-- Drop the overly restrictive constraint
ALTER TABLE content_posts DROP CONSTRAINT IF EXISTS content_posts_section_check;

-- The section field is free-text (categories come from cms_education_news.category 
-- which has values like 'exam-preparation', 'government-jobs', etc.)
-- No constraint needed — we'll validate in the application layer.

-- Now retry the migration
INSERT INTO content_posts (
  slug, title, excerpt, content, pillar, content_type,
  section, post_type, author_name, featured_image,
  tags, status, is_featured, is_breaking,
  published_at, created_at, updated_at, created_by,
  title_hindi, excerpt_hindi, content_hindi,
  source, source_link,
  exam_entity_name, migrated_from
)
SELECT
  en.slug,
  en.title,
  en.excerpt,
  en.content,
  'news'::pillar_type,
  'news'::content_type,
  en.category,
  CASE 
    WHEN en.is_breaking THEN 'news'
    WHEN en.is_important THEN 'news'
    ELSE 'article'
  END,
  en.author,
  NULL,
  CASE 
    WHEN en.tags IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(en.tags))
    ELSE '{}'::text[]
  END,
  CASE en.status
    WHEN 'published' THEN 'published'::post_status
    WHEN 'approved' THEN 'published'::post_status
    WHEN 'pending_review' THEN 'review'::post_status
    ELSE 'draft'::post_status
  END,
  en.is_featured,
  en.is_breaking,
  en.published_at,
  en.created_at,
  en.updated_at,
  en.created_by,
  en.title_hindi,
  en.excerpt_hindi,
  en.content_hindi,
  en.source,
  en.source_link,
  '',
  'cms_education_news'
FROM cms_education_news en
ON CONFLICT (slug) DO NOTHING;
;
