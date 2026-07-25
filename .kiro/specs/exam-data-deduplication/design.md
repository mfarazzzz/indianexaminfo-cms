# Technical Design Document

## Overview

This design implements the exam-data-deduplication feature across 15 requirements, transforming the IndianExamInfo CMS from duplicated, independently-edited date/vacancy fields into a single-source-of-truth model with automatic sync, duplicate prevention, and UI improvements.

**Stack:** React 18 + TypeScript, TanStack Query, Radix UI, Zod validation, Supabase (Postgres), existing service-layer pattern with `db.from().select()` chains and manual `mapRow` functions.

**Key architectural decisions:**
- New `conducting_body` lookup table with FK on `entity`
- `entity_timeline_event.event_type` repurposed as the Date_Type_Enum key for standard dates
- React Context (`TimelineDatesContext`) for cross-tab date sync within a single browser session
- `pg_trgm` extension for fuzzy duplicate detection
- All new services follow existing pattern: service file → hook → component (no direct DB in components)

## Architecture

### System Context

The feature operates entirely within the CMS admin SPA (React) and its Supabase Postgres backend. No external systems are affected. The public frontend reads from the same `entity_timeline_event` table — consolidating dates there means the frontend automatically benefits.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EntityEditorShell                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              TimelineDatesProvider (new Context)                │  │
│  │                                                                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │  │
│  │  │ General  │  │ Timeline │  │ Modules  │  │ Vacancy/Fee  │ │  │
│  │  │ Tab      │  │ Tab      │  │ Tab      │  │ Tab          │ │  │
│  │  │(ReadOnly │  │(Editable │  │(ReadOnly │  │(Editable     │ │  │
│  │  │ Chips)   │  │ Dates)   │  │ Chips)   │  │ Vacancy)     │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              SaveAllButton (sticky, dirty-aware)                │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│ conductingBody  │  │ timelineService  │  │ duplicateCheckService│
│ Service         │  │ (extended)       │  │ (new)                │
└────────┬────────┘  └────────┬─────────┘  └──────────┬───────────┘
         │                    │                        │
         ▼                    ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Supabase / Postgres                                │
│  conducting_body | entity_timeline_event | entity | entity_activity_log │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Sync Strategy

Date values flow one-way: **Timeline Tab → entity_timeline_event → TanStack Query cache → TimelineDatesContext → ReadOnlyChips in all other tabs**. This is achieved without websockets or polling — TanStack Query's `invalidateQueries` on timeline mutations triggers a refetch that updates the context.

Vacancy values follow the same pattern: **Vacancy Tab → entity_vacancy → TanStack Query cache → TimelineDatesContext → ReadOnlyVacancyChips**.

## Components and Interfaces

### New Shared Context: TimelineDatesContext

```typescript
// src/contexts/TimelineDatesContext.tsx
interface DateEntry {
  eventType: string
  date: string | null
  isHighlighted: boolean
  title: string
}

interface TimelineDatesContextValue {
  dates: Map<string, DateEntry>          // keyed by event_type
  totalVacancy: number | null
  isLoading: boolean
  navigateToTimeline: (eventType: string) => void
  navigateToVacancy: () => void
}
```

Mounted inside `EntityEditorShell`, wraps all tab content. Uses `useSatelliteQuery` with the existing `entityKeys.timeline(entityId)` cache key.

### New UI Components

| Component | Path | Props Interface |
|---|---|---|
| `ReadOnlyDateChip` | `src/components/shared/ReadOnlyDateChip.tsx` | `{ eventType: string; label?: string }` |
| `ReadOnlyVacancyChip` | `src/components/shared/ReadOnlyVacancyChip.tsx` | `{}` (reads from context) |
| `DuplicateWarningBanner` | `src/components/entity-editor/DuplicateWarningBanner.tsx` | `{ name: string; conductingBodyId: string \| null }` |
| `ActivityFeed` | `src/components/dashboard/ActivityFeed.tsx` | `{ limit?: number }` |
| `ModuleCompletionDot` | `src/components/entity-editor/modules/ModuleCompletionDot.tsx` | `{ module: EntityModule; blocks: ModuleBlock[] }` |
| `SaveAllButton` | `src/components/entity-editor/SaveAllButton.tsx` | `{ entityId: string }` |
| `ConductingBodySelect` | `src/components/shared/ConductingBodySelect.tsx` | `{ value: string \| null; onChange: (id: string) => void }` |
| `TagChipInput` | `src/components/shared/TagChipInput.tsx` | `{ value: string[]; onChange: (tags: string[]) => void; max?: number }` |
| `TaxonomyTooltip` | `src/components/shared/TaxonomyTooltip.tsx` | `{ fieldKey: string }` |

