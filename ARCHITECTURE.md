# Architecture Rules — IndianExamInfo Content OS

> These rules govern all code written in this repository.
> They exist to keep the platform maintainable for 5–10 years.
> Violations must be approved by a senior engineer and documented with a reason.

---

## 1. Entity Rules

### 1.1 Never hardcode entity types
`entity_type` is a free-text column. Code must never switch on its value.

```typescript
// ✗ WRONG
if (entity.entityType === 'exam') { ... }
switch (entity.entityType) { case 'exam': ... }

// ✓ CORRECT
// Entity types are data. Render generically.
<EntityCard entity={entity} />
```

### 1.2 Entity types must remain extensible
Adding a new entity type (job, scholarship, admission) must require:
- Inserting a row with a new `entity_type` value
- Registering a plugin (if custom rendering is needed)
- **Zero changes to existing source files**

### 1.3 The `entity` table is the single parent
All content belongs to an `entity` row. Never create parallel parent tables.

---

## 2. Module Rules

### 2.1 Module rendering must be dynamic
The frontend renders modules by reading `module_type` from the database.
Components must never contain conditional logic on specific module types.

```typescript
// ✗ WRONG
if (module.moduleType === 'result') return <ResultModule />
if (module.moduleType === 'admit_card') return <AdmitCardModule />

// ✓ CORRECT
const Component = moduleRegistry.get(module.moduleType) ?? DefaultModule
return <Component module={module} />
```

### 2.2 Module types are data, not code
New module types are created by editors in the CMS, not by developers in source files.
The block system handles rendering — no new component is needed per module type.

### 2.3 Never switch on module type in shared components
`EntityEditorShell`, `BlockRenderer`, `ModuleRenderer`, and similar generic
components must have **zero** `switch/case` or `if/else` on `moduleType`.

---

## 3. Service Rules

### 3.1 Services never import React
Service files live in `src/services/`. They contain only data-fetching logic.
They must never import React, hooks, or UI components.

### 3.2 Services own one domain
Each service file is responsible for exactly one table or domain.
`entityService.ts` manages `entity`. `timelineService.ts` manages `entity_timeline_event`.

```
✓  src/services/entity/timelineService.ts   → entity_timeline_event table only
✗  src/services/entity/builderServices.ts  → multiple tables (split it)
```

### 3.3 Services contain business logic
Validation, data transformation, and business rules belong in services or Zod schemas,
not in components. Components call services and render results.

### 3.4 Row mappers are named and extracted
Every service file that reads from a DB table must have a named `mapRow()` function.
Inline mapping inside query results creates duplication and hides the data contract.

### 3.5 Services expose typed public interfaces
All exported functions must have explicit TypeScript return types.
Use `async function foo(): Promise<Bar>` — not `async function foo()`.

---

## 4. Component Rules

### 4.1 Components never access Supabase directly
Components call hooks or services only. The `db` client must never appear in
a `.tsx` file.

```typescript
// ✗ WRONG (in a component)
const { data } = await db.from('entity').select('*')

// ✓ CORRECT
const { data } = useEntityQuery(id)
// or
const result = await getEntityById(id)
```

### 4.2 Component LOC budget

| Type | Maximum lines |
|---|---|
| Page component | 250 |
| Feature component | 200 |
| Shared component | 150 |
| Hook | 120 |
| Service | 250 |
| Utility | 100 |

When a file exceeds its budget, split it.

### 4.3 One component per file
Each `.tsx` file exports exactly one primary component.
Internal sub-components (e.g. `SortableItem` inside `DraggableList`) are acceptable
if they are not used outside the file.

### 4.4 Shared UI lives in `src/components/shared/`
Reusable components (`FormField`, `DraggableList`, `ConfirmDialog`, etc.) live in
`src/components/shared/`. Feature-specific components live in their feature folder.

---

## 5. Hook Rules

### 5.1 Hooks orchestrate, services implement
Hooks (`useX`) coordinate: they call services, manage TanStack Query state,
handle loading/error, and expose actions to components.
Business logic belongs in services, not hooks.

