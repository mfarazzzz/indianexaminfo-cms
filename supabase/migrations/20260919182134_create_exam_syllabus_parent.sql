-- Parent table for exam-level syllabus metadata: one row per exam.
-- Holds the syllabus-level `notes` (which exam_syllabus_subjects has nowhere for) and
-- `weightage_type` (moved off exams.syllabus_weightage_type). exam_syllabus_subjects
-- stays the child (subject rows). RLS mirrors exam_syllabus_subjects exactly.
CREATE TABLE IF NOT EXISTS public.exam_syllabus (
  exam_id        uuid PRIMARY KEY REFERENCES public.exams(id) ON DELETE CASCADE,
  notes          text,
  weightage_type text CHECK (weightage_type IN ('marks','questions','percent')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exam_syllabus IS
  'Exam-level syllabus metadata (one row per exam): syllabus-level notes + weightage_type. Child rows live in exam_syllabus_subjects.';

ALTER TABLE public.exam_syllabus ENABLE ROW LEVEL SECURITY;

-- Read: public sees rows for published exams; staff see all.
CREATE POLICY public_read_exam_syllabus ON public.exam_syllabus
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.exams WHERE exams.id = exam_syllabus.exam_id AND exams.is_published = true
  ));
CREATE POLICY staff_read_all_exam_syllabus ON public.exam_syllabus
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Write: gated by create_exam|edit_any_exam, with WITH CHECK on both INSERT and UPDATE.
CREATE POLICY exam_syllabus_insert ON public.exam_syllabus
  FOR INSERT WITH CHECK (
    current_user_has_permission('create_exam') OR current_user_has_permission('edit_any_exam')
  );
CREATE POLICY exam_syllabus_update ON public.exam_syllabus
  FOR UPDATE
  USING (current_user_has_permission('create_exam') OR current_user_has_permission('edit_any_exam'))
  WITH CHECK (current_user_has_permission('create_exam') OR current_user_has_permission('edit_any_exam'));

-- Delete: admin / super-admin only (mirrors the subjects table).
CREATE POLICY admin_delete_exam_syllabus ON public.exam_syllabus
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id
    WHERE up.id = auth.uid() AND r.slug = ANY (ARRAY['super-admin','admin'])
  ));;
