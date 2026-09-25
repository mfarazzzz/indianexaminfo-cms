
-- ELMS-011: Audit trigger for all ELMS tables

CREATE OR REPLACE FUNCTION elms_audit_trigger_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_id uuid;
  v_actor_id  uuid;
BEGIN
  -- Resolve entity_id from the affected row
  v_entity_id := CASE
    WHEN TG_TABLE_NAME = 'entity'             THEN COALESCE((NEW).id,       (OLD).id)
    WHEN TG_TABLE_NAME IN (
      'entity_module','entity_timeline_event','entity_seo','entity_eligibility',
      'entity_vacancy','entity_fee','entity_exam_pattern','entity_selection_stage',
      'entity_syllabus_subject','entity_download','entity_link','entity_media',
      'entity_revision','entity_broken_link'
    ) THEN COALESCE((NEW).entity_id, (OLD).entity_id)
    WHEN TG_TABLE_NAME = 'module_block'       THEN NULL
    ELSE NULL
  END;

  -- Actor: prefer app-set session variable, fall back to auth.uid()
  BEGIN
    v_actor_id := (current_setting('app.current_user_id', true))::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := auth.uid();
  END;

  INSERT INTO entity_activity_log (
    entity_id, actor_id, action, target_type, target_id, changes, created_at
  ) VALUES (
    v_entity_id,
    v_actor_id,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE((NEW).id, (OLD).id),
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', to_jsonb(NEW))
      WHEN 'DELETE' THEN jsonb_build_object('old', to_jsonb(OLD))
      ELSE jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply trigger to all major ELMS tables
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'entity', 'entity_module', 'entity_timeline_event', 'entity_seo',
    'entity_eligibility', 'entity_vacancy', 'entity_fee', 'entity_exam_pattern',
    'entity_selection_stage', 'entity_syllabus_subject',
    'entity_download', 'entity_link', 'entity_revision'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS audit_%s ON %s;
      CREATE TRIGGER audit_%s
        AFTER INSERT OR UPDATE OR DELETE ON %s
        FOR EACH ROW EXECUTE FUNCTION elms_audit_trigger_fn();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;
;
