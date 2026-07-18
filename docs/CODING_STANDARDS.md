# Coding Standards

> Rules and conventions for writing code in the IndianExamInfo CMS codebase.

---

## 1. Folder Structure

```
src/
├── components/          # React UI components
│   ├── blocks/         # Block system (editors + renderers)
│   ├── layout/         # App shell, sidebar, header
│   ├── shared/         # Reusable components (FormField, DraggableList, etc.)
│   └── workspace/      # Entity workspace editors
├── config/             # Configuration constants and registries
├── contexts/           # React contexts (Auth, Settings, Pillar)
├── hooks/              # Custom React hooks
├── lib/                # Utilities and library wrappers
│   ├── ai/            # AI autofill logic
│   ├── blocks/        # Block registry, schemas, core registrations
│   ├── gemini/        # Gemini API client and prompts
│   ├── revalidation/  # Cache invalidation
│   ├── supabase/      # Supabase client and types
│   └── validation/    # Zod schemas
├── pages/              # Route-level page components
├── router/             # React Router configuration
├── services/           # Data access layer (NO React)
│   ├── entity/        # Entity-specific services
│   └── template/      # Template and snapshot services
└── types/              # TypeScript type definitions
```

### Placement Rules

| Code Type | Location |
|-----------|----------|
| Reusable UI component | `src/components/shared/` |
| Feature-specific component | `src/components/{feature}/` |
| Page-level component | `src/pages/{feature}/` |
| Data access / business logic | `src/services/` |
| React hook | `src/hooks/` |
| Type definition | `src/types/` |
| Validation schema | `src/lib/validation/` |
| Configuration constant | `src/config/` |

---

## 2. File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Component | PascalCase | `EntityEditorPage.tsx` |
| Service | camelCase | `entityService.ts` |
| Hook | camelCase (use prefix) | `useEntityQuery.ts` |
| Type file | camelCase | `entity.ts` |
| Test file | Source + `.test` | `BlockRenderer.test.tsx` |
| Schema file | camelCase + Schema | `entitySchemas.ts` |
| Config file | camelCase | `moduleRegistry.ts` |

---

## 3. Component Conventions

### One Component Per File
Each `.tsx` file exports exactly one primary component. Internal sub-components are acceptable if not used elsewhere.

### Component Structure
```typescript
// 1. Imports
import React from 'react'
import { useEntityQuery } from '@/hooks/useEntityQuery'

// 2. Types (if component-specific)
interface Props {
  entityId: string
}

// 3. Component
export function MyComponent({ entityId }: Props) {
  // hooks
  const { data, isLoading } = useEntityQuery(entityId)

  // handlers
  const handleClick = () => { /* ... */ }

  // render
  if (isLoading) return <Loading />
  return <div>...</div>
}
```

### Export Style
- **Named exports** for components: `export function MyComponent() {}`
- **Default exports** only for lazy-loaded pages: `export default MyPage`
- Never mix default and named exports in the same file

### Size Budget

| Type | Maximum Lines |
|------|--------------|
| Page component | 250 |
| Feature component | 200 |
| Shared component | 150 |
| Hook | 120 |
| Service | 250 |
| Utility | 100 |

---

## 4. Service Conventions

### Rules
1. Services NEVER import React
2. Each service owns ONE table/domain
3. Every service has a `mapRow()` function
4. All exported functions have explicit return types
5. Business logic lives in services (not components or hooks)

### Template

```typescript
// src/services/myDomain/myService.ts
import { db } from '@/lib/supabase/client'
import type { MyType } from '@/types/myType'

// ── Row mapper ──────────────────────────────────────────────
function mapRow(r: Record<string, unknown>): MyType {
  return {
    id:        r.id as string,
    name:      r.name as string,
    createdAt: r.created_at as string,
  }
}

// ── Public API ──────────────────────────────────────────────
export async function listItems(): Promise<MyType[]> {
  const { data, error } = await db
    .from('my_table')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function getById(id: string): Promise<MyType | null> {
  const { data, error } = await db
    .from('my_table')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}
```

---

## 5. Database Access Rules

