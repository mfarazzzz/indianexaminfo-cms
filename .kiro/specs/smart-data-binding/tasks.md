# Implementation Plan: Smart Data Binding

## Overview

Implements auto-population and smart data binding for content modules. Modules pull data from existing tabs (Dates, SEO, News, Identity) instead of requiring manual entry. Adds per-module data modes (auto/hybrid/manual), AI Fill per-module, and stale detection with sync.

## Tasks

- [ ] 1. Create data binding service with mode resolution and auto-generation
  - Create `src/lib/modules/dataBindingService.ts`
  - Implement `resolveModuleContent(slug, mode, exam, edition, contentModules)` that returns auto/manual content based on mode
  - Implement `generateOverviewAuto(exam, edition)` that builds HTML overview from Identity + Dates + Eligibility + Fee data
  - Implement `isModuleStale(slug, syncTimestamp, sourceUpdatedAt)` for stale detection
  - Implement `getModuleMode(config, slug)` and `setModuleMode(config, slug, mode)` helpers
  - Add `DataMode` type export: `'auto' | 'hybrid' | 'manual'`
  - Requirements: R1, R2, R7

- [ ] 2. Update ModulePanel config to support data modes and sync timestamps
  - Extend `ModuleConfig` type to include `modes: Record<string, DataMode>` and `syncTimestamps: Record<string, string>`
  - Update `saveModuleConfig` to persist modes and timestamps
  - Update `ModulePanel.loadData()` to initialize modes (default: auto for overview, important-dates, faqs, news; manual for others)
  - When mode changes, persist immediately via `saveModuleConfig`
  - Requirements: R1

- [ ] 3. Update ContentModuleCard with mode selector and stale indicator
  - Add a mode dropdown (Auto / Hybrid / Manual) to each module card header
  - Show amber "Stale" dot when `isModuleStale()` returns true
  - Show "Sync Now" button next to stale indicator
  - Show "AI Fill" button (sparkles icon) in the card header when module is expanded
  - For `auto` mode: show read-only rendered content (AutoContentRenderer)
  - For `hybrid` mode: show auto content (read-only) + editable "Additional Notes" textarea below
  - For `manual` mode: show full field editor (existing behavior)
  - Requirements: R1, R7, R8

- [ ] 4. Implement Important Dates module as direct pass-through (no editor)
  - When Important Dates module is in `auto` mode (default), render dates from `edition.importantDates` as a read-only formatted list
  - Remove the repeater field editor for this module in auto mode
  - The module only shows: Enable/Disable toggle + read-only date display
  - Dates are pulled from the parent component's `edition` prop — no separate fetch
  - If editor switches to `manual` mode, show the repeater editor (fallback)
  - Requirements: R3

- [ ] 5. Implement FAQs module with SEO tab binding
  - In `auto` mode, pull FAQs from `exam.faqs` (passed as prop from parent)
  - Display them as read-only cards with Edit/Delete/Pin actions per FAQ
  - Add "Add Custom FAQ" button that appends a user-entered FAQ (marked as `custom: true`)
  - Add "Regenerate" button that calls AI to generate new FAQs
  - Pinned FAQs (`pinned: true`) always sort to the top
  - In `hybrid` mode: show auto FAQs (from SEO) + custom FAQs section below
  - In `manual` mode: show full repeater editor (ignore SEO tab data)
  - Requirements: R4

- [ ] 6. Implement News module as toggle-only pass-through
  - In `auto` mode, display news from the News tab data (read-only list)
  - The module only shows: Enable/Disable toggle + read-only news item list
  - No news editing inside the module — editors use the News tab directly
  - If mode is `manual`, show the existing news repeater editor (fallback)
  - Requirements: R5

- [ ] 7. Create AI Fill per-module functionality
  - Create `src/lib/modules/moduleAI.ts` with `aiGenerateForModule(slug, examName, year, context, apiKey, model)`
  - Write focused prompts per module type: overview, eligibility, application-process, exam-pattern, syllabus
  - Each returns structured JSON matching the module's field schema
  - Wire the "AI Fill" button in ContentModuleCard to call this function
  - On success, populate the module's content fields and trigger autosave
  - Show loading state on the AI Fill button during generation
  - Requirements: R6

- [ ] 8. Implement smart sync: stale detection and Sync Now action
  - Track `syncTimestamps[slug]` = timestamp of last auto-generation/binding
  - Compare against `exam.updatedAt` and `edition.updatedAt` to determine staleness
  - Show stale count badge in ModulePanelHeader ("3 modules need sync")
  - "Sync Now" button re-runs `resolveModuleContent()` and updates the stored content
  - "Reset to Auto" action: sets mode to `auto`, clears manual content, re-syncs
  - Add "Collapse All" / "Expand All" button to ModulePanelHeader
  - Requirements: R7, R8

- [ ] 9. Add auto-regeneration on source data save
  - In `EntranceExamEditorPage.handleSave()`: after saving Identity/Dates/Edition, check which modules are in `auto` mode
  - For auto modules whose source changed: call `resolveModuleContent()` and save updated content to `content_modules`
  - Update `syncTimestamps` for regenerated modules
  - This ensures Overview regenerates when Identity changes, Dates module updates when Dates tab saves, etc.
  - Requirements: R2, R7, R9

- [ ] 10. Frontend verification — ensure single source of truth rendering
  - Verify Important Dates renders from `edition.importantDates` (already does via `exam.dates` mapping)
  - Verify FAQs render from `exam.faqs` (already does via `EntityDetailPage`)
  - Verify News renders from `contentModules.news` (already works)
  - Verify Overview renders from `contentModules.overview.body` (auto-generated on CMS save)
  - Ensure `revalidateExams()` is called on all save paths so frontend cache updates
  - No frontend code changes should be needed — the CMS generates+caches content on save
  - Requirements: R9

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2]},
    {"tasks": [3, 4, 5, 6]},
    {"tasks": [7, 8]},
    {"tasks": [9]},
    {"tasks": [10]}
  ]
}
```

## Notes

- No new database table is needed — all binding config stored in existing `content_modules._config` jsonb
- The frontend doesn't need to know about data modes — it just reads the cached content from `content_modules`
- Auto-generated content is still stored in `content_modules` (cached on save) for fast frontend reads
- This is an enhancement ON TOP of the existing ModulePanel from the dynamic-content-modules spec
- Tasks 4, 5, 6 are independent and can be worked on in parallel
- Task 10 is mostly verification — the frontend should already work correctly since auto content is cached in `content_modules`
