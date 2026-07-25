# Requirements Document

## Introduction

This feature eliminates data duplication and conflicting information across the IndianExamInfo CMS by establishing a single source of truth for shared exam fields (dates, vacancies), introducing automatic sync from the canonical data store to Content Modules, adding duplicate exam detection at creation time, and improving the Exam Manager UI/UX with search, filters, activity feeds, and consistent save patterns.

## Glossary

- **CMS**: The IndianExamInfo Content Management System (React/TypeScript + Supabase)
- **Entity**: A single exam/recruitment record managed by the CMS, stored in the `entity` table
- **Entity_Editor**: The multi-tab editor UI (`EntityEditorShell`) used by CMS operators to manage an Entity
- **Timeline_Tab**: The dedicated tab in Entity_Editor that manages `entity_timeline_event` rows (dates/milestones)
- **Content_Module**: A typed sub-section of an Entity (e.g., Notification, Admit Card, Application) stored in `entity_module`
- **Exam_Dates_Table**: The unified data structure (backed by `entity_timeline_event`) storing all date-type events for an Entity, keyed by `event_type`
- **Date_Type_Enum**: A controlled vocabulary of standard date identifiers: `notification_date`, `application_start`, `application_end`, `fee_payment_last_date`, `exam_date`, `admit_card_release`
- **Read_Only_Chip**: A non-editable UI badge displaying a date value with a navigation link to the canonical editing location
- **Exam_Manager**: The list view at `/entities` showing all Entity records with search, filters, and sort
- **Conducting_Body**: The organization that administers an exam (e.g., IBPS, UPSC, SSC). Currently stored as free-text in `entity.conducting_body`; this feature introduces a `conducting_body` lookup table with a FK relationship (see Requirement 15)
- **Conducting_Body_Table**: A normalized lookup table (`conducting_body`) containing canonical entries for all conducting bodies, with `id`, `name`, `short_name`, and `slug` columns
- **Slug**: A URL-safe identifier derived from the Entity name, used in public-facing URLs
- **Activity_Log**: A record of module-level state transitions displayed on the CMS Dashboard, backed by `entity_activity_log`
- **Fuzzy_Match**: An approximate string comparison algorithm (pg_trgm trigram similarity) used to detect similar exam names during creation
- **Normalized_Exam_Name**: A lowercased, whitespace-collapsed, punctuation-stripped version of the exam name used for soft-uniqueness checks

## Requirements

### Requirement 1: Canonical Date Ownership

**User Story:** As a CMS editor, I want each date field to exist in exactly one editable location, so that I never encounter conflicting dates across tabs and modules.

#### Acceptance Criteria

1. THE Entity_Editor SHALL store all standard date values exclusively in the Exam_Dates_Table (`entity_timeline_event` rows) using rows keyed by `event_type` matching a Date_Type_Enum value, limited to one row per (Entity, Date_Type_Enum value) combination
2. WHEN an Entity is opened for editing and a standard date row does not yet exist for that Entity, THE Timeline_Tab SHALL pre-populate one default row for each value in Date_Type_Enum with a null `event_date` value within 2 seconds of the tab rendering
3. THE Entity_Editor SHALL NOT render editable date inputs for standard date types outside of the Timeline_Tab
4. WHEN a Content_Module references a standard date type, THE Entity_Editor SHALL render a Read_Only_Chip displaying the current date value formatted as DD MMM YYYY (or "Not set" when null) and a navigation link labeled "Edit in Timeline →" that activates the Timeline_Tab and scrolls to the corresponding date row
5. WHEN a CMS editor updates a date value in the Timeline_Tab, THE Entity_Editor SHALL reflect the updated value in all Read_Only_Chips referencing that Date_Type_Enum within the same browser session without requiring a page reload or additional save action, within 500 milliseconds of the save completing
6. IF a CMS editor enters an invalid date value (malformed format or out-of-range) in the Timeline_Tab, THEN THE Entity_Editor SHALL display an inline validation error message indicating the accepted date format and prevent the save operation until the value is corrected
7. IF the save operation for a date value in the Timeline_Tab fails due to a network or server error, THEN THE Entity_Editor SHALL display an error notification indicating the failure, retain the editor's unsaved input in the form field, and allow retry without re-entering the value
8. UPON deployment of this feature, THE system SHALL execute a one-time data migration that creates missing standard Date_Type_Enum rows (with null `event_date`) for every pre-existing Entity that does not already have a complete set of standard date rows in `entity_timeline_event`. This migration SHALL run automatically as part of the deployment process (database migration script) and SHALL NOT require manual per-Entity intervention.

