
-- ELMS-006: All 6 structured data satellite tables

-- Eligibility (one per entity)
CREATE TABLE IF NOT EXISTS entity_eligibility (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id             uuid NOT NULL UNIQUE REFERENCES entity(id) ON DELETE CASCADE,
  min_age               integer,
  max_age               integer,
  age_relaxation        jsonb DEFAULT '[]',
  nationality           text,
  education             text,
  experience            text,
  max_attempts          integer,
  physical_standards    text,
  medical_standards     text,
  language_requirements text,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Vacancies (multiple per entity)
CREATE TABLE IF NOT EXISTS entity_vacancy (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  category      text NOT NULL DEFAULT 'total',
  label         text NOT NULL,
  value         integer NOT NULL DEFAULT 0,
  notes         text,
  display_order integer NOT NULL DEFAULT 0,
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_vacancy_entity ON entity_vacancy(entity_id) WHERE deleted_at IS NULL;

-- Fees (one per entity)
CREATE TABLE IF NOT EXISTS entity_fee (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id      uuid NOT NULL UNIQUE REFERENCES entity(id) ON DELETE CASCADE,
  general        integer,
  obc            integer,
  sc             integer,
  st             integer,
  ews            integer,
  pwd            integer,
  female         integer,
  payment_modes  text[] DEFAULT '{}',
  refund_rules   text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Exam pattern (multiple per entity)
CREATE TABLE IF NOT EXISTS entity_exam_pattern (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  stage_name        text NOT NULL,
  duration_minutes  integer,
  total_questions   integer,
  total_marks       integer,
  negative_marking  numeric(4,2),
  subjects          text[] DEFAULT '{}',
  exam_language     text,
  qualifying_marks  text,
  notes             text,
  display_order     integer NOT NULL DEFAULT 0,
  deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_exam_pattern_entity ON entity_exam_pattern(entity_id) WHERE deleted_at IS NULL;

-- Selection process (multiple per entity)
CREATE TABLE IF NOT EXISTS entity_selection_stage (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  stage_name        text NOT NULL,
  description       text,
  marks             integer,
  weightage_percent numeric(5,2),
  is_qualifying     boolean NOT NULL DEFAULT false,
  notes             text,
  display_order     integer NOT NULL DEFAULT 0,
  deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_selection_entity ON entity_selection_stage(entity_id) WHERE deleted_at IS NULL;

-- Syllabus (multiple per entity)
CREATE TABLE IF NOT EXISTS entity_syllabus_subject (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  subject_name      text NOT NULL,
  topics            text[] DEFAULT '{}',
  description       text,
  pdf_url           text,
  video_link        text,
  study_notes       text,
  books             text,
  weightage_percent numeric(5,2),
  display_order     integer NOT NULL DEFAULT 0,
  deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_syllabus_entity ON entity_syllabus_subject(entity_id) WHERE deleted_at IS NULL;
;
