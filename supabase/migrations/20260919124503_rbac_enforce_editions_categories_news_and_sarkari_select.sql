-- ── exam_editions: edit-gated by exam permissions (an edition is part of an exam;
--    its own `status` is edition lifecycle, NOT publish state, so no publish gate here) ──
DROP POLICY IF EXISTS staff_write_exam_editions ON public.exam_editions;   -- INSERT auth.uid() IS NOT NULL
DROP POLICY IF EXISTS staff_update_exam_editions ON public.exam_editions;  -- UPDATE USING auth.uid() IS NOT NULL

CREATE POLICY exam_editions_insert ON public.exam_editions
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_has_permission('create_exam') OR current_user_has_permission('edit_any_exam')
  );

CREATE POLICY exam_editions_update ON public.exam_editions
  FOR UPDATE TO authenticated
  USING (
    current_user_has_permission('edit_any_exam') OR current_user_has_permission('create_exam')
  )
  WITH CHECK (
    current_user_has_permission('edit_any_exam') OR current_user_has_permission('create_exam')
  );

-- ── categories: structural, gated by manage_categories (no publish concept) ──
DROP POLICY IF EXISTS staff_write_categories ON public.categories;   -- INSERT auth.uid() IS NOT NULL
DROP POLICY IF EXISTS staff_update_categories ON public.categories;  -- UPDATE USING auth.uid() IS NOT NULL

CREATE POLICY categories_insert ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('manage_categories'));

CREATE POLICY categories_update ON public.categories
  FOR UPDATE TO authenticated
  USING (current_user_has_permission('manage_categories'))
  WITH CHECK (current_user_has_permission('manage_categories'));

-- ── cms_education_news: editorial content; no news-specific slug exists, so reuse the
--    existing post vocabulary (create_post to write, publish_post to publish). Not a new slug. ──
DROP POLICY IF EXISTS staff_insert_news ON public.cms_education_news;  -- INSERT auth.uid() IS NOT NULL
DROP POLICY IF EXISTS staff_update_news ON public.cms_education_news;  -- UPDATE USING auth.uid() IS NOT NULL

CREATE POLICY news_insert ON public.cms_education_news
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_has_permission('create_post')
    AND (status <> 'published' OR current_user_has_permission('publish_post'))
  );

CREATE POLICY news_update ON public.cms_education_news
  FOR UPDATE TO authenticated
  USING (
    current_user_has_permission('edit_any_post')
    OR (created_by = auth.uid() AND current_user_has_permission('edit_own_post'))
  )
  WITH CHECK (
    current_user_has_permission('edit_any_post')
    OR (created_by = auth.uid() AND current_user_has_permission('edit_own_post'))
  );

DROP TRIGGER IF EXISTS trg_enforce_news_publish ON public.cms_education_news;
CREATE TRIGGER trg_enforce_news_publish
  BEFORE UPDATE ON public.cms_education_news
  FOR EACH ROW
  WHEN (NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published')
  EXECUTE FUNCTION public.enforce_post_publish_permission();

-- ── sarkari_naukri.authenticated_select: qual=true leaked unpublished rows to any
--    logged-in user. Replace with: staff (any content permission) see all; everyone
--    else only published. Anon already has anon_read_published. ──
DROP POLICY IF EXISTS authenticated_select ON public.sarkari_naukri;

CREATE POLICY authenticated_select ON public.sarkari_naukri
  FOR SELECT TO authenticated
  USING (
    workflow_status = 'published'
    OR current_user_has_permission('create_post')
    OR current_user_has_permission('edit_any_post')
    OR current_user_has_permission('edit_own_post')
    OR current_user_role() IN ('admin','super-admin','editor')
  );;
