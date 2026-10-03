-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSED — NOT APPLIED. Design doc: docs/design/admission-counselling-model.md §4.
-- D1/D2 — flexible event rows. Promote exam_editions.important_dates (JSONB) into a
-- first-class exam_events table: custom label, single date OR range, optional time,
-- optional phase/round, an explicit kind (so status is computed, not label-guessed),
-- done/next derived from today (never stored).
-- Backfill is loss-free from important_dates. During cut-over, keep important_dates
-- as a read-only projection; drop it only after e1_exam_status_fn + both sites read
-- exam_events. Move the revalidation trigger (20260930171935) off important_dates.
-- ══════════════════════════════════════════════════════════════════════════════

-- Event kind: reuse the vocabulary the current status view infers from labels
-- (exam_derived_status v3 lines 39-69) but make it explicit + add counselling stages.
-- CREATE TYPE exam_event_kind AS ENUM ( ... )  -- final list TBD with owner; see §4.

CREATE TABLE IF NOT EXISTS exam_events (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid NOT NULL REFERENCES exam_editions(id) ON DELETE CASCADE,
  kind         text NOT NULL,                     -- application_end, counselling, seat_allotment, ...
  label        text NOT NULL,                     -- editor's display text
  date_start   date NOT NULL,
  date_end     date,                              -- NULL = single date; set = range
  time_text    text,                              -- optional, e.g. "10:00–12:00"
  phase        text,                              -- optional phase tag
  round        text,                              -- optional round tag (links counselling)
  state        text NOT NULL DEFAULT 'confirmed'
               CHECK (state IN ('confirmed','expected','tentative','postponed','cancelled')),
  source_quote text,                              -- verbatim line from the notice (AI Fill)
  sort         integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL default now(),
  updated_at   timestamptz NOT NULL default now()
);
CREATE INDEX IF NOT EXISTS exam_events_edition_idx ON exam_events(edition_id, date_start);
CREATE INDEX IF NOT EXISTS exam_events_kind_idx    ON exam_events(kind);

-- ── Backfill from important_dates (loss-free) ──────────────────────────────────
-- type→kind; label-inferred kind when .type was empty (align with the view);
-- stage_label→phase; state→state; date→date_start (no end/time — new fields left NULL).
-- INSERT INTO exam_events (edition_id, kind, label, date_start, state, phase)
-- SELECT ee.id,
--        COALESCE(NULLIF(d->>'type',''), <label-inference>),
--        d->>'label',
--        (d->>'date')::date,
--        COALESCE(NULLIF(d->>'state',''),'confirmed'),
--        d->>'stage_label'
-- FROM exam_editions ee
-- CROSS JOIN LATERAL jsonb_array_elements(COALESCE(NULLIF(ee.important_dates,'null'::jsonb),'[]'::jsonb)) d
-- WHERE (d->>'date') IS NOT NULL AND (d->>'date') <> '';
