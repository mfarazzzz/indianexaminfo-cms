-- exams.type_fields: 0/403 populated, superseded by exam_editions module data.
-- CMS reads it via SELECT * (tolerates missing column) and writes only when a
-- caller passes typeFields (UI no longer does). Dead column — drop it.
ALTER TABLE public.exams DROP COLUMN IF EXISTS type_fields;;
