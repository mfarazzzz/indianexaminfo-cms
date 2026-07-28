# Implementation Plan: Dynamic Content Modules

## Overview

This plan implements the Dynamic Content Modules feature in 14 tasks across 6 phases. Phase 1 establishes the data layer and registry. Phase 2 builds field editors. Phase 3 creates the unified Module Panel UI. Phase 4 adds the Custom Module Builder. Phase 5 builds the frontend auto-renderer. Phase 6 handles migration and cleanup.

## Tasks

- [ ] 1. Create module_registry database table and seed built-in modules
  - Apply Supabase migration to create `module_registry` table with columns: id, slug, name, type, icon, description, display_order, fields (jsonb), is_active, created_at, updated_at, created_by
  - Add RLS policies: SELECT for authenticated, INSERT/UPDATE/DELETE for admin role
  - Add unique index on slug, composite index on (type, is_active, display_order)
  - Seed 12 built-in module definitions with complete FieldDefinition arrays in their fields jsonb
  - Requirements: R8

- [ ] 2. Create TypeScript types and constants for module system
  - Create `src/types/modules.ts` with FieldType, FieldDefinition, ModuleDefinition, ModuleConfig interfaces
  - Create `src/lib/modules/builtInSchemas.ts` with hardcoded field schemas for all 12 built-in modules
  - Create `src/lib/modules/fieldValidation.ts` with validation logic per field type
  - Export BUILT_IN_MODULE_SLUGS constant array
  - Requirements: R8, R7

- [ ] 3. Create moduleRegistryService.ts
  - Implement getModuleRegistry(), getModuleBySlug(), createCustomModule(), updateModuleDefinition(), deleteCustomModule(), reorderModules()
  - Add slug uniqueness validation before insert/update
  - Reject deletion of built-in modules
  - Requirements: R3, R5

- [ ] 4. Add content module persistence methods to entranceExamService
  - Implement saveModuleContent(editionId, moduleSlug, content, userId) with jsonb merge
  - Implement saveModuleConfig(editionId, config) for moduleOrder and enabledModules
  - Implement getContentModules(editionId) to return full content_modules object
  - Trigger revalidateExams() on all save operations
  - Requirements: R4

- [ ] 5. Create FieldRenderer and all field editor sub-components
  - Create FieldRenderer.tsx as a switch/mapping component
  - Create 12 field editors: Text, Textarea, RichText, Number, Date, Select, Checkbox, Radio, Image, File, Url, Repeater
  - RichTextFieldEditor wraps existing RichEditor; ImageFieldEditor wraps existing ImageUploader
  - RepeaterFieldEditor renders FieldRenderer recursively for subFields (no nested repeaters)
  - All editors support label, placeholder, required indicator, inline validation errors
  - Requirements: R2, R7

- [ ] 6. Create useModuleAutosave hook
  - Implement 2-second debounce on content changes
  - Track status: idle, saving, saved, error
  - Retry up to 3 times with exponential backoff on network failure
  - Inject _meta with updatedAt and updatedBy before each save
  - Return { save, scheduleAutosave, status, lastSavedAt }
  - Requirements: R4

- [ ] 7. Create ModulePanel unified content editing interface
  - Create ModulePanel.tsx (top-level), ModulePanelHeader.tsx (status + add button), ModuleList.tsx (sortable via @dnd-kit), ModuleCard.tsx (toggle + expand + drag handle), ModuleContentEditor.tsx (renders fields from schema)
  - Drag-and-drop reorder persists via saveModuleConfig()
  - Toggle OFF collapses editor but retains content; toggle ON expands
  - Requirements: R1

- [ ] 8. Integrate ModulePanel into EntranceExamEditorPage
  - Replace existing Modules tab (checkboxes) and Content tab with single Modules tab rendering ModulePanel
  - Pass editionId, contentModules, userId as props
  - Load module registry on mount; initialize _config from has_* flags if missing
  - Remove ModulesTab and ContentModulesTab components
  - Requirements: R1, R9

- [ ] 9. Create CustomModuleBuilder dialog
  - Create CustomModuleBuilder.tsx modal with ModuleMetaForm (name, slug, icon, description) and FieldSchemaEditor (add/remove/reorder fields)
  - Validate slug uniqueness and format
  - Support field type selection, options editor for select/radio, sub-fields for repeater
  - On save: create module in registry, immediately available in panel
  - Support edit mode for existing custom module schemas
  - Requirements: R3

- [ ] 10. Create ModuleSectionRenderer for Next.js frontend
  - Create ModuleSectionRenderer.tsx that reads _config.moduleOrder and enabledModules
  - Create ModuleNavigation.tsx for anchor links
  - Route to built-in components or CustomModuleSection based on type
  - Fetch module_registry for custom schemas (cached revalidate: 3600)
  - Skip unknown module slugs silently
  - Requirements: R6

- [ ] 11. Create built-in module frontend section components
  - Create 12 section components: Overview, Eligibility, ImportantDates, ApplicationProcess, ExamPattern, Syllabus, FAQs, AdmitCard, Result, CutOff, Counselling, News
  - Each with appropriate rendering: tables, lists, accordions, rich HTML, dates, links
  - FAQsSection includes JSON-LD for SEO
  - Requirements: R6

- [ ] 12. Create CustomModuleSection generic schema-driven renderer
  - Read field schema from registry; render each field type with appropriate frontend component
  - Handle missing/empty fields gracefully
  - Generate heading with module name and anchor id
  - Requirements: R6

- [ ] 13. Data migration from legacy boolean flags
  - Write migration script that reads has_* flags from each edition
  - Builds _config.enabledModules and _config.moduleOrder
  - Merges into existing content_modules jsonb preserving existing keys
  - Run across all editions; keep legacy columns for backward compatibility
  - Requirements: R9

- [ ] 14. Remove legacy Modules/Content tabs and clean up
  - Remove ModulesTab checkbox component and old ContentModulesTab from editor
  - Update tabs array: Identity, Dates & Status, Modules, News, SEO, Editions
  - Update handleSave to no longer write has_* flags
  - Update handleAIGenerate to write into new content_modules format
  - Verify all existing data loads correctly after swap
  - Requirements: R9

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2, 3]},
    {"tasks": [4, 5]},
    {"tasks": [6, 9]},
    {"tasks": [7]},
    {"tasks": [8, 10]},
    {"tasks": [11, 12]},
    {"tasks": [13]},
    {"tasks": [14]}
  ]
}
```

Tasks 1-4 (data layer) must complete before UI work.
Task 5 (field editors) and Task 6 (autosave hook) are prerequisites for Task 7 (Module Panel).
Task 9 (Custom Builder) depends on Task 3 (registry service).
Tasks 10-12 (frontend) depend on Task 4 (persistence) being complete.
Tasks 13-14 (migration) depend on Task 8 (new UI integrated).

## Notes

- Phase 1-3 (Tasks 1-8) deliver the core CMS editing experience for built-in modules
- Phase 4 (Task 9) can be deferred if custom modules aren't immediately needed
- Phase 5 (Tasks 10-12) can be developed in parallel with Phase 3 once the data layer is stable
- Phase 6 (Tasks 13-14) should only run after both CMS and frontend are verified working
- Legacy has_* columns are kept indefinitely for backward compatibility until frontend cutover is confirmed
