# Implementation Plan: Exam Data Deduplication

## Overview

This plan implements the exam-data-deduplication feature in sequential, buildable steps. Database schema and migrations come first, followed by service layer, shared contexts/hooks, then UI components, and finally wiring/integration. Each task builds on previous work with no orphaned code.

## Tasks

- [ ] 1. Database schema and Postgres functions
  - [ ] 1.1 Create `conducting_body` table, RLS policies, and seed migration
    - Create the `conducting_body` lookup table with columns: `id`, `name`, `short_name`, `slug`, `official_website`, `created_at`, `updated_at`
    - Add UNIQUE constraints on `name` and `slug`
    - Enable RLS: readable by all authenticated users, writable by admin/editor roles
    - _Requirements: 15.1_

  - [ ] 1.2 Add `conducting_body_id` FK to `entity` table and partial unique index
    - Add `conducting_body_id` uuid column (nullable initially) with FK to `conducting_body.id`
    - Create partial unique index `uq_entity_conducting_body_slug ON entity(conducting_body_id, slug) WHERE deleted_at IS NULL`
    - _Requirements: 15.2, 7.1_

  - [ ] 1.3 Enable `pg_trgm` extension and create trigram index
    - `CREATE EXTENSION IF NOT EXISTS pg_trgm`
    - Create GIN index `idx_entity_name_trgm ON entity USING gin (name gin_trgm_ops)`
    - _Requirements: 5.1_

  - [ ] 1.4 Create `entity_migration_log` table with RLS
    - Create table with columns: `id`, `entity_id` (FK), `field_type`, `winning_value`, `winning_source`, `discarded_values` (jsonb), `resolution_method`, `created_at`
    - RLS: readable by admin only
    - _Requirements: 14.5_

  - [ ] 1.5 Create `check_duplicate_entity` Postgres function
    - Implement the composite scoring function using `similarity()` with name weight 0.6, conducting_body_id match bonus 0.2, year extraction bonus 0.2
    - Return up to 5 results above configurable threshold (default 0.7)
    - _Requirements: 5.1, 5.2_

  - [ ] 1.6 Create `check_slug_available` Postgres function
    - Implement slug uniqueness check function returning `is_available`, `conflicting_entity_id`, `conflicting_entity_name`
    - Support `p_exclude_entity_id` parameter for edit scenarios
    - _Requirements: 7.2, 7.5_

  - [ ] 1.7 Create activity log performance index
    - `CREATE INDEX idx_entity_activity_log_recent ON entity_activity_log(created_at DESC) WHERE action IN ('module_filled', 'module_updated')`
    - _Requirements: 8.7_

- [ ] 2. Checkpoint - Verify database migrations
  - Ensure all migrations apply cleanly, ask the user if questions arise.