### Modified Components

| Component | Changes |
|---|---|
| `EntityEditorShell.tsx` | Wrap tabs in `TimelineDatesProvider`; add `SaveAllButton` to header |
| `TimelineTab.tsx` | Add fixed default rows for standard Date_Type_Enum; disable delete on standard rows; urgent row highlighting |
| `GeneralTab.tsx` | Replace `conducting_body` text input with `ConductingBodySelect`; replace date inputs with `ReadOnlyDateChip`; add `TaxonomyTooltip`; fix slug preview |
| `ModulesTab.tsx` | Add `ModuleCompletionDot` next to each module name |
| `ModuleEditor.tsx` | Replace date fields matching Date_Type_Enum with `ReadOnlyDateChip`; block free-text date inputs |
| `DashboardPage.tsx` | Add `ActivityFeed` section |
| `SelectionProcessTab.tsx` | Replace text input with `TagChipInput` |

### New Services

| Service | Path | Key Functions |
|---|---|---|
| `conductingBodyService.ts` | `src/services/entity/` | `listConductingBodies()`, `searchConductingBodies(q)`, `createConductingBody(input)` |
| `duplicateCheckService.ts` | `src/services/entity/` | `checkDuplicateEntity(name, conductingBodyId, year?)` |
| `activityLogService.ts` | `src/services/entity/` | `logModuleActivity(...)`, `listRecentActivity(limit)` |

### New Hooks

| Hook | Path | Purpose |
|---|---|---|
| `useTimelineDates` | `src/hooks/useTimelineDates.ts` | Consumes TimelineDatesContext; returns date by event_type |
| `useDuplicateCheck` | `src/hooks/useDuplicateCheck.ts` | Debounced (500ms) fuzzy match query during entity creation |
| `useActivityFeed` | `src/hooks/useActivityFeed.ts` | TanStack Query hook for dashboard feed |
| `useConductingBodies` | `src/hooks/useConductingBodies.ts` | TanStack Query hook for dropdown data |
| `useSaveAll` | `src/hooks/useSaveAll.ts` | Orchestrates saving all dirty tabs via `Promise.allSettled` |
| `useSlugValidation` | `src/hooks/useSlugValidation.ts` | Debounced uniqueness check for conducting_body_id + slug |

### Query Key Extensions

```typescript
// Added to src/lib/queryKeys.ts
export const conductingBodyKeys = {
  all:    () => ['conducting-bodies'] as const,
  list:   () => ['conducting-bodies', 'list'] as const,
  search: (q: string) => ['conducting-bodies', 'search', q] as const,
} as const

export const activityFeedKeys = {
  all:     () => ['activity-feed'] as const,
  recent:  (limit: number) => ['activity-feed', 'recent', limit] as const,
} as const

export const duplicateCheckKeys = {
  check: (name: string, bodyId: string | null) => ['duplicate-check', name, bodyId] as const,
} as const
```

## Data Models

### New Tables

```sql
-- Requirement 15: Conducting Body lookup table
CREATE TABLE conducting_body (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL UNIQUE,
  short_name       text,
  slug             text NOT NULL UNIQUE,
  official_website text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE conducting_body ENABLE ROW LEVEL SECURITY;

-- Requirement 14: Migration audit log
CREATE TABLE entity_migration_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         uuid NOT NULL REFERENCES entity(id),
  field_type        text NOT NULL,          -- e.g. 'date:notification_date', 'vacancy:total'
  winning_value     text,
  winning_source    text NOT NULL,          -- 'timeline_event' | 'module_block' | 'entity_metadata'
  discarded_values  jsonb DEFAULT '[]',     -- [{value, source, updated_at}]
  resolution_method text NOT NULL,          -- 'timestamp_priority' | 'fallback_order' | 'no_conflict'
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE entity_migration_log ENABLE ROW LEVEL SECURITY;
```

### Schema Modifications

