-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSED — NOT APPLIED. Design doc §5 (C2).
-- Structured counselling rounds for merit/internal-admission routes (UP D.El.Ed, etc.).
-- Round STATUS is COMPUTED from these dates by exam_computed_status (e1_exam_status_fn.sql)
-- — it is NEVER hand-typed.
--
-- ⚠ FIELD LIST IS A GUESS. The task says "all fields in the owner's list" but the issue
--   document was not readable in this session. Reconcile every column below against the
--   owner's exact field list before this slice is approved (design doc §11 GAP (a)).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS counselling_rounds (
  id                     uuid primary key default gen_random_uuid(),
  edition_id             uuid NOT NULL REFERENCES exam_editions(id) ON DELETE CASCADE,
  round_label            text NOT NULL,          -- "Phase 1", "Round 2", ...
  phase                  text,
  registration_start     date,
  registration_end       date,
  choice_filling_start   date,
  choice_filling_end     date,
  fee_last_date          date,
  round_start_date       date,
  allotment_date         date,                   -- seat allotment result
  reporting_start        date,
  reporting_end          date,
  seat_allotment_url     text,
  docs_required          text[],
  notes                  text,
  source_quote           text,                   -- verbatim line from the notice (AI Fill)
  sort                   integer NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL default now(),
  updated_at             timestamptz NOT NULL default now()
);
CREATE INDEX IF NOT EXISTS counselling_rounds_edition_idx ON counselling_rounds(edition_id, sort);
