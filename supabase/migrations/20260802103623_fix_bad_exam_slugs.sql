
-- Fix slugs that have uppercase letters, double dashes, or trailing dashes
UPDATE exams 
SET slug = regexp_replace(
  regexp_replace(
    regexp_replace(lower(slug), '[^a-z0-9-]', '-', 'g'),  -- replace non-alphanumeric with dash
    '-{2,}', '-', 'g'                                       -- collapse multiple dashes
  ),
  '^-|-$', '', 'g'                                          -- remove leading/trailing dashes
)
WHERE slug ~ '[A-Z]' OR slug ~ '--' OR slug ~ '^-|-$' OR slug ~ '[^a-z0-9-]';
;