1. **Only services access Supabase** — never components, hooks, or utilities
2. **Always filter `deleted_at IS NULL`** — unless explicitly querying deleted items
3. **Use `mapRow()` for all data mapping** — no inline transformations
4. **Prefer `.single()` for ID lookups** — `.maybeSingle()` for slug lookups
5. **Use `{ count: 'exact' }` for list queries** — enables pagination metadata
6. **Order explicitly** — never rely on database default ordering

---

## 6. TypeScript Conventions

### Strict Mode
The project uses strict TypeScript. All types must be explicit:

```typescript
// ✓ Explicit return types on exported functions
export async function getEntity(id: string): Promise<Entity | null> { ... }

// ✓ Explicit parameter types
function handleChange(value: string): void { ... }

// ✗ Avoid `any` — use `unknown` with type guards
const data = response as Record<string, unknown>
```

### Type Imports
```typescript
// ✓ Use `import type` for type-only imports
import type { Entity, WorkflowStatus } from '@/types/entity'

// ✓ Use `type` keyword in mixed imports
import { db, type SupabaseClient } from '@/lib/supabase/client'
```

### Nullability
- Use `T | null` for optional database fields
- Use `T | undefined` for optional function parameters
- Prefer optional chaining (`?.`) over null checks where possible
- Use non-null assertion (`!`) only when provably safe (e.g., after `if (!data) return`)

---

## 7. Error Handling

### Service Layer
```typescript
// Throw descriptive errors
if (!available) {
  throw new Error(`Slug "${slug}" is already in use. Choose a different slug.`)
}

// Propagate Supabase errors
const { data, error } = await db.from('table').select('*')
if (error) throw error
```

### Component Layer
```typescript
// Use TanStack Query error state
const { error } = useQuery(...)
if (error) return <ErrorMessage error={error} />

// Use try/catch for mutations
try {
  await updateEntity(id, data)
  toast.success('Saved successfully')
} catch (err) {
  toast.error(err instanceof Error ? err.message : 'Save failed')
}
```

### Never Swallow Errors
```typescript
// ✗ WRONG — silent failure
try { await save() } catch {}

// ✓ CORRECT — at minimum, log
try { await save() } catch (err) { console.error('[Save]', err) }
```

---

## 8. Logging

### Allowed Logging

| Level | Use |
|-------|-----|
| `console.error` | Unexpected failures that need investigation |
| `console.warn` | Recoverable issues (e.g., revalidation retry exhausted) |

### Not Allowed

- `console.log` in production code (remove before commit)
- Logging sensitive data (API keys, user passwords)
- Excessive logging in hot paths

### Structured Audit Logging

For business events, use the `audit_log` table via service functions:
```typescript
await db.from('audit_log').insert({
  user_id: userId,
  action: 'entity.published',
  entity_type: 'entity',
  entity_id: id,
  details: { from: 'review', to: 'published' },
})
```

---

## 9. Testing Standards

### File Location
Tests live next to source files:
```
src/services/entity/entityService.ts
src/services/entity/entityService.test.ts
```

### Naming Convention
```typescript
describe('entityService', () => {
  describe('createEntity', () => {
    it('generates slug from name when slug is empty', () => { ... })
    it('throws when slug already exists', () => { ... })
  })
})
```

### Mocking Supabase
```typescript
vi.mock('@/lib/supabase/client', () => ({
  db: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    })),
  },
}))
```

### Coverage Expectations
- Services: 80%+ function coverage
- Hooks: 70%+ branch coverage
- Components: Critical paths covered (save, error states)

---

## 10. Git Conventions

### Branch Naming
```
feature/add-result-bulk-import
fix/slug-conflict-on-create
refactor/extract-timeline-service
```

### Commit Messages
```
feat: add bulk publish for results
fix: prevent duplicate slugs in same pillar
refactor: extract revalidation into service
docs: add database guide to /docs
test: add unit tests for timeline lifecycle rules
```

### Pull Request Size
- Maximum 400 lines changed (excluding generated files)
- One concern per PR
- Include description of what changed and why

---

## 11. Security Conventions

1. **Never hardcode secrets** — use settings table or environment variables
2. **Sanitize user input** — especially in AI prompts and file names
3. **Validate on the service layer** — UI validation is for UX, not security
4. **Use allowlists** — for folder names, file types, transition states
5. **Cap string lengths** — prevent storage abuse (e.g., `altText.slice(0, 500)`)
6. **Generate random filenames** — prevent path traversal in uploads