### 5.2 Use the shared query hooks
For entity data, always prefer:
- `useEntityQuery(id)` over raw `useQuery` for entity detail
- `useSatelliteQuery(id, key, fn)` for satellite table data
- `useReorderMutation(key, fn)` for all drag-and-drop reorder operations
- `useEntityMutation(id)` for entity updates

### 5.3 Autosave uses stable callbacks
The `useAutosave` hook requires a stable `saveFn` reference.
Use `autosaveFnRef` pattern to prevent stale closure bugs:

```typescript
const autosaveFnRef = useRef(async () => {})
useEffect(() => { autosaveFnRef.current = handleSubmit(onSave) })
const stableSaveFn = useCallback(() => autosaveFnRef.current(), [])
const { scheduleAutosave } = useAutosave(stableSaveFn, !isNew)
```

---

## 6. Database Rules

### 6.1 Prefer normalized tables over JSON blobs
Structured data that needs querying (dates, vacancies, fees) lives in dedicated tables.
JSON (`jsonb`) is acceptable for unstructured overflow data that is never queried.

```
✓  entity_timeline_event table (queryable by date, status, entity)
✗  important_dates jsonb column (not queryable, not indexable)
```

### 6.2 Every table has soft delete
All tables use `deleted_at timestamptz NULL` for soft deletion.
Hard DELETE is reserved for GDPR erasure and admin operations.
All queries filter `WHERE deleted_at IS NULL`.

### 6.3 All writes go through the service layer
SQL and Supabase calls are only made from `src/services/`. No raw DB calls
in components, hooks, or utilities.

### 6.4 Migrations are small and idempotent
One migration = one concern (one table, one index set, one trigger).
Every migration uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` to be idempotent.
Migrations never drop columns or tables without a deprecation period.

### 6.5 Reorder uses atomic operations
`reorderX()` functions should use a single SQL statement or RPC where possible.
Multiple parallel updates are acceptable for ≤20 items but must be replaced with
a batch RPC for production at scale.

---

## 7. AI Rules

### 7.1 AI never auto-publishes
All AI-generated content must be reviewed and explicitly confirmed by the editor
before being inserted into any field. No AI action writes directly to the database.

### 7.2 AI output always goes through a preview panel
The `AIAssistant` component shows a preview panel. The editor clicks "Accept" to
insert the content. "Dismiss" leaves the current value unchanged.

### 7.3 Heavy AI operations use the job queue
Operations taking > 5 seconds (PDF extraction, full-article translation) must use
the `ai_job` queue table. The UI polls for completion.

---

## 8. Plugin Rules

### 8.1 New plugins register through the registry
New block types, module types, and dashboard widgets register via
`pluginRegistry.registerBlockType()`, `registerModuleType()`, etc.

### 8.2 Core code must not require modification for new plugins
Adding a new plugin must not require editing `BlockRenderer.tsx`,
`EntityEditorShell.tsx`, or any other core file.

### 8.3 Core plugins register via `corePlugin.ts`
All built-in block types and module types are registered in
`src/lib/plugins/corePlugin.ts`, not hardcoded in component files.

---

## 9. Testing Rules

### 9.1 Every service function has a unit test
Tests live in `*.test.ts` next to their source file or in a `__tests__/` directory.

### 9.2 Every editor tab has a component test
Tests render the tab with a mocked entity and verify save/error behavior.

### 9.3 E2E tests cover the critical editorial path
Playwright tests must cover: Create Exam, Save Exam, Publish Exam, Rollback,
Add Timeline Event, Delete Timeline Event.

### 9.4 Tests run in CI before every merge
No code merges to `main` without passing `npm run test` and `npm run typecheck`.

---

## 10. Workflow Rules

### 10.1 All workflow state transitions are validated server-side
The `WORKFLOW_TRANSITIONS` map in `src/types/entity.ts` defines all valid
state machine edges. No invalid transition should reach the database.

### 10.2 Publishing requires SEO completeness
Transitioning to `published` or `scheduled` requires `seo_title` and
`meta_description` to be non-empty. This is enforced at the service layer,
not just the UI.

### 10.3 Every publish creates a revision snapshot
`revisionService.createRevision()` is called by `publish-entity` Edge Function
on every status transition to `published`.

---

*Last updated: Architecture Stabilization Sprint (Phase 1)*