- [ ] 3. Core TypeScript types and query keys
  - [ ] 3.1 Add TypeScript interfaces and constants to `src/types/entity.ts`
    - Add `ConductingBody`, `ActivityLogEntry` interfaces
    - Add `STANDARD_DATE_TYPES` const array and `StandardDateType` type
    - Add `DateEntry` interface for timeline context
    - _Requirements: 1.1, 15.1, 8.4_

  - [ ] 3.2 Extend query keys in `src/lib/queryKeys.ts`
    - Add `conductingBodyKeys`, `activityFeedKeys`, `duplicateCheckKeys` objects
    - _Requirements: 5.1, 6.2, 8.3_

  - [ ] 3.3 Add `buildUrlPreview` utility to `src/lib/utils.ts`
    - Implement URL preview builder that strips trailing/leading slashes and joins with exactly one separator
    - Preserve protocol prefix (https://)
    - Ensure no consecutive forward slashes in path portion
    - _Requirements: 9.1, 9.4_

  - [ ]* 3.4 Write unit tests for `buildUrlPreview`
    - Test double-slash removal, empty slug handling, protocol preservation
    - _Requirements: 9.1, 9.4_

- [ ] 4. Service layer
  - [ ] 4.1 Create `src/services/entity/conductingBodyService.ts`
    - Implement `listConductingBodies()` — fetches all from `conducting_body` table
    - Implement `searchConductingBodies(query: string)` — text search on name/short_name
    - Implement `createConductingBody(input: { name, shortName?, slug, officialWebsite? })` — inserts new row
    - _Requirements: 15.6, 15.7, 6.2_

  - [ ] 4.2 Create `src/services/entity/duplicateCheckService.ts`
    - Implement `checkDuplicateEntity(name: string, conductingBodyId: string | null)` — calls `check_duplicate_entity` RPC
    - _Requirements: 5.1, 5.2_

  - [ ] 4.3 Create `src/services/entity/activityLogService.ts`
    - Implement `logModuleActivity(entityId, moduleId, moduleType, actorId, action)` — inserts into `entity_activity_log`
    - Implement `listRecentActivity(limit: number)` — fetches recent entries with entity name and actor name resolved
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 4.4 Extend existing `timelineService` with `ensureStandardDates`
    - Add `ensureStandardDates(entityId: string)` — checks for missing standard date rows and inserts placeholders with null `event_date`
    - Uses `(entity_id, event_type)` check before inserting (idempotent)
    - _Requirements: 1.2, 1.8_

  - [ ] 4.5 Add slug validation to entity service
    - Implement `checkSlugAvailable(slug, conductingBodyId, excludeEntityId?)` — calls `check_slug_available` RPC
    - _Requirements: 7.2, 7.5_

  - [ ]* 4.6 Write unit tests for service layer functions
    - Test `conductingBodyService` CRUD operations
    - Test `duplicateCheckService` threshold filtering
    - Test `activityLogService` action type discrimination
    - _Requirements: 15.6, 5.1, 8.1_

- [ ] 5. Hooks layer
  - [ ] 5.1 Create `src/hooks/useConductingBodies.ts`
    - TanStack Query hook wrapping `conductingBodyService.listConductingBodies()`
    - `staleTime: Infinity` for small lookup table (<200 rows)
    - _Requirements: 15.6, 15.7_

  - [ ] 5.2 Create `src/hooks/useDuplicateCheck.ts`
    - Debounced (500ms) TanStack Query hook calling `duplicateCheckService.checkDuplicateEntity`
    - Only triggers after 3+ characters entered
    - Returns matches above threshold
    - _Requirements: 5.1, 5.2, 5.5, 5.6_

  - [ ] 5.3 Create `src/hooks/useActivityFeed.ts`
    - TanStack Query hook wrapping `activityLogService.listRecentActivity(25)`
    - _Requirements: 8.3, 8.6_

  - [ ] 5.4 Create `src/hooks/useSlugValidation.ts`
    - Debounced (500ms) hook calling `checkSlugAvailable`
    - Returns `{ isAvailable, conflictingEntityId, conflictingEntityName }`
    - _Requirements: 7.2, 7.5_

  - [ ] 5.5 Create `src/hooks/useSaveAll.ts`
    - Orchestrates saving all dirty tabs via `Promise.allSettled`
    - Tracks per-tab success/failure; clears dirty flags only on successful tabs
    - Returns `{ saveAll, isSaving, errors }`
    - _Requirements: 11.2, 11.3, 11.5_

  - [ ] 5.6 Create `src/hooks/useTimelineDates.ts`
    - Consumes `TimelineDatesContext`
    - Returns date by event_type, loading state, and navigation helpers
    - _Requirements: 1.4, 3.1_

- [ ] 6. Shared context: TimelineDatesProvider
  - [ ] 6.1 Create `src/contexts/TimelineDatesContext.tsx`
    - Define `TimelineDatesContextValue` interface with `dates` Map, `totalVacancy`, `isLoading`, navigation helpers
    - Implement `TimelineDatesProvider` that reads from TanStack Query cache using existing `entityKeys.timeline(entityId)`
    - Expose `navigateToTimeline(eventType)` and `navigateToVacancy()` callbacks
    - _Requirements: 1.4, 1.5, 3.1, 3.3, 4.3, 4.4_

  - [ ]* 6.2 Write unit tests for `TimelineDatesContext`
    - Test that dates Map is populated from query data
    - Test navigation helpers trigger tab switch
    - _Requirements: 1.5, 3.3_

- [ ] 7. Checkpoint - Verify service + hooks layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Shared UI components
  - [ ] 8.1 Create `src/components/shared/ReadOnlyDateChip.tsx`
    - Reads date from `TimelineDatesContext` by `eventType` prop
    - Displays formatted date (DD MMM YYYY) or "Not set" when null
    - Shows "Edit in Timeline →" navigation link that calls `navigateToTimeline`
    - _Requirements: 1.4, 3.4_

  - [ ] 8.2 Create `src/components/shared/ReadOnlyVacancyChip.tsx`
    - Reads `totalVacancy` from `TimelineDatesContext`
    - Displays numeric value or "Not set" when null
    - Shows "Edit in Vacancy →" navigation link
    - _Requirements: 4.3, 4.5_

  - [ ] 8.3 Create `src/components/shared/ConductingBodySelect.tsx`
    - Searchable dropdown/combobox populated from `useConductingBodies` hook
    - Displays `short_name` where available, `name` as fallback
    - "Add new conducting body" option (admin/editor roles only)
    - _Requirements: 15.6, 15.7_

  - [ ] 8.4 Create `src/components/shared/TagChipInput.tsx`
    - Renders existing values as removable chips
    - Adds new chip on Enter or comma keypress
    - Validates: trim whitespace, 1-100 char length, case-insensitive dedup, max items (default 20)
    - Shows inline rejection message for invalid input
    - _Requirements: 13.1, 13.2, 13.3, 13.5_

  - [ ] 8.5 Create `src/components/shared/TaxonomyTooltip.tsx`
    - Renders info icon next to field label
    - Shows tooltip on hover/focus with field definition (max 200 chars)
    - Loads tooltip content from settings/config source
    - Hides icon if content unavailable
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 8.6 Write unit tests for shared UI components
    - Test `ReadOnlyDateChip` renders formatted date or "Not set"
    - Test `TagChipInput` deduplication and max-length rules
    - Test `TaxonomyTooltip` shows/hides based on config availability
    - _Requirements: 1.4, 13.3, 10.4_

- [ ] 9. Entity Editor feature components
  - [ ] 9.1 Create `src/components/entity-editor/DuplicateWarningBanner.tsx`
    - Uses `useDuplicateCheck` hook with entity name and conducting body
    - Displays up to 5 matches with workflow_status, last-updated-by, and clickable links
    - Dismisses when no matches found
    - Non-blocking — does not prevent creation
    - _Requirements: 5.2, 5.3, 5.4, 5.6_

  - [ ] 9.2 Create `src/components/entity-editor/SaveAllButton.tsx`
    - Sticky positioned button, visible only when dirty tabs exist
    - Shows loading indicator during save
    - Displays per-tab error messages on partial failure
    - Uses `useSaveAll` hook
    - _Requirements: 11.1, 11.2, 11.3, 11.5_

  - [ ] 9.3 Create `src/components/entity-editor/modules/ModuleCompletionDot.tsx`
    - Three states: empty (no content), filled (has non-empty blocks), published (workflow_status = 'published')
    - Precedence: published > filled > empty
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ] 9.4 Create `src/components/dashboard/ActivityFeed.tsx`
    - Uses `useActivityFeed` hook
    - Renders up to 25 entries in reverse chronological order
    - Shows entity name, module_type, actor name, relative timestamp, action wording ("filled"/"updated")
    - Empty state message when no entries
    - Error state with retry button
    - _Requirements: 8.3, 8.4, 8.5, 8.6_

  - [ ]* 9.5 Write unit tests for feature components
    - Test `DuplicateWarningBanner` shows/dismisses based on matches
    - Test `ModuleCompletionDot` state precedence logic
    - Test `SaveAllButton` visibility tied to dirty state
    - _Requirements: 5.2, 12.5, 11.1_

