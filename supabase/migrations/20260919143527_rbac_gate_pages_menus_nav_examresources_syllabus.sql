-- ── pages -> manage_pages ──
DROP POLICY IF EXISTS staff_write_pages ON public.pages;
DROP POLICY IF EXISTS staff_update_pages ON public.pages;
CREATE POLICY pages_insert ON public.pages FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('manage_pages'));
CREATE POLICY pages_update ON public.pages FOR UPDATE TO authenticated
  USING (current_user_has_permission('manage_pages'))
  WITH CHECK (current_user_has_permission('manage_pages'));

-- ── menus -> manage_menus ──
DROP POLICY IF EXISTS staff_write_menus ON public.menus;
DROP POLICY IF EXISTS staff_update_menus ON public.menus;
CREATE POLICY menus_insert ON public.menus FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('manage_menus'));
CREATE POLICY menus_update ON public.menus FOR UPDATE TO authenticated
  USING (current_user_has_permission('manage_menus'))
  WITH CHECK (current_user_has_permission('manage_menus'));

-- ── menu_items -> manage_menus ──
DROP POLICY IF EXISTS staff_write_menu_items ON public.menu_items;
DROP POLICY IF EXISTS staff_update_menu_items ON public.menu_items;
CREATE POLICY menu_items_insert ON public.menu_items FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('manage_menus'));
CREATE POLICY menu_items_update ON public.menu_items FOR UPDATE TO authenticated
  USING (current_user_has_permission('manage_menus'))
  WITH CHECK (current_user_has_permission('manage_menus'));

-- ── navigation_config -> manage_menus ──
DROP POLICY IF EXISTS staff_write_nav_config ON public.navigation_config;
DROP POLICY IF EXISTS staff_update_nav_config ON public.navigation_config;
CREATE POLICY navigation_config_insert ON public.navigation_config FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('manage_menus'));
CREATE POLICY navigation_config_update ON public.navigation_config FOR UPDATE TO authenticated
  USING (current_user_has_permission('manage_menus'))
  WITH CHECK (current_user_has_permission('manage_menus'));

-- ── exam_resources -> create_exam OR edit_any_exam (exam content) ──
DROP POLICY IF EXISTS staff_write_exam_resources ON public.exam_resources;
DROP POLICY IF EXISTS staff_update_exam_resources ON public.exam_resources;
CREATE POLICY exam_resources_insert ON public.exam_resources FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('create_exam') OR current_user_has_permission('edit_any_exam'));
CREATE POLICY exam_resources_update ON public.exam_resources FOR UPDATE TO authenticated
  USING (current_user_has_permission('create_exam') OR current_user_has_permission('edit_any_exam'))
  WITH CHECK (current_user_has_permission('create_exam') OR current_user_has_permission('edit_any_exam'));

-- ── exam_syllabus_subjects -> create_exam OR edit_any_exam ──
DROP POLICY IF EXISTS staff_write_exam_syllabus_subjects ON public.exam_syllabus_subjects;
DROP POLICY IF EXISTS staff_update_exam_syllabus_subjects ON public.exam_syllabus_subjects;
CREATE POLICY exam_syllabus_subjects_insert ON public.exam_syllabus_subjects FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('create_exam') OR current_user_has_permission('edit_any_exam'));
CREATE POLICY exam_syllabus_subjects_update ON public.exam_syllabus_subjects FOR UPDATE TO authenticated
  USING (current_user_has_permission('create_exam') OR current_user_has_permission('edit_any_exam'))
  WITH CHECK (current_user_has_permission('create_exam') OR current_user_has_permission('edit_any_exam'));;
