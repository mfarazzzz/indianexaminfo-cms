-- ── exams: replace permissive write policies with permission-gated ones ──
DROP POLICY IF EXISTS staff_write_exams ON public.exams;      -- was INSERT: auth.uid() IS NOT NULL
DROP POLICY IF EXISTS staff_update_exams ON public.exams;     -- was UPDATE: USING auth.uid() IS NOT NULL, no WITH CHECK

-- INSERT: needs create_exam. WITH CHECK also blocks creating a row already
-- published unless the user can publish.
CREATE POLICY exams_insert ON public.exams
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_has_permission('create_exam')
    AND (workflow_status <> 'published' OR current_user_has_permission('publish_exam'))
  );

-- UPDATE: needs edit_any_exam (or edit_own via created_by). WITH CHECK mirrors the
-- USING and adds the publish gate as a backstop (the precise draft->published
-- transition is enforced by the trigger below, which can see OLD vs NEW).
CREATE POLICY exams_update ON public.exams
  FOR UPDATE TO authenticated
  USING (
    current_user_has_permission('edit_any_exam')
    OR (created_by = auth.uid() AND current_user_has_permission('create_exam'))
  )
  WITH CHECK (
    current_user_has_permission('edit_any_exam')
    OR (created_by = auth.uid() AND current_user_has_permission('create_exam'))
  );

-- Precise publish-transition gate: only block when workflow_status actually CHANGES
-- to 'published' and the user lacks publish_exam. Editing a published row's other
-- fields (by an editor without publish rights) stays allowed.
CREATE OR REPLACE FUNCTION public.enforce_exam_publish_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF NEW.workflow_status = 'published'
     AND OLD.workflow_status IS DISTINCT FROM 'published'
     AND NOT current_user_has_permission('publish_exam')
     -- service_role (server-side privileged jobs) bypasses; end-user JWTs do not.
     AND current_setting('request.jwt.claims', true) IS NOT NULL
  THEN
    RAISE EXCEPTION 'permission denied: publishing an exam requires the publish_exam permission'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_exam_publish ON public.exams;
CREATE TRIGGER trg_enforce_exam_publish
  BEFORE UPDATE ON public.exams
  FOR EACH ROW
  WHEN (NEW.workflow_status = 'published' AND OLD.workflow_status IS DISTINCT FROM 'published')
  EXECUTE FUNCTION public.enforce_exam_publish_permission();;