```sql
-- Requirement 15: FK column on entity
ALTER TABLE entity ADD COLUMN conducting_body_id uuid REFERENCES conducting_body(id);

-- Requirement 7: Unique constraint (partial — excludes soft-deleted)
CREATE UNIQUE INDEX uq_entity_conducting_body_slug 
  ON entity(conducting_body_id, slug) WHERE deleted_at IS NULL;

-- Requirement 5: pg_trgm for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_entity_name_trgm ON entity USING gin (name gin_trgm_ops);

-- Requirement 8: Activity feed performance index
CREATE INDEX idx_entity_activity_log_recent 
  ON entity_activity_log(created_at DESC) 
  WHERE action IN ('module_filled', 'module_updated');
```

### Date_Type_Enum Values

Standard `event_type` values stored in `entity_timeline_event`:

| event_type | Display Label | Modules That Reference It |
|---|---|---|
| `notification_date` | Notification Date | notification |
| `application_start` | Application Start Date | application |
| `application_end` | Application End Date | application |
| `fee_payment_last_date` | Fee Payment Last Date | application |
| `exam_date` | Exam Date | admit_card, answer_key |
| `admit_card_release` | Admit Card Release Date | admit_card |
| `answer_key_release` | Answer Key Release Date | answer_key |
| `result_date` | Result Date | result |

Custom dates continue to use `event_type = 'other'`.

### TypeScript Interfaces

```typescript
// src/types/entity.ts (additions)
export interface ConductingBody {
  id: string
  name: string
  shortName: string | null
  slug: string
  officialWebsite: string | null
}

export interface ActivityLogEntry {
  id: string
  entityId: string
  entityName: string
  moduleId: string | null
  moduleType: string
  actorId: string
  actorName: string
  action: 'module_filled' | 'module_updated'
  createdAt: string
}

export const STANDARD_DATE_TYPES = [
  'notification_date', 'application_start', 'application_end',
  'fee_payment_last_date', 'exam_date', 'admit_card_release',
  'answer_key_release', 'result_date',
] as const

export type StandardDateType = typeof STANDARD_DATE_TYPES[number]
```

## Correctness Properties

### Property 1: Single Source of Truth for Dates
For any standard date_type, exactly one `entity_timeline_event` row exists per entity. Enforced by `ensureStandardDates()` on tab load + the deployment migration backfill. The UI prevents deletion of standard rows. No editable date input for standard types exists outside the Timeline Tab.

**Validates: Requirements 1.1, 1.3, 2.2**

### Property 2: No Duplicate Editable Fields
Content Module templates cannot define editable date fields matching Date_Type_Enum values. Enforced at the block editor level: fields matching standard date types are rendered as ReadOnlyDateChips, not inputs. Free-text date fields are blocked by Requirement 3.7 schema enforcement. Pre-existing embedded date values in `module_block.content` JSON are addressed by Migration 2b (extracted into `entity_timeline_event` or flagged for conflict resolution); the original JSON values are retained as inert historical data but never rendered as editable inputs post-migration.

**Validates: Requirements 3.2, 3.7, 4.2**

### Property 3: Slug Uniqueness
The partial unique index `(conducting_body_id, slug) WHERE deleted_at IS NULL` guarantees no two live entities under the same conducting body share a slug. Validated client-side via `useSlugValidation` (debounced 500ms) and hard-blocked by the DB constraint on save.

**Validates: Requirements 7.1, 7.2, 7.5**

### Property 4: Migration Idempotency
`ensureStandardDates()` checks `(entity_id, event_type)` before inserting. The migration script skips rows where `event_date IS NOT NULL`. Running migrations repeatedly produces the same result without creating duplicates or overwriting manual corrections.

**Validates: Requirements 14.8, 1.8**

### Property 5: Activity Log Completeness
Every block create/update/delete operation in `moduleService.ts` triggers `logModuleActivity`. The "module_filled" vs "module_updated" distinction is determined by comparing the block count before and after the operation (0→N = filled, N→M = updated).

**Validates: Requirements 8.1, 8.2**

## Error Handling

### Network/Server Errors

| Scenario | Handling |
|---|---|
| Timeline date save fails | Toast error; retain form value in input; allow retry (Req 1.7) |
| Save All — partial failure | Display error listing failed tabs; clear dirty only on succeeded tabs; preserve unsaved data (Req 11.5) |
| Duplicate check API timeout | Silently discard; allow creation to proceed (Req 5.5) |
| Slug uniqueness check fails | Show inline validation error with link to conflicting entity (Req 7.2) |
| Activity feed query fails | Show error state with retry button on dashboard (Req 8.6) |
| Conducting body creation fails | Toast error; keep combobox in "add new" state for retry |

