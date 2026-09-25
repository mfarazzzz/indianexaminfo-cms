-- Drop exams.syllabus_highlights. Every value is verified-copied into
-- exam_syllabus_subjects (8 exams from this column, position-for-position equal;
-- 2 exams sourced from the module blob). A subject-by-subject equality guard
-- returned zero mismatches immediately before this. The structured store
-- (exam_syllabus_subjects) is now the single source of truth for syllabus.
ALTER TABLE public.exams DROP COLUMN syllabus_highlights;;
