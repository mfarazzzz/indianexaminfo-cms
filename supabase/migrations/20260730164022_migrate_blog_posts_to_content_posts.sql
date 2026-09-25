
-- ============================================================================
-- MIGRATION: Copy blog_posts (12 rows) into content_posts
-- ============================================================================

INSERT INTO content_posts (
  slug, title, excerpt, content, pillar, content_type,
  section, post_type, author_id, featured_image,
  reading_time, word_count, views, shares,
  tags, faqs, seo_title, seo_description, canonical_url,
  status, is_featured, is_breaking, is_pinned,
  table_of_contents, related_exam_slugs,
  published_at, created_at, updated_at, created_by, updated_by,
  exam_entity_name, migrated_from
)
SELECT
  bp.slug,
  bp.title,
  bp.excerpt,
  bp.content,
  'news'::pillar_type,
  'article'::content_type,
  bp.section::text,
  bp.post_type::text,
  bp.author_id,
  bp.featured_image,
  bp.reading_time,
  bp.word_count,
  bp.views,
  bp.shares,
  bp.tags,
  bp.faqs,
  bp.seo_title,
  bp.seo_description,
  bp.canonical_url,
  bp.status,
  bp.is_featured,
  bp.is_breaking,
  bp.is_pinned,
  bp.table_of_contents,
  bp.related_exam_slugs,
  bp.published_at,
  bp.created_at,
  bp.updated_at,
  bp.created_by,
  bp.updated_by,
  '',
  'blog_posts'
FROM blog_posts bp
ON CONFLICT (slug) DO NOTHING;
;