- [ ] 10. Checkpoint - Verify UI components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Integration: Wire components into existing pages
  - [ ] 11.1 Modify `EntityEditorShell.tsx` — wrap tabs in `TimelineDatesProvider` and add `SaveAllButton`
    - Wrap all tab content inside `<TimelineDatesProvider entityId={entityId}>`
    - Add `<SaveAllButton entityId={entityId} />` to the header/toolbar area
    - _Requirements: 1.4, 1.5, 11.1_

  - [ ] 11.2 Modify `TimelineTab.tsx` — add fixed standard rows and disable delete
    - Call `ensureStandardDates(entityId)` on mount
    - Render fixed default rows for each `STANDARD_DATE_TYPES` value (no delete action)
    - Add is_urgent row highlighting (distinct background color)
    - Cap custom rows at 50
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.5_

  - [ ] 11.3 Modify `GeneralTab.tsx` — replace conducting body input, add date chips, fix slug preview
    - Replace free-text `conducting_body` input with `<ConductingBodySelect>`
    - Replace date inputs for standard types with `<ReadOnlyDateChip>` components
    - Add `<TaxonomyTooltip>` to taxonomy field labels
    - Integrate `buildUrlPreview` for slug preview display
    - Integrate `useSlugValidation` for inline slug conflict checking
    - _Requirements: 15.6, 1.3, 10.1, 9.1, 9.2, 7.5_

  - [ ] 11.4 Modify `ModulesTab.tsx` — add `ModuleCompletionDot` indicators
    - Render `<ModuleCompletionDot>` next to each module name in the module list
    - _Requirements: 12.1, 12.6_

  - [ ] 11.5 Modify `ModuleEditor.tsx` — replace date fields with ReadOnlyDateChips
    - For any field matching a `STANDARD_DATE_TYPES` value, render `<ReadOnlyDateChip>` instead of an editable input
    - Block free-text date inputs for standard types
    - _Requirements: 3.2, 3.7, 1.3_

  - [ ] 11.6 Modify `DashboardPage.tsx` — add `ActivityFeed` section
    - Add `<ActivityFeed limit={25} />` component to the dashboard layout
    - _Requirements: 8.3_

  - [ ] 11.7 Modify Selection Process tab — replace text input with `TagChipInput`
    - Replace comma-separated text input with `<TagChipInput>` for selection process stages
    - Wire chip add/remove to `entity_selection_stage` create/soft-delete operations
    - _Requirements: 13.1, 13.4, 13.5_

  - [ ] 11.8 Integrate activity logging into module save operations
    - In `moduleService.ts` (or equivalent), call `logModuleActivity` on block create/update/delete
    - Determine "module_filled" vs "module_updated" by comparing block count before and after
    - _Requirements: 8.1, 8.2_

  - [ ] 11.9 Wire `DuplicateWarningBanner` into entity creation flow
    - Add `<DuplicateWarningBanner>` to the entity creation form/dialog
    - Pass current name and selected conducting body
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 11.10 Add vacancy `ReadOnlyVacancyChip` to relevant tabs
    - Add `<ReadOnlyVacancyChip>` in General Tab and any Content Module displaying vacancy
    - _Requirements: 4.2, 4.3_