### Requirement 2: Unified Date Editor

**User Story:** As a CMS editor, I want a single dynamic date table that replaces the previous static date inputs and the separate timeline table, so that I manage all dates in one consistent interface.

#### Acceptance Criteria

1. THE Timeline_Tab SHALL render a single editable table containing one row per date entry, with columns for label (maximum 300 characters), date value (in YYYY-MM-DD format), is_urgent flag (mapped to `is_highlighted`), and a delete action
2. WHEN the Timeline_Tab loads for an Entity, THE Timeline_Tab SHALL display one fixed default row for each standard Date_Type_Enum value, and these fixed rows SHALL NOT present a delete action
3. THE Timeline_Tab SHALL allow adding custom date rows (with `event_type` set to `'other'` or a custom string) beyond the fixed standard stages, up to a maximum of 50 custom rows per Entity
4. WHEN a custom date row is added, THE Timeline_Tab SHALL allow deletion of that custom row via the delete action column (soft-delete via `deleted_at`)
5. WHEN any date row is marked with the is_urgent flag, THE Timeline_Tab SHALL apply a distinct background color to that row distinguishing it from non-urgent rows, and SHALL persist the `is_highlighted` value so that the frontend timeline display renders the date as urgent
6. IF a date value is entered that does not match the YYYY-MM-DD format, THEN THE Timeline_Tab SHALL display an inline validation error on that row and SHALL NOT persist the invalid value

### Requirement 3: Content Module Date Sync

**User Story:** As a CMS editor, I want Content Modules to automatically display current dates from the canonical source, so that published pages always show consistent information.

#### Acceptance Criteria

1. WHEN a Content_Module template includes a date_type reference matching a value in Date_Type_Enum, THE Content_Module SHALL read the date value from the Exam_Dates_Table row (`entity_timeline_event`) for the same Entity by matching on that `event_type` value
2. THE Content_Module SHALL NOT store its own copy of any date value that corresponds to a standard Date_Type_Enum; any existing date fields in `module_block.content` JSON that duplicate standard dates SHALL be ignored in favor of the Exam_Dates_Table value
3. WHEN the Exam_Dates_Table is updated for a given Date_Type_Enum, THE CMS frontend rendering SHALL use the updated value for all Content_Modules of the same Entity referencing that Date_Type_Enum within the same browser session without requiring per-module saves or page reload
4. IF a Content_Module references a Date_Type_Enum value whose corresponding Exam_Dates_Table row has a null `event_date`, THEN THE Content_Module SHALL display a placeholder label "Date not set" and SHALL NOT render an empty or broken date field
5. IF a Content_Module needs a date type not present in Date_Type_Enum, THEN THE Content_Module SHALL store that value in its own metadata only after a CMS editor explicitly selects the "Store as module-specific date" option, confirming the date does not correspond to any standard Date_Type_Enum value
6. IF a Content_Module references a Date_Type_Enum value and no corresponding row exists in the Exam_Dates_Table for that Entity (possible only during the brief window between deployment and the Requirement 1.8 migration completing, or for a module referencing a `event_type` that was never part of Date_Type_Enum), THEN THE Content_Module SHALL display a placeholder label "Date source unavailable" and SHALL log the missing reference for administrative review
7. THE Content_Module schema SHALL NOT expose any date-value field that is not either (a) a reference to a Date_Type_Enum value in the Exam_Dates_Table, or (b) an explicitly tagged module-specific date field created via the Requirement 3.5 flow. Free-text or untyped date inputs SHALL NOT be a permitted field type in any Content_Module template.

