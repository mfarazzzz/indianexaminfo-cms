
-- ELMS-002: Create entity_module table
-- One row per content section per entity. module_type is free-text (extensible).

CREATE TABLE IF NOT EXISTS entity_module (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id             uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  module_type           text NOT NULL,
  sub_title             text,
  display_order         integer NOT NULL DEFAULT 0,
  workflow_status       text NOT NULL DEFAULT 'draft',
  is_featured           boolean NOT NULL DEFAULT false,
  tags                  text[] NOT NULL DEFAULT '{}',
  scheduled_publish_at  timestamptz,
  published_at          timestamptz,
  published_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  seo_override_title    text,
  seo_override_desc     text,
  metadata              jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at            timestamptz
);

-- Unique sub_title per (entity_id, module_type) — null-safe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_module_sub_title'
  ) THEN
    ALTER TABLE entity_module
      ADD CONSTRAINT uq_module_sub_title
      UNIQUE NULLS NOT DISTINCT (entity_id, module_type, sub_title, deleted_at);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_module_entity ON entity_module(entity_id)                       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_module_type   ON entity_module(module_type)                     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_module_order  ON entity_module(entity_id, display_order)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_module_status ON entity_module(entity_id, workflow_status)      WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_entity_module_updated_at'
  ) THEN
    CREATE TRIGGER set_entity_module_updated_at
      BEFORE UPDATE ON entity_module
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
;
