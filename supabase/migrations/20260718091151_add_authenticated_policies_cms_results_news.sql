-- Add RLS policies for authenticated CMS users on cms_results
CREATE POLICY "authenticated_select_all" ON cms_results
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert" ON cms_results
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update" ON cms_results
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete" ON cms_results
  FOR DELETE TO authenticated USING (true);

-- Add RLS policies for authenticated CMS users on cms_education_news
CREATE POLICY "authenticated_select_all" ON cms_education_news
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert" ON cms_education_news
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update" ON cms_education_news
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete" ON cms_education_news
  FOR DELETE TO authenticated USING (true);;
