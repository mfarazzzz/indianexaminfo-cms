-- =============================================================================
-- AU1 (PROPOSED — DO NOT APPLY WITHOUT OWNER APPROVAL). Docs/design only.
-- DB-trigger-based audit so application code CANNOT forget to log.
--
-- WHY: audit_log currently has 0 rows total — the app writes to it from a few
-- hand-instrumented call sites (and evidently none fired for the exam/edition
-- actions behind FX1), so destructive operations like an edition delete leave no
-- trail. That is exactly why FX1.1 could not determine HOW the record lost its
-- edition. A trigger on the table itself makes logging structural: every write
-- is recorded regardless of which code path performed it (CMS, bulk import, a
-- future RPC, or a direct SQL edit).
--
-- DESIGN NOTE
-- -----------
-- 1. Coverage: exams, exam_editions, sarkari_naukri, categories, reader_messages
--    (the tables the owner named). One shared trigger function; a per-table
--    trigger instance passes its own table name as TG_TABLE_NAME.
--
-- 2. Identity: user_id = auth.uid(). audit_log.user_name / user_role are NOT
--    NULL, so the trigger resolves them from user_profiles (name) joined to
--    roles (slug) by auth.uid(). When auth.uid() is NULL (a service_role /
--    migration / background job, or a SECURITY DEFINER RPC that runs as owner),
--    the trigger records user_id NULL and a sentinel name/role ('system' /
--    'service_role') rather than failing the audited write. A failed audit must
--    never block the business operation — see (5).
--
-- 3. Action: a plain verb INSERT / UPDATE / DELETE. Semantic verbs (publish,
--    promote, activate) stay in the app layer where they are known; the trigger
--    guarantees at least the mechanical verb is always present.
--
-- 4. Diff summary (details jsonb):
--       INSERT -> {"after": <new row>}
--       DELETE -> {"before": <old row>}
--       UPDATE -> {"changed": {col: {"from": old, "to": new}, ...}}  only the
--                 columns that actually differ, so the blob stays small and a
--                 reviewer sees exactly what changed (e.g. is_current true->false,
--                 workflow_status draft->published).
--    entity_name is best-effort from name / slug / label / title so the log line
--    is readable without joining back.
--
-- 5. Non-blocking: the trigger body is wrapped so an audit error is logged via
--    RAISE WARNING and swallowed, never aborting the underlying DML. Losing an
--    audit row is bad; failing the user's save is worse.
--
-- 6. SECURITY DEFINER + search_path pinned: the function inserts into audit_log
--    on behalf of users who do not have INSERT rights on audit_log directly. It
--    sets search_path to avoid hijacking. Execute is revoked from public and
--    granted only via the triggers (the function is not meant to be called
--    directly by roles).
--
-- 7. RLS on audit_log: keep it read-only for admins (super-admin/admin roles) and
--    NOT writable by authenticated users directly — writes happen only through
--    this SECURITY DEFINER trigger. (A companion policy change is noted in the
--    design doc; not included here to keep this file to the trigger mechanism.)
--
-- 8. Retention / volume: audits every write. For high-churn tables this can grow
--    fast; a follow-up may add a partition or a periodic prune. Flagged, not
--    solved here.
--
-- STATUS: proposal only. The owner reviews and, if approved, this becomes a
-- dated migration under supabase/migrations/ and is applied via the normal
-- migration path. Nothing here has been run against the database.
-- =============================================================================

-- The shared audit trigger function.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_name    text;
  v_role    text;
  v_action  text := TG_OP;
  v_details jsonb;
  v_id      text;
  v_row     jsonb;
  v_entname text;
BEGIN
  -- Best-effort human name for the log line (NEW/OLD are only visible inside
  -- this trigger's own scope, so it is computed here, not in a helper fn).
  v_row := to_jsonb(COALESCE(NEW, OLD));
  v_entname := NULLIF(COALESCE(
    v_row->>'name', v_row->>'slug', v_row->>'label', v_row->>'title', v_row->>'question'
  ), '');

  -- Resolve identity; fall back to a sentinel when there is no end user
  -- (service_role, migration, or a definer RPC). Never fail the audited write.
  IF v_uid IS NOT NULL THEN
    SELECT up.name, r.slug INTO v_name, v_role
      FROM public.user_profiles up
      LEFT JOIN public.roles r ON r.id = up.role_id
      WHERE up.id = v_uid;
  END IF;
  v_name := COALESCE(v_name, 'system');
  v_role := COALESCE(v_role, 'service_role');

  -- Build the diff summary.
  IF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object('after', to_jsonb(NEW));
    v_id := NEW.id::text;
  ELSIF TG_OP = 'DELETE' THEN
    v_details := jsonb_build_object('before', to_jsonb(OLD));
    v_id := OLD.id::text;
  ELSE -- UPDATE: only the columns that actually changed.
    SELECT jsonb_object_agg(key, jsonb_build_object('from', old_v, 'to', new_v))
      INTO v_details
      FROM (
        SELECT key,
               (o->>key) AS old_v,
               (n->>key) AS new_v
        FROM jsonb_each(to_jsonb(OLD)) o(key, val)
        JOIN jsonb_each(to_jsonb(NEW)) n(key, val) USING (key)
        WHERE (o->>key) IS DISTINCT FROM (n->>key)
      ) d;
    v_details := COALESCE(v_details, '{}'::jsonb);
    v_id := NEW.id::text;
  END IF;

  BEGIN
    INSERT INTO public.audit_log
      (user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details)
    VALUES
      (v_uid, v_name, v_role, v_action, TG_TABLE_NAME, v_id, v_entname, v_details);
  EXCEPTION WHEN OTHERS THEN
    -- (5) Non-blocking: an audit failure must not abort the business write.
    RAISE WARNING 'audit_row_change: failed to log % on %.%: %', v_action, TG_TABLE_NAME, v_id, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach one trigger per audited table. Idempotent (drop-then-create).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['exams','exam_editions','sarkari_naukri','categories','reader_messages']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
  END LOOP;
END $$;

-- The function is invoked only by triggers; do not expose it for direct calls.
REVOKE ALL ON FUNCTION public.audit_row_change() FROM public;
