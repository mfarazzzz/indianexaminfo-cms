# API Reference

> Internal service layer documentation. All data access flows through these services.

---

## 1. Entity Service

**File:** `src/services/entity/entityService.ts`
**Domain:** `entity` table (universal content parent)

### Methods

#### `listEntities(opts?: EntityListOpts): Promise<{data: EntityListItem[], count: number}>`
List entities with filtering and keyset pagination.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `opts.pillar` | string | Filter by pillar slug |
| `opts.workflowStatus` | string | Filter by status |
| `opts.entityType` | string | Filter by entity type |
| `opts.isFeatured` | boolean | Filter featured only |
| `opts.categoryId` | string | Filter by category |
| `opts.search` | string | Name ILIKE search |
| `opts.cursor` | string | Cursor for pagination (updated_at) |
| `opts.limit` | number | Page size (default: 50) |

#### `getEntityById(id: string): Promise<Entity | null>`
Fetch entity with template snapshot (from `entity_snapshot` table).

#### `getEntityFull(id: string): Promise<EntityFull | null>`
Fetch entity with ALL satellite data (12 parallel queries). Used by the entity editor.

#### `createEntity(input: EntityCreateInput): Promise<Entity>`
Create entity with auto-slug generation, snapshot creation, and SEO skeleton.

**Errors:** Throws if slug is unavailable (after year-append fallback).

#### `updateEntity(id: string, input: Partial<EntityCreateInput>, userId?: string): Promise<Entity>`
Update entity fields. Records slug changes in history.

#### `transitionWorkflow(id: string, targetStatus: WorkflowStatus, userId: string): Promise<Entity>`
Validates transition against state machine. Blocks invalid transitions. Creates revision on publish. Checks SEO readiness for publish.

**Errors:** Throws if transition not allowed or publish readiness fails.

#### `verifyEntity(id: string, userId: string, source?: string, notes?: string): Promise<Entity>`
Mark content as verified. Updates `last_verified_at` and logs to activity.

#### `softDeleteEntity(id: string): Promise<void>`
Sets `deleted_at` timestamp.

#### `searchEntities(query: string, limit?: number): Promise<EntityListItem[]>`
Full-text name search.

#### `bulkUpdateStatus(ids: string[], status: string): Promise<void>`
#### `bulkSetFeatured(ids: string[], isFeatured: boolean): Promise<void>`
#### `bulkSoftDelete(ids: string[]): Promise<void>`
#### `bulkUpdateCategory(ids: string[], categoryId: string): Promise<void>`

---

## 2. Timeline Service

**File:** `src/services/entity/timelineService.ts`
**Domain:** `entity_timeline_event` table

### Methods

#### `listTimeline(entityId: string): Promise<TimelineEvent[]>`
All non-deleted events, ordered by display_order then event_date.

#### `createTimelineEvent(entityId: string, input: TimelineEventInput): Promise<TimelineEvent>`
Creates event with publish state resolution (scheduled publishing logic).

#### `updateTimelineEvent(id: string, input: Partial<TimelineEventInput>): Promise<TimelineEvent>`
Updates event fields with publish state recalculation.

#### `softDeleteTimelineEvent(id: string): Promise<void>`

#### `reorderTimeline(entityId: string, orderedIds: string[]): Promise<void>`
Sets display_order based on array position.

#### `evaluateLifecycleRules(rules: LifecycleRule[], allEvents: TimelineEvent[]): LifecycleRuleViolation[]`
Pure function — evaluates ordering constraints. No DB calls.

#### `evaluateEntityRules(entityId: string): Promise<LifecycleRuleViolation[]>`
Loads snapshot + events and evaluates rules.

---

## 3. Module Service

**File:** `src/services/entity/moduleService.ts`
**Domain:** `entity_module` table

### Methods

#### `listModules(entityId: string): Promise<EntityModule[]>`
#### `getModuleById(id: string): Promise<EntityModule | null>`
#### `createModule(entityId: string, input: ModuleCreateInput): Promise<EntityModule>`

**Business Rule:** If a module of the same type already exists, `subTitle` is required to distinguish them.

#### `updateModule(id: string, input: Partial<ModuleCreateInput>): Promise<EntityModule>`
#### `publishModule(id: string, userId: string): Promise<EntityModule>`
#### `softDeleteModule(id: string): Promise<void>`
#### `reorderModules(entityId: string, orderedIds: string[]): Promise<void>`
#### `duplicateModule(id: string): Promise<EntityModule>`

---

## 4. Result Service

**File:** `src/services/resultService.ts`
**Domain:** `cms_results` table

### Methods

#### `listResults(opts?: CmsResultListOpts): Promise<{data: CmsResult[], count: number}>`
#### `getResultById(id: string): Promise<CmsResult | null>`
#### `getResultBySlug(slug: string): Promise<CmsResult | null>`
#### `createResult(input: CmsResultInput): Promise<CmsResult>`

