# Open Investigation Items

Items that are not blocking the legacy-exam-migration spec but must not silently become "confirmed safe" without explicit resolution.

**Convention:** every item states how it was verified and when. An item moves to RESOLVED only with a named check (query, file, or command) attached — not with a summary sentence.

---

## STILL OPEN

### 4. Legacy exam editor is the only real creation path (OPEN — active hazard)

**Status:** Confirmed by code + DB check, 2026-07-25. `/exams/new` → `ExamEditorPage` → `examService.ts` → `.from("exams")` only. It is the only exam creation flow linked from `Sidebar.tsx` and the dashboard quick actions. The ELMS entity editor at `/entities/:pillar/new` is router-registered but has **no navigation entry anywhere in the UI** — reachable only by typing the URL.

**Confirmed counts (2026-07-25):** `entity` = 3 (newest write 2026-07-12), `entity_module` = **0**, `entity_timeline_event` = 5, `exams` = 127 (newest write 2026-07-24).

**Impact:** exam-data-deduplication (groups 1–12) has zero effect on exams being created today. Every new exam still goes through the un-fixed legacy form with the same date triplicated across the Dates & Fees tab, the Application content module, and the `important_dates` JSONB timeline.

**Blocking:** Resolution is mandatory scope inside `legacy-exam-migration/requirements.md` ("MANDATORY SCOPE — Editor UI Unification"). Not resolvable within the deduplication spec.

### 6. ELMS editor is unreachable — conclusive, root cause identified (OPEN as a decision, CLOSED as an investigation)

**Full write-up: `legacy-exam-migration/track-2-elms-decision.md`.** That document is the primary record; this entry is the index pointer.

**Outcome:** the intended manual smoke test of cross-tab date sync was not "blocked" — it is impossible for any editor using the product, and establishing why answered the question the smoke test existed to answer. No production writes were made to force it through.

**Chain, each link verified 2026-07-25:** `lifecycle_template` = 0 and `lifecycle_template_version` = 0 → no template version resolvable → `entity_snapshot` = 0 → `entity.templateSnapshot` null for every entity → `snapshot?.moduleVisibility` undefined → `WorkspaceContext` falls back to `[general]` only → **all 18 non-General modules unreachable, including `timeline`** → the one editable surface for standard dates does not exist in the running product. URL override cannot bypass it (`activeModule` requires membership in `enabledModules`). Same zero-template cause makes `/entities/:pillar/new` throw "No content configuration available for this domain".

**Confirmed working, by direct browser observation:** task 11.3's eight `ReadOnlyDateChip` components render correctly under "Key Dates" on the General module for a real published entity, with correct labels and "Not set" values. Module nav visually confirmed to contain General only.

**Fixed along the way:** the route was rendering the router error fallback because `EditorUIProvider`, `PillarProvider`, and `TimelineDatesProvider` were mounted nowhere — they lived only in `EntityEditorShell`, which `EntityEditorPage` replaced with `WorkspaceProvider`/`WorkspaceShell` during "M4 Integration" without carrying them over. Now mounted in `EntityEditorPage.tsx`. `EntityEditorShell` is dead code.

**Two earlier claims in this project were wrong and are corrected by this:** "correct code on an unused surface" (the integration was never done) and "reachable only by typing the URL" (typing the URL produced an error page).

**Blocking:** Track 2 decision — finish ELMS or delete it and port the pattern to `exams`. Until that is decided, the `legacy-exam-migration` dependency line claiming exam-data-deduplication is deployed remains inaccurate: schema exists, editor does not.

### 6a. Original framing, superseded (kept for lineage)

Found while investigating the above: `tasks.md` for exam-data-deduplication has **0 of 69 tasks checked**, and integration tasks 8.1, 8.2, 11.3, 11.5, 11.10 were all unchecked while the component files existed. 11.3's chip work is now implemented; 11.5 and 11.10 remain undone. Design.md Property 2 ("No Duplicate Editable Fields") is unimplemented.

**`ReadOnlyDateChip` and `ReadOnlyVacancyChip` are rendered nowhere.** Grep for both identifiers across `src/**` returns only their own definition files plus doc comments in `TimelineDatesContext.tsx`. Zero consumers. `TimelineDatesProvider` *is* wired into `EntityEditorShell.tsx` (line 185), so the provider runs and computes `dates` and `totalVacancy` on every entity editor mount — feeding nothing.

**`tasks.md` records this honestly: 0 of 69 tasks are checked.** The integration tasks specifically are unchecked:

| Task | Description | State |
|---|---|---|
| 8.1 / 8.2 | Create the two chip components | `[ ]` (files exist) |
| 11.3 | GeneralTab — replace date inputs with `ReadOnlyDateChip` | `[ ]` |
| 11.5 | ModuleEditor — replace standard date fields with `ReadOnlyDateChip` | `[ ]` |
| 11.10 | Add `ReadOnlyVacancyChip` to General Tab and vacancy modules | `[ ]` |

**Correction to record:** earlier framing in this session said the deduplication feature was "correct code on an unused surface." That was too generous. It is *partially built* code on an unused surface — the enforcement mechanism (chips replacing editable date inputs) does not exist in any rendered tab, so even if editors were routed to `/entities/:pillar/new` today, nothing would prevent duplicate date entry there. Design.md Property 2 ("No Duplicate Editable Fields") is unimplemented.

