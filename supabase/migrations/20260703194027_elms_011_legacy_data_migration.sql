
-- ELMS-013: Idempotent legacy data migration (exams → entity, content_posts → entity_module)

-- 1. Copy exams → entity
INSERT INTO entity (
  id, entity_type, slug, name, short_name, pillar,
  sub_type, category_id, conducting_body, official_website,
  workflow_status, is_featured, tags, search_keywords, metadata,
  created_at, updated_at, created_by
)
SELECT
  e.id, 'exam', e.slug, e.name, e.short_name, e.pillar::text,
  e.entity_type::text, e.category_id, e.conducting_body, e.official_website,
  CASE e.status::text
    WHEN 'upcoming'            THEN 'draft'
    WHEN 'active'              THEN 'published'
    WHEN 'registration-open'   THEN 'published'
    WHEN 'registration-closed' THEN 'published'
    WHEN 'result-declared'     THEN 'published'
    WHEN 'completed'           THEN 'archived'
    WHEN 'ongoing'             THEN 'published'
    ELSE 'draft'
  END,
  e.is_featured, e.tags, e.search_keywords,
  jsonb_build_object(
    'legacy_status', e.status::text,
    'academic_year', e.academic_year,
    'semester', e.semester,
    'admission_to', e.admission_to
  ),
  e.created_at, e.updated_at, e.created_by
FROM exams e
ON CONFLICT (id) DO NOTHING;

-- 2. Migrate legacy SEO into entity_seo
INSERT INTO entity_seo (entity_id, seo_title, meta_description)
SELECT ex.id, ex.seo_title, ex.seo_description
FROM exams ex
WHERE (ex.seo_title IS NOT NULL OR ex.seo_description IS NOT NULL)
  AND EXISTS (SELECT 1 FROM entity en WHERE en.id = ex.id)
ON CONFLICT (entity_id) DO NOTHING;

-- 3. Migrate important_dates array → entity_timeline_event
INSERT INTO entity_timeline_event (
  entity_id, title, event_type, event_date, status, display_order
)
SELECT
  ex.id,
  (d->>'label'),
  'other',
  (d->>'date')::date,
  CASE WHEN (d->>'isUrgent')::boolean = true THEN 'active' ELSE 'upcoming' END,
  (row_number() OVER (PARTITION BY ex.id ORDER BY idx))::int
FROM exams ex
CROSS JOIN LATERAL jsonb_array_elements(ex.important_dates) WITH ORDINALITY AS t(d, idx)
WHERE jsonb_typeof(ex.important_dates) = 'array'
  AND jsonb_array_length(ex.important_dates) > 0
  AND (d->>'date') IS NOT NULL
  AND (d->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
  AND EXISTS (SELECT 1 FROM entity en WHERE en.id = ex.id)
ON CONFLICT DO NOTHING;

-- 4. Migrate content_posts → entity_module
INSERT INTO entity_module (
  id, entity_id, module_type, sub_title, workflow_status,
  seo_override_title, seo_override_desc,
  is_featured, tags, published_at, created_at, updated_at, created_by
)
SELECT
  cp.id, cp.exam_id, cp.content_type::text, cp.title, cp.status::text,
  cp.seo_title, cp.seo_description, cp.is_featured, cp.tags,
  cp.published_at, cp.created_at, cp.updated_at, cp.created_by
FROM content_posts cp
WHERE cp.exam_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM entity en WHERE en.id = cp.exam_id)
ON CONFLICT (id) DO NOTHING;

-- 5. Wrap content_posts.content as rich_text blocks
INSERT INTO module_block (module_id, block_type, content, display_order)
SELECT cp.id, 'rich_text', jsonb_build_object('html', coalesce(cp.content, '')), 0
FROM content_posts cp
WHERE cp.exam_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM entity_module em WHERE em.id = cp.id)
  AND NOT EXISTS (
    SELECT 1 FROM module_block mb
    WHERE mb.module_id = cp.id AND mb.block_type = 'rich_text' AND mb.display_order = 0
  );
;
