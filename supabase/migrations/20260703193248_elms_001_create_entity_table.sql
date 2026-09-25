
-- ELMS-001: Create entity table (universal parent for exam, job, scholarship, etc.)
-- Idempotent: uses IF NOT EXISTS

CREATE TABLE IF NOT EXISTS entity (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type           text NOT NULL DEFAULT 'exam',
  slug                  text NOT NULL,
  name                  text NOT NULL,
  short_name            text,
  conducting_body       text,
  official_website      text,
  category_id           uuid REFERENCES categories(id) ON DELETE SET NULL,
  pillar                text,
  sub_type              text,
  exam_level            text,
  exam_mode             text,
  application_mode      text,
  exam_frequency        text,
  workflow_status       text NOT NULL DEFAULT 'draft',
  is_featured           boolean NOT NULL DEFAULT false,
  priority              integer,
  featured_until        timestamptz,
  tags                  text[] NOT NULL DEFAULT '{}',
  search_keywords       text[] NOT NULL DEFAULT '{}',
  scheduled_publish_at  timestamptz,
  published_at          timestamptz,
  published_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  lang                  text NOT NULL DEFAULT 'en',
  metadata              jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at            timestamptz
);

-- Unique slug per pillar (null-safe: allows multiple deleted rows with same slug)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_entity_slug_pillar'
  ) THEN
    ALTER TABLE entity
      ADD CONSTRAINT uq_entity_slug_pillar
      UNIQUE NULLS NOT DISTINCT (slug, pillar, deleted_at);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entity_type     ON entity(entity_type)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entity_pillar   ON entity(pillar)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entity_status   ON entity(workflow_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entity_featured ON entity(is_featured, priority DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entity_updated  ON entity(updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entity_category ON entity(category_id)     WHERE deleted_at IS NULL;

-- updated_at trigger (reuse existing set_updated_at function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_entity_updated_at'
  ) THEN
    CREATE TRIGGER set_entity_updated_at
      BEFORE UPDATE ON entity
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
;
