-- Security fix: conducting_body INSERT and UPDATE policies were always-true,
-- meaning any authenticated user (including advertisers) could modify the
-- conducting body lookup table. Tighten to admin/editor roles only.
-- SELECT stays open for all authenticated (editors need to read for dropdowns).

DROP POLICY IF EXISTS conducting_body_insert_authenticated ON public.conducting_body;
DROP POLICY IF EXISTS conducting_body_update_authenticated ON public.conducting_body;

-- Only super-admin, admin, and editor roles can insert/update conducting bodies.
CREATE POLICY conducting_body_insert_staff ON public.conducting_body
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role_slug() IN ('super-admin', 'admin', 'editor')
  );

CREATE POLICY conducting_body_update_staff ON public.conducting_body
  FOR UPDATE TO authenticated
  USING (
    get_my_role_slug() IN ('super-admin', 'admin', 'editor')
  )
  WITH CHECK (
    get_my_role_slug() IN ('super-admin', 'admin', 'editor')
  );;