### Requirement 4: Vacancy Single Source

**User Story:** As a CMS editor, I want the total vacancies field to exist in one editable location, so that all modules and pages display the same vacancy count.

#### Acceptance Criteria

1. THE Entity_Editor SHALL store the total_vacancies value exclusively in the `entity_vacancy` table (the row with `category = 'total'`), and SHALL NOT persist a total_vacancies value in any other data structure or module payload
2. THE Entity_Editor SHALL NOT render an editable total_vacancies input in the General_Tab or in any Content_Module; any existing `vacancyCount` or `totalVacancy` field definition in a Content_Module SHALL be rendered as read-only when displayed
3. WHEN a Content_Module or the General_Tab needs to display total vacancies, THE Entity_Editor SHALL render a Read_Only_Chip showing the current numeric value (or the text "Not set" when no value has been saved in `entity_vacancy`) together with a navigation link labeled "Edit in Vacancy →" that activates the Vacancy_Tab within the same Entity_Editor session
4. WHEN the total_vacancies value is updated in the Vacancy_Tab, THE Entity_Editor SHALL reflect the updated value in all Read_Only_Chips rendered within the same browser tab within 1 second, without requiring the editor to perform a manual save or page reload
5. IF the total_vacancies value in the `entity_vacancy` table is null or no row with `category = 'total'` exists, THEN THE Entity_Editor SHALL display "Not set" in every Read_Only_Chip location and SHALL NOT display "0" or a blank space

### Requirement 5: Live Duplicate Detection on Exam Creation

**User Story:** As a CMS editor, I want to be warned when I am creating an exam that closely matches an existing one, so that I avoid creating duplicate records.

#### Acceptance Criteria

1. WHEN a CMS editor enters at least 3 characters in the exam name field during Entity creation, THE Entity_Editor SHALL perform a Fuzzy_Match (using `pg_trgm` trigram similarity) against existing Entity names, Conducting_Body (matched by `conducting_body_id`), and year within 500ms of the last keystroke (debounced)
2. WHEN the Fuzzy_Match returns one or more results with a similarity score at or above a configurable threshold (default: 0.7 on a 0.0–1.0 scale), THE Entity_Editor SHALL display a warning banner listing up to 5 matching Entity names with their workflow_status, last-updated-by info, and clickable links to their editor pages
3. THE warning banner SHALL NOT block Entity creation; it serves as an advisory notification only
4. WHEN the CMS editor proceeds with creation despite the warning, THE Entity_Editor SHALL allow the creation to complete without additional confirmation steps
5. IF the Fuzzy_Match request fails or exceeds the 500ms timeout, THEN THE Entity_Editor SHALL silently discard the failed check and allow Entity creation to proceed without displaying a warning banner
6. WHEN the exam name input changes and the Fuzzy_Match returns zero results above the threshold, THE Entity_Editor SHALL dismiss any previously displayed warning banner

#### Design Notes (for Tech Design phase)

- Use `pg_trgm` extension's `similarity()` function against `entity.name`
- Combine name similarity (weight 0.6), conducting_body_id exact match bonus (weight 0.2), and year extraction match bonus (weight 0.2) into the composite 0.0–1.0 score
- Year extraction: parse 4-digit year from exam name string using regex

### Requirement 6: Exam Manager Search and Filters

**User Story:** As a CMS editor, I want to search and filter the exam list by multiple criteria, so that I can quickly find existing exams before creating new ones.

#### Acceptance Criteria

