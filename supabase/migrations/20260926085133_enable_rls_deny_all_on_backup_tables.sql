-- Close-out: the three data-operation backup tables are exposed to PostgREST with
-- RLS disabled (flagged by the security advisor). Enable RLS with NO policies, which
-- denies all access through the API to anon/authenticated while leaving the data
-- intact for the service role / direct SQL (used for any rollback). Not dropped yet.
alter table public.uni_merge_backup_20260925 enable row level security;
alter table public.admission_move_backup_20260925 enable row level security;
alter table public.region_seed_backup_20260713000021 enable row level security;
