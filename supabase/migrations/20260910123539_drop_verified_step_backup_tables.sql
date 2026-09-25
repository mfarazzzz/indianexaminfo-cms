
-- Both step backups have served their purpose and been verified live:
--  _backup_step2a_20260908  — the 6-record eligibility/fee/vacancy reconciliation (deployed, render-verified)
--  _backup_step4_exams_cols_20260908 — the 17 dropped exams.* columns (step 4 complete, pages render)
-- Keeping unprotected-by-default copies of production data around outlives their rollback value.
drop table if exists _backup_step2a_20260908;
drop table if exists _backup_step4_exams_cols_20260908;
;
