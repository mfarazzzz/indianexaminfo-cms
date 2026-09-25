-- Requirement 5.1, 5.2: Fuzzy duplicate check function
CREATE OR REPLACE FUNCTION check_duplicate_entity(
  p_name text,
  p_conducting_body_id uuid DEFAULT NULL,
  p_threshold float DEFAULT 0.7
)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  workflow_status text,
  conducting_body_id uuid,
  conducting_body_name text,
  updated_at timestamptz,
  updated_by_name text,
  similarity_score float
) AS $$
DECLARE
  v_year text;
BEGIN
  v_year := substring(p_name from '\d{4}');
  
  RETURN QUERY
  WITH scored AS (
    SELECT 
      e.id,
      e.name,
      e.slug,
      e.workflow_status,
      e.conducting_body_id,
      cb.name AS conducting_body_name,
      e.updated_at,
      up.name AS updated_by_name,
      (
        similarity(e.name, p_name) * 0.6 +
        CASE WHEN p_conducting_body_id IS NOT NULL 
             AND e.conducting_body_id = p_conducting_body_id THEN 0.2 ELSE 0.0 END +
        CASE WHEN v_year IS NOT NULL AND e.name ~ v_year THEN 0.2 ELSE 0.0 END
      )::float AS similarity_score
    FROM entity e
    LEFT JOIN conducting_body cb ON cb.id = e.conducting_body_id
    LEFT JOIN user_profiles up ON up.id = e.updated_by
    WHERE e.deleted_at IS NULL
      AND similarity(e.name, p_name) > 0.3
  )
  SELECT s.*
  FROM scored s
  WHERE s.similarity_score >= p_threshold
  ORDER BY s.similarity_score DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE;;
