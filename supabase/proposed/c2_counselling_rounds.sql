-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSED — NOT APPLIED. Design doc §5 (C2).
-- Owner change #3: counselling_rounds holds METADATA ONLY. Every date WINDOW is a
-- row in exam_editions.important_dates linked by important_dates[].round_id (see
-- d1_important_dates_extension.sql) — there are NO date columns on this table, so
-- there is only ONE date source. Round STATUS is COMPUTED from those linked date
-- rows by exam_computed_status (e1_exam_status_fn.sql); it is NEVER stored here.
--
-- Field list is the owner's verbatim list (Phase-3 example values in comments).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS counselling_rounds (
  id                     uuid primary key default gen_random_uuid(),
  edition_id             uuid NOT NULL REFERENCES exam_editions(id) ON DELETE CASCADE,
  round_label            text NOT NULL,                -- phase label, e.g. "Phase-3"
  round_order            integer NOT NULL DEFAULT 0,   -- orders rounds (replaces `sort`)
  rank_from              integer,                      -- eligible rank band low  (e.g. 1)
  rank_to                integer,                      -- eligible rank band high (e.g. 152202)
  eligibility_text       text,                         -- e.g. "not yet allotted an institution"
  seat_note              text,                         -- e.g. "unfilled OBC/SC/ST/special-reserved seats converted to unreserved"
  fee_amount             numeric(12,2),                -- e.g. 5000
  fee_label              text,                         -- e.g. "choice-filling fee"
  notice_resource_id     uuid REFERENCES exam_resources(id) ON DELETE SET NULL, -- the round's notice
  source_quote           text,                         -- verbatim line from the notice (AI Fill)
  created_at             timestamptz NOT NULL default now(),
  updated_at             timestamptz NOT NULL default now()
  -- NO date/time columns here (owner #3). NO round_status column (computed in e1).
);
CREATE INDEX IF NOT EXISTS counselling_rounds_edition_idx ON counselling_rounds(edition_id, round_order);

-- Linked windows are important_dates rows keyed by round_id, e.g.:
--   {label:"Choice filling & payment", date:"2026-10-05", start_time:"13:00",
--    end_date:"2026-10-07", end_time:"18:00", round_id:<this row>, type:"choice_filling"}
--   {label:"Seat allotment",  date:"2026-10-08", round_id:<this row>, type:"seat_allotment"}
--   {label:"Reporting / DV",  date:"2026-10-09", end_date:"2026-10-14", end_time:"17:00",
--    round_id:<this row>, type:"reporting"}
--   {label:"Institution lock",date:"2026-10-15", round_id:<this row>, type:"institution_lock"}