1. THE Exam_Manager SHALL display a search bar that filters Entity records by name substring match, debouncing input by 300ms with a minimum of 2 characters before triggering a search
2. THE Exam_Manager SHALL provide filter controls for Conducting_Body (populated from the `conducting_body` lookup table), Pillar, Workflow_Status, and Year, combining all active filters using AND logic
3. THE Exam_Manager SHALL sort results by `updated_at` timestamp descending as the default sort order
4. THE Exam_Manager SHALL display the last-updated-by user display name (resolved from `entity.updated_by` → `user_profiles.name`) for each Entity row
5. WHEN an Entity has been updated within the last 48 hours by a user other than the currently authenticated user, THE Exam_Manager SHALL display a visual activity indicator (colored dot) on that Entity row
6. WHEN the search and filter combination returns zero results, THE Exam_Manager SHALL display an empty-state message indicating no matching exams and suggesting the editor broaden their filters

### Requirement 7: Hard Uniqueness Constraint

**User Story:** As a CMS administrator, I want the system to hard-block slug collisions and soft-warn on name duplicates, so that no two exams can share the same URL path.

#### Acceptance Criteria

1. THE CMS SHALL enforce a database-level unique constraint on the combination of `conducting_body_id` (FK to `conducting_body.id`) and `slug` in the `entity` table
2. IF an Entity creation or slug update would violate the unique constraint, THEN THE Entity_Editor SHALL display an error message identifying the conflicting slug and including a clickable link to the existing Entity that holds it, and SHALL prevent the save operation from completing until the slug is changed to a non-conflicting value
3. WHEN an Entity creation matches an existing record on the combination of `conducting_body_id`, Normalized_Exam_Name, and year (exact equality on all three fields), THE Entity_Editor SHALL display a non-blocking warning with a clickable link to the potential duplicate
4. IF the unique constraint violation prevents a save, THEN THE Entity_Editor SHALL preserve all form data entered by the editor so that only the slug field requires correction before re-attempting save
5. WHEN a CMS editor modifies the slug field on a new or existing Entity, THE Entity_Editor SHALL validate uniqueness of the `conducting_body_id` and `slug` combination against existing records within 500ms of the last keystroke and display the constraint violation inline before form submission is attempted

### Requirement 8: Activity Log and Dashboard Feed

**User Story:** As a CMS team lead, I want a lightweight activity feed on the dashboard showing recent module updates, so that I have visibility into team editing activity.

#### Acceptance Criteria

1. WHEN an `entity_module` transitions from having zero non-deleted `module_block` rows to having at least one non-deleted `module_block` row, THE CMS SHALL insert a row into `entity_activity_log` with `entity_id`, `module_id`, `actor_id`, `action` set to `"module_filled"`, `target_type` set to the `module_type` value, and `created_at` set to the current timestamp
2. WHEN an `entity_module` that already has at least one non-deleted `module_block` row has any of its blocks edited (content changed), added, or removed (a state change distinct from the initial empty→filled transition), THE CMS SHALL insert a row into `entity_activity_log` with `action` set to `"module_updated"`, following the same `entity_id`/`module_id`/`actor_id`/`target_type`/`created_at` structure as Criterion 1
3. THE CMS Dashboard SHALL display the most recent 25 `entity_activity_log` entries (both `"module_filled"` and `"module_updated"` action types) in reverse chronological order, or all available entries if fewer than 25 exist
4. EACH Activity_Log entry displayed on the Dashboard SHALL show the Entity name (resolved via `entity_id` → `entity.name`), the `module_type`, the actor's display name (resolved via `actor_id`), a relative timestamp indicating elapsed time since `created_at`, and distinct wording based on action type: "filled" for `module_filled`, "updated" for `module_updated`
5. WHEN the Dashboard activity feed query returns zero entries, THE CMS Dashboard SHALL display an empty-state message indicating no recent module activity
6. IF the Dashboard activity feed query fails, THEN THE CMS Dashboard SHALL display an error indication and allow the user to retry the query without a full page reload
7. THE `entity_activity_log` row inserted by criteria 1 and 2 SHALL be queryable via the Dashboard feed within 5 seconds of the triggering block insertion/update being persisted

