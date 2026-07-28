# Technical Design Document — Dynamic Content Modules

## Overview

This feature replaces the current split "Modules" tab (checkbox toggles) and "Content" tab (block-based editing) with a unified **Module Panel** that combines enable/disable toggling with inline rich editing. It introduces a **Module Registry** for schema-driven content definitions (both built-in and custom), persists all module data in the existing `exam_editions.content_modules` jsonb column, and provides a **Frontend Auto-Renderer** that dynamically generates exam page sections without requiring code deployments.

**Requirement mapping:**
- Req 1 (Unified Module Panel) → ModulePanel component + ModuleList + ModuleCard
- Req 2 (Built-In Module Editors) → FieldRenderer + per-type field editors
- Req 3 (Custom Module Creation) → CustomModuleBuilder dialog
- Req 4 (Content Persistence) → useModuleAutosave hook + debounced jsonb writes
- Req 5 (Management Operations) → duplicate/delete handlers + ConfirmDialog
- Req 6 (Frontend Auto-Rendering) → ModuleSectionRenderer (Next.js)
- Req 7 (Field Validation) → FieldRenderer inline validation
- Req 8 (Schema Serialization) → FieldDefinition interface + round-trip guarantees
- Req 9 (Migration) → SQL migration script + data backfill

---

## Architecture

### Data Models

#### 1. `module_registry` Table

Stores the canonical definition of every available module (built-in and custom).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `slug` | text UNIQUE | Lowercase alphanumeric + hyphens, e.g. `important-dates` |
| `name` | text NOT NULL | Display name |
| `type` | text NOT NULL | `'built-in'` or `'custom'` |
| `icon` | text | Lucide icon name, e.g. `calendar` |
| `description` | text | Brief help text shown in module list |
| `display_order` | integer NOT NULL DEFAULT 0 | Global default order |
| `fields` | jsonb NOT NULL | Array of `FieldDefinition` objects |
| `is_active` | boolean DEFAULT true | Soft-disable without deletion |
| `created_at` | timestamptz DEFAULT now() | |
| `updated_at` | timestamptz DEFAULT now() | |
| `created_by` | uuid FK → auth.users | |

**RLS policies:**
- SELECT: authenticated users (all CMS admins)
- INSERT/UPDATE/DELETE: authenticated users with `role = 'admin'`

**Indexes:**
- UNIQUE on `slug`
- Index on `type, is_active, display_order` for list queries

---

#### 2. `content_modules` JSON Structure

Stored in the existing `exam_editions.content_modules` jsonb column.

```json
{
  "_config": {
    "moduleOrder": ["overview", "eligibility", "important-dates", "application-process", "exam-pattern", "syllabus", "faqs", "admit-card", "result", "cut-off", "counselling", "news"],
    "enabledModules": ["overview", "eligibility", "important-dates"]
  },
  "overview": {
    "_meta": { "updatedAt": "2025-07-26T10:30:00Z", "updatedBy": "user-uuid" },
    "summary": "JEE Main is a national-level entrance exam...",
    "body": "<p>Full HTML content from TipTap editor</p>"
  },
  "eligibility": {
    "_meta": { "updatedAt": "2025-07-26T11:00:00Z", "updatedBy": "user-uuid" },
    "qualification": "10+2 or equivalent",
    "ageLimit": "No upper age limit",
    "nationality": "Indian citizens",
    "additionalCriteria": "<p>Candidates must have...</p>"
  },
  "important-dates": {
    "_meta": { "updatedAt": "2025-07-26T11:30:00Z", "updatedBy": "user-uuid" },
    "dates": [
      { "label": "Registration Opens", "date": "2025-11-01", "isUrgent": true },
      { "label": "Last Date to Apply", "date": "2025-11-30", "isUrgent": false }
    ]
  }
}
```

**Key conventions:**
- `_config` is reserved for panel state (order + enablement)
- Each module slug maps to its own key
- `_meta` inside each module tracks last update timestamp and user
- Content fields map 1:1 with the module's `fields` schema from `module_registry`

---

#### 3. Field Schema Definition (TypeScript)

```typescript
interface FieldDefinition {
  key: string;           // unique within module, kebab or camelCase
  label: string;         // display label
  type: FieldType;
  required: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  options?: { label: string; value: string }[];  // for select/radio
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;    // regex pattern
    message?: string;    // custom error message
  };
  subFields?: FieldDefinition[];  // for repeater type only
}

type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'image'
  | 'file'
  | 'url'
  | 'repeater';

interface ModuleDefinition {
  slug: string;
  name: string;
  type: 'built-in' | 'custom';
  icon: string;
  description: string;
  displayOrder: number;
  fields: FieldDefinition[];
  isActive: boolean;
}
```

---

### Component Architecture

#### CMS Components (React + Vite)

