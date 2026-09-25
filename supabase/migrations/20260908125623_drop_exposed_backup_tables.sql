-- Drop four backup tables that had RLS disabled (readable/writable via anon key).
-- All verified as superseded backups this week. Dropping removes the exposure.
DROP TABLE IF EXISTS public._backup_20260830_dragproof_ctet;
DROP TABLE IF EXISTS public._backup_20260830_vacancy_elig;
DROP TABLE IF EXISTS public._backup_20260902_date_state;
DROP TABLE IF EXISTS public._backup_20260902_date_type;;
