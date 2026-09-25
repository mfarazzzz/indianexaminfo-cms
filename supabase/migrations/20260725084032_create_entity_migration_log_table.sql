-- Requirement 14.5: Migration audit log
CREATE TABLE entity_migration_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         uuid NOT NULL REFERENCES entity(id),
  field_type        text NOT NULL,
  winning_value     text,
  winning_source    text NOT NULL,
  discarded_values  jsonb DEFAULT '[]',
  resolution_method text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE entity_migration_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read migration logs
CREATE POLICY "migration_log_select_admin"
  ON entity_migration_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid() AND r.slug IN ('super-admin', 'admin')
    )
  );;
