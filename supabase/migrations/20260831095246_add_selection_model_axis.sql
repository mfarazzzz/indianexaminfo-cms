
-- Axis 2: how a candidate is selected. Tight 4-value enum; growable later via ALTER TYPE ADD VALUE.
CREATE TYPE selection_model AS ENUM (
  'written-exam',
  'merit-based',
  'interview-based',
  'internal-admission'
);

-- All 402 rows keep current behaviour until positively reclassified.
ALTER TABLE exams
  ADD COLUMN selection_model selection_model NOT NULL DEFAULT 'written-exam';
;
