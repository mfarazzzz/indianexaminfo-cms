-- Attribution: who last edited exams / exam_editions / sarkari_naukri. Column + trigger.
ALTER TABLE public.exams            ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);
ALTER TABLE public.exam_editions   ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);
ALTER TABLE public.sarkari_naukri  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Trigger fills updated_by from auth.uid() on every UPDATE — cannot be forgotten like the
-- service layer was. When there is no end user (server/service job, auth.uid() IS NULL),
-- preserve whatever the caller set (or leave NULL) rather than blanking it.
CREATE OR REPLACE FUNCTION public.set_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_by ON public.exams;
CREATE TRIGGER trg_set_updated_by BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();

DROP TRIGGER IF EXISTS trg_set_updated_by ON public.exam_editions;
CREATE TRIGGER trg_set_updated_by BEFORE UPDATE ON public.exam_editions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();

DROP TRIGGER IF EXISTS trg_set_updated_by ON public.sarkari_naukri;
CREATE TRIGGER trg_set_updated_by BEFORE UPDATE ON public.sarkari_naukri
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();;
