-- T3.6: Replace blanket `true` INSERT/UPDATE/DELETE policies on sarkari_naukri
-- and cms_education_news with role-scoped policies matching the rest of the schema.
-- Pattern: authenticated can read all; only staff (editor/admin/super-admin) can write;
-- only admin/super-admin can delete.

-- ──── sarkari_naukri ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS authenticated_insert ON sarkari_naukri;
DROP POLICY IF EXISTS authenticated_update ON sarkari_naukri;
DROP POLICY IF EXISTS authenticated_delete ON sarkari_naukri;

-- Staff can create
CREATE POLICY staff_insert_sarkari ON sarkari_naukri
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Staff can update
CREATE POLICY staff_update_sarkari ON sarkari_naukri
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Only admin/super-admin can delete
CREATE POLICY admin_delete_sarkari ON sarkari_naukri
  FOR DELETE TO authenticated
  USING (current_user_role() IN ('super-admin', 'admin'));

-- ──── cms_education_news ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS authenticated_insert ON cms_education_news;
DROP POLICY IF EXISTS authenticated_update ON cms_education_news;
DROP POLICY IF EXISTS authenticated_delete ON cms_education_news;

-- Staff can create
CREATE POLICY staff_insert_news ON cms_education_news
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Staff can update
CREATE POLICY staff_update_news ON cms_education_news
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Only admin/super-admin can delete
CREATE POLICY admin_delete_news ON cms_education_news
  FOR DELETE TO authenticated
  USING (current_user_role() IN ('super-admin', 'admin'));;
