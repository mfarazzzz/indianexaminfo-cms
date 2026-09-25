
-- Update applicable_pillars to include new pillar values alongside old ones
-- This ensures modules appear for both old and new pillar values during transition

UPDATE module_registry SET applicable_pillars = array_cat(
  applicable_pillars,
  ARRAY['government-exam']::text[]
)
WHERE 'sarkari-naukri' = ANY(applicable_pillars)
  AND NOT ('government-exam' = ANY(applicable_pillars));

UPDATE module_registry SET applicable_pillars = array_cat(
  applicable_pillars,
  ARRAY['govt-vacancy']::text[]
)
WHERE 'sarkari-bharti' = ANY(applicable_pillars)
  AND NOT ('govt-vacancy' = ANY(applicable_pillars));

UPDATE module_registry SET applicable_pillars = array_cat(
  applicable_pillars,
  ARRAY['board-exam']::text[]
)
WHERE 'board-university' = ANY(applicable_pillars)
  AND NOT ('board-exam' = ANY(applicable_pillars));

UPDATE module_registry SET applicable_pillars = array_cat(
  applicable_pillars,
  ARRAY['university-exam']::text[]
)
WHERE 'board-university' = ANY(applicable_pillars)
  AND NOT ('university-exam' = ANY(applicable_pillars));
;
