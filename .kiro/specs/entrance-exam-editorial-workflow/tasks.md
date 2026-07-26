# Implementation Plan: Entrance Exam Editorial Workflow

## Overview
Implements a dedicated editorial workflow for entrance exams — separate from other pillars — with its own data model (`exam_editions` table), CMS editor, and publishing logic. Each entrance exam becomes a single canonical record continuously updated across yearly editions.

## Tasks

- [x] 1. Create `exam_editions` table and schema changes — Add the `exam_editions` table with 10-state lifecycle enum, partial unique index for `is_current`, add `cycle_frequency` and `current_edition_id` to `exams`, add `exam_edition_id` to `content_posts`, create `maintain_current_edition` trigger, add RLS policies, apply via Supabase migration.

- [x] 2. Migrate existing entrance exams to editions — For each exam with `pillar='entrance-exam'`: infer year from slug/name/dates, create `exam_editions` row with `is_current=true` copying temporal data, set `current_edition_id`, deduplicate (merge `cat-2026`/`mba-cat-2026` → `cat`), normalize slugs to year-agnostic form, set `cycle_frequency`, link `content_posts` to editions, generate migration report, ensure idempotency.

- [x] 3. Build CMS service layer `entranceExamService.ts` — Create dedicated service with functions: `getEntranceExams`, `getEntranceExam`, `createEntranceExam`, `updateExamIdentity`, `updateEdition`, `startNewEdition`, `completeEdition`, `updateModuleStatus`, `getEditionHistory`. Define TypeScript types `ExamEdition`, `EditionInput`, `EntranceExamListItem`.

- [x] 4. Build CMS Exam Selection Screen — Create `EntranceExamSelectionPage.tsx` with searchable list of entrance exams showing current edition status and next important date, category filter, "Create New Exam" button. Add "Entrance Exams" sidebar item separate from Exam Manager. Register route.

- [x] 5. Build Dedicated Entrance Exam Editor — Create `EntranceExamEditorPage.tsx` with tabbed layout: Identity, Dates & Status (10 lifecycle states + dates repeater), Eligibility, Modules (syllabus/admit-card/result/counselling panels), Content (linked posts), SEO, Editions History. Add edition switcher dropdown and "Start New Edition" button. Wire save to service layer.

- [x] 6. Build Start New Edition dialog — Create `StartNewEditionDialog.tsx` with year/session/label fields, carryover checkboxes (eligibility, syllabus, fees), archive warning. On confirm call `startNewEdition()`, validate no duplicate year+session.

- [x] 7. Build Create New Exam flow — Create dialog/form with required fields (name, short_name, category, conducting_body), auto-generate year-agnostic slug, auto-create first edition, duplicate detection warning, navigate to editor on success.

- [x] 8. Update frontend examService to resolve editions — Modify `getExamBySlug()` to join with `exam_editions` via `current_edition_id`, merge edition data into `ExamEntity` shape for backward compatibility. Implement `getExamArchive(slug, year)` and `getExamEditions(examId)`. Ensure homepage queries still work with fallback to legacy columns.

- [x] 9. Add frontend archive pages and routing — Create `[year]/page.tsx` route for archived editions with banner linking to current. Add "Previous Years" widget. Set canonical URLs correctly. Add noindex for very old archives.

- [x] 10. Update homepage and feed integration — Update `EntranceExamSection` to filter by edition status, update `LatestUpdates` feed to scope by edition `updated_at`, update "Upcoming Exams" widget, update `ExamCard` to read from edition data, ensure cache tags fire on edition updates.

- [x] 11. Set up redirects and SEO preservation — Add 301 redirects in `next.config.ts` for old year-specific slugs → canonical, generate sitemap entries for archives, add JSON-LD structured data with edition-aware dates.

- [x] 12. Cleanup and documentation — Hide entrance exams from generic Exam Manager, add deprecation comments to legacy temporal columns, update `CMS_MODULE_GUIDE.md` and `ARCHITECTURE.md` with new workflow.

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1], "description": "Schema creation — no dependencies"},
    {"tasks": [2], "description": "Data migration — depends on schema"},
    {"tasks": [3], "description": "Service layer — depends on migration"},
    {"tasks": [4, 5, 6, 7, 8], "description": "CMS UI + Frontend service — depend on service layer, run in parallel"},
    {"tasks": [9, 10, 11], "description": "Frontend pages and integration — depend on frontend service"},
    {"tasks": [12], "description": "Cleanup — depends on all CMS and frontend tasks"}
  ]
}
```

- Wave 1: Schema creation (Task 1) — no dependencies
- Wave 2: Data migration (Task 2) — depends on schema
- Wave 3: Service layer (Task 3) — depends on migration
- Wave 4: CMS UI (Tasks 4-7) + Frontend service (Task 8) — depend on service layer, can run in parallel
- Wave 5: Frontend pages and integration (Tasks 9-11) — depend on frontend service (Task 8)
- Wave 6: Cleanup (Task 12) — depends on all CMS and frontend tasks complete

## Notes

- Tasks 1-2 are database-level and must complete before any application code depends on the new tables.
- The migration (Task 2) should be run in dry-run mode first to generate a report for manual review before committing.
- Frontend backward compatibility is critical — `ExamEntity` shape must be preserved during transition so existing pages don't break.
- The generic "Exam Manager" continues to serve sarkari-naukri and board-university exams unchanged.