### Validation Errors

| Scenario | Handling |
|---|---|
| Invalid date format | Inline error on timeline row; prevent save (Req 1.6, 2.6) |
| Tag input > 100 chars | Inline rejection message; chip not added (Req 13.3) |
| Duplicate tag (case-insensitive) | Inline rejection message; chip not added (Req 13.3) |
| Max 50 custom date rows | Disable "Add Date" button; show hint text |
| Max 20 selection stages | Disable input; show hint text |

### Migration Errors

| Scenario | Handling |
|---|---|
| Title-matching ambiguity | Row stays as `event_type = 'other'`; logged for manual review |
| Conducting body variant detection | Mapped via alias list; ambiguous cases logged, not auto-merged |
| Date conflict (different values) | Resolved by timestamp priority → fallback order; full details logged to `entity_migration_log` |

## Postgres Functions

### Fuzzy Duplicate Check (Requirement 5)

```sql
CREATE OR REPLACE FUNCTION check_duplicate_entity(
  p_name text,
  p_conducting_body_id uuid DEFAULT NULL,
  p_threshold float DEFAULT 0.7
)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  workflow_status text,
  conducting_body_id uuid,
  conducting_body_name text,
  updated_at timestamptz,
  updated_by_name text,
  similarity_score float
) AS $$
DECLARE
  v_year text;
BEGIN
  v_year := substring(p_name from '\d{4}');
  
  RETURN QUERY
  WITH scored AS (
    SELECT 
      e.id,
      e.name,
      e.slug,
      e.workflow_status,
      e.conducting_body_id,
      cb.name AS conducting_body_name,
      e.updated_at,
      up.name AS updated_by_name,
      (
        similarity(e.name, p_name) * 0.6 +
        CASE WHEN p_conducting_body_id IS NOT NULL 
             AND e.conducting_body_id = p_conducting_body_id THEN 0.2 ELSE 0.0 END +
        CASE WHEN v_year IS NOT NULL AND e.name ~ v_year THEN 0.2 ELSE 0.0 END
      )::float AS similarity_score
    FROM entity e
    LEFT JOIN conducting_body cb ON cb.id = e.conducting_body_id
    LEFT JOIN user_profiles up ON up.id = e.updated_by
    WHERE e.deleted_at IS NULL
      AND similarity(e.name, p_name) > 0.3
  )
  SELECT s.*
  FROM scored s
  WHERE s.similarity_score >= p_threshold
  ORDER BY s.similarity_score DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE;
```

The similarity formula is computed once in the CTE (`scored`) and referenced by name in the outer query's WHERE and ORDER BY clauses. This eliminates the previous issues: (1) the anonymous column problem (now explicitly aliased as `similarity_score` matching the RETURNS TABLE signature), (2) the fragile `ORDER BY 9` positional reference (now `ORDER BY s.similarity_score DESC`), and (3) the triple-duplicated formula (now written once in the CTE).

### Slug Uniqueness Check (Requirement 7)

```sql
CREATE OR REPLACE FUNCTION check_slug_available(
  p_slug text,
  p_conducting_body_id uuid,
  p_exclude_entity_id uuid DEFAULT NULL
)
RETURNS TABLE(is_available boolean, conflicting_entity_id uuid, conflicting_entity_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT
    NOT EXISTS(
      SELECT 1 FROM entity 
      WHERE slug = p_slug AND conducting_body_id = p_conducting_body_id
        AND deleted_at IS NULL
        AND (p_exclude_entity_id IS NULL OR id != p_exclude_entity_id)
    ),
    (SELECT e.id FROM entity e 
     WHERE e.slug = p_slug AND e.conducting_body_id = p_conducting_body_id
       AND e.deleted_at IS NULL AND (p_exclude_entity_id IS NULL OR e.id != p_exclude_entity_id)
     LIMIT 1),
    (SELECT e.name FROM entity e 
     WHERE e.slug = p_slug AND e.conducting_body_id = p_conducting_body_id
       AND e.deleted_at IS NULL AND (p_exclude_entity_id IS NULL OR e.id != p_exclude_entity_id)
     LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE;
```

