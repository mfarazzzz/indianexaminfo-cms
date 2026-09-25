
-- STEP 4 backup: snapshot all 17 columns being dropped from `exams`, for all rows,
-- before dropping. Reversible: values can be restored by joining on exam_id.
create table if not exists _backup_step4_exams_cols_20260908 as
select
  id as exam_id, slug,
  status,
  has_admit_card, has_result, has_answer_key, has_syllabus, has_date_sheet,
  has_mock_test, has_previous_papers, has_study_material,
  has_application, has_notification, has_cutoff,
  important_dates, vacancy, eligibility, application_fee, last_updated,
  now() as backed_up_at
from exams;

select count(*) as rows_backed_up from _backup_step4_exams_cols_20260908;
;
