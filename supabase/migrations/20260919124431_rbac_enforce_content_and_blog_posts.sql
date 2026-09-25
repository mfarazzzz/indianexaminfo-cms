-- ── content_posts ──
DROP POLICY IF EXISTS staff_write_content ON public.content_posts;   -- INSERT: auth.uid() IS NOT NULL
DROP POLICY IF EXISTS staff_update_content ON public.content_posts;  -- UPDATE: USING auth.uid() IS NOT NULL

CREATE POLICY content_posts_insert ON public.content_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_has_permission('create_post')
    AND (status <> 'published' OR current_user_has_permission('publish_post'))
  );

CREATE POLICY content_posts_update ON public.content_posts
  FOR UPDATE TO authenticated
  USING (
    current_user_has_permission('edit_any_post')
    OR (created_by = auth.uid() AND current_user_has_permission('edit_own_post'))
  )
  WITH CHECK (
    current_user_has_permission('edit_any_post')
    OR (created_by = auth.uid() AND current_user_has_permission('edit_own_post'))
  );

-- ── blog_posts ──
DROP POLICY IF EXISTS staff_write_blog ON public.blog_posts;    -- INSERT: auth.uid() IS NOT NULL
DROP POLICY IF EXISTS staff_update_blog ON public.blog_posts;   -- UPDATE: USING auth.uid() IS NOT NULL

CREATE POLICY blog_posts_insert ON public.blog_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_has_permission('create_post')
    AND (status <> 'published' OR current_user_has_permission('publish_post'))
  );

CREATE POLICY blog_posts_update ON public.blog_posts
  FOR UPDATE TO authenticated
  USING (
    current_user_has_permission('edit_any_post')
    OR (created_by = auth.uid() AND current_user_has_permission('edit_own_post'))
  )
  WITH CHECK (
    current_user_has_permission('edit_any_post')
    OR (created_by = auth.uid() AND current_user_has_permission('edit_own_post'))
  );

-- Precise publish-transition gate for the post tables (status text/enum -> 'published').
CREATE OR REPLACE FUNCTION public.enforce_post_publish_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.status::text = 'published'
     AND OLD.status::text IS DISTINCT FROM 'published'
     AND NOT current_user_has_permission('publish_post')
  THEN
    RAISE EXCEPTION 'permission denied: publishing a post requires the publish_post permission'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_content_post_publish ON public.content_posts;
CREATE TRIGGER trg_enforce_content_post_publish
  BEFORE UPDATE ON public.content_posts
  FOR EACH ROW
  WHEN (NEW.status::text = 'published' AND OLD.status::text IS DISTINCT FROM 'published')
  EXECUTE FUNCTION public.enforce_post_publish_permission();

DROP TRIGGER IF EXISTS trg_enforce_blog_post_publish ON public.blog_posts;
CREATE TRIGGER trg_enforce_blog_post_publish
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  WHEN (NEW.status::text = 'published' AND OLD.status::text IS DISTINCT FROM 'published')
  EXECUTE FUNCTION public.enforce_post_publish_permission();;