## Migration Strategy (Requirements 14 + 15)

### Migration 1: Conducting body normalization

1. Create `conducting_body` table with RLS
2. Extract distinct `conducting_body` text from `entity` + `exams` tables
3. De-duplicate by lowercased/trimmed comparison + predefined alias list
4. Insert canonical entries; log ambiguous mappings
5. Backfill `entity.conducting_body_id` FK

### Migration 2: Timeline event_type reclassification

1. For each entity, scan `entity_timeline_event` rows where `event_type = 'other'`
2. Title-match against standard labels (case-insensitive substring)
3. Update matched rows' `event_type` to the standard value
4. Insert missing standard-type placeholder rows (null `event_date`)

### Migration 2b: Extract embedded dates from module_block content

Addresses the gap where date values may exist as free-text inside `module_block.content` JSON with no corresponding `entity_timeline_event` row (e.g., an Admit Card block containing `"admitCardReleaseDate": "2026-08-15"` or a Result block containing `"resultDeclaredDate": "2026-09-01"`).

1. For each entity, scan `module_block.content` JSON in modules of types known to embed standard dates:
   - `admit-card` blocks: look for keys `admitCardReleaseDate`, `examDate`
   - `result` blocks: look for keys `resultDeclaredDate`
   - `answer-key` blocks: look for keys `releaseDate`, `challengeStartDate`, `challengeEndDate`
   - `application` blocks: look for keys `applicationStartDate`, `applicationEndDate`
   - `notification` blocks: look for keys `notificationDate`
2. Map each discovered JSON key to its corresponding Date_Type_Enum value using a predefined key→event_type mapping
3. For each discovered value, if the corresponding `entity_timeline_event` row for that entity + event_type has a null `event_date` (placeholder created in Migration 2), populate it with the discovered value — subject to the conflict resolution rules in Migration 3
4. If the `entity_timeline_event` row already has a non-null `event_date` (populated by Migration 2 from a title-matched row), treat this as a conflict case and route through Migration 3's timestamp-priority resolution
5. Log all extractions to `entity_migration_log` with `winning_source = 'module_block'` and the specific block_id in `discarded_values` metadata for traceability
6. Do NOT modify or delete the original `module_block.content` JSON — the embedded date values remain as inert historical data. The UI layer (ModuleEditor.tsx) handles rendering them as ReadOnlyDateChips going forward.

### Migration 3: Date conflict resolution

1. For each entity + standard date_type with multiple source values (from Migration 2 title-reclassification and Migration 2b module_block extraction):
   - Compare `updated_at` timestamps across sources
   - Apply winning value to timeline event row
   - Log full details to `entity_migration_log`
2. Skip if timeline event already has non-null `event_date` and was not flagged for conflict by Migration 2b (idempotency)

### Migration 4: Vacancy normalization

1. Ensure `entity_vacancy` row with `category = 'total'` per entity
2. Source from most-recently-updated location

### Execution order: 1 → 2 → 2b → 3 → 4 (sequential, each idempotent)

### Transaction Boundaries and Dry-Run Mode

**Transaction boundaries:** Each of the 5 migration steps (1, 2, 2b, 3, 4) runs inside its own database transaction. A failure partway through any single migration rolls back that entire migration atomically (not just the failing row), leaving the database in the state it was in before that migration started. This guarantees that re-running from a clean idempotent state is always possible — no partial/corrupt intermediate states.

**Dry-run mode:** The migration script supports a `--dry-run` flag (implemented as a parameter in the Supabase migration function or a separate SQL script variant) that:

1. Executes all read, comparison, and conflict-resolution logic identically to the live run
2. Writes the full `entity_migration_log` output (all conflict resolutions, winning/discarded values, ambiguous conducting_body mappings, unmatched title reclassifications, module_block date extractions)
3. Does NOT commit any changes to `entity`, `entity_timeline_event`, `entity_vacancy`, or `conducting_body` tables — the transaction is rolled back at the end, preserving only the log output (written to a separate `entity_migration_log_preview` table that is not rolled back, or output as a downloadable report)