### Requirement 9: Slug URL Preview Fix

**User Story:** As a CMS editor, I want the slug/URL preview to display correctly without double slashes, so that I can verify the correct public URL before publishing.

#### Acceptance Criteria

1. THE Entity_Editor SHALL render the URL preview by stripping all trailing forward slashes from the base URL prefix and all leading forward slashes from the slug value, then joining them with exactly one forward slash separator, preserving the protocol prefix (e.g. "https://")
2. WHEN the slug field contains a non-empty value, THE Entity_Editor SHALL display the URL preview text below the slug input showing the concatenated result of the base URL prefix and slug
3. IF the slug field is empty, THEN THE Entity_Editor SHALL hide the URL preview text
4. THE Entity_Editor SHALL ensure the displayed URL preview contains no consecutive forward slashes in the path portion (after the protocol "://" prefix)

### Requirement 10: Taxonomy Tooltips

**User Story:** As a CMS editor, I want clear tooltip explanations on taxonomy fields, so that I understand the distinction between Entity Type, Pillar, Category, and Subcategory.

#### Acceptance Criteria

1. THE Entity_Editor SHALL display an informational icon immediately after each taxonomy field label (Entity Type, Pillar, Category, Subcategory) that is visually distinct from the label text
2. WHEN a CMS editor hovers over a tooltip icon with a pointer or moves keyboard focus to it, THE Entity_Editor SHALL display a tooltip containing a plain-text definition of that taxonomy level (maximum 200 characters) and a one-sentence description of its relationship to its parent or child level
3. WHEN the CMS editor moves the pointer away from the tooltip icon or moves keyboard focus to another element, THE Entity_Editor SHALL dismiss the tooltip within 300 milliseconds
4. IF the tooltip content for a taxonomy field is not available from the content store, THEN THE Entity_Editor SHALL hide the tooltip icon for that field rather than displaying an empty tooltip
5. THE tooltip content SHALL be loaded from an external configuration source (e.g., `settings` table or a JSON config file) that can be updated without modifying or redeploying component source code

### Requirement 11: Unified Save Action

**User Story:** As a CMS editor, I want a single sticky "Save All Changes" button that persists all modified tabs, so that I do not need to save each module individually.

#### Acceptance Criteria

1. WHILE one or more tabs have unsaved changes, THE Entity_Editor SHALL render a sticky "Save All Changes" button that remains visible regardless of scroll position; WHEN no tabs have unsaved changes, THE Entity_Editor SHALL hide the "Save All Changes" button
2. WHEN a CMS editor clicks "Save All Changes", THE Entity_Editor SHALL disable the button, display a loading indicator, and persist all dirty tab states before re-enabling the button
3. WHEN all dirty tab states are persisted successfully, THE Entity_Editor SHALL clear the dirty flag for each saved tab and display a success notification within 2 seconds of completion
4. THE Entity_Editor SHALL render a per-module save icon on each tab that has unsaved changes, allowing editors to save an individual tab without triggering a save of all dirty tabs
5. IF one or more tab saves fail during "Save All Changes", THEN THE Entity_Editor SHALL display an error message indicating which tab or tabs failed, clear the dirty flag only for tabs that succeeded, and preserve unsaved data in failed tabs so the editor can retry

### Requirement 12: Module Completion Indicators

**User Story:** As a CMS editor, I want visual indicators showing which Content Modules are filled versus empty, so that I can quickly assess completeness at a glance.

#### Acceptance Criteria

