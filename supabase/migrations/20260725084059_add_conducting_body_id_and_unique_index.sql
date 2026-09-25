-- Requirement 15.2: Add conducting_body_id FK to entity (nullable during migration)
ALTER TABLE entity ADD COLUMN IF NOT EXISTS conducting_body_id uuid REFERENCES conducting_body(id);

-- Requirement 7.1: Partial unique index on (conducting_body_id, slug) excluding soft-deleted
CREATE UNIQUE INDEX uq_entity_conducting_body_slug 
  ON entity(conducting_body_id, slug) WHERE deleted_at IS NULL;;
