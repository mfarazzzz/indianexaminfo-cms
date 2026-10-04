-- =============================================================================
-- FX1.5 (PROPOSED — DO NOT APPLY WITHOUT OWNER APPROVAL)
-- create_exam_with_edition(): one atomic RPC that inserts an exam AND its first
-- current edition in a single transaction.
--
-- WHY: today the editor / pillarService / bulk-import each insert exams then
-- exam_editions as two separate round-trips. If the edition insert fails the
-- exam is left with ZERO editions — the FX1 silent-save state. The app-layer
-- fix (FX1.5) adds a compensating delete, but that is best-effort (the delete
-- itself could fail, or the tab could close between the two calls). A single
-- SECURITY INVOKER function makes the pair atomic: either both rows commit or
-- neither does, with no orphan possible.
--
-- SECURITY INVOKER (not DEFINER) is deliberate: the function runs as the
-- calling user, so the EXISTING RLS policies on exams / exam_editions apply
-- unchanged. No privilege is granted that the user's role policies don't
-- already allow. A user who cannot insert into exams via RLS cannot create one
-- through this function either.
--
-- This is a PROPOSAL for a later switch. The app code (entranceExamService.
-- createEntranceExam, pillarService.create, excelBulkOps) is NOT changed to
-- call it in FX1; it keeps the compensating-delete path. When the owner
-- approves, the three call sites can be pointed at this RPC in a follow-up.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_exam_with_edition(
  p_exam          jsonb,   -- columns for the exams row (slug, name, short_name, pillar, region, ...)
  p_edition       jsonb    -- columns for the exam_editions row (year, session, edition_label, status, ...)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_exam_id    uuid;
  v_edition_id uuid;
  v_exam       record;
BEGIN
  -- Guard: the caller must supply the minimum identity fields. RLS still decides
  -- whether this user may actually write; this only fails fast on a malformed call.
  IF p_exam IS NULL OR p_edition IS NULL THEN
    RAISE EXCEPTION 'create_exam_with_edition: both p_exam and p_edition are required';
  END IF;
  IF (p_exam->>'slug') IS NULL OR (p_exam->>'name') IS NULL THEN
    RAISE EXCEPTION 'create_exam_with_edition: p_exam must include at least slug and name';
  END IF;
  IF (p_edition->>'year') IS NULL THEN
    RAISE EXCEPTION 'create_exam_with_edition: p_edition must include year';
  END IF;

  -- Insert the exam. Runs under the caller's RLS (SECURITY INVOKER).
  EXECUTE 'INSERT INTO public.exams SELECT * FROM jsonb_populate_record(NULL::public.exams, $1) RETURNING id'
    INTO v_exam_id
    USING p_exam;

  -- Insert the first edition, forced to is_current = true and linked to the exam.
  -- If this raises, the whole transaction rolls back — no orphan exam survives.
  EXECUTE 'INSERT INTO public.exam_editions SELECT * FROM jsonb_populate_record(NULL::public.exam_editions, $1) RETURNING id'
    INTO v_edition_id
    USING jsonb_set(
      p_edition || jsonb_build_object('exam_id', v_exam_id, 'is_current', true),
      '{}', '{}'::jsonb, true
    );

  -- Keep exams.current_edition_id consistent (the trigger normally does this on
  -- an is_current edition insert; set it explicitly here as a belt-and-braces so
  -- the returned record is coherent even if the trigger ordering differs).
  UPDATE public.exams SET current_edition_id = v_edition_id WHERE id = v_exam_id;

  RETURN jsonb_build_object(
    'exam_id', v_exam_id,
    'edition_id', v_edition_id
  );
END;
$$;

-- Execute as the authenticated CMS users (and service_role for server paths).
-- No superuser/definer escalation: the body runs with the invoker's privileges.
REVOKE ALL ON FUNCTION public.create_exam_with_edition(jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.create_exam_with_edition(jsonb, jsonb) TO authenticated, service_role;
