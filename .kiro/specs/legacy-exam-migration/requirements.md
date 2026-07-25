# Requirements Document — STUB

## Introduction

This spec covers the migration of legacy exam/recruitment records into the new `entity`/`entity_module`/`entity_timeline_event`/`module_block` schema. This is a prerequisite for the exam-data-deduplication feature's migrations (group 13) to operate at meaningful scale.

## Status: NOT STARTED — Placeholder only

This stub was created during the exam-data-deduplication feature build after the dry-run revealed that migrations 13.2–13.6 only affect the 3 entities currently in the `entity` table. The real data lives in three legacy tables that need bridging.

## Confirmed Scope (tables to migrate)

1. **`exams`** (127 rows) — the primary legacy exam table. Fields: `important_dates` JSONB, `conducting_body` free text, `selection_process` array, `eligibility` JSONB, `application_fee` JSONB, embedded dates.
2. **`content_posts`** (3 rows, but structure matters) — exam-linked content modules (notification, application, admit-card, etc.) with `content_type_data` JSONB containing per-type structured fields like `admitCardReleaseDate`, `resultDeclaredDate`.
3. **`sarkari_naukri`** (361 rows) — enriched sarkari recruitment records with explicit date columns (`notification_date`, `application_start_date`, `exam_date`, `admit_card_date`, `answer_key_date`, `result_date`, etc.). **Confirmed lineage: migrated FROM `cms_results` via `_migration_log_sarkari`.**

## Explicitly Out of Scope

- **`cms_results`** (361 rows) — ARCHIVABLE. Confirmed as the already-migrated source of `sarkari_naukri`. All data already exists in `sarkari_naukri` with full migration log traceability. No re-migration needed; archive at Tier 3 (backup first).
- **`cms_education_news`** (41 rows) — STAYS AS-IS for now. Actively used by both CMS admin and public frontend. NOT a duplicate of `content_posts` (different content type entirely — standalone news articles, not exam-linked modules). May eventually unify with `blog_posts` but that's a separate product decision, not part of this migration.
- **13 empty `cms_*` tables** (0 rows each) — cleanup candidates, not migration targets. Can be dropped separately.

## Migration Targets (what gets created in the entity system)

1. `exams` rows → `entity` rows (field mapping TBD)
2. `exams.important_dates` JSONB → `entity_timeline_event` rows per exam (with Date_Type_Enum event_types)
3. `content_posts` rows → `entity_module` + `module_block` rows (content_type → module_type mapping)
4. `content_posts.content_type_data` structured fields → appropriate `module_block.content` JSON
5. `sarkari_naukri` date columns (notification_date, application_start_date, etc.) → `entity_timeline_event` rows
6. `sarkari_naukri` non-date fields → `entity` + satellite tables (vacancy, eligibility, etc.)
7. Backfill `entity.conducting_body_id` FK for all migrated entities (using the hierarchy-aware `conducting_body` table with Option 2 parent/child model)
8. Preserve SEO data (seo_title, seo_description) in `entity_seo`
9. Generate `entity_snapshot` for each migrated entity (requires template assignment)
10. Handle the `exams` ↔ `content_posts` FK relationship (`exam_id`) during migration

## Dependencies

- `exam-data-deduplication` feature deployed (provides target schema: `entity_timeline_event` with Date_Type_Enum, `conducting_body` lookup table with parent/child hierarchy, `entity_module`/`module_block` structure)
- Template system must have at least one template configured for exam/recruitment entity types
- Conducting body alias list finalized (AIIMS/IIM hierarchy decisions confirmed — Option 2 in place)

## Open Questions

1. **Big-bang vs incremental?** All 488 rows at once, or migrate-on-first-edit?
2. **Rollback strategy?** What if migration produces data quality issues for live exams?
3. **Transition period?** Do legacy tables remain readable during dual-read, or cut over immediately?
4. **sarkari_naukri handling:** Same migration or phased? (127 exams first, then 361 sarkari separately?)
5. **cms_education_news unification:** Should education news eventually merge into `blog_posts` or become its own entity type? (Product decision — deferred, not blocking this migration.)
6. **What happens to legacy tables post-migration?** Archive? Soft-delete? Keep as read-only reference?

## Key Insight from Investigation

The `_migration_log_sarkari` table proved that `cms_results` → `sarkari_naukri` was a **completed, tracked migration** — not a mysterious duplicate. This means `sarkari_naukri` is the authoritative source for recruitment data (not `cms_results`), and the migration should read FROM `sarkari_naukri`, not from `cms_results`.
