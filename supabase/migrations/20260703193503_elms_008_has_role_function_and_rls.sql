
-- ELMS-009: has_role() helper and RLS policies for all new tables

-- has_role() helper — uses user_profiles.role_id -> roles.slug
CREATE OR REPLACE FUNCTION has_role(required_role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN roles r ON up.role_id = r.id
    WHERE up.id = auth.uid()
      AND r.slug = required_role
      AND up.is_active = true
  );
$$;

-- can_write_entity(): editor, writer, admin, super-admin
CREATE OR REPLACE FUNCTION can_write_entity()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN roles r ON up.role_id = r.id
    WHERE up.id = auth.uid()
      AND r.slug IN ('editor', 'writer', 'admin', 'super-admin')
      AND up.is_active = true
  );
$$;

-- can_publish_entity(): admin, super-admin only
CREATE OR REPLACE FUNCTION can_publish_entity()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN roles r ON up.role_id = r.id
    WHERE up.id = auth.uid()
      AND r.slug IN ('admin', 'super-admin')
      AND up.is_active = true
  );
$$;

-- Revoke anon execute
REVOKE EXECUTE ON FUNCTION has_role(text) FROM anon;
REVOKE EXECUTE ON FUNCTION can_write_entity() FROM anon;
REVOKE EXECUTE ON FUNCTION can_publish_entity() FROM anon;

-- ── RLS for entity ───────────────────────────────────────────────
ALTER TABLE entity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entity_select"       ON entity;
DROP POLICY IF EXISTS "entity_insert"       ON entity;
DROP POLICY IF EXISTS "entity_update"       ON entity;
DROP POLICY IF EXISTS "entity_delete"       ON entity;

CREATE POLICY "entity_select" ON entity FOR SELECT TO authenticated
  USING (deleted_at IS NULL);
CREATE POLICY "entity_insert" ON entity FOR INSERT TO authenticated
  WITH CHECK (can_write_entity());
CREATE POLICY "entity_update" ON entity FOR UPDATE TO authenticated
  USING (can_write_entity());
CREATE POLICY "entity_delete" ON entity FOR DELETE TO authenticated
  USING (has_role('admin') OR has_role('super-admin'));

-- ── RLS for entity_module ────────────────────────────────────────
ALTER TABLE entity_module ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entity_module_select" ON entity_module;
DROP POLICY IF EXISTS "entity_module_write"  ON entity_module;
DROP POLICY IF EXISTS "entity_module_delete" ON entity_module;
CREATE POLICY "entity_module_select" ON entity_module FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "entity_module_write"  ON entity_module FOR ALL    TO authenticated USING (can_write_entity()) WITH CHECK (can_write_entity());

-- ── RLS for module_block ─────────────────────────────────────────
ALTER TABLE module_block ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "module_block_select" ON module_block;
DROP POLICY IF EXISTS "module_block_write"  ON module_block;
CREATE POLICY "module_block_select" ON module_block FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "module_block_write"  ON module_block FOR ALL    TO authenticated USING (can_write_entity()) WITH CHECK (can_write_entity());

-- ── RLS for timeline ─────────────────────────────────────────────
ALTER TABLE entity_timeline_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "timeline_select" ON entity_timeline_event;
DROP POLICY IF EXISTS "timeline_write"  ON entity_timeline_event;
CREATE POLICY "timeline_select" ON entity_timeline_event FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "timeline_write"  ON entity_timeline_event FOR ALL    TO authenticated USING (can_write_entity()) WITH CHECK (can_write_entity());

-- ── RLS for SEO ──────────────────────────────────────────────────
ALTER TABLE entity_seo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "seo_select" ON entity_seo;
DROP POLICY IF EXISTS "seo_write"  ON entity_seo;
CREATE POLICY "seo_select" ON entity_seo FOR SELECT TO authenticated USING (true);
CREATE POLICY "seo_write"  ON entity_seo FOR ALL    TO authenticated USING (can_write_entity()) WITH CHECK (can_write_entity());

-- ── RLS for structured tables ────────────────────────────────────
ALTER TABLE entity_eligibility        ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_vacancy            ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_fee                ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_exam_pattern       ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_selection_stage    ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_syllabus_subject   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['entity_eligibility','entity_vacancy','entity_fee',
    'entity_exam_pattern','entity_selection_stage','entity_syllabus_subject']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_write"  ON %s', t, t);
    EXECUTE format('CREATE POLICY "%s_select" ON %s FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_write"  ON %s FOR ALL    TO authenticated USING (can_write_entity()) WITH CHECK (can_write_entity())', t, t);
  END LOOP;
END $$;

-- ── RLS for media / downloads / links ───────────────────────────
ALTER TABLE media_library   ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_media    ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_download ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_link     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['media_library','entity_media','entity_download','entity_link']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %s', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_write"  ON %s', t, t);
    EXECUTE format('CREATE POLICY "%s_select" ON %s FOR SELECT TO authenticated USING (deleted_at IS NULL)', t, t);
    EXECUTE format('CREATE POLICY "%s_write"  ON %s FOR ALL    TO authenticated USING (can_write_entity()) WITH CHECK (can_write_entity())', t, t);
  END LOOP;
END $$;

-- ── RLS for revisions, activity, components ──────────────────────
ALTER TABLE entity_revision          ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_activity_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reusable_component       ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_block_component_ref ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_broken_link       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_revision_select" ON entity_revision FOR SELECT TO authenticated USING (true);
CREATE POLICY "entity_revision_write"  ON entity_revision FOR ALL    TO authenticated USING (can_write_entity()) WITH CHECK (can_write_entity());
CREATE POLICY "activity_log_select"    ON entity_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_log_insert"    ON entity_activity_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reusable_component_select" ON reusable_component FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "reusable_component_write"  ON reusable_component FOR ALL    TO authenticated USING (can_write_entity()) WITH CHECK (can_write_entity());
CREATE POLICY "block_component_ref_all"   ON module_block_component_ref FOR ALL TO authenticated USING (can_write_entity()) WITH CHECK (can_write_entity());
CREATE POLICY "broken_link_select"    ON entity_broken_link FOR SELECT TO authenticated USING (true);
CREATE POLICY "broken_link_write"     ON entity_broken_link FOR ALL    TO authenticated USING (can_write_entity()) WITH CHECK (can_write_entity());
;
