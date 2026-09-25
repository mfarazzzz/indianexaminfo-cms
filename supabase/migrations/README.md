# Supabase migrations — source of truth rule

The database is the authority for what is APPLIED, but the repo must always be able
to REPRODUCE it. Every schema/policy/trigger/data change made against this project —
including changes applied through the Supabase MCP — is not finished until its
migration file exists here under the **exact version the MCP/CLI recorded**.

Workflow:
- Apply a migration (MCP `apply_migration`, or CLI).
- Immediately ensure a file `supabase/migrations/<version>_<name>.sql` exists with the
  applied SQL. If it was applied via MCP, run `supabase migration fetch` (or write the
  file by hand under the recorded version) so a future `supabase db push` sees it as
  already applied and runs nothing twice.
- Report the file path alongside the applied change.

Do NOT delete a local migration file just because it is already applied — the repo is
the disaster-recovery record. A file present locally but absent from remote history is
either (a) not yet pushed, or (b) a stale/divergent lineage — investigate, don't assume.

## Archived stale lineage
`20260713000001` … `20260713000017` were an earlier, MORE ELABORATE version of the ELMS
`entity` design track — one of the three parallel content systems from the CMS audit.
The database only ever applied a partial subset of that track (the `elms_001`..`elms_011`
migrations at versions 20260703193248..194027), and `entity` holds ~3 rows while its
sibling tables are empty. These 17 files defined ~18 objects the database does NOT have
(e.g. `user_pillar_access`, `entity_module_block`, `entity_relationship`,
`entity_amendment`, `entity_localization`, `entity_field_change_log`, `entity_slug_history`,
`entity_event_log`, `has_permission`, and a descriptive-taxonomy layer of `pillar`/
`content_type`/`category`/`department`/`exam_level`/`exam_mode`/`application_mode`/`tag`/
`taxonomy_merge_log` as TABLES — the DB has `pillar_type`/`content_type` only as enum TYPES).

They have been MOVED OUT of the run path to `supabase/_archive/elms-abandoned/` so a fresh
`db push` cannot build an abandoned taxonomy. Nothing is lost; they are kept for reference.
The `entity*` tables currently in the database stay for now — their fate belongs to the
three-systems decision, not the region pass.

## Edge functions
`supabase/functions/admin-set-temp-password` and `supabase/functions/revalidate-frontend`
are the deployed functions, recovered via `supabase functions download`.