**Verification performed:** grep for `ReadOnlyDateChip|ReadOnlyVacancyChip` and `useTimelineDates|TimelineDatesProvider` across `src/**`; task checkbox count via `Select-String '^\s*- \[x\]'` on tasks.md.

**Blocking:** This changes what the legacy migration depends on. The "Dependencies" line in `legacy-exam-migration/requirements.md` claiming `exam-data-deduplication` is deployed is inaccurate — the schema work may be in place but the editor enforcement is not. Resolve before Option A is chosen, since Option A assumes the entity editor is a safe replacement for `/exams/new`.

### 3. cms_education_news — frontend scope clarification (LOW PRIORITY, OPEN)

**Status:** Partially resolved. Confirmed actively used by both CMS admin (full CRUD service) and public frontend (search API + educationNewsService). NOT a duplicate of content_posts. Table confirmed still present in the database, 2026-07-25.

**What's still open:** Whether it has a dedicated frontend page/section (e.g. `/education-news`) or only appears as search results. Lower stakes than the items above.

**Product decision pending:** Should cms_education_news eventually unify with blog_posts, or stay its own content type permanently? Not blocking anything — parked.

---

## RESOLVED

### 1. cms_users / cms_roles / cms_permissions — dormancy verification (RESOLVED 2026-07-25)

**Original concern:** code-search showed no CMS admin references, but database-layer verification had not been done. Risk was that these tables were load-bearing for auth at the Postgres/Supabase layer.

**Now moot — the tables no longer exist.** `ARCHITECTURE_AUDIT_REPORT.md` records T3-9 as ✅ Dropped (`cms_users`, `cms_roles`, `cms_permissions`, `cms_ai_permissions`, `cms_ai_config`, `cms_ai_usage`, `v_cms_user_permissions`, in one atomic migration). Re-verified against the live database 2026-07-25:

| Check | Result |
|---|---|
| `information_schema.tables` for `cms_%` | 16 tables remain; none of `cms_users`, `cms_roles`, `cms_permissions` among them |
| `pg_class` lookup on those four names | 0 rows (tables absent, so no RLS/policy surface to check) |
| `pg_proc.prosrc ~* '(cms_users\|cms_roles\|cms_permissions\|cms_role_permissions)'`, all schemas | 0 matches |
| Non-internal triggers on those tables, plus on `auth.users` | Only `on_auth_user_created` on `auth.users`, executing `public.handle_new_user()` |

`handle_new_user()` body inserts into `user_profiles` only — no cms_* reference. Live auth stack confirmed intact and RLS-enabled: `user_profiles` (4 policies), `roles` (1), `permissions` (1), `role_permissions` (2).

**Conclusion:** the dormancy question is closed, and the cleanup it was gating is already done. The "database-layer verification has NOT been done" wording in the previous version of this file was accurate when written and is now obsolete.

### 2. cms_results CMS screen — operational hazard (RESOLVED 2026-07-25)

**Original concern:** editors might still be editing `cms_results` rows through a live CMS screen, believing changes were going live, when `sarkari_naukri` is what the frontend actually reads.

**Resolved — no such screen exists, and neither does the table.** Verified 2026-07-25:

- `cms_results` is absent from `information_schema.tables`; audit item T3-10 recorded the drop. `sarkari_naukri` and `_migration_log_sarkari` both confirmed still present, so migration lineage is preserved.
- `router/index.tsx` redirects `/results`, `/results/new`, and `/results/:id` to the `/sarkari-naukri` equivalents.
- `Sidebar.tsx` has no Results nav entry; the Content group routes editors to Sarkari Naukri.

**No editor communication needed** — there was no reachable dead screen to warn anyone about. The leftover source files are tracked as item 5 above (dead code, not a hazard).

### 5. Orphaned `cms_results` UI code (RESOLVED 2026-07-25 — deleted)

**Finding:** the `cms_results` table is dropped (absent from `information_schema.tables`) but three files still carried CRUD code against it:

- `src/services/resultService.ts` — 12 call sites on `.from('cms_results')`
- `src/pages/results/ResultsListPage.tsx`
- `src/pages/results/ResultEditPage.tsx`

Verified orphaned before deleting: grep for `ResultsListPage|ResultEditPage|pages/results` across `src/**` returned only their own definitions; no route imported them (`router/index.tsx` redirects `/results*` → `/sarkari-naukri`).

**Action taken:** all three files deleted. This completes audit item T3-10, whose second half ("also remove dead `resultService.ts` code") had not been done.

**Verification after deletion:**

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | exit 0 |
| `npm run test` | 25 files / 267 tests passed |
| grep `resultService\|ResultsListPage\|ResultEditPage\|cms_results` in `src/**` | 0 matches |

**Side finding, also fixed:** the full suite was red before this cleanup and unrelated to it — `TimelineTab.test.tsx` failed 20/20 because its `vi.mock` of `@/services/entity/timelineService` omitted `ensureStandardDates`, which `TimelineTab.tsx` calls on mount. Added the missing mock export. Worth noting the shape of this: the test suite covering the date single-source-of-truth path was fully failing while the feature was considered shipped, which is the same class of gap as the feature living behind an unreachable route.

---

*Last updated: 2026-07-25. Items 1 and 2 reconciled against live DB + audit report; item 4 added; item 5 found, fixed, and closed.*
