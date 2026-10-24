-- ─────────────────────────────────────────────────────────────────────────────
-- PROPOSED — DO NOT move into supabase/migrations/ without the owner's approval.
--
-- PHASE D3 (R2.5) — save_exam_page RPC. A SINGLE page-level Save that writes the
-- dirty sections of one exam atomically, under the caller's own RLS. This is a
-- DESIGN PROPOSAL for review; it is NOT applied and NOT built this batch.
--
-- Locked decisions honoured (docs/design/r2-s3-s4-plan.md):
--   • one page-level Save with per-section dirty markers; no section silently
--     publishes;
--   • verify reuses publish_exam (there is NO verify_exam slug) — the existing
--     trg_enforce_exam_verify trigger still gates is_verified/verified_*;
--   • counselling rounds stay JSONB (exam_editions.counselling_data);
--   • an update's own PDF lives in content_posts.attachment_urls; browsable papers
--     live in exam_resources.
--
-- SECURITY INVOKER (NOT DEFINER): every write below runs as the signed-in editor,
-- so the exams / exam_editions / content_posts / exam_resources RLS policies AND the
-- publish/verify enforcement triggers apply exactly as they do for the current
-- per-section saves. The RPC does not bypass anything.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.save_exam_page(
  p_exam_id        uuid,
  p_base_updated_at timestamptz,   -- the exam_editions.updated_at the editor LOADED
  p_payload        jsonb           -- { exams?:{...}, edition?:{...}, content_modules?:{...},
                                   --   posts?:[...], resources?:[...] } — only dirty sections
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp     -- pinned (advisor A3 discipline)
AS $fn$
DECLARE
  v_edition_id  uuid;
  v_now_updated timestamptz;
  v_key         text;
  v_forbidden   text[] := ARRAY['is_verified','verified_at','verified_by','workflow_status','is_published','status'];
BEGIN
  -- ── 0. The forbidden-field guard. No Save path may flip verification or publish
  --      state through this RPC — those go through the dedicated publish/verify
  --      actions (which the triggers gate). Reject the whole call if present. ──
  FOR v_key IN SELECT jsonb_object_keys(p_payload -> 'edition') LOOP
    IF v_key = ANY (v_forbidden) THEN
      RAISE EXCEPTION 'save_exam_page: field "%" is not writable via Save (use Publish/Verify)', v_key
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;

  -- ── 1. Stale-edition (optimistic concurrency). The editor sends the edition
  --      updated_at it loaded; if the row moved underneath it, abort with a typed
  --      conflict so the CMS can show "someone else changed this — reload". ──
  SELECT ed.id, ed.updated_at INTO v_edition_id, v_now_updated
    FROM public.exams e
    JOIN public.exam_editions ed ON ed.id = e.current_edition_id
   WHERE e.id = p_exam_id;

  IF v_edition_id IS NULL THEN
    RAISE EXCEPTION 'save_exam_page: no current edition for exam %', p_exam_id
      USING ERRCODE = 'no_data_found';
  END IF;
  IF p_base_updated_at IS DISTINCT FROM v_now_updated THEN
    -- Typed conflict the client recognises (SQLSTATE 40001 = serialization_failure).
    RAISE EXCEPTION 'save_exam_page:conflict:stale_edition'
      USING ERRCODE = '40001',
            HINT = jsonb_build_object('base', p_base_updated_at, 'current', v_now_updated)::text;
  END IF;

  -- ── 2. Ordered writes, each guarded by RLS. Any failure aborts the whole
  --      function (it runs inside the caller's transaction), so the page is
  --      all-saved or all-unchanged — no half-written record. ──
  IF p_payload ? 'exams' THEN
    UPDATE public.exams e SET
      name            = COALESCE(p_payload->'exams'->>'name', e.name),
      short_name      = COALESCE(p_payload->'exams'->>'shortName', e.short_name),
      conducting_body = COALESCE(p_payload->'exams'->>'conductingBody', e.conducting_body),
      official_website= COALESCE(p_payload->'exams'->>'officialWebsite', e.official_website)
      -- (extend with the identity columns the Basics section edits; NEVER the
      --  forbidden list above)
    WHERE e.id = p_exam_id;
  END IF;

  IF p_payload ? 'edition' OR p_payload ? 'content_modules' THEN
    UPDATE public.exam_editions ed SET
      important_dates  = COALESCE(p_payload->'edition'->'importantDates', ed.important_dates),
      vacancy          = COALESCE((p_payload->'edition'->>'vacancy')::int, ed.vacancy),
      eligibility      = COALESCE(p_payload->'edition'->'eligibility', ed.eligibility),
      application_fee  = COALESCE(p_payload->'edition'->'applicationFee', ed.application_fee),
      counselling_data = COALESCE(p_payload->'edition'->'counsellingData', ed.counselling_data),
      content_modules  = COALESCE(p_payload->'content_modules', ed.content_modules),
      updated_at       = now(),
      updated_by       = auth.uid()
    WHERE ed.id = v_edition_id;
  END IF;

  -- content_posts / exam_resources: upsert the dirty rows the editor changed.
  -- (Representative — the exact column set mirrors the per-section services.)
  IF p_payload ? 'posts' THEN
    INSERT INTO public.content_posts AS cp (exam_id, content_type, title, content, status, updated_at, updated_by)
    SELECT p_exam_id, x->>'content_type', x->>'title', x->>'content', 'draft', now(), auth.uid()
      FROM jsonb_array_elements(p_payload->'posts') AS x
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, updated_at = now();
  END IF;

  RETURN jsonb_build_object('ok', true, 'exam_id', p_exam_id, 'edition_updated_at', v_now_updated);
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- APPLY-TIME CHECKS (read-only first, then a forced-rollback txn like D1/D2):
--   • a non-privileged editor (no edit_any_exam, not the owner) is rejected by RLS
--     on the UPDATEs (SECURITY INVOKER);
--   • a payload carrying is_verified/workflow_status raises insufficient_privilege;
--   • a stale p_base_updated_at raises SQLSTATE 40001 with the conflict hint;
--   • a valid Save writes only the dirty sections and leaves verified_* untouched.
-- ROLLBACK: DROP FUNCTION public.save_exam_page(uuid, timestamptz, jsonb);
-- ─────────────────────────────────────────────────────────────────────────────
