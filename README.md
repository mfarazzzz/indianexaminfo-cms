# IndianExamInfo CMS

Content Operating System (Content OS) for managing Indian exam content.
Built on React 18 + TypeScript + Vite + Supabase + TanStack Query.

---

## Architecture Overview

```
Entity (exam, job, scholarship, ...)
  ├── Timeline Events      (entity_timeline_event)
  ├── Content Modules      (entity_module)
  │     └── Blocks         (entity_module_block) — 14 block types via Block Registry
  ├── Eligibility          (entity_eligibility)
  ├── Vacancies            (entity_vacancy)
  ├── Fee                  (entity_fee)
  ├── Exam Pattern         (entity_exam_pattern)
  ├── Selection Process    (entity_selection_stage)
  ├── Syllabus             (entity_syllabus_subject)
  ├── Downloads            (entity_download)
  ├── Links                (entity_link)
  ├── SEO                  (entity_seo)
  └── Media                (entity_media_slot)
```

The **Block Registry** (`src/lib/blocks/blockRegistry.ts`) is the core extensibility mechanism.
Adding a new block type requires one `register()` call — zero changes to shared components.

---

## Stack

| Layer | Technology |
|---|---|
| UI | React 18 + Radix UI + Tailwind CSS |
| State | TanStack Query v5 |
| Forms | react-hook-form + Zod |
| Rich text | Tiptap |
| Drag-and-drop | dnd-kit |
| Backend | Supabase (Postgres + Auth + Storage) |
| Build | Vite 5 + TypeScript 5 |
| Tests | Vitest + Testing Library + fast-check |

---

## Environment Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/indianexaminfo-cms
cd indianexaminfo-cms

# 2. Install dependencies
npm install

# 3. Create .env from example
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 4. Run database migrations in Supabase SQL Editor
# supabase_schema.sql        — base schema (roles, users, categories, etc.)
# supabase_m1_m3_migration.sql — Content OS tables (entity, modules, blocks, timeline, etc.)

# 5. Start development server
npm run dev
```

### Required environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `VITE_FRONTEND_URL` | Optional | Public site URL for preview links (default: `https://indianexaminfo.com`) |
| `VITE_ENABLE_HTML_BLOCK` | Optional | Set to `true` to enable the raw HTML block type in Module Editor |

---

## Development

```bash
npm run dev          # Start Vite dev server
npm run test         # Run all tests (vitest)
npm run test:watch   # Watch mode
npm run test:coverage # With coverage report
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run build        # Production build
```

---

## Folder Structure

```
src/
├── components/
│   ├── blocks/              # Block editors + renderers (one file per block type)
│   │   ├── BlockRenderer.tsx      # Generic dispatch — zero switch/case
│   │   ├── AddBlockMenu.tsx       # Block palette
│   │   ├── editors/               # 14 editor components
│   │   └── renderers/             # 14 renderer components
│   ├── entity-editor/
│   │   ├── EntityEditorShell.tsx  # 15-tab editor shell
│   │   ├── modules/               # ModuleCard, ModuleEditor, BlockCard, BlockList
│   │   └── tabs/                  # GeneralTab, TimelineTab, ModulesTab, ...
│   ├── layout/                    # AppShell, Sidebar, TopBar
│   └── shared/                    # FormField, DraggableList, ConfirmDialog, ...
├── hooks/
│   ├── useAutosave.ts             # 30s debounce autosave
│   ├── useStableSaveFn.ts         # Stable autosave callback (extracted pattern)
│   ├── useConfirmDelete.ts        # Optimistic delete with rollback
│   ├── useEntityQuery.ts          # useSatelliteQuery, useReorderMutation
│   ├── useTimelineTab.ts          # Timeline tab orchestration
│   ├── useModulesTab.ts           # Modules tab orchestration
│   └── useModuleEditor.ts         # Module editor orchestration
├── lib/
│   ├── blocks/
│   │   ├── blockRegistry.ts       # Singleton block registry
│   │   ├── coreBlocks.ts          # registerCoreBlocks() — 14 built-in types
│   │   └── schemas/               # Zod schema per block type
│   ├── queryKeys.ts               # TanStack Query key factory
│   ├── supabase/client.ts         # Supabase client
│   └── validation/entitySchemas.ts # Zod schemas for entity forms
├── services/
│   └── entity/
│       ├── entityService.ts       # Entity CRUD
│       ├── timelineService.ts     # Timeline events CRUD
│       ├── moduleService.ts       # Module CRUD
│       ├── blockService.ts        # Block CRUD
│       └── ...                    # Other satellite services
├── pages/
│   └── exams/
│       ├── ExamsListPage.tsx      # Exam list with search/filter
│       └── ExamEditorPage.tsx     # New Content OS editor entry point
└── __tests__/
    ├── helpers.tsx                # renderWithQuery helper
    └── fixtures.ts                # makeModule, makeBlock, makeTimelineEvent
```

---

## Architecture Rules

All code follows `ARCHITECTURE.md`. Key rules:

1. **Component → Hook → Service → Supabase** — never bypass this flow
2. **No switch/case on blockType or moduleType** in shared components — all dispatch via Block Registry
3. **Services never import React** — pure data logic only
4. **Optimistic UI on all mutations** — update immediately, persist in background, roll back on failure
5. **Zod validation only** — no manual validation in components or hooks
6. **LOC budgets** — Component ≤250, Hook ≤180, Service ≤250, Test ≤300

---

## Database

The CMS uses two SQL files:

- `supabase_schema.sql` — base schema (users, categories, blog, content posts, ads, audit)
- `supabase_m1_m3_migration.sql` — Content OS tables (run after base schema)

All tables use:
- Soft delete (`deleted_at` column, never hard DELETE)
- Row Level Security (RLS policies for staff/admin access)
- `updated_at` trigger via `set_updated_at()` function

---

## Block Types (V1 — 14 built-in)

| Type | Description |
|---|---|
| `heading` | H1–H6 heading |
| `paragraph` | Plain HTML paragraph |
| `rich_text` | Full Tiptap rich text editor |
| `image` | Single image with alt + caption |
| `gallery` | Multiple images grid |
| `button` | CTA button (primary/secondary/outline) |
| `download_card` | Reference to EntityDownload by ID |
| `table` | Headers + rows table |
| `quote` | Blockquote with attribution |
| `alert_box` | Info/warning/error/success alert |
| `divider` | Line or space divider |
| `video` | YouTube/Vimeo/direct video embed |
| `faq` | Frequently asked questions list |
| `timeline_reference` | Reference to entity timeline events |

To add a new block type: add one `register()` call in `src/lib/blocks/coreBlocks.ts`. Zero other changes required.

---

## CI/CD

GitHub Actions runs on every push and PR:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:coverage`
4. `npm run build`

---

## Milestones Completed

| Milestone | Description | Status |
|---|---|---|
| M1 | Entity architecture, quality gates, CI | ✅ |
| M2 | Timeline Editor | ✅ |
| M3 | Generic Module Editor + Block Registry | ✅ |

### Next milestones

| Milestone | Description |
|---|---|
| M4 | Downloads Manager |
| M5 | Media Library |
| M6 | Official Links |
| M7 | SEO Editor |
| M8 | Publishing Workflow |
