
-- ELMS-003: Create module_block table (page builder blocks)
-- block_type is free-text — extensible without schema changes.

CREATE TABLE IF NOT EXISTS module_block (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     uuid NOT NULL REFERENCES entity_module(id) ON DELETE CASCADE,
  block_type    text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  content       jsonb NOT NULL DEFAULT '{}',
  is_visible    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_block_module ON module_block(module_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_block_type   ON module_block(block_type)               WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_module_block_updated_at'
  ) THEN
    CREATE TRIGGER set_module_block_updated_at
      BEFORE UPDATE ON module_block
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
;
