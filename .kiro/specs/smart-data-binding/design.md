# Technical Design: Smart Data Binding

## Overview

Adds a data-binding layer between content modules and source data (Dates tab, Identity, SEO, News). Modules auto-populate from existing structured data. A `module_bindings` config stored in `content_modules._config` tracks per-module data mode and sync timestamps.

## Data Model

### Module Config Extension (in content_modules._config)

```json
{
  "_config": {
    "moduleOrder": [...],
    "enabledModules": [...],
    "modes": {
      "overview": "auto",
      "important-dates": "auto",
      "faqs": "auto",
      "news": "auto",
      "eligibility": "hybrid",
      "application-process": "manual"
    },
    "syncTimestamps": {
      "overview": "2026-07-28T12:00:00Z",
      "faqs": "2026-07-28T11:00:00Z"
    }
  }
}
```

No new database table needed — all binding config lives in the existing `content_modules` jsonb.

## Architecture

### Data Binding Service (`src/lib/modules/dataBindingService.ts`)

```typescript
type DataMode = 'auto' | 'hybrid' | 'manual';

interface BindingConfig {
  modes: Record<string, DataMode>;
  syncTimestamps: Record<string, string>;
}

// Resolves what content a module should display based on its mode
function resolveModuleContent(
  moduleSlug: string,
  mode: DataMode,
  examIdentity: ExamIdentity,
  edition: ExamEdition,
  contentModules: ContentModulesData
): { autoContent: Record<string, unknown> | null; manualContent: Record<string, unknown> | null; isStale: boolean };

// Generates auto-content for Overview from structured data
function generateOverviewAuto(exam: ExamIdentity, edition: ExamEdition): string;

// Checks if a module's auto-content is stale (source data newer than last sync)
function isModuleStale(moduleSlug: string, syncTimestamp: string, sourceUpdatedAt: string): boolean;
```

### Source Data Mapping

| Module | Source | Binding |
|--------|--------|---------|
| Overview | Identity + Dates + Edition | Auto-generates HTML summary |
| Important Dates | `edition.importantDates` | Direct pass-through (no copy) |
| FAQs | `exam.faqs` (SEO tab) | Direct pass-through |
| News | `contentModules.news` (News tab) | Direct pass-through |
| Eligibility | `edition.eligibility` + content_modules | Hybrid-capable |
| Application Process | content_modules | Manual/AI only |
| Exam Pattern | content_modules | Manual/AI only |
| Syllabus | content_modules | Manual/AI only |
| Others | content_modules | Manual/AI only |

### Component Changes

1. **ContentModuleCard** — Add mode selector dropdown (auto/hybrid/manual), AI Fill button, stale indicator
2. **ModuleContentEditor** — In `auto` mode show read-only rendered content; in `hybrid` show auto + editable notes; in `manual` show full editor
3. **ModulePanelHeader** — Add "Collapse All/Expand All", stale module count badge
4. **New: AutoContentRenderer** — Displays auto-generated content as read-only formatted HTML
5. **New: AI Fill per-module** — Button triggers AI generation scoped to that module

### AI Fill Per-Module

```typescript
// In entranceExamAI.ts or new file
async function aiGenerateForModule(
  moduleSlug: string,
  examName: string,
  year: number,
  context: { identity: ExamIdentity; edition: ExamEdition },
  apiKey: string,
  model?: string
): Promise<Record<string, unknown>>;
```

Each module type gets a focused prompt:
- Overview: "Generate a comprehensive overview for {exam} {year}..."
- Eligibility: "Generate eligibility criteria for {exam}..."
- Application Process: "Generate step-by-step application process..."
- Exam Pattern: "Generate exam pattern details..."
- Syllabus: "Generate subject-wise syllabus..."

### Frontend Changes

The frontend `EntityDetailPage` already reads from `exam_editions` via the edition join. For the data-bound modules:
- **Important Dates**: Already rendered from `edition.importantDates` → no change needed
- **FAQs**: Already rendered from `exam.faqs` → no change needed  
- **News**: Rendered from `contentModules.news` → already works
- **Overview**: Rendered from `contentModules.overview.body` → auto-generated on CMS save

The key insight: **auto-generated content is still stored in `content_modules`** (cached on save). The frontend doesn't need to know about data modes — it just reads content_modules as before. The binding layer runs in the CMS at save-time.

## Implementation Phases

Phase 1: Data binding service + mode config + Overview auto-generation
Phase 2: Important Dates & FAQs direct binding (remove duplicate editors)  
Phase 3: AI Fill per-module
Phase 4: Stale detection + sync UI
Phase 5: Frontend verification (mostly already works)
