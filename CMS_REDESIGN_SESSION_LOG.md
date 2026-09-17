# IndianExamInfo — 30-Day Work Log (CMS + Frontend)

**Window:** 2026-08-30 → 2026-09-16 (last 30 days)
**Repos:** `indianexaminfo-cms` (Vite/React admin) and `indianexaminfo-frontend` (Next.js public site)
**Sources for this log:**
1. `git log --since="30 days ago"` from **both** repos (46 CMS + 44 frontend commits) — the factual timeline.
2. This chat thread — decisions, rationale, audits, and the reasoning behind the most recent commits.

> **Scope note (read this):** The commit history is complete and authoritative for the 30-day window. The narrative/decision detail is richest for the work done inside *this* chat thread (the tail end — CMS Group 1–3, version stamp, deploy diagnosis). Earlier workstreams (normalized-column migration, resources library, syllabus, date-state model, section retirement, contract CI, editions, canonical phase) are reconstructed from commit messages plus references that surfaced in-thread — they were real and shipped, but their blow-by-blow decision history predates my visible context and is summarized, not transcribed.

---

## Table of contents

1. [Workstreams overview](#workstreams-overview)
2. [Chronological timeline (both repos)](#chronological-timeline)
3. [Workstream detail](#workstream-detail)
   - [A. Data-integrity / silent-write hardening](#a-data-integrity)
   - [B. Normalized data model migration (exams.* → editions)](#b-normalized-model)
   - [C. Modules system honesty (two-axis, groups, badges)](#c-modules)
   - [D. Resources library + Syllabus](#d-resources-syllabus)
   - [E. Date-state & derived-status model](#e-date-state)
   - [F. Section registry retirement + Contract CI](#f-sections-ci)
   - [G. Editions / year-route dispatch + Canonical phase (frontend)](#g-editions-canonical)
   - [H. CMS Redesign — Groups 1–3 (this chat)](#h-cms-redesign)
   - [I. Version stamp (CMS + frontend)](#i-version-stamp)
   - [J. Post-deploy production diagnosis](#j-diagnosis)
4. [Commit reference — CMS](#commit-ref-cms)
5. [Commit reference — Frontend](#commit-ref-fe)
6. [Open items / backlog](#backlog)

---

<a name="workstreams-overview"></a>
## 1. Workstreams overview

Over the 30 days the work spanned far more than the CMS redesign. Distinct threads:

| Key | Workstream | Repos | Status |
|---|---|---|---|
| A | Data-integrity / anti-silent-write hardening (URL normalize, date-state preservation, import preview gate) | both | shipped |
| B | Normalized model migration — stop reading/writing dropped `exams.*` columns; cycle data → `exam_editions` | both | shipped |
| C | Modules system honesty — two-axis applicability, 3 groups, real drag, Live/Hidden badges | CMS | shipped |
| D | Resources library + structured Syllabus (relational table, per-exam weightage) | both | shipped |
| E | Date-state & date-driven derived status (VIEW, state seeding, frontend rendering) | both | shipped |
| F | Section-registry retirement (previous-papers/study-material/mock-test) + Contract CI rules | both | shipped |
| G | Editions / shared year-route dispatch + "Canonical phase" dedup routing | frontend | shipped (`9c082f3`, `d94d190`) |
| H | **CMS Redesign Groups 1–3** (this chat's main work) | CMS | Groups 1–2 shipped+verified; Group 3 Items 2–3 shipped; Item 1 pending decisions |
| I | Version stamp (deployed-SHA visibility) | both | shipped (`0838df3`, `f7f9c5e`) |
| J | Post-deploy production diagnosis of 3 issues | CMS | diagnosis only, no fix |

---

<a name="chronological-timeline"></a>
## 2. Chronological timeline (both repos, newest → oldest)

Format: `date · repo · sha · summary`. **CMS** = admin, **FE** = frontend.

- 2026-09-16 · FE · `e0cec29` · push
- 2026-09-16 · FE · `f7f9c5e` · feat(frontend): emit deployed commit SHA in a build meta tag **(I)**
- 2026-09-16 · CMS · `29e2496` · fix: unify news save and clarify content classification **(H — Group 3 Items 2+3)**
- 2026-09-16 · CMS · `c4356a8` · fix(cms): explain module content modes **(H — Group 2 Item 8)**
- 2026-09-16 · CMS · `0838df3` · feat(cms): show deployed commit SHA + build time in sidebar **(I)**
- 2026-09-16 · CMS · `a8df5bb` · fix(exam-editor): AI Fill only populates empty fields, never overwrites **(H — Group 1 follow-up)**
- 2026-09-16 · CMS · `970b911` · fix(exam-editor): prevent silent data loss in editor **(H — Group 1)**
- 2026-09-15 · FE · `d94d190` · fix(editions): main-page title year from current edition, not calendar year **(G)**
- 2026-09-15 · FE · `9c082f3` · feat(editions): shared year-route dispatch across all pillars + SEO guards **(G)**
- 2026-09-13 · FE · `a4c9463` · Canonical Phase **(G)**
- 2026-09-12 · CMS · `e7d1f74` · chore(registry): export CONTENT_TYPE_TO_SECTION for cross-check **(F)**
- 2026-09-12 · FE · `c983056` · refactor(exam-page): shared MODULE_RENDERERS so both render paths agree **(F)**
- 2026-09-12 · FE · `4ce9e13` · feat(exam-page): structured Result and Admit Card renderers
- 2026-09-12 · FE · `da349ea` · fix(exam-page): render overview 'description' field (recovers 268 exams' About text)
- 2026-09-12 · FE · `e0a7811` · refactor(exam-page): focused content-type view (converge university/board CT pages)
- 2026-09-12 · FE · `23a571d` · test(ci): Rule 5b — filesystem check closes the undeclared-route gap **(F)**
- 2026-09-12 · FE · `0598e5d` · test(ci): Rule 5 — per-route content-type divergence guard **(F)**
- 2026-09-11 · CMS · `dff9b47` · refactor(registry): add academic-info section, reconcile board-exam pillar (parity) **(F)**
- 2026-09-11 · CMS · `ab1b6da` · feat(ci): module registry axis rules — selection, entity, level; ban 'empty' opt-outs **(C/F)**
- 2026-09-11 · CMS · `f25edaf` · refactor(publish): workflow_status single source; remove dropped syllabus_highlights **(B)**
- 2026-09-11 · CMS · `a65b199` · feat(syllabus): drag-reorder subjects, topics one-per-line, richer empty state **(D)**
- 2026-09-11 · CMS · `6e6a2a5` · retire(sections): remove previous-papers + study-material from sectionRegistry + bridge **(F)**
- 2026-09-11 · CMS · `ccd5867` · retire(modules): remove previous-papers/mock-test/study-material defs; content → exam_resources **(F)**
- 2026-09-11 · CMS · `e1e6e05` · feat(syllabus): structured exam-level syllabus — relational table + DB trigger guard + Syllabus tab **(D)**
- 2026-09-11 · FE · `b610a70` · fix(syllabus): consistent SyllabusSection across all 6 CT routes; add gate to state route **(D)**
- 2026-09-11 · FE · `6cf303d` · test(ci): placement-consistency rule — tab-only sections have no main-page renderer **(F)**
- 2026-09-11 · FE · `b0cdee8` · fix(syllabus): route /syllabus correctly, remove from main page; one gate for tab+page **(D)**
- 2026-09-11 · FE · `f705dae` · refactor(exam-page): widen render to all pillars, delete dead legacy body
- 2026-09-11 · FE · `d12c18e` · refactor(exam-page): ordered path parity + academic-info + board-exam pillar
- 2026-09-11 · FE · `ddb2954` · feat: selection-outcome renderers + renderer-coverage CI rule **(F)**
- 2026-09-11 · FE · `d693bf4` · fix(exam): remove duplicate syllabus render, fix double-year title, syllabus tab from structured store **(D)**
- 2026-09-11 · FE · `825aeb8` · feat(syllabus): render topics as a list, respecting per-subject order **(D)**
- 2026-09-11 · FE · `49179c9` · retire(sections): remove previous-papers + study-material from sectionRegistry + contentType bridge **(F)**
- 2026-09-11 · FE · `077e08d` · feat(syllabus): render structured syllabus (subjects+weightage) on exam pages **(D)**
- 2026-09-10 · CMS · `9a476bb` · fix(resources): pluralize CMS group headings by count **(D)**
- 2026-09-10 · CMS · `e25f97b` · fix(resources): block deleting a syllabus PDF referenced by any edition (FK→RESTRICT) **(D/A)**
- 2026-09-10 · CMS · `69b9018` · feat(resources): Option A syllabus reference — edition.syllabus_resource_id + inline picker **(D)**
- 2026-09-10 · CMS · `e756b1b` · feat(resources): exam_resources library service + identity-level Resources tab **(D)**
- 2026-09-10 · CMS · `9b08b24` · feat(import preview): ALL-DATES-DELETED line + archived-edition content summary **(A)**
- 2026-09-10 · CMS · `a19fd61` · feat(import): read-only preview + CONFIRM gate for Excel import **(A)**
- 2026-09-10 · CMS · `32f8349` · fix(excel): absent is_featured/is_published cell preserves existing value **(A)**
- 2026-09-10 · CMS · `54a48a9` · step 4: remove dropped exams.* cols from generated Supabase types **(B)**
- 2026-09-10 · CMS · `f876813` · step 4b: stop writing dropped exams.* cols; cycle data → exam_editions **(B)**
- 2026-09-10 · FE · `1687012` · fix(resources): pluralize kind headings by item count **(D)**
- 2026-09-10 · FE · `c2a7e7a` · docs(resources): correct ResourceLibrary comment — archive rendering NOT wired yet **(D)**
- 2026-09-10 · FE · `d171e56` · harden(resources): app-level is_published filter (defense-in-depth vs RLS) **(D/A)**
- 2026-09-10 · FE · `cc49b42` · feat(resources): render exam_resources library on exam pages **(D)**
- 2026-09-10 · FE · `6d4fdd3` · step 4a: drop exams.* cycle/has_*/status reads — edition + derived VIEW only **(B)**
- 2026-09-09 · CMS · `cdd6d2e` · feat(modules): fix axis-scoping + add exhaustiveness guard **(C)**
- 2026-09-09 · CMS · `42290f2` · fix(dates): stop CMS destroying date state/verified/stage_label on save **(A/E)**
- 2026-09-09 · CMS · `dd2c8f9` · fix: log CMS service errors + drop dead type_fields coupling **(A)**
- 2026-09-09 · CMS · `b516246` · assets: add real logo favicon **(assets)**
- 2026-09-09 · FE · `fb0aeaa` · fix(exams): read cycle fields edition-only, drop stale exams.* fallback **(B)**
- 2026-09-09 · FE · `610949c` · perf: disable RSC prefetch on real nav + fix ad 404s **(perf)**
- 2026-09-09 · FE · `0a4a530` · assets: wire real IndianExamInfo logo across favicon, PWA, header, OG **(assets)**
- 2026-09-08 · FE · `c3bd841` · perf: finish prefetch tuning across detail-page link sources **(perf)**
- 2026-09-02 · CMS · `c7c2950` · feat: AI Fill now returns type, state, stage_label, verified on date rows **(E)**
- 2026-09-02 · FE · `7aba6dc` · fix: log fetchDerivedStatuses errors; prefetch=false on high-volume links **(E/perf)**
- 2026-09-02 · FE · `3b83701` · fix: remove fake stat, close mega menu on navigation
- 2026-09-02 · FE · `302c164` · fix: status override priority — stored 'cancelled'/'postponed' wins over VIEW **(E)**
- 2026-09-02 · FE · `122ab93` · feat: Step 2 transaction (b) — type-driven VIEW, strip contract, date state rendering **(E)**
- 2026-09-02 · FE · `e3e60ba` · feat: date-driven status (Step 2) — VIEW, state seeding, frontend switch **(E)**
- 2026-09-01 · CMS · `94631f1` · fix: Slice 1 follow-ups — badge, date dedup, toggle enforcement, date-sheet tab **(C)**
- 2026-09-01 · CMS · `b3dcd94` · Update ContentModuleCard.tsx **(C)**
- 2026-09-01 · CMS · `0d2731b` · fix(ModulePanel): fail-open on unknown slugs **(C)**
- 2026-09-01 · CMS · `8dda37d` · feat(two-axis): SelectionModel type + selection-aware applicability at all write paths **(C)**
- 2026-09-01 · CMS · `4af6bd0` · GPT push
- 2026-09-01 · FE · `4b919b8` · fix: Slice 1 follow-ups — React key, toggle enforcement, date-sheet tab **(C)**
- 2026-09-01 · FE · `71fc28b` · fix
- 2026-09-01 · FE · `0d5a222` · GPT push
- 2026-08-31 · CMS · `429212a` · fix 1
- 2026-08-31 · CMS · `503fd59` · feat(cms): honest Modules tab (3 groups, real drag on editable modules only) + UI fixes **(C)**
- 2026-08-30 · CMS · `871683c` · feat(cms): Live/Hidden per-section badge + Unverified per-exam chip **(C)**
- 2026-08-30 · CMS · `28dfc1c` · Create sectionRegistry.ts **(F)**
- 2026-08-30 · CMS · `ac43e12` · refactor(modules): remove dead System B drag-to-reorder UI **(C)**
- 2026-08-30 · CMS · `a9ed018` · fix(url): reject whitespace/comma & pre-encoded %20/%2C in normalizeUrl **(A)**
- 2026-08-30 · CMS · `54e0100` · fix: throw on non-empty official_website that cannot normalise (Finding #3) **(A)**
- 2026-08-30 · CMS · `e1b7546` · Update EntranceExamEditorPage.tsx **(A)**
- 2026-08-30 · CMS · `189ed2b` · fix: normalise official_website on save (Finding #3) **(A)**
- 2026-08-30 · CMS · `f6db550` / `c2548f3` / `500d24f` · revalidate.ts fixes
- 2026-08-30 · CMS · `c15bbdd` · fix: recover from stale-chunk load failures after deploy **(A)**
- 2026-08-30 · CMS · `664ca82` · fix: update Groq models to current production IDs (gpt-oss-120b) **(AI)**
- 2026-08-30 · FE · `c141806` · feat(sections): gate tabs, sitemap, sub-page routes and hub links by one hasData rule **(F)**
- 2026-08-30 · FE · `fa48a36` · fix
- 2026-08-30 · FE · `f373c87` · fix(url): reject whitespace/comma & pre-encoded %20/%2C in normalizeUrl **(A)**
- 2026-08-30 · FE · `d755156` · fix: normalise officialWebsite on read (prevent 500 on bare URLs, Finding #3) **(A)**
- 2026-08-30 · FE · `ec2fb26` / `86c3d7e` · route.ts / examService.ts updates

---

<a name="workstream-detail"></a>
## 3. Workstream detail

<a name="a-data-integrity"></a>
### A. Data-integrity / silent-write hardening
Recurring theme all month: stop the CMS from destroying good data silently.
- **official_website normalization** (`54e0100`, `189ed2b`, `a9ed018`; FE `f373c87`, `d755156`): reject whitespace/comma/pre-encoded input rather than blanking; throw on non-normalizable non-empty URLs so AI/import can't silently blank them ("Finding #3").
- **Date row preservation** (`42290f2`): stop CMS wiping `state`/`verified`/`stage_label`/`type` on save.
- **Excel import safety** (`a19fd61`, `9b08b24`, `32f8349`): read-only preview + CONFIRM gate; explicit "ALL DATES DELETED" line; absent cells preserve existing values instead of flipping them.
- **Stale-chunk recovery** (`c15bbdd`): auto-reload once after deploy when a hashed chunk 404s.
- This is the same principle the CMS-redesign Group 1 (below) formalized into the unsaved-changes guard and AI empty-only fill.

<a name="b-normalized-model"></a>
### B. Normalized data model migration (`exams.*` → `exam_editions`)
- **"Step 4"** (`f876813`, `54a48a9`, `f25edaf`; FE `6d4fdd3`, `fb0aeaa`): stop writing/reading dropped `exams.*` cycle columns (`status`, `has_*`, `important_dates`, `vacancy`, `eligibility`, `fee`, `last_updated`). Cycle data now lives in `exam_editions`; frontend reads edition + a derived VIEW only, no stale `exams.*` fallback. `workflow_status` became the single publish source.

<a name="c-modules"></a>
### C. Modules system honesty (two-axis, groups, badges)
- **Two-axis applicability** (`8dda37d`, `cdd6d2e`, `0d2731b`): `entityType` × `SelectionModel` drive which modules apply; fail-open on unknown slugs; exhaustiveness guard.
- **Honest Modules tab** (`503fd59`, `ac43e12`, `b3dcd94`, `94631f1`): 3 groups (fixed sections / editable modules / tab-only), real drag only where reordering is real, Live/Hidden + Unverified badges (`871683c`). This is the module UI that Group 2 (below) later added help text to.

<a name="d-resources-syllabus"></a>
### D. Resources library + Syllabus
- **exam_resources library** (`e756b1b`, `69b9018`, `e25f97b`, `9a476bb`; FE `cc49b42`, `d171e56`, `c2a7e7a`, `1687012`): identity-level Resources tab shared across editions; Option A syllabus-PDF reference on the edition with an inline picker; FK→RESTRICT so a referenced PDF can't be silently unlinked; RLS-filtered rendering.
- **Structured syllabus** (`e1e6e05`, `a65b199`; FE `077e08d`, `825aeb8`, `d693bf4`, `b0cdee8`, `b610a70`): relational subjects/topics/weightage table + DB trigger guard; Syllabus tab with per-exam weightage; frontend renders structured syllabus consistently across all content-type routes.

<a name="e-date-state"></a>
### E. Date-state & date-driven derived status
- **Step 2** (FE `e3e60ba`, `122ab93`, `302c164`; CMS `c7c2950`, `42290f2`): a date VIEW derives status from dates; date `state` seeding (`confirmed`/`expected`/`cancelled`/`postponed`); stored `cancelled`/`postponed` overrides win over the VIEW; AI Fill returns `type`/`state`/`stage_label`/`verified` on date rows. This is the model the Group 3 Item 1 investigation later leaned on.

<a name="f-sections-ci"></a>
### F. Section registry retirement + Contract CI
- **Retire dead sections** (`ccd5867`, `6e6a2a5`, `49179c9`, `28dfc1c`, `dff9b47`, `e7d1f74`; FE `49179c9`, `c141806`): remove previous-papers / study-material / mock-test module definitions (content moved to the resources library); keep CMS and frontend section registries in sync via a bridge/cross-check.
- **Contract CI** (`ab1b6da`; FE `0598e5d`, `23a571d`, `6cf303d`, `ddb2954`): CI rules enforcing route/content-type/renderer parity between the two repos and banning "empty" opt-outs. (In-thread the user noted this effort had grown large for one confirmed bug — hence the pivot to the CMS redesign.)

<a name="g-editions-canonical"></a>
### G. Editions / year-route dispatch + Canonical phase (frontend)
- **Editions** (`9c082f3`, `d94d190`): shared year-route dispatch across all pillars + SEO guards; main-page title uses the current edition's year, not the calendar year. **Verified in production and explicitly closed** — treated as off-limits for the rest of the session.
- **Canonical phase** (`a4c9463`, and the 4 uncommitted files seen in-thread): dedup routing — 301-redirect duplicate board-exam/university routes to canonical forms. In-thread, the 4 uncommitted frontend files (C1/C2/CBSE/H1) were investigated read-only and left intact (separate workstream).

<a name="h-cms-redesign"></a>
### H. CMS Redesign — Groups 1–3 (the main work of this chat)

**Editor confirmed via router:** `/entrance-exams`, `/govt-exam` (re-export), `/govt-vacancy`, `/board-exams`, `/university-exams` all render `EntranceExamEditorPage`. The ELMS `WorkspaceShell`/`EditorUIContext.dirtyTabs` is only on `/entities/:pillar/:id` — not the daily editor.

**Group 1 — data-loss risks** (`970b911`, then `a8df5bb`):
- Unsaved-changes guard: three exits (tab switch, `beforeunload`, `useBlocker`), accurate dirty (RHF `isDirty` + seed-compared News/News-SEO + module-autosave-pending), styled 3-button dialog naming the tab. Modules handled via Option A (autosave-pending counts as dirty; "Save & continue" waits for the debounce).
- AI Fill no-op-on-empty, then **empty-only fill**: AI never overwrites an existing value (the Bihar Board "CAT" incident); fills only blanks; appends news; existing content wins on module key clash; honest toasts.

**Group 2 — daily friction** (`c4356a8`): audited 6 items against live code — 5 already fixed in earlier work (clipped labels, toast position, collapse-by-default, raw-JSON suppression, AI scope labels); only **Item 8** open → added one always-visible Auto/Hybrid/Manual help line in `ModulePanel`.

**Group 3 — redundancy** (`29e2496`, Items 2+3):
- Item 2: three DISTINCT classifiers (Content Type = route family; Section = topic + public URL; Post Type = display badge) — clarified with one-line role notes; no removal/schema/URL change.
- Item 3: unified Save — one merged `content_modules` write (base ∪ live News ∪ live News-SEO) in a single `updateEdition`, removing the two-button stale-snapshot race; removed the separate "Save News"/"Save News SEO" buttons; guard `Save & continue` triggers on any dirty source. **Post-audit stale-ref fix:** refs reset to `null` on tab unmount so an unmounted tab can't flush a stale snapshot.
- Item 1 (Notification Date vs Notification Release row): **investigated, not implemented** — pending user decisions (see backlog). Key facts: `important_dates` is canonical; the `notification_date` column is unread by the entrance/exam frontend; 200 col / 38 row / 37 both (1 conflict: RRB Group D 2026) / 163 col-only / 1 row-only; a frontend `datePosted` label-match defect logged separately.

**Verification on `29e2496`:** tsc PASS · 337/337 tests PASS · production build PASS · `git diff --check` clean.

<a name="i-version-stamp"></a>
### I. Version stamp (`0838df3` CMS, `f7f9c5e` frontend)
Build-time git SHA + time + sync-vs-origin baked in. CMS shows it in the sidebar footer (green only when exactly `origin/main`); frontend emits `<meta name="build">`. Purpose: end the recurring "which commit is deployed?" ambiguity.

<a name="j-diagnosis"></a>
### J. Post-deploy production diagnosis (read-only, no fix)
Three observations after deploying `29e2496` — **none a regression from it**:
1. **News save shows a reload/spinner** — pre-existing `loadExam()` refresh (present at `29e2496~1`); cosmetic. Class B/D.
2. **AI Fill "Enter a title first"** — by design; title is the generation *input*, not generated. Class D.
3. **Published Govt Vacancy not on dashboard** — `/govt-vacancy` writes to `exams`, but the dashboard counts recruitment from the legacy `sarkari_naukri` table (and `exams` has no `published_at`). Class C, belongs to the CMS_REDESIGN dashboard rework (§6), not Group 3.

---

<a name="commit-ref-cms"></a>
## 4. Commit reference — CMS (46 commits, 30 days)
See the [chronological timeline](#chronological-timeline) for the full list with dates. Headline recent commits:

| SHA | Message |
|---|---|
| `29e2496` | fix: unify news save and clarify content classification |
| `c4356a8` | fix(cms): explain module content modes |
| `0838df3` | feat(cms): show deployed commit SHA + build time in sidebar |
| `a8df5bb` | fix(exam-editor): AI Fill only populates empty fields, never overwrites |
| `970b911` | fix(exam-editor): prevent silent data loss in editor |
| `e7d1f74` | chore(registry): export CONTENT_TYPE_TO_SECTION for cross-check |
| `f876813` | step 4b: stop writing dropped exams.* cols; cycle data → exam_editions |
| `503fd59` | feat(cms): honest Modules tab (3 groups, real drag) |
| `8dda37d` | feat(two-axis): SelectionModel + selection-aware applicability |

<a name="commit-ref-fe"></a>
## 5. Commit reference — Frontend (44 commits, 30 days)
Headline recent commits (full list in the timeline):

| SHA | Message |
|---|---|
| `f7f9c5e` | feat(frontend): emit deployed commit SHA in a build meta tag |
| `d94d190` | fix(editions): main-page title year from current edition |
| `9c082f3` | feat(editions): shared year-route dispatch across all pillars + SEO guards |
| `a4c9463` | Canonical Phase |
| `122ab93` | feat: Step 2 — type-driven VIEW, date state rendering |
| `e3e60ba` | feat: date-driven status (Step 2) |
| `cc49b42` | feat(resources): render exam_resources library on exam pages |
| `077e08d` | feat(syllabus): render structured syllabus on exam pages |
| `c141806` | feat(sections): gate tabs/sitemap/routes by one hasData rule |

---

<a name="backlog"></a>
## 6. Open items / backlog (nothing started; awaiting decisions)

**Group 3 Item 1 (Notification Date) — pending user decisions:**
1. RRB Group D 2026 conflict: column `2026-07-02` vs row `2026-07-01`.
2. Backfill `state`: `confirmed` vs `expected`.
3. Backfill `label`: `"Notification"` (matches frontend `datePosted`) vs `"Notification Release"` (CMS standard).
4. Migration strategy for 163 column-only + 1 row-only records.
5. Frontend structured-data `datePosted` exact-match defect (logged separately).

**Deferred / separate backlog:**
- `exam-prep` vs `exam-preparation` section normalization (migration + URL redirects).
- **Group 4 (structural):** result-module phantom fields; `physicalStandards` / `examLanguages` as real fields.
- Option B: convert Modules to explicit save (remove 2s autosave).
- **Dashboard rework (CMS_REDESIGN §6):** decide whether recruitment counts read `exams` vs `sarkari_naukri` (addresses diagnosis Issue 3).
- News-save reload UX polish (Issue 1); AI-Fill title expectation note (Issue 2).
- Frontend canonical-routing patch — the 4 uncommitted files investigated in-thread; commit/finish/discard is a pending decision.

**Protected / closed this session:** Editions & year-routing (`9c082f3`/`d94d190`, verified in prod), ELMS WorkspaceShell, Groups 1 & 2 (verified in prod), and any DB schema/data migration.

---

## Accuracy & limitations

- **Commit lists** are exact, from `git log --since="30 days ago"` on both repos on 2026-09-16.
- **Narrative depth** is highest for this chat's work (Groups 1–3, version stamp, diagnosis). Earlier workstreams (A–G) are summarized from commit messages + in-thread references; their detailed decision history predates my visible chat context, so treat those sections as an accurate *index* rather than a full transcript.
- This document is a record only. It changed no application code, schema, or data. It is currently uncommitted.
