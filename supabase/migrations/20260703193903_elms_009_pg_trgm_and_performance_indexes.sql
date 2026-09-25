
-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigger-maintained tsvector column for entity FTS
ALTER TABLE entity ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Function to update search_vector
CREATE OR REPLACE FUNCTION update_entity_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english',
      coalesce(NEW.name, '') || ' ' ||
      coalesce(NEW.short_name, '') || ' ' ||
      coalesce(NEW.conducting_body, '') || ' ' ||
      coalesce(array_to_string(NEW.tags, ' '), '') || ' ' ||
      coalesce(array_to_string(NEW.search_keywords, ' '), '')
    );
  RETURN NEW;
END;
$$;

-- Trigger on entity
DROP TRIGGER IF EXISTS entity_search_vector_trigger ON entity;
CREATE TRIGGER entity_search_vector_trigger
  BEFORE INSERT OR UPDATE ON entity
  FOR EACH ROW EXECUTE FUNCTION update_entity_search_vector();

-- Backfill existing rows
UPDATE entity SET name = name WHERE deleted_at IS NULL;

-- GIN index on search_vector
CREATE INDEX IF NOT EXISTS idx_entity_fts
  ON entity USING gin(search_vector)
  WHERE deleted_at IS NULL;

-- Trigram index for ILIKE queries
CREATE INDEX IF NOT EXISTS idx_entity_name_trgm
  ON entity USING gin(name gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Covering index for list view queries
CREATE INDEX IF NOT EXISTS idx_entity_list_cover
  ON entity(pillar, workflow_status, updated_at DESC)
  INCLUDE (id, slug, name, is_featured, priority)
  WHERE deleted_at IS NULL;

-- Partial index for scheduled publish cron (tiny set)
CREATE INDEX IF NOT EXISTS idx_entity_scheduled
  ON entity(scheduled_publish_at)
  WHERE workflow_status = 'scheduled' AND deleted_at IS NULL;

-- Timeline display ordering
CREATE INDEX IF NOT EXISTS idx_timeline_display
  ON entity_timeline_event(entity_id, display_order, event_date)
  WHERE deleted_at IS NULL AND visibility = 'public';

-- Download + link indexes
CREATE INDEX IF NOT EXISTS idx_download_visible
  ON entity_download(entity_id, is_visible) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_link_status
  ON entity_link(entity_id, status) WHERE deleted_at IS NULL;
;
