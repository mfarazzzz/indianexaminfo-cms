-- Requirement 7.2, 7.5: Slug uniqueness check function
CREATE OR REPLACE FUNCTION check_slug_available(
  p_slug text,
  p_conducting_body_id uuid,
  p_exclude_entity_id uuid DEFAULT NULL
)
RETURNS TABLE(is_available boolean, conflicting_entity_id uuid, conflicting_entity_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT
    NOT EXISTS(
      SELECT 1 FROM entity 
      WHERE slug = p_slug AND conducting_body_id = p_conducting_body_id
        AND deleted_at IS NULL
        AND (p_exclude_entity_id IS NULL OR id != p_exclude_entity_id)
    ),
    (SELECT e.id FROM entity e 
     WHERE e.slug = p_slug AND e.conducting_body_id = p_conducting_body_id
       AND e.deleted_at IS NULL AND (p_exclude_entity_id IS NULL OR e.id != p_exclude_entity_id)
     LIMIT 1),
    (SELECT e.name FROM entity e 
     WHERE e.slug = p_slug AND e.conducting_body_id = p_conducting_body_id
       AND e.deleted_at IS NULL AND (p_exclude_entity_id IS NULL OR e.id != p_exclude_entity_id)
     LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE;;
