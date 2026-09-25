
-- T1-1: Drop 10 redundant indexes that duplicate their UNIQUE constraint
-- A UNIQUE constraint already creates a btree index; the extra one just wastes storage and slows writes.

DROP INDEX IF EXISTS public.blog_posts_slug_idx;
DROP INDEX IF EXISTS public.categories_slug_idx;
DROP INDEX IF EXISTS public.idx_cms_articles_slug;
DROP INDEX IF EXISTS public.idx_cms_authors_slug;
DROP INDEX IF EXISTS public.idx_cms_categories_slug;
DROP INDEX IF EXISTS public.idx_cms_tags_slug;
DROP INDEX IF EXISTS public.content_posts_slug_idx;
DROP INDEX IF EXISTS public.idx_entity_seo_entity;
DROP INDEX IF EXISTS public.exams_slug_idx;
DROP INDEX IF EXISTS public.redirects_from_path_idx;

-- T1-2: Document entity.conducting_body as deprecated
COMMENT ON COLUMN public.entity.conducting_body IS 
  'DEPRECATED: Legacy text field. Use conducting_body_id FK instead. Will be removed in a future migration after confirming no code reads this field directly.';

-- T1-3: Add missing index on entity_activity_log.module_id
CREATE INDEX IF NOT EXISTS idx_activity_log_module 
  ON public.entity_activity_log(module_id) 
  WHERE module_id IS NOT NULL;

-- T1-5: Document sarkari_naukri dual-status fields
COMMENT ON COLUMN public.sarkari_naukri.status IS 
  'Recruitment lifecycle status (upcoming, application-open, result-declared, etc.). Distinct from workflow_status which tracks editorial/publishing state.';
COMMENT ON COLUMN public.sarkari_naukri.workflow_status IS
  'Editorial workflow status (draft, review, published, archived). Distinct from status which tracks the recruitment lifecycle.';
;