1. THE Entity_Editor SHALL display a completion indicator next to each Content_Module name in the module list, using one of three mutually exclusive states: "empty" (empty dot), "filled" (filled dot), or "published" (checkmark)
2. WHEN a Content_Module has at least one non-deleted, visible `module_block` whose `content` JSON field contains at least one non-whitespace character in any text property (or a non-empty URL for image/video blocks), THE Entity_Editor SHALL display the indicator as "filled"
3. WHEN a Content_Module has zero non-deleted visible `module_block` rows, or all such blocks contain only empty or whitespace-only values, THE Entity_Editor SHALL display the indicator as "empty"
4. WHEN a Content_Module's `workflow_status` column equals `'published'`, THE Entity_Editor SHALL display the indicator as a checkmark, regardless of content block state (confirmed: `entity_module.workflow_status` exists at module level with values including 'draft' and 'published')
5. THE Entity_Editor SHALL evaluate indicator state in the following precedence order: "published" (highest), "filled", "empty" (lowest)
6. WHEN a content block is added to, removed from, or edited within a Content_Module, THE Entity_Editor SHALL update the completion indicator within 2 seconds without requiring a page refresh

### Requirement 13: Selection Process Tag Input

**User Story:** As a CMS editor, I want the Selection Process field to use a proper tag/chip input instead of comma-separated text, so that I can add and remove process steps cleanly.

#### Acceptance Criteria

1. THE Selection_Process_Tab SHALL render the selection process stages (from `entity_selection_stage` rows) as individual removable chips in a tag input component, displayed in `display_order`
2. WHEN a CMS editor types a stage name and presses Enter or comma, THE Selection_Process_Tab SHALL trim leading and trailing whitespace and add the text as a new chip (creating an `entity_selection_stage` row), provided the trimmed text is between 1 and 100 characters and is not a duplicate of an existing stage (case-insensitive comparison)
3. IF the CMS editor submits an empty or whitespace-only input, or a duplicate of an existing stage, or input exceeding 100 characters, THEN THE Selection_Process_Tab SHALL not add a chip and SHALL display an inline message indicating the reason for rejection
4. WHEN a CMS editor clicks the remove icon on a chip, THE Selection_Process_Tab SHALL soft-delete that stage (set `deleted_at`) immediately without confirmation
5. THE Selection_Process_Tab SHALL persist the ordered list of stages preserving insertion order via `display_order`, with a maximum of 20 stages per entity

### Requirement 14: Data Migration for Existing Entities

**User Story:** As a CMS administrator, I want existing exam data (dates scattered across multiple locations) to be consolidated into the canonical source during deployment, so that the single-source-of-truth model works immediately for all existing exams without manual cleanup.

#### Acceptance Criteria

1. UPON deployment, THE system SHALL run an automated migration script that, for each existing Entity in the `entity` table, creates `entity_timeline_event` rows for all standard Date_Type_Enum values that do not already exist for that Entity
2. WHEN an existing Entity has date values stored in multiple source locations (existing `entity_timeline_event` rows with `event_type = 'other'` whose `title` matches a standard date concept, `entity.metadata` JSON fields, or `module_block.content` JSON fields), THE migration SHALL resolve conflicts using the **most-recently-updated source** rule: the value from whichever source location has the most recent `updated_at` timestamp for that specific field SHALL be used
3. WHEN two or more source locations have identical `updated_at` timestamps (or no timestamp is available to compare), THE migration SHALL fall back to this fixed priority order: (1) existing `entity_timeline_event` row > (2) `module_block.content` field (as Content Modules are the surface editors used most recently in practice for date updates) > (3) `entity.metadata` legacy field. THE migration SHALL log this fallback case for manual review rather than resolving it silently
4. AFTER migration completes for an Entity, THE system SHALL NOT delete the legacy date fields from `entity.metadata` or `module_block.content`; they SHALL be retained as read-only historical data but SHALL NOT be displayed as editable fields in the Entity_Editor
5. THE migration script SHALL produce a detailed summary log listing: total Entities processed, number of date rows created, number of conflicts detected (same date_type with different values across sources), and for each conflict: the Entity name, the date_type, the winning value and its source, and the discarded value(s) with their sources — so a CMS admin can manually verify or revert any migration decision that looks wrong
6. FOR existing `entity_timeline_event` rows that currently have `event_type = 'other'` but whose `title` matches a standard date concept (e.g., title contains "Application Start", "Exam Date", "Admit Card"), THE migration SHALL reclassify these rows by updating their `event_type` to the matching Date_Type_Enum value using title-based string matching (case-insensitive, substring match against a predefined mapping). Non-matching rows SHALL remain as `event_type = 'other'` (custom dates)
7. FOR vacancy data: THE migration SHALL ensure an `entity_vacancy` row with `category = 'total'` exists for every Entity that has a vacancy count in `entity.metadata` or legacy fields, copying the value from the most recently updated source using the same priority rules as Criteria 2–3
8. THE migration SHALL be idempotent: running it multiple times SHALL NOT create duplicate rows or overwrite values that were manually corrected after a previous migration run. The migration SHALL check for existing rows by (entity_id, event_type) before inserting and SHALL skip rows where `event_date` is already non-null (indicating a previous successful migration or manual edit)

