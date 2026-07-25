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

## MANDATORY SCOPE — Editor UI Unification (not just data)

**Added 2026-07-25 after live screenshot review of `admincms1.indianexaminfo.com/exams/new`.**

Migrating rows is necessary but not sufficient. Verified state of the system today:

- `/exams/new` → `ExamEditorPage` → `examService.ts` → `.from("exams")` only. No reference to `entity`, `entity_module`, or `entity_timeline_event`.
- The same underlying date is independently editable in **three** places on that one screen:
  1. **Dates & Fees tab** — `moduleRegistry.dateFields`: `notificationDate`, `lastDateApply`, `feeLastDate`, `correctionWindow`, `examDate`
  2. **Content Modules → Application module** — `applicationStartDate`, `applicationEndDate`, `lastDateFeePayment`, `correctionWindowStart`, `correctionWindowEnd`
  3. **Important Dates (Frontend Timeline)** — free-form `useFieldArray` writing to `exams.important_dates` JSONB
  No sync exists between any of the three.
- `/entities/:pillar/new` (the ELMS editor with `TimelineDatesProvider` + `ReadOnlyDateChip`) is **registered in the router but absent from `Sidebar.tsx` and all dashboard quick actions**. It is only reachable by typing the URL.
- DB counts (2026-07-25): `entity` = 3, `entity_timeline_event` = 5, `entity_module` = 0, `exams` = 127. Newest `entity` row 2026-07-12; newest `exams` row 2026-07-24.

**Consequence:** the exam-data-deduplication feature has zero effect on any exam being created today. Migrating the 127 historical rows without addressing the editor UI means the duplication problem recurs immediately for every exam created after the migration ships.

The following are required content for this spec's Requirements phase:

1. **Whichever option is chosen for T3-1** (entity canonical / entity syncs to exams / parallel systems), the resolution MUST include a concrete answer for what editors use to create a NEW exam the day after this migration ships — not only what happens to the 127 existing rows.

2. **If Option A (entity canonical):** `/exams/new` and the entire legacy exam editor UI (General / Dates & Fees / Eligibility & Selection / Content Modules / SEO & Tags) must be either replaced by the ELMS entity editor or retired behind a redirect, following the existing `/results` → `/sarkari-naukri` pattern already in `router/index.tsx`. Creating a new exam through the duplicated-date form must become **impossible**, not discouraged. This includes removing/redirecting the `Exam Manager` sidebar item and the `New Exam` dashboard quick action, and adding the entity editor to the sidebar so it has a real navigation path.

3. **If Option B (entity syncs to exams):** the sync layer must explicitly designate which UI is authoritative for date entry. Editors must not be able to independently edit the same date in `/exams/new`'s Dates & Fees tab AND its Content Modules tab AND (if reachable) the entity Timeline tab with no sync between them. Define **exactly one editable surface per date type**, matching the single-source-of-truth model already implemented via `TimelineDatesContext` + `ReadOnlyDateChip`.

4. **Screenshot-level acceptance criterion (non-negotiable):** after implementation, re-take a screenshot of the actual new-exam creation flow an editor uses and confirm no single date appears as an independently-editable field in more than one location. This project has repeatedly found that "the code is correct" and "the screen editors actually use is fixed" are different claims. Verify the second directly; a passing test suite does not satisfy this criterion.

## RISK — The module-authoring path has never been exercised by a real editor

**Confirmed 2026-07-25:** `entity_module` = **0 rows**. Not "few" — zero. No module content has ever been authored through `EntityEditorShell` by anyone, at any point, in production.

This is a materially different confidence level from the date/timeline path, which has 5 `entity_timeline_event` rows across 3 pilot entities and therefore has at least been exercised end-to-end once. The module system has not.

**Consequence for Option A (entity canonical):** retiring `/exams/new` is not only replacing a screen. It means real CMS editors become the first humans ever to author exam content through the entity module system, in production, under deadline pressure, all at once — on a code path with no production usage history. Every latent bug in module creation, ordering, block editing, publish state, and snapshot generation surfaces simultaneously, to the people least able to work around it.

**Required in this spec's risk/rollout section:**

1. **No hard cutover on day one.** Stage the rollout: route a small set of new exams (suggest 3–5, chosen with the editors) through the entity editor while `/exams/new` remains available, and watch those closely before removing the legacy path.
2. **Define what "watched closely" means concretely** — who checks, against what, and what specific signals abort the rollout and restore `/exams/new`.
3. **Exercise `entity_module` before editors do.** The migration itself (`content_posts` → `entity_module` + `module_block`) will be the first bulk write to that table. Treat successful module creation via the *editor UI*, not just via migration script, as a gate for the rollout — a migration script writing rows does not prove the authoring UI works.
4. **Rollback must cover editor-authored content**, not just migrated rows. If the rollout aborts after editors have authored exams through the entity system, define what happens to that content — it will not exist in `exams` and the frontend reads `exams`.

## BLOCKING PREREQUISITE — Track 2: finish ELMS or delete it

**See `track-2-elms-decision.md` in this folder.** Decided before any migration design work, because the two outcomes produce entirely different specs.

Conclusive finding, 2026-07-25: the ELMS editor is unreachable by any editor. `lifecycle_template` = 0 → `entity_snapshot` = 0 → `moduleVisibility` undefined → the workspace shows General only → all 18 other modules, including `timeline`, are unreachable, and `/entities/:pillar/new` cannot create anything. The date single-source-of-truth mechanism therefore has no editable surface in the running product.

This invalidates the Dependencies line below as written. The deduplication schema exists; the editor does not. Do not treat "exam-data-deduplication deployed" as meaning an editor can use it.

## Dependencies

- ⚠️ `exam-data-deduplication` — **schema only.** Provides `entity_timeline_event` with Date_Type_Enum, the `conducting_body` parent/child hierarchy, and the `entity_module`/`module_block` tables. Does NOT provide a working editor: see the blocking prerequisite above.
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
