
-- =============================================================================
-- ENTRANCE EXAM EDITORIAL WORKFLOW: exam_editions table + schema changes
-- =============================================================================

-- 1. Create edition_status enum (granular 10-state lifecycle)
DO $$ BEGIN
  CREATE TYPE edition_status AS ENUM (
    'upcoming',
    'notification-released',
    'registration-open',
    'registration-closed',
    'admit-card-released',
    'exam-conducted',
    'answer-key-released',
    'result-declared',
    'counselling',
    'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create exam_editions table
CREATE TABLE IF NOT EXISTS exam_editions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id           uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  year              integer NOT NULL,
  session           text NOT NULL DEFAULT 'main',
  edition_label     text NOT NULL,
  is_current        boolean NOT NULL DEFAULT false,

  -- Status & lifecycle
  status            edition_status NOT NULL DEFAULT 'upcoming',
  notification_date date,

  -- Temporal data (edition-specific)
  important_dates   jsonb NOT NULL DEFAULT '[]'::jsonb,
  eligibility       jsonb NOT NULL DEFAULT '{}'::jsonb,
  vacancy           integer,
  application_fee   jsonb NOT NULL DEFAULT '{}'::jsonb,
  age_limit         jsonb,

  -- Content availability flags for this edition
  has_notification  boolean NOT NULL DEFAULT false,
  has_application   boolean NOT NULL DEFAULT false,
  has_admit_card    boolean NOT NULL DEFAULT false,
  has_syllabus      boolean NOT NULL DEFAULT false,
  has_answer_key    boolean NOT NULL DEFAULT false,
  has_result        boolean NOT NULL DEFAULT false,
  has_cutoff        boolean NOT NULL DEFAULT false,
  has_counselling   boolean NOT NULL DEFAULT false,

  -- Edition-specific SEO (overrides exam-level when viewing this edition)
  seo_title         text,
  seo_description   text,

  -- Archival data for completed editions
  result_summary    jsonb,
  counselling_data  jsonb,

  -- Timestamps
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT uq_exam_edition_year_session UNIQUE (exam_id, year, session),
  CONSTRAINT chk_edition_year CHECK (year >= 2000 AND year <= 2100),
  CONSTRAINT chk_edition_session CHECK (session IN ('main', 'session-1', 'session-2', 'supplementary', 'special'))
);

-- 3. Partial unique index: exactly one current edition per exam
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_current_edition
  ON exam_editions(exam_id) WHERE is_current = true;

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_editions_exam_id ON exam_editions(exam_id);
CREATE INDEX IF NOT EXISTS idx_editions_current ON exam_editions(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_editions_year ON exam_editions(year DESC);
CREATE INDEX IF NOT EXISTS idx_editions_status ON exam_editions(status);

-- 5. Add cycle_frequency column to exams
ALTER TABLE exams ADD COLUMN IF NOT EXISTS cycle_frequency text
  NOT NULL DEFAULT 'annual';

-- Add check constraint separately (idempotent approach)
DO $$ BEGIN
  ALTER TABLE exams ADD CONSTRAINT chk_cycle_frequency
    CHECK (cycle_frequency IN ('annual', 'biannual', 'irregular'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Add current_edition_id FK to exams
ALTER TABLE exams ADD COLUMN IF NOT EXISTS current_edition_id uuid
  REFERENCES exam_editions(id) ON DELETE SET NULL;

-- 7. Add exam_edition_id FK to content_posts
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS exam_edition_id uuid
  REFERENCES exam_editions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_posts_edition
  ON content_posts(exam_edition_id) WHERE exam_edition_id IS NOT NULL;

-- 8. Trigger: maintain current_edition_id on exams when is_current changes
CREATE OR REPLACE FUNCTION maintain_current_edition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    -- Deactivate any other current edition for this exam
    UPDATE exam_editions
    SET is_current = false, updated_at = now()
    WHERE exam_id = NEW.exam_id
      AND id != NEW.id
      AND is_current = true;

    -- Update the denormalized pointer on exams
    UPDATE exams
    SET current_edition_id = NEW.id, updated_at = now()
    WHERE id = NEW.exam_id;
  END IF;

  -- If we just unset current and nothing else is current, null out the pointer
  IF NEW.is_current = false AND OLD IS NOT NULL AND OLD.is_current = true THEN
    UPDATE exams
    SET current_edition_id = NULL, updated_at = now()
    WHERE id = NEW.exam_id
      AND NOT EXISTS (
        SELECT 1 FROM exam_editions
        WHERE exam_id = NEW.exam_id AND is_current = true AND id != NEW.id
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists then create (idempotent)
DROP TRIGGER IF EXISTS trg_maintain_current_edition ON exam_editions;
CREATE TRIGGER trg_maintain_current_edition
  AFTER INSERT OR UPDATE OF is_current ON exam_editions
  FOR EACH ROW EXECUTE FUNCTION maintain_current_edition();

-- 9. updated_at trigger for exam_editions
DROP TRIGGER IF EXISTS set_updated_at ON exam_editions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON exam_editions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10. RLS policies
ALTER TABLE exam_editions ENABLE ROW LEVEL SECURITY;

-- Public read (frontend needs to read editions)
CREATE POLICY "public_read_exam_editions" ON exam_editions
  FOR SELECT USING (true);

-- Staff can do everything when authenticated
CREATE POLICY "staff_write_exam_editions" ON exam_editions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "staff_update_exam_editions" ON exam_editions
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_delete_exam_editions" ON exam_editions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid() AND r.slug IN ('super-admin', 'admin')
    )
  );
;