### Requirement 15: Conducting Body Normalization

**User Story:** As a CMS administrator, I want conducting bodies stored as normalized lookup entries rather than free text, so that uniqueness constraints, fuzzy matching, and filter dropdowns operate reliably on canonical values.

**Decision rationale (Option A chosen):** Schema review revealed existing data inconsistencies (e.g., "AIIMS New Delhi" vs "All India Institute of Medical Sciences (AIIMS)", "IBPS" vs possible future "Institute of Banking Personnel Selection"). With only 3 entities in the new `entity` table and ~127 in legacy `exams`, now is the optimal time to normalize before more data accumulates. Option B (normalized-text-only) would leave the dropdown filter unreliable and the uniqueness constraint bypassable through formatting differences.

#### Acceptance Criteria

1. THE system SHALL create a `conducting_body` lookup table with columns: `id` (uuid, PK), `name` (text, unique, the full canonical name), `short_name` (text, nullable, e.g. "UPSC", "NTA", "SSC"), `slug` (text, unique, URL-safe), `official_website` (text, nullable), `created_at` (timestamptz), and `updated_at` (timestamptz)
2. THE system SHALL add a `conducting_body_id` column (uuid, FK to `conducting_body.id`) to the `entity` table, initially nullable during migration
3. UPON deployment, THE migration SHALL: (a) extract all distinct `conducting_body` text values from the `entity` table and the legacy `exams` table, (b) de-duplicate these by lowercased/trimmed comparison, (c) insert one canonical row per unique conducting body into the `conducting_body` table, (d) update each `entity` row's `conducting_body_id` to reference the matching canonical entry
4. WHEN the migration encounters text values that are likely variants of the same conducting body (e.g., "AIIMS New Delhi" and "All India Institute of Medical Sciences (AIIMS)"), THE migration SHALL map them to the same canonical entry using a predefined alias list, and SHALL log ambiguous cases (similarity > 0.6 but no exact alias match) for manual review
5. AFTER migration is verified complete and all `entity` rows have a non-null `conducting_body_id`, THE system SHALL make `conducting_body_id` NOT NULL and MAY retain the legacy `conducting_body` text column as read-only for reference but SHALL NOT use it for uniqueness constraints, filtering, or fuzzy matching
6. THE Entity_Editor SHALL replace the free-text `conducting_body` input with a searchable dropdown/combobox populated from the `conducting_body` lookup table, with an option to "Add new conducting body" for cases not yet in the table (restricted to admin/editor roles)
7. THE Exam_Manager filter for Conducting_Body (Requirement 6) SHALL populate its dropdown options exclusively from the `conducting_body` lookup table, displaying `short_name` where available and `name` as fallback