**Operational workflow:**
1. Run `--dry-run` against production database
2. CMS admin reviews the migration log: conflict resolutions, ambiguous conducting_body merges, module_block date extractions, title-match reclassifications
3. Adjust the alias mapping or manually correct data if needed
4. Run the live migration (without `--dry-run`) — this is a separate, explicit step taken only after dry-run output has been reviewed and approved
5. Verify final state by re-running dry-run (should report zero conflicts since all data is now consistent)

## Slug URL Preview Fix (Requirement 9)

```typescript
// src/lib/utils.ts (new utility)
export function buildUrlPreview(pillar: string | null, category: string | null, slug: string): string {
  const parts = [pillar, category, slug].filter(Boolean)
  return '/' + parts.map(p => p!.replace(/^\/+|\/+$/g, '')).join('/')
}
```

## Tooltip Configuration (Requirement 10)

Stored in existing `settings` table:

```json
{
  "key": "taxonomy_tooltips",
  "group": "editor",
  "value": {
    "entity_type": "Determines the schema and available fields. Example: 'exam' enables exam-specific modules.",
    "pillar": "Determines the URL path prefix (e.g., /sarkari-naukri/). This is the primary content vertical.",
    "category": "Groups related exams under a conducting body or subject area. Appears in navigation and breadcrumbs.",
    "subcategory": "Optional sub-grouping within a category. Used for filtering, not URL routing."
  }
}
```

## Performance Considerations

1. **pg_trgm index** on `entity.name` ensures fuzzy search stays fast as entity count grows
2. **TimelineDatesContext** reuses TanStack Query cache — no additional network requests
3. **Activity feed index** (`created_at DESC WHERE action IN (...)`) targets dashboard query
4. **Conducting body dropdown** is a small table (<200 rows); cached with `staleTime: Infinity`
5. **Save All** uses `Promise.allSettled` for parallel tab saves

## Security & RLS

- `conducting_body`: readable by all authenticated users, writable by admin/editor. Supports parent/child hierarchy via `parent_id` self-reference. **Both parent rows and child rows are first-class conducting bodies** — fully selectable as `entity.conducting_body_id`. Parent rows are not grouping-only labels; they represent the umbrella institution in its coordinating capacity (e.g., AIIMS running CRE, IIM running CAT).

### Conducting Body Hierarchy Rule (generalized)

The following decision rule applies uniformly to all conducting bodies during migration and future data entry:

> If a conducting body text value names a specific campus, branch, region, or district office of a larger institution, create it as a **child** of that institution's parent row. If the text value names the institution generically (no campus/branch qualifier), it maps to the **parent** row. The parent row is always usable as a `conducting_body_id` on an entity.

This pattern applies to: AIIMS campuses, IIM campuses, SSC regions, state PSC district offices, NTA sub-centers, ICAI chapters, and any future umbrella-shaped organization — no per-org special-casing in code.

- `entity_migration_log`: readable by admin only
- Postgres functions use `STABLE` volatility (no SECURITY DEFINER needed)
- All service calls go through Supabase client with user JWT — RLS applies automatically

## Testing Strategy

### Unit Tests
- Zod schema validation for `conductingBodyId` (uuid required), `buildUrlPreview` utility (no double slashes), date_type classification mapping logic, TagChipInput deduplication/max-length rules

### Integration Tests
- Migration scripts against test DB with known fixtures: verify idempotency (run twice, assert same state), verify conflict resolution picks most-recent timestamp, verify alias mapping collapses known variants
- Migration 2b: seed test DB with module_block content containing embedded dates; verify extraction into entity_timeline_event; verify conflict resolution when timeline event already has a value
- Dry-run mode: verify migration log is populated but entity/timeline/vacancy tables remain unchanged after dry-run completes

### Component Tests
- `ReadOnlyDateChip`: renders formatted date from context; shows "Not set" for null; click navigates to Timeline tab
- `DuplicateWarningBanner`: appears when fuzzy match returns results above threshold; dismisses when input changes and no matches found
- `ModuleCompletionDot`: shows empty/filled/published based on block data + workflow_status
- `SaveAllButton`: visible only when dirtyTabs.size > 0; disabled during save; shows per-tab errors on partial failure

### End-to-End (Manual)
- Edit date in Timeline Tab → verify Content Module ReadOnlyChip updates instantly
- Create new exam with similar name to existing → verify warning banner with link to existing
- Attempt to save duplicate slug under same conducting body → verify hard error with link
- Dashboard activity feed shows recent module_filled/module_updated entries with correct wording
