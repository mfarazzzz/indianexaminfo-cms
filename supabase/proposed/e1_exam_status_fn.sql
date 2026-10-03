-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSED — NOT APPLIED. Design doc §6 (E1). Mirror of the content_has_data contract.
-- E1 — ONE computed status over exam_events (§4) + counselling_rounds (§5), with a
-- clearly-marked manual override, plus the MISSING counselling stages the current
-- exam_derived_status VIEW never produces.
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
  events            jsonb,   -- exam_events as [{kind,date_start,date_end,state}]
  counselling_rounds jsonb,  -- counselling_rounds as [{round_label,allotment_date,reporting_start,...}]
  manual_override   text     -- stored exams.status for genuine record-level decisions (e.g. cancelled)
) RETURNS text
LANGUAGE plpgsql STABLE            -- NOT immutable: reads "today"; pass today via caller if needed
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
  -- IF EXISTS (round r WHERE r.reporting_start <= today_ist AND r.reporting_end >= today_ist)
  --   THEN RETURN 'reporting-open';
  -- IF EXISTS (round r WHERE r.allotment_date <= today_ist)
  --   THEN RETURN 'allotment-out';
  -- IF EXISTS (round r WHERE r.choice_filling_start <= today_ist AND r.choice_filling_end >= today_ist)
  --   THEN RETURN 'choice-filling-open';
  -- (labels produced by the TS/SQL mirror as "Counselling – Phase 3 open" etc. from round_label)

  -- ── Fallback: existing exam-lifecycle status (port the CASE from
  --    exam_derived_status v3 lines 162-220, but key off events.kind instead of the
  --    label-LIKE inference on lines 39-69). ──
  -- RETURN <one of: postponed | result-declared | result-awaited | ongoing | admit-card-out
  --                 | registration-closed | registration-open | notified | upcoming | dates-awaited>;

  RETURN 'dates-awaited';  -- placeholder until the real rules are filled in on approval
END;
$$;

-- Until the frontend switches to the TS mirror, keep the anon read path by wrapping it:
-- CREATE OR REPLACE VIEW exam_derived_status AS
--   SELECT e.id AS exam_id, e.slug, e.pillar,
--          public.exam_computed_status(events_json, rounds_json, e.status) AS derived_status
--   FROM ...;
-- GRANT SELECT ON exam_derived_status TO anon, authenticated;
