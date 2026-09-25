
-- Add tsvector column for full-text search
ALTER TABLE public.sarkari_naukri ADD COLUMN IF NOT EXISTS fts tsvector;

-- Populate fts from existing data
UPDATE public.sarkari_naukri SET fts = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(organization, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(department, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'C');

-- Create GIN index for fast text search
CREATE INDEX IF NOT EXISTS idx_sarkari_naukri_fts ON public.sarkari_naukri USING gin(fts);

-- Trigger to auto-update fts on insert/update
CREATE OR REPLACE FUNCTION public.sarkari_naukri_fts_update() RETURNS trigger AS $$
BEGIN
  NEW.fts := 
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.organization, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.department, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sarkari_naukri_fts ON public.sarkari_naukri;
CREATE TRIGGER trg_sarkari_naukri_fts
  BEFORE INSERT OR UPDATE OF title, organization, department, category
  ON public.sarkari_naukri
  FOR EACH ROW EXECUTE FUNCTION public.sarkari_naukri_fts_update();
;
