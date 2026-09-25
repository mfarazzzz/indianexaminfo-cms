
-- These backup tables (created during step 2a and step 4) were left exposed to
-- PostgREST with no RLS — anon could read exam data from them. They are admin-only
-- recovery artifacts. Enable RLS with no policies = deny all via the API (service
-- role / direct SQL still works for restore).
alter table if exists _backup_step2a_20260908 enable row level security;
alter table if exists _backup_step4_exams_cols_20260908 enable row level security;
;