**Validates:** Slug uniqueness before insert.

#### `updateResult(id: string, input: Partial<CmsResultInput>): Promise<CmsResult>`
#### `publishResult(id: string, userId?: string): Promise<CmsResult>`
#### `archiveResult(id: string): Promise<CmsResult>`
#### `deleteResult(id: string): Promise<void>` (hard delete)
#### `bulkPublishResults(ids: string[]): Promise<void>`
#### `bulkArchiveResults(ids: string[]): Promise<void>`
#### `bulkDeleteResults(ids: string[]): Promise<void>`
#### `searchResults(query: string, limit?: number): Promise<CmsResult[]>`
#### `getResultStats(): Promise<{total, published, draft, featured}>`
#### `duplicateResult(id: string): Promise<CmsResult>`

---

## 5. Education News Service

**File:** `src/services/educationNewsService.ts`
**Domain:** `cms_education_news` table

### Methods

#### `listEducationNews(opts?: CmsEducationNewsListOpts): Promise<{data: CmsEducationNews[], count: number}>`
#### `getEducationNewsById(id: string): Promise<CmsEducationNews | null>`
#### `getEducationNewsBySlug(slug: string): Promise<CmsEducationNews | null>`
#### `createEducationNews(input: CmsEducationNewsInput): Promise<CmsEducationNews>`
#### `updateEducationNews(id: string, input: Partial<CmsEducationNewsInput>): Promise<CmsEducationNews>`
#### `publishEducationNews(id: string): Promise<CmsEducationNews>`
#### `archiveEducationNews(id: string): Promise<CmsEducationNews>`
#### `deleteEducationNews(id: string): Promise<void>`
#### `bulkPublishNews(ids: string[]): Promise<void>`
#### `bulkDeleteNews(ids: string[]): Promise<void>`
#### `searchEducationNews(query: string, limit?: number): Promise<CmsEducationNews[]>`
#### `getEducationNewsStats(): Promise<{total, published, draft, breaking}>`

---

## 6. Media Service

**File:** `src/services/mediaService.ts`
**Domain:** `media` table + Supabase Storage

### Methods

#### `getMediaItems(folder?: string): Promise<MediaItem[]>`
#### `uploadMedia(file: File, folder?: string, userId?: string): Promise<MediaItem>`

**Validates:** File type and size. Sanitizes folder name against allowlist. Generates random filename.

#### `deleteMedia(id: string): Promise<void>`
Removes from storage AND database.

#### `updateMediaAlt(id: string, altText: string): Promise<void>`
Updates alt text (capped at 500 chars).

---

## 7. Revalidation Service

**File:** `src/lib/revalidation/revalidationService.ts`
**Domain:** Frontend cache invalidation

### Methods

#### `revalidateAfterExamSave(exam: {id, slug, pillar, categorySlug}): void`
Tags: `exam:{slug}`, `pillar:{pillar}`, `exams`

#### `revalidateAfterModuleSave(module: {examSlug, pillar, categorySlug, contentType}): void`
Tags: `exam:{examSlug}`, `hub:{contentType}`

#### `clearRevalidationConfigCache(): void`
Call after admin updates frontend settings.

#### `getRetryQueueLength(): number`
Diagnostic: pending retry items.

#### `getPendingTagCount(): number`
Diagnostic: tags in current debounce window.

---

## 8. AI Services

### Autofill (`src/lib/ai/autofill.ts`)

#### `autoFillExam(rawText: string): Promise<ExamAutoFillResult>`
#### `autoFillContentPost(rawText: string): Promise<ContentPostAutoFillResult>`
#### `autoFillBlogPost(rawText: string): Promise<BlogAutoFillResult>`
#### `clearApiKeyCache(): void`

### Gemini Client (`src/lib/gemini/client.ts`)

#### `generateWithGemini(prompt: string, apiKey: string, model?: string): Promise<string>`

---

## 9. Block Registry

**File:** `src/lib/blocks/blockRegistry.ts`

#### `register(definition: BlockDefinition): void`
Register a block type (idempotent — overwrites if exists).

#### `get(blockType: string): BlockDefinition`
Returns definition or safe fallback (never throws).

#### `getAll(): BlockDefinition[]`
All registered definitions (for AddBlockMenu palette).

#### `has(blockType: string): boolean`
Check if type is registered.

---

## 10. Error Patterns

All services follow consistent error handling:

```typescript
// Supabase error propagation
const { data, error } = await db.from('table').select('*').eq('id', id).single()
if (error) throw error  // Throws PostgrestError

// Business rule errors
if (!available) throw new Error('Slug already in use')

// Validation errors (Zod)
const result = schema.safeParse(input)
if (!result.success) throw result.error
```

Components catch errors via TanStack Query's `error` state or try/catch in event handlers, then display via `sonner` toast notifications.
