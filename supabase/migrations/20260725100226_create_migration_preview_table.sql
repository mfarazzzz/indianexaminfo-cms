-- Task 13.1: Dry-run infrastructure
-- entity_migration_log_preview stores dry-run output that persists even when the main transaction rolls back
-- (uses a separate insert mechanism — the preview table is ALWAYS committed)
CREATE TABLE IF NOT EXISTS entity_migration_log_preview (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL,  -- groups all entries from a single dry-run execution
  entity_id         uuid REFERENCES entity(id),
  entity_name       text,
  field_type        text NOT NULL,
  winning_value     text,
  winning_source    text NOT NULL,
  discarded_values  jsonb DEFAULT '[]',
  resolution_method text NOT NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE entity_migration_log_preview ENABLE ROW LEVEL SECURITY;

CREATE POLICY "migration_preview_select_admin"
  ON entity_migration_log_preview FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "migration_preview_insert_authenticated"
  ON entity_migration_log_preview FOR INSERT
  TO authenticated
  WITH CHECK (true);;
