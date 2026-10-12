-- =============================================================================
-- PROPOSED — DO NOT APPLY WITHOUT OWNER APPROVAL  (read-only diagnosis artifact)
-- 2026-10-12 · govt-vacancy /exam new: "first cycle violates RLS on exam_editions"
--
-- LIVE COUNTS AT DIAGNOSIS (read-only):
--   exams = 397 · exam_editions = 399
--   exams with no edition  all-time = 0  |  last 24h = 0   (compensating delete works)
--
-- FINDING (facts):
--   * exam_editions INSERT policy `exam_editions_insert` (PERMISSIVE, role
--     authenticated) WITH CHECK = current_user_has_permission('create_exam')
--     OR current_user_has_permission('edit_any_exam').
--   * exams INSERT policy `exams_insert` (authenticated) WITH CHECK =
--     current_user_has_permission('create_exam') AND (workflow_status<>'published'
--     OR current_user_has_permission('publish_exam')).
--   * The signed-in account (user_profiles 1b7bf398…, is_active, role super-admin)
--     HOLDS both create_exam and edit_any_exam → both WITH CHECKs are satisfied.
--   * Both tables relrowsecurity=true, no restrictive/ALL INSERT policy, no
--     INSERT-affecting trigger. The INSERT policy is long-standing (recent
--     exam_editions migrations only tightened SELECT), i.e. it worked before.
--   => The RLS rejection is NOT reproducible from the current DB state for this
--      account. The only mechanism that yields "exams ok, exam_editions denied"
--      on one client is that the two rows are written as SEPARATE requests
--      (createEntranceExam: insert exams → getModuleRegistry network call →
--      insert exam_editions) and the short-lived access token lapses in that gap,
--      so the SECOND request reaches PostgREST as `anon` and the authenticated-only
--      policy denies it, while the first (still-valid) request succeeded.
--
-- SMALLEST FIX: create the exam and its first current edition in ONE request via
-- a SECURITY INVOKER function, so both inserts run under a single, identical
-- auth context — the exams-ok/editions-anon split becomes impossible, and the
-- pair is atomic (no orphan even if the app tab closes mid-create). INVOKER keeps
-- the EXISTING RLS: a user who cannot insert via the policies cannot use this
-- either. Grants mirror the tables. NOT applied.
--
-- FOLLOW-UP CODE CHANGE (separate, not part of this migration): point
-- entranceExamService.createEntranceExam (serves every pillar incl. govt-vacancy
-- via pillarFromUrl) at db.rpc('create_exam_with_edition', { p_exam, p_edition })
-- instead of two sequential client inserts; keep compensating delete as a
-- fallback for legacy callers until all three call sites (entrance/pillar/bulk)
-- move.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_exam_with_edition(
  p_exam    jsonb,   -- exams columns: slug, name, short_name, pillar, region, entity_type,
                     -- selection_model, conducting_body, official_website, workflow_status, …
  p_edition jsonb    -- exam_editions columns: year, session, edition_label, status, content_modules, …
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_exam_id    uuid;
  v_edition_id uuid;
BEGIN
  IF p_exam IS NULL OR p_edition IS NULL THEN
    RAISE EXCEPTION 'create_exam_with_edition: both p_exam and p_edition are required';
  END IF;
  IF (p_exam->>'slug') IS NULL OR (p_exam->>'name') IS NULL THEN
    RAISE EXCEPTION 'create_exam_with_edition: p_exam must include at least slug and name';
  END IF;
  IF (p_edition->>'year') IS NULL THEN
    RAISE EXCEPTION 'create_exam_with_edition: p_edition must include year';
  END IF;

  -- Runs under the CALLER's RLS (invoker). One request → one auth context.
  EXECUTE 'INSERT INTO public.exams SELECT * FROM jsonb_populate_record(NULL::public.exams, $1) RETURNING id'
    INTO v_exam_id USING p_exam;

  EXECUTE 'INSERT INTO public.exam_editions SELECT * FROM jsonb_populate_record(NULL::public.exam_editions, $1) RETURNING id'
    INTO v_edition_id
    USING (p_edition || jsonb_build_object('exam_id', v_exam_id, 'is_current', true));

  -- Keep the pointer coherent even if the maint_current_edition trigger ordering differs.
  UPDATE public.exams SET current_edition_id = v_edition_id WHERE id = v_exam_id;

  RETURN jsonb_build_object('exam_id', v_exam_id, 'edition_id', v_edition_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_exam_with_edition(jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.create_exam_with_edition(jsonb, jsonb) TO authenticated, service_role;