```
src/components/entity-editor/
├── modules/
│   ├── ModulePanel.tsx              ← Top-level unified panel
│   ├── ModulePanelHeader.tsx        ← Save status + "Add Custom Module" button
│   ├── ModuleList.tsx               ← Sortable list (@dnd-kit/sortable)
│   ├── ModuleCard.tsx               ← Toggle + expand/collapse + drag handle
│   ├── ModuleContentEditor.tsx      ← Reads field schema, renders FieldRenderer
│   ├── FieldRenderer.tsx            ← Switch on field.type → sub-editor
│   ├── fields/
│   │   ├── TextFieldEditor.tsx
│   │   ├── TextareaFieldEditor.tsx
│   │   ├── RichTextFieldEditor.tsx  ← Wraps existing RichEditor
│   │   ├── NumberFieldEditor.tsx
│   │   ├── DateFieldEditor.tsx
│   │   ├── SelectFieldEditor.tsx
│   │   ├── CheckboxFieldEditor.tsx
│   │   ├── RadioFieldEditor.tsx
│   │   ├── ImageFieldEditor.tsx     ← Wraps existing ImageUploader
│   │   ├── FileFieldEditor.tsx
│   │   ├── UrlFieldEditor.tsx
│   │   └── RepeaterFieldEditor.tsx  ← Recursive FieldRenderer for subFields
│   └── custom/
│       ├── CustomModuleBuilder.tsx   ← Modal dialog for creating custom modules
│       ├── ModuleMetaForm.tsx        ← Name, slug, icon, description
│       └── FieldSchemaEditor.tsx     ← Add/remove/reorder field definitions
```

**Key design decisions:**
- `FieldRenderer` is a pure mapping component — no business logic. It reads a `FieldDefinition` and delegates to the correct sub-editor.
- `RepeaterFieldEditor` recursively uses `FieldRenderer` for its `subFields`, but repeaters cannot nest repeaters (max depth = 1).
- Existing `RichEditor` and `ImageUploader` are wrapped, not forked, maintaining a single source of truth for those widgets.
- `@dnd-kit/sortable` is used for both module reordering (ModuleList) and repeater item reordering (RepeaterFieldEditor).

#### Frontend Components (Next.js 15)

```
app/exams/[slug]/[edition]/
├── components/
│   ├── ModuleSectionRenderer.tsx     ← Reads content_modules, iterates in order
│   ├── ModuleNavigation.tsx          ← Generates anchor links for enabled modules
│   ├── built-in/
│   │   ├── OverviewSection.tsx
│   │   ├── EligibilitySection.tsx
│   │   ├── ImportantDatesSection.tsx
│   │   ├── ApplicationProcessSection.tsx
│   │   ├── ExamPatternSection.tsx
│   │   ├── SyllabusSection.tsx
│   │   ├── FAQsSection.tsx
│   │   ├── AdmitCardSection.tsx
│   │   ├── ResultSection.tsx
│   │   ├── CutOffSection.tsx
│   │   ├── CounsellingSection.tsx
│   │   └── NewsSection.tsx
│   └── generic/
│       └── CustomModuleSection.tsx   ← Schema-driven generic renderer
```

**Rendering logic:**
1. `ModuleSectionRenderer` reads `_config.moduleOrder` and `_config.enabledModules`
2. For each enabled module in order:
   - If slug matches a built-in → render dedicated component
   - If slug exists in `module_registry` with `type = 'custom'` → render `CustomModuleSection`
   - If slug not found in registry → skip silently (Req 6, AC 6)
3. `ModuleNavigation` generates anchor links from enabled modules for in-page nav

---

### Service Layer

#### `moduleRegistryService.ts` (new)

```typescript
// CRUD operations for module_registry table
export async function getModuleRegistry(): Promise<ModuleDefinition[]>;
export async function getModuleBySlug(slug: string): Promise<ModuleDefinition | null>;
export async function createCustomModule(def: Omit<ModuleDefinition, 'type'>): Promise<ModuleDefinition>;
export async function updateModuleDefinition(slug: string, updates: Partial<ModuleDefinition>): Promise<void>;
export async function deleteCustomModule(slug: string): Promise<void>;
export async function reorderModules(orderedSlugs: string[]): Promise<void>;
```

#### Updates to `entranceExamService.ts`

```typescript
// New methods added to existing service
export async function saveContentModules(
  editionId: string,
  moduleSlug: string,
  content: Record<string, unknown>,
  userId: string
): Promise<void>;

export async function saveModuleConfig(
  editionId: string,
  config: { moduleOrder: string[]; enabledModules: string[] }
): Promise<void>;

export async function getContentModules(
  editionId: string
): Promise<Record<string, unknown>>;
```

#### `useModuleAutosave` Hook (new)

```typescript
function useModuleAutosave(editionId: string, moduleSlug: string) {
  // Returns: { save, status, scheduleAutosave }
  // - Debounces writes with 2-second delay (within 3s requirement)
  // - Retries up to 3 times with exponential backoff on network failure
  // - Tracks status: 'idle' | 'saving' | 'saved' | 'error'
  // - Wraps _meta injection (updatedAt, updatedBy)
}
```

