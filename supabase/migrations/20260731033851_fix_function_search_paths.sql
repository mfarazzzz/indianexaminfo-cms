
-- Fix search_path on the new fts trigger function
CREATE OR REPLACE FUNCTION public.sarkari_naukri_fts_update() RETURNS trigger 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.fts := 
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.organization, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.department, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$;
;