- [ ] 12. Checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Data migration scripts
  - [ ] 13.1 Build dry-run infrastructure and `entity_migration_log_preview` table
    - Create `entity_migration_log_preview` table (same schema as `entity_migration_log` but NOT rolled back on transaction abort — separate connection or autonomous transaction)
    - Implement shared `MigrationRunner` utility (SQL function or script harness) that accepts a `p_dry_run boolean` parameter
    - When `p_dry_run = true`: execute all read/comparison/write logic inside a transaction, write all log entries to `entity_migration_log_preview`, then ROLLBACK the transaction (data tables unchanged)
    - When `p_dry_run = false`: execute identically but COMMIT at the end, writing to `entity_migration_log` (production)
    - Each migration script (13.2–13.6) must be written to use this harness from the start — dry-run is not bolted on after
    - _Requirements: 14.5, 14.8_

  - [ ] 13.2 Write Migration 1: Conducting body normalization script (with dry-run support)
    - Extract distinct `conducting_body` text values from `entity` and `exams` tables
    - De-duplicate by lowercased/trimmed comparison + predefined alias list
    - Insert canonical entries into `conducting_body` table
    - Backfill `entity.conducting_body_id` FK
    - Log ambiguous mappings to migration log
    - Must be idempotent and run within a single transaction
    - **Do NOT execute live until dry-run output has been reviewed by human**
    - _Requirements: 15.3, 15.4, 15.5_

  - [ ] 13.3 Write Migration 2: Timeline event_type reclassification script (with dry-run support)
    - Scan `entity_timeline_event` rows where `event_type = 'other'`
    - Title-match against standard labels (case-insensitive substring)
    - Update matched rows' `event_type` to the standard value
    - Insert missing standard-type placeholder rows (null `event_date`) for all entities
    - Must be idempotent; skip rows where `event_date` is already non-null
    - Run within a single transaction
    - **Do NOT execute live until dry-run output has been reviewed by human**
    - _Requirements: 14.1, 14.6, 14.8_

  - [ ] 13.4 Write Migration 2b: Extract embedded dates from module_block content (with dry-run support)
    - Scan `module_block.content` JSON in modules of types: admit-card, result, answer-key, application, notification
    - Map discovered JSON keys to Date_Type_Enum values using predefined key→event_type mapping
    - For each discovered value: if the corresponding `entity_timeline_event` row has a null `event_date` (no conflict), write the value directly and log with `resolution_method = 'no_conflict'`
    - If the timeline row already has a non-null `event_date` (conflict), do NOT write — flag for Migration 3 resolution. No log entry is written by 2b for conflict cases (Migration 3 owns those log entries)
    - Do NOT modify original `module_block.content` JSON
    - Must be idempotent; run within a single transaction
    - **Log semantics**: 2b only logs successful no-conflict extractions. Conflict cases produce zero log entries from 2b — they are exclusively logged by Migration 3.
    - **Do NOT execute live until dry-run output has been reviewed by human**
    - _Requirements: 14.2, 14.3, 14.4_

  - [ ] 13.5 Write Migration 3: Date conflict resolution script (with dry-run support)
    - For each entity + standard date_type where multiple sources provided different values (flagged by Migration 2b or detected between Migration 2's title-reclassified value and other sources)
    - Compare `updated_at` timestamps; apply winning value to timeline event row
    - Fallback order when timestamps tie: timeline_event > module_block > entity.metadata
    - Log one resolution record per (entity_id, field_type) conflict — this is the sole log entry for conflict cases (2b does not produce a competing entry)
    - Must be idempotent; run within a single transaction
    - **Log semantics**: The migration log has exactly ONE row per (entity_id, field_type) combination across all migration steps. Either 2b logs it (no-conflict extraction) or 3 logs it (conflict resolution) — never both.
    - **Do NOT execute live until dry-run output has been reviewed by human**
    - _Requirements: 14.2, 14.3, 14.5_

  - [ ] 13.6 Write Migration 4: Vacancy normalization script (with dry-run support)
    - Ensure `entity_vacancy` row with `category = 'total'` per entity
    - Source from most-recently-updated location
    - Must be idempotent; run within a single transaction
    - **Do NOT execute live until dry-run output has been reviewed by human**
    - _Requirements: 14.7_

  - [ ] 13.7 Dry-run execution and human review gate
    - Run all migration scripts (13.2–13.6) in dry-run mode against production database
    - Review `entity_migration_log_preview` output: conflict resolutions, ambiguous conducting_body mappings, module_block date extractions, title-match reclassifications
    - Adjust alias mapping or manually correct data if dry-run reveals issues
    - **This task blocks live execution — do not proceed to 13.8 until review is complete**
    - _Requirements: 14.5, 14.8_

  - [ ] 13.8 Live migration execution (human-gated) — DEFERRED
    - **DEFERRED**: Will run as part of the legacy-exam-migration spec once 127 legacy exams are in the `entity` table and conducting_body alias decisions are made against real data at scale. Running now would only affect 3 entities with no meaningful value.
    - Execute all migration scripts (13.2–13.6) in live mode (p_dry_run = false), in order: 13.2 → 13.3 → 13.4 → 13.5 → 13.6
    - After completion: make `entity.conducting_body_id` NOT NULL (Requirement 15.5)
    - Verify final state by re-running dry-run (should report zero conflicts)
    - _Requirements: 15.5, 14.8_

  - [ ]* 13.9 Write integration tests for migration scripts
    - Test idempotency: run each migration twice, assert same state
    - Test conflict resolution picks most-recent timestamp
    - Test alias mapping collapses known conducting body variants
    - Test dry-run mode populates preview log but leaves data tables unchanged
    - Test log semantics: confirm exactly one row per (entity_id, field_type) — no duplicates between 2b and 3
    - _Requirements: 14.8, 15.4_

- [ ] 14. Final checkpoint - Complete feature verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The design uses TypeScript throughout — all implementations use React 18 + TypeScript + TanStack Query + Radix UI + Zod
- **CRITICAL: Group 13 (migrations) must NOT be run unattended.** Task 13.7 is an explicit human-review gate. "Run All Tasks" should stop at 13.7 and wait for human sign-off before proceeding to 13.8 (live execution).
- Migration scripts (tasks 13.2–13.6) are written with dry-run support from the start (task 13.1 builds the infrastructure first)
- Migration log semantics: exactly ONE row per (entity_id, field_type) combination. Migration 2b logs no-conflict extractions; Migration 3 logs conflict resolutions. They never produce competing entries for the same field.
- The `TimelineDatesContext` is the central mechanism for cross-tab date sync — it must be wired before module-level integrations
- All services follow existing pattern: service file → hook → component (no direct DB in components)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.4", "1.7"] },
    { "id": 1, "tasks": ["1.2", "1.5", "1.6", "3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["3.4", "4.1", "4.2", "4.3", "4.4", "4.5"] },
    { "id": 3, "tasks": ["4.6", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["6.2", "8.1", "8.2", "8.3", "8.4", "8.5"] },
    { "id": 6, "tasks": ["8.6", "9.1", "9.2", "9.3", "9.4"] },
    { "id": 7, "tasks": ["9.5", "11.1", "11.2"] },
    { "id": 8, "tasks": ["11.3", "11.4", "11.5", "11.6", "11.7", "11.8", "11.9", "11.10"] },
    { "id": 9, "tasks": ["13.1"] },
    { "id": 10, "tasks": ["13.2", "13.3", "13.4", "13.5", "13.6"] },
    { "id": 11, "tasks": ["13.7"] },
    { "id": 12, "tasks": ["13.8"], "note": "HUMAN-GATED: requires 13.7 sign-off" },
    { "id": 13, "tasks": ["13.9"] }
  ]
}
```
