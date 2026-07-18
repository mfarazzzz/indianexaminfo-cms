# Developer Handbook

> Everything a new engineer needs to get productive on IndianExamInfo CMS.

---

## 1. Quick Start

### Prerequisites

- Node.js 20+
- npm 9+
- A Supabase project (free tier works for development)
- (Optional) Google Gemini API key for AI features

### Setup

```bash
# Clone the repository
git clone <repo-url> indianexaminfo-cms
cd indianexaminfo-cms

# Install dependencies
npm ci

# Create environment file
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (safe for browser) |
| `VITE_FRONTEND_URL` | No | Frontend URL for cache revalidation (default: `https://indianexaminfo.com`) |
| `VITE_ENABLE_HTML_BLOCK` | No | Enable raw HTML block (admin only, default: `false`) |

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript type checking (no emit) |
| `npm run test` | Run tests (Vitest, single run) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

---

## 2. Architecture Overview

This is a **React SPA** that communicates directly with Supabase. There is no custom backend server — Supabase provides:
- PostgreSQL database (with RLS for security)
- Authentication (email/password)
- File storage (media uploads)
- Real-time subscriptions (not currently used)

The CMS manages content that a separate **Next.js frontend** renders for public users. The CMS triggers cache invalidation on the frontend via a revalidation API.

### Key Mental Model

```
Entity (parent) → has many Modules → each Module has many Blocks
                → has many Timeline Events
                → has one SEO record
                → has satellite data (eligibility, fee, vacancy, etc.)
```

An **Entity** is the universal content container. It can represent an exam, recruitment, board, university, or any future content type — determined by a free-text `entity_type` field, not code.

---

## 3. Project Conventions

### File Naming
- Components: `PascalCase.tsx` (e.g., `EntityEditorPage.tsx`)
- Services: `camelCase.ts` (e.g., `entityService.ts`)
- Types: `camelCase.ts` (e.g., `entity.ts`)
- Tests: `ComponentName.test.tsx` or `serviceName.test.ts`

### Import Aliases
The project uses `@/` as an alias for `src/`:
```typescript
import { db } from '@/lib/supabase/client'
import type { Entity } from '@/types/entity'
```

### Component Size Budgets

| Type | Max Lines |
|------|-----------|
| Page component | 250 |
| Feature component | 200 |
| Shared component | 150 |
| Hook | 120 |
| Service | 250 |
| Utility | 100 |

When a file exceeds its budget, split it.

---

## 4. Core Concepts

### 4.1 Entities

Everything is an entity. The `entity` table is the single parent for all content. Entity types (`exam`, `recruitment`, `board`, `university`) are free-text — never switch on them in code.

```typescript
// ✗ WRONG
if (entity.entityType === 'exam') { ... }

// ✓ CORRECT — render generically, configure via templates
const config = entity.templateSnapshot;
```

### 4.2 Templates

Templates define entity behavior:
- Which fields appear in the editor (via `fieldDefinitions`)
- Which modules are visible (via `moduleVisibility`)
- Timeline stage definitions (via `defaultTimelineStages`)
- Lifecycle ordering rules (via `lifecycleRules`)

When an entity is created, the template configuration is **frozen** into an immutable `entity_snapshot`. This ensures entities don't break if templates are later modified.

### 4.3 Modules

Entity modules are content sections (Notification, Application, Admit Card, Result, etc.). Each module:
- Has its own workflow status (draft/review/published)
- Contains blocks (rich content pieces)
- Is registered in `moduleRegistry.ts`

### 4.4 Blocks

Blocks are the atomic content units within modules:
- Heading, Paragraph, Rich Text, Image, Gallery, Table, FAQ, Video, etc.
- Rendered by the block registry pattern — no switch statements
- Each block has: Editor (edit mode), Renderer (preview mode), Schema (validation)

### 4.5 Workflow

Content follows a state machine:
```
draft → review → published → archived
                           → hidden → draft (restore)
archived → draft (restore)
```

