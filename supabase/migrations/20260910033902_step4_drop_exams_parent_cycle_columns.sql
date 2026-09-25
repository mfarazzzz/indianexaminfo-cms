
-- STEP 4: drop the 17 parent/cycle/flag columns from `exams`. All data now lives on
-- exam_editions (cycle) or is derived (status via exam_derived_status VIEW).
-- Backup: _backup_step4_exams_cols_20260908. Code readers/writers removed and deployed
-- (frontend 6d4fdd3, CMS f876813). VIEW exam_derived_status confirmed independent of all 17.
alter table exams
  drop column if exists status,
  drop column if exists has_admit_card,
  drop column if exists has_result,
  drop column if exists has_answer_key,
  drop column if exists has_syllabus,
  drop column if exists has_date_sheet,
  drop column if exists has_mock_test,
  drop column if exists has_previous_papers,
  drop column if exists has_study_material,
  drop column if exists has_application,
  drop column if exists has_notification,
  drop column if exists has_cutoff,
  drop column if exists important_dates,
  drop column if exists vacancy,
  drop column if exists eligibility,
  drop column if exists application_fee,
  drop column if exists last_updated;
;
