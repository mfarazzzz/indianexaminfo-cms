
-- ELMS-011: Audit trigger (v2) — uses jsonb for cross-table field access

CREATE OR REPLACE FUNCTION elms_audit_trigger_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       jsonb;
  v_old_row   jsonb;
  v_entity_id uuid;
  v_row_id    uuid;
  v_actor_id  uuid;
BEGIN
  v_row     := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_old_row := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  v_row_id  := (v_row->>'id')::uuid;

  v_entity_id := CASE
    WHEN TG_TABLE_NAME = 'entity' THEN v_row_id
    ELSE (v_row->>'entity_id')::uuid
  END;

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
    v_row_id,
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', v_row)
      WHEN 'DELETE' THEN jsonb_build_object('old', v_row)
      ELSE jsonb_build_object('old', v_old_row, 'new', v_row)
    END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply to all major ELMS tables
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
