-- Single source of truth for publish state: exams.workflow_status (draft/published/archived).
-- is_published becomes DERIVED from it via a trigger (kept as a real column so the 4 RLS
-- policies + exam_derived_status view that read it need NO change — zero teardown).
-- is_verified stays a separate axis (human fact-check), untouched.

-- 1. Enum for the three states.
DO $$ BEGIN
  CREATE TYPE exam_workflow_status AS ENUM ('draft','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add the column. Default 'published' to match today's behaviour (all 403 live).
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS workflow_status exam_workflow_status NOT NULL DEFAULT 'published';

-- 3. Backfill from the current boolean so nothing changes for readers today:
--    true -> published, false -> draft.
UPDATE public.exams
SET workflow_status = CASE WHEN is_published THEN 'published'::exam_workflow_status
                          ELSE 'draft'::exam_workflow_status END;

-- 4. Trigger: is_published is ALWAYS derived from workflow_status. Any write that
--    touches either field results in is_published = (workflow_status = 'published').
--    This makes workflow_status the sole writable source; is_published can't diverge.
CREATE OR REPLACE FUNCTION public.derive_is_published_from_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.is_published := (NEW.workflow_status = 'published');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_derive_is_published ON public.exams;
CREATE TRIGGER trg_derive_is_published
  BEFORE INSERT OR UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.derive_is_published_from_workflow();

COMMENT ON COLUMN public.exams.workflow_status IS
  'Single source of truth for publish state (draft/published/archived). is_published is DERIVED from this via trg_derive_is_published — do not write is_published directly.';
COMMENT ON COLUMN public.exams.is_published IS
  'DERIVED from workflow_status (= published) by trg_derive_is_published. Read-only in practice; write workflow_status instead. Kept as a real column so RLS policies and exam_derived_status view read it unchanged.';;
