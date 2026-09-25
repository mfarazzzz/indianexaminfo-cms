-- One home for previous papers and study material: those two now live on the
-- content-type page (content_modules), not the resource library. Stop the library
-- from accepting them going forward. Existing rows are grandfathered via NOT VALID
-- so the single legacy previous-paper row survives untouched — this is only about
-- what can be added from now on.
ALTER TABLE public.exam_resources
  DROP CONSTRAINT exam_resources_kind_check;

ALTER TABLE public.exam_resources
  ADD CONSTRAINT exam_resources_kind_check
  CHECK (kind = ANY (ARRAY['mock-test'::text, 'sample-paper'::text, 'syllabus-pdf'::text]))
  NOT VALID;

COMMENT ON CONSTRAINT exam_resources_kind_check ON public.exam_resources IS
  'Allowed resource kinds. previous-paper and study-material were removed 2026-09 — those content types now live on the content-type page (content_modules), not the library. NOT VALID grandfathers the one pre-existing previous-paper row; all new inserts/updates are blocked.';;
