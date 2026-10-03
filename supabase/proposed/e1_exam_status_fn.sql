-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSED — NOT APPLIED. Design doc §6 (E1). Mirror of the content_has_data contract.
-- E1 — ONE computed status over the EXTENDED important_dates (§4) + counselling_rounds
-- metadata (§5), with a clearly-marked manual override, plus the MISSING counselling
-- stages the current exam_derived_status VIEW never produces. Owner change #6: this
-- function REPLACES the view's inline CASE (see the cut-over at the bottom).
--
-- This is a PURE function over jsonb (like public.content_has_data(view jsonb, section))
-- so the SAME fixtures can be fed to this SQL and to the TS mirrors:
--   - frontend: indianexaminfo-frontend/lib/sectionRegistry.ts (status mirror)
--   - CMS:      indianexaminfo-cms/src/lib/sectionRegistry.ts   (status mirror)
--   - SQL:      this file
-- Parity pinned by shared fixtures + embedded sha256 in BOTH repos, modelled on
--   contentHasData.contract.test.ts (frontend, anchor) + contentHasData.parity.test.ts
--   (CMS, PGlite — real PL/pgSQL, no live DB, no production data).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.exam_computed_status(
  important_dates    jsonb,  -- [{label,date,end_date,start_time,end_time,round_id,type,state}]
  counselling_rounds jsonb,  -- [{id,round_label,round_order}] — metadata only, for stage LABELS
  manual_override   text     -- stored exams.status for genuine record-level decisions (e.g. cancelled)
) RETURNS text
LANGUAGE plpgsql STABLE            -- reads "today"; caller may pass a pinned date in the fixtures
AS $$
DECLARE
  today_ist date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  -- Manual override wins (mirrors exam_derived_status v3 lines 16-17, 166-167: the VIEW
  -- never invents 'cancelled'; that is an editorial decision).
  IF manual_override IS NOT NULL AND manual_override <> '' THEN
    RETURN manual_override;
  END IF;

  -- ── NEW: counselling stages (absent today) ──────────────────────────────────
  -- Highest-priority live stage wins. Order:
  --   Reporting open → Allotment out → Choice filling open → Registration open → round scheduled.
  -- Stage = today inside a linked important_dates window [date..end_date] (+ times), joined
  -- to counselling_rounds.round_label for the display name:
  -- IF EXISTS (row d WHERE d.type='reporting' AND today_ist BETWEEN d.date AND COALESCE(d.end_date,d.date))
  --   THEN RETURN 'reporting-open';
  -- IF EXISTS (row d WHERE d.type='seat_allotment' AND today_ist >= d.date)
  --   THEN RETURN 'allotment-out';
  -- IF EXISTS (row d WHERE d.type='choice_filling' AND today_ist BETWEEN d.date AND COALESCE(d.end_date,d.date))
  --   THEN RETURN 'choice-filling-open';
  -- (label produced by the TS/SQL mirror, e.g. "Counselling – Phase 3: choice filling open",
  --  joining d.round_id -> counselling_rounds.round_label)

  -- ── Fallback: existing exam-lifecycle status (port the CASE from
  --    exam_derived_status v3 lines 162-220, keyed off important_dates[].type; the
  --    label-LIKE inference on lines 39-69 stays ONLY as a backstop for legacy rows
  --    that have no .type). ──
  -- RETURN <one of: postponed | result-declared | result-awaited | ongoing | admit-card-out
  --                 | registration-closed | registration-open | notified | upcoming | dates-awaited>;

  RETURN 'dates-awaited';  -- placeholder until the real rules are filled in on approval
END;
$$;

-- ── Owner change #6 — CUT-OVER: the function REPLACES the view's inline CASE ──────
-- Step 1: create this function (above). Nothing consumes it yet.
-- Step 2: recreate the view as a PROJECTION of the function; the old inline CASE
--         (migrations/20260902122910 lines 162-220) is DELETED from the view body:
--
--   CREATE OR REPLACE VIEW exam_derived_status AS
--     SELECT e.id AS exam_id, e.slug, e.pillar,
--            public.exam_computed_status(
--              ce.important_dates,                       -- extended rows (§4)
--              round_agg.rounds,                         -- metadata (§5)
--              e.status                                  -- manual override
--            ) AS derived_status,
--            v.has_confirmed_dates, v.admit_card_date, v.result_date, v.strip_eligible
--     FROM exams e
--     JOIN exam_editions ce ON ce.id = e.current_edition_id
--     LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object(
--                          'id',r.id,'round_label',r.round_label,'round_order',r.round_order))
--                        AS rounds FROM counselling_rounds r WHERE r.edition_id = ce.id) round_agg ON TRUE
--     LEFT JOIN <existing confirmed-dates lateral> v ON TRUE;   -- columns readers already select
--
-- Step 3: readers UNCHANGED — fetchDerivedStatuses still selects exam_id, derived_status,
--         strip_eligible, has_confirmed_dates, admit_card_date, result_date from the same
--         view name. Re-apply GRANT SELECT ON exam_derived_status TO anon, authenticated.
-- Step 4: prove parity (new fn vs old view over every live edition + fixtures) BEFORE the
--         old inline CASE is dropped. After step 2 there is exactly ONE status algorithm.