Publishing requires SEO completeness (title + meta description).

---

## 5. Development Workflow

### Making Changes

1. **Read the architecture rules** in `ARCHITECTURE.md` before writing code
2. **Check the service layer** — never access Supabase from components
3. **Use the registry pattern** — never add switch statements for content types
4. **Validate with Zod** — schemas live in `src/lib/validation/entitySchemas.ts`
5. **Run quality gates** before committing:

```bash
npm run lint
npm run typecheck
npm run test
```

### Adding a New Feature

Typical feature addition flow:
1. Add types in `src/types/`
2. Add Zod schema in `src/lib/validation/`
3. Add service in `src/services/`
4. Add hook in `src/hooks/`
5. Add UI components in `src/components/` or `src/pages/`
6. Register route in `src/router/index.tsx`

### Debugging

- **React Query DevTools** — Available in development (TanStack Query Devtools)
- **Supabase Dashboard** — View tables, run queries, check auth logs
- **Browser DevTools** — Network tab shows all Supabase API calls
- **PM2 logs** — `pm2 logs indianexaminfo-cms` in production

---

## 6. Testing

### Framework
- **Vitest** — Test runner (Vite-native, fast)
- **@testing-library/react** — Component testing
- **jsdom** — DOM environment for tests
- **fast-check** — Property-based testing (available in devDeps)

### Running Tests

```bash
npm run test          # Single run
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
npm run test:ui       # Visual UI
```

### Test File Locations
Tests live next to their source files:
```
src/components/blocks/BlockRenderer.test.tsx
src/services/entity/entityService.test.ts
```

---

## 7. Key Files Reference

| File | Purpose |
|------|---------|
| `src/config/env.ts` | Environment variable access |
| `src/lib/supabase/client.ts` | Supabase client initialization |
| `src/lib/supabase/types.ts` | Database type definitions |
| `src/types/entity.ts` | Core entity type system |
| `src/types/lifecycle-template.ts` | Template configuration types |
| `src/config/permissions.ts` | Permission slug constants |
| `src/config/moduleRegistry.ts` | Module + entity type definitions |
| `src/lib/blocks/blockRegistry.ts` | Block plugin system |
| `src/lib/blocks/coreBlocks.ts` | Core block registrations |
| `src/lib/validation/entitySchemas.ts` | Zod validation schemas |
| `src/lib/queryKeys.ts` | TanStack Query key factory |
| `src/router/index.tsx` | All application routes |
| `src/contexts/AuthContext.tsx` | Authentication state |
| `src/services/entity/entityService.ts` | Primary entity CRUD |

---

## 8. Common Patterns

### Query Key Factory
```typescript
import { entityKeys } from '@/lib/queryKeys'

// Always use the factory — never raw strings
useQuery({ queryKey: entityKeys.detail(id), queryFn: ... })
```

### Service Pattern
```typescript
// src/services/myDomain/myService.ts
import { db } from '@/lib/supabase/client'

function mapRow(r: Record<string, unknown>): MyType { ... }

export async function getById(id: string): Promise<MyType | null> {
  const { data, error } = await db.from('my_table').select('*').eq('id', id).single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}
```

### Hook Pattern
```typescript
// src/hooks/useMyData.ts
import { useQuery } from '@tanstack/react-query'
import { myKeys } from '@/lib/queryKeys'
import { getById } from '@/services/myDomain/myService'

export function useMyData(id: string) {
  return useQuery({
    queryKey: myKeys.detail(id),
    queryFn: () => getById(id),
    enabled: !!id,
  })
}
```

### Autosave Pattern
```typescript
const autosaveFnRef = useRef(async () => {})
useEffect(() => { autosaveFnRef.current = handleSubmit(onSave) })
const stableSaveFn = useCallback(() => autosaveFnRef.current(), [])
const { scheduleAutosave } = useAutosave(stableSaveFn, !isNew)
```