**Autosave strategy:**
- Each module editor instance gets its own `useModuleAutosave` hook
- On field change → debounce 2000ms → PATCH `content_modules.{slug}` via Supabase jsonb path update
- Uses `content_modules || jsonb_build_object(slug, $data)` to merge without overwriting other modules
- Status indicator in `ModulePanelHeader` aggregates across all active editors

---

### Validation Strategy

Field validation runs at two levels:

1. **Inline (on blur / on change):** Each field editor validates its own value against the `FieldDefinition.validation` rules and renders inline error messages.
2. **On publish:** The `ModuleContentEditor` runs a full validation pass across all required fields before allowing the edition to be marked as published.

Validation rules per field type:
| Type | Validations |
|------|------------|
| `text` | required, max length |
| `textarea` | required, max length |
| `richtext` | required (non-empty HTML) |
| `number` | required, min, max |
| `date` | required, ISO 8601 format |
| `select` / `radio` | required, value in options |
| `checkbox` | required (must be true) |
| `image` / `file` | required (non-empty URL) |
| `url` | required, https scheme, well-formed URL |
| `repeater` | required (min 1 entry), recurse into subFields |

---

### Migration Strategy

#### Phase 1: Database Migration

```sql
-- Create module_registry table
CREATE TABLE module_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('built-in', 'custom')),
  icon text,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  fields jsonb NOT NULL DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE module_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read modules"
  ON module_registry FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage modules"
  ON module_registry FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Seed built-in module definitions
INSERT INTO module_registry (slug, name, type, icon, display_order, fields) VALUES
  ('overview', 'Overview', 'built-in', 'file-text', 1, '[...]'),
  ('eligibility', 'Eligibility', 'built-in', 'user-check', 2, '[...]'),
  ('important-dates', 'Important Dates', 'built-in', 'calendar', 3, '[...]'),
  -- ... remaining built-in modules
;
```

#### Phase 2: Data Migration Script

```typescript
// Maps legacy has_* flags to module enablement
const LEGACY_FLAG_MAP: Record<string, string> = {
  hasNotification: 'news',
  hasApplication: 'application-process',
  hasAdmitCard: 'admit-card',
  hasSyllabus: 'syllabus',
  hasAnswerKey: 'answer-key',
  hasResult: 'result',
  hasCutoff: 'cut-off',
  hasCounselling: 'counselling',
};

// For each edition:
// 1. Read has_* flags
// 2. Build _config.enabledModules from true flags
// 3. Preserve existing content_modules data under same keys
// 4. Write merged content_modules back
```

#### Phase 3: UI Migration

- Replace "Modules" and "Content" tabs with unified "Modules" tab in `EditionEditor`
- Legacy `has_*` columns remain readable for backward compatibility with the frontend until the Auto-Renderer is deployed
- Once Auto-Renderer is live, legacy columns become read-only / deprecated

---

## Implementation Phases

### Phase 1: Data Layer + Module Panel UI (Built-In Modules)

- Create `module_registry` table + seed built-in definitions
- Implement `moduleRegistryService.ts`
- Build `ModulePanel`, `ModuleList`, `ModuleCard` components
- Build `FieldRenderer` + all field sub-editors
- Implement `useModuleAutosave` hook with debounce and retry
- Wire up autosave to `exam_editions.content_modules`
- Add save status indicator

### Phase 2: Custom Module Builder + Field Schema Editor

- Build `CustomModuleBuilder` modal dialog
- Build `FieldSchemaEditor` with add/remove/reorder fields
- Implement validation for slug uniqueness and field key uniqueness
- Add custom module CRUD to `moduleRegistryService`
- Support editing existing custom module schemas with content preservation

### Phase 3: Frontend Auto-Renderer

- Build `ModuleSectionRenderer` in Next.js
- Build dedicated section components for each built-in module
- Build `CustomModuleSection` generic renderer
- Build `ModuleNavigation` anchor link generator
- Add graceful handling for orphaned module keys

### Phase 4: Migration Script + Legacy Cleanup

- Write and run data migration for `has_*` flags → `_config.enabledModules`
- Remove legacy "Modules" tab from UI
- Mark legacy `has_*` columns as deprecated
- Eventual column removal after frontend fully migrated

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Store content in existing `content_modules` jsonb | Avoids schema changes, keeps all module data colocated per edition |
| Separate `module_registry` table for definitions | Definitions shared across all editions; keeps schema separate from content |
| `@dnd-kit` for drag-and-drop | Already available in the project, accessible, lightweight |
| Debounce at 2s (not immediate) | Reduces write frequency while staying within 3s requirement |
| No nested repeaters | Keeps UI/UX manageable, avoids complex recursive depth issues |
| Dedicated built-in components on frontend | Better SEO, structured data, and visual design per module type |
| Generic renderer for custom modules | Zero-deploy addition of new module types |
| Legacy columns preserved initially | Non-breaking migration; frontend cutover happens independently |
