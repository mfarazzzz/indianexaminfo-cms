# Admission & Counselling Model + AI Fill v2 — Investigation and Design (D)

Status: **PROPOSAL ONLY — READ-ONLY. Nothing here is implemented, no migration is applied.**
Scope: Sprint 1 Part B (AI Fill v2) and new Part C (admission & counselling model).
R0: local commits only; no push, no deploy, no remote DB writes.

Evidence rule: every "CURRENT" claim below cites a real `file:line` or `table.column`.
Where I could not verify something, it is labelled **[UNVERIFIED]** or **[GAP]**.

> **Two inputs I do not have.** The owner's issue document ("AI Fill & CMS model can't handle
> UP D.El.Ed 2026") was referenced as attached, but the only readable temp file was the
> Hostinger build log; the acceptance-test text and the owner's exact **counselling-round
> field list** were not recoverable. This doc is written from the 10-point spec in the task.
> Section 5 (round fields) and Section 12 (acceptance mapping) flag precisely what must be
> reconciled against the issue before any slice is approved.

The worked example that motivated all of this — **UP D.El.Ed 2026** — is a *state
counselling admission*: merit-based selection (Intermediate/graduation marks), a
notification, an online form with a fee, then multi-phase **counselling with rounds,
choice-filling, seat allotment and reporting**, and no written exam. The current model
cannot express it, which is the thread every section below pulls on.

---

## 0. The two axes (already correct — do not re-litigate)

- **Axis 1 — `entity_type` = WHAT the thing is.** Postgres enum mirrored in
  `src/config/moduleRegistry.ts:30` — `exam | board | university-admission | recruitment |
  university-exam`; stored on `exams.entity_type` (`migrations/20260702150637_categories_and_exams.sql:30`).
  The valid `(pillar, entity_type)` pairs are enforced at the DB:
  `migrations/20260926023410_exams_pillar_entity_type_check.sql:8-14`.
- **Axis 2 — `selection_model` = HOW selection happens.** `src/types/selection.ts:12-16` —
  `written-exam | merit-based | interview-based | internal-admission`; Postgres enum created
  on `exams.selection_model` with `DEFAULT 'written-exam'`
  (`migrations/20260831095246_add_selection_model_axis.sql:3-12`).

`moduleRegistry` already labels `university-admission` as the **"counselling-route"**
(`src/config/moduleRegistry.ts:42`) and lets the entrance-exam pillar choose between
`exam` and `university-admission` (`:47`). That existing value is the home for a state
counselling admission — see §1.

---

## 1. Taxonomy (B1, B2, B4)

**CURRENT**
- Entrance/exam categories are a **table**, not code: `categories(id, slug, name,
  short_name, pillar, parent_id, order_index, is_active, exam_count)`
  (`migrations/20260702150637_categories_and_exams.sql:2-20`); exams point at them via
  `exams.category_id` / `subcategory_id` (`:28-29`). (A second `cms_categories` table exists
  for CMS-authored articles — `migrations/20260716024807_create_cms_categories.sql:1`.)
- **But AI Fill ignores that table** and hard-codes the whole category vocabulary as an
  inline enum in the prompt: `src/lib/ai/autofill.ts:168` —
  `management|engineering|medical|law|banking|…|teaching|…` (18 fixed slugs, no
  teacher-education / D.El.Ed / B.Ed / M.Ed / Shiksha Shastri).
- `pillar`, `entityType`, `status` are likewise hard-coded enums in the same prompt
  (`autofill.ts:146-148`), and the `entityType` list `recruitment|exam|board|university` is
  **stale**: the DB renamed `university`→`university-admission` and added `university-exam`
  (`migrations/20260926023322_entity_type_add_university_exam_rename_admission.sql:9-12`).
- **No CMS category-management UI** was found for `categories` (add/rename/reorder/slug)
  **[UNVERIFIED — confirm there is no admin screen before proposing to build one]**.

**PROPOSAL**
- **B1 — categories stay in the DB (single source of truth); add a CMS admin screen** over
  `categories` (add / rename / reorder via `order_index` / change `slug`). Remove the
  hard-coded list from `autofill.ts:168` and have AI Fill read options from the table (§9).
- **B1 — add a "Teacher Education" category tree** as rows, not code: a parent
  `teacher-education` (pillar `entrance-exam`) with children `d-el-ed` (D.El.Ed/BTC),
  `b-ed`, `m-ed`, `shiksha-shastri`. Draft seed: `supabase/proposed/b1_teacher_education_categories.sql`.
- **B2 — keep the two axes clean.** UP D.El.Ed = `entity_type='university-admission'`
  (the existing counselling-route value) **AND** `selection_model='merit-based'`. Do **not**
  add `merit-based` as an entity_type: "WHAT it is" (an admission) is orthogonal to "HOW
  selection happens" (merit). The smallest change that fits a state counselling admission is
  therefore **zero new enum values** — it is the pairing the schema already allows but the
  UI/AI Fill never produce. Only gap: nothing today *drives* modules/order from
  `selection_model` (§3) or sets it from AI Fill (§9).

---

## 2. URL safety (B4)

**CURRENT**
- Legacy URLs are handled by a static, hand-maintained `redirects()` list in the frontend
  `next.config.ts` (e.g. `/entrance-exam/*`→`/admission/*`, `/government-jobs/*`→
  `/sarkari-naukri/*`) — file:line **[UNVERIFIED: exact lines to cite at implementation]**.
- There is **no slug/category history table** — renaming a published record's slug orphans
  its old URL (no automatic redirect). **[GAP]**
- Breadcrumb labels: the sarkari path builds a display label from a slug via
  `lib/sarkari/categories.ts:57-67` `titleCaseSlug` ("new-dept" → "New Dept") — a
  slug-derived label, which is exactly the anti-pattern to avoid. Entrance/admission/board/
  university breadcrumbs are passed into `EntityDetailPage` as a `breadcrumbs` prop built by
  the routes **[UNVERIFIED: confirm each route uses `categories.name`, not a title-cased slug]**.

**PROPOSAL**
- **Slug/category history table + one-hop redirect.** `supabase/proposed/b4_slug_history.sql`:
  `entity_slug_history(entity_type, entity_id, old_slug, new_slug, changed_at)`; a Next.js
  middleware/`redirects` source that reads the latest history row for a not-found slug and
  issues a **301/308 one-hop** redirect to the current canonical URL when a *published*
  record was renamed. One hop only (never a chain).
- **Breadcrumb uses the category display name.** Always resolve the label from
  `categories.name` (join by `category_id`), never from the slug. Replace the `titleCaseSlug`
  fallback path for breadcrumbs; keep title-casing only as a last-resort dev fallback that is
  never hit in production.

---

## 3. Modules follow the model (C1, I1–I3)

**CURRENT**
- `moduleRegistry` modules declare **both** axes already: `applicableTo` (entity types)
  `src/config/moduleRegistry.ts:151` and `appliesToSelection` (selection models) `:152-153`.
  Examples: admit-card/answer-key/exam-pattern `appliesToSelection:['written-exam']`
  (`:479,:512,:818`); documents-required & final-selection `['merit-based','interview-based']`
  (`:678,:748`); interview `['interview-based']` (`:714`); allotment `['internal-admission']`
  (`:781`); a dedicated **counselling** module `applicableTo:['exam','university-admission']`
  "Counselling rounds, seat allotment, choice filling" (`:605-607`) and a **merit-list**
  module (`:639-641`).
- So the *definition* layer is model-aware, but at runtime the page order/enablement is
  **editorial**, not model-driven: the frontend renders `content_modules._config
  .moduleOrder` / `.enabledModules` (`components/exam/EntityDetailPage.tsx:692-701`) — there
  is no per-`selection_model` default set/order.
- **Eligibility, Fee and FAQs are NOT modules** — they render from **columns**:
  `EligibilitySummary` reads `exam.eligibility` (`sectionRenderers.tsx:98`),
  `ApplicationFeeSummary` reads `exam.applicationFee` (`:130`), `FaqsSummary` reads `exam.faqs`
  (`:218`); the registry marks eligibility `source:"column"` (`lib/sectionRegistry.ts:87`).
  The coverage test confirms there is "no eligibility module renderer"
  (`lib/contract/contract.coverage.test.ts:40`).
- **Reorder contradiction (I2):** `components/entity-editor/modules/ModuleCard.tsx:22-26` —
  drag was **removed** because "System B reorder wrote to `entity_module.display_order`, a
  column the frontend never reads (CONSISTENCY_AUDIT Phase 1 Q2)"; the table/service are
  parked, yet a drag handle is still conditionally rendered (`:51-53`). Two reorder notions
  (parked `display_order` vs live `_config.moduleOrder`) coexist.
- **Toggle vs badge (I3):** enabling a module uses `enabledModules` (the toggle), while tab
  visibility is a separate registry flag `showAsTab` (`lib/sectionRegistry.ts:85`) — two
  controls a reader may not connect. Exact on-screen help wording **[UNVERIFIED — cite the
  ModuleCard/panel help string before rewriting]**.

**PROPOSAL**
- **Model-driven default module set + order.** Compute a *default* order/enablement from
  `(entity_type, selection_model)` using the existing `applicableTo`/`appliesToSelection`
  filters, so a merit-based counselling admission **hides** admit-card/answer-key/exam-pattern
  and **surfaces** Overview, Eligibility, Application Process, Fee, Merit List, Counselling,
  Important Dates, News. Editor edits are an override on top of the computed default.
- **Irrelevant modules are hidden, not empty.** A module not applicable to the model is
  dropped from the render list entirely (today an enabled-but-empty module still shows a
  heading) — same "hide the whole widget" rule as T1c.
- **Move Eligibility, Fee, FAQs into the module system** as first-class modules so the model
  can order/gap them uniformly (keep the column data; render through a module so order/gating
  is one mechanism, not two).
- **Resolve reorder (I2):** delete the parked `display_order` path and the dead drag handle;
  single source = `_config.moduleOrder`. Re-enable drag writing ONLY to `moduleOrder`.
- **Resolve toggle-vs-badge (I3):** one control — enabled ⇒ appears; and a separate explicit
  "show as tab" only where a tab route exists. Reword the help text to describe that single
  meaning.

---

## 4. Dates — a flexible event-rows model (D1, D2)

**CURRENT**
- Dates live in `exam_editions.important_dates` — a **JSONB array of objects**, one per event:
  `{ label, date, isUrgent, state, type, stage_label, verified, note }`
  (frontend read: `services/examService.ts:141-150`; SQL consumers key off `.type`/`.state`).
- `state ∈ confirmed | expected | cancelled | postponed`
  (`migrations/20260902122910_exam_derived_status_v3_postponed_fix.sql:70,123-131`).
- `type` is the machine event kind used by the status view; when absent it is **inferred from
  the label** by `LIKE` patterns (`exam_derived_status…:39-69`) — including `counselling`,
  `merit_list`, `interview`.
- Limits vs the owner's ask: a row is a **single date** (no range/end), **no time**, **no
  explicit phase/round tag** (only a free `stage_label`), and "done/next" is not a stored
  marker (it is computed against today in the view). A revalidation trigger fires on
  `important_dates` change (`migrations/20260930171935_…sql:131-133`).

**PROPOSAL — promote important_dates to a first-class `exam_events` table**
`supabase/proposed/d1_exam_events.sql`:
- Columns: `id, edition_id (FK), kind, label, date_start, date_end (nullable → range),
  time_text (nullable, e.g. "10:00–12:00"), phase (nullable), round (nullable),
  state (confirmed|expected|cancelled|postponed|tentative), source_quote (nullable), sort,
  created_at, updated_at`.
- `kind` is an explicit, DB-enumerated event type (reusing the view's vocabulary:
  `notification, application_start, application_end, admit_card, exam_written, …,
  merit_list, counselling, choice_filling, seat_allotment, reporting, document_verification,
  interview, result, other`) — editors set it, and the status function no longer has to guess
  from labels (the `LIKE` inference becomes a migration-time backfill only).
- **done / next are computed, not stored** — derived from `date_start` vs today (IST), the
  same anchor the current view uses (`exam_derived_status…:35`).
- **Migration without data loss:** backfill `exam_events` from every existing
  `important_dates` element (label→`label`, date→`date_start`, `type`→`kind`, inferred type→
  `kind` where `.type` was empty, `state`→`state`, `stage_label`→`phase`). Keep
  `important_dates` as a read-only projection during the cut-over, then drop it once the
  status function and both sites read `exam_events`. The revalidation trigger moves to
  `exam_events`.

---

## 5. Counselling rounds (C2)

**CURRENT**
- Counselling exists only as (a) a free-text **module** (`moduleRegistry.ts:605`
  "Counselling rounds, seat allotment, and choice filling") and (b) a label-inferred date
  `kind='counselling'` in the view (`exam_derived_status…:48-50`). There is **no structured
  round record, no allotment/reporting fields, no per-round status** — **[GAP]**. UP D.El.Ed's
  Phase 1/2/3, choice locking, seat allotment, and reporting cannot be represented.

**PROPOSAL — `counselling_rounds` table** `supabase/proposed/c2_counselling_rounds.sql`
structured rows: `id, edition_id (FK), round_label, phase (nullable), registration_start,
registration_end, choice_filling_start, choice_filling_end, fee_last_date, round_start_date,
result/allotment_date, reporting_start, reporting_end, seat_allotment_url (nullable),
docs_required (text[]), notes, sort`. **Round status is computed from these dates** by the
same function as §6 (e.g. "Counselling – Phase 3 open", "Allotment out", "Reporting open"),
never hand-typed.

> **[GAP — needs the owner's issue]** The task says "all fields in the owner's list"; I do
> not have that list. The columns above are a superset guessed from a typical UP/state
> counselling flow. Before Slice-3 is approved, reconcile this table against the exact field
> list in the issue and drop/add accordingly.

---

## 6. One status (E1) — mirror the content_has_data contract

**CURRENT — the pattern to copy already exists:**
- Content-presence is a **canonical function mirrored three ways and pinned by test**:
  frontend TS `lib/sectionRegistry.ts hasData/contentTypeHasData`; CMS TS mirror
  `indianexaminfo-cms/src/lib/sectionRegistry.ts:204-207`; SQL mirror
  `indianexaminfo-cms/supabase/proposed/content_has_data_fn.sql:99`
  (`public.content_has_data(view jsonb, section text)`). Parity is enforced by shared
  fixtures + embedded sha256 in BOTH repos:
  `indianexaminfo-frontend/lib/contract/contentHasData.contract.test.ts` (anchor of truth,
  REGEN mode) and `indianexaminfo-cms/src/lib/contentHasData.parity.test.ts:12-16` (runs the
  SQL in PGlite, no live DB).
- Status today is a **VIEW** `exam_derived_status`
  (`migrations/20260902122910_…sql:27-235`) that computes one status from date rows, already
  has a **manual override** via stored `exams.status` for genuine record-level cancellation
  (`:16-17`, `:166-167`), and is granted to `anon` (`:237`). But it (a) does not emit
  counselling stages, (b) infers `kind` from labels, (c) is a view, not a pure
  function-over-a-row that can be mirrored TS↔SQL the way presence is.

**PROPOSAL**
- Turn status into the **same three-mirror contract as `content_has_data`**:
  1. `supabase/proposed/e1_exam_status_fn.sql` — a **pure**
     `exam_computed_status(events jsonb, counselling_rounds jsonb, manual_override text)`
     returning one status string over `exam_events` (§4) + `counselling_rounds` (§5), with a
     clearly-marked manual override (reuse the `exams.status` override idea). Add the missing
     rules so counselling **stages** are produced: from a round whose allotment date has
     passed → "Allotment out"; reporting window open → "Reporting open"; choice-filling open →
     "Choice filling open"; else fall back to the existing exam-lifecycle statuses.
  2. Frontend TS mirror + CMS TS mirror (both over the same `HasDataView`-style shape).
  3. Shared **fixtures + sha256 parity tests** in both repos, modelled exactly on
     `content-has-data.fixtures.json` / `contentHasData.contract.test.ts` /
     `contentHasData.parity.test.ts`, so a status can never mean different things in
     CMS ↔ frontend ↔ SQL.
- `exam_derived_status` becomes a thin SQL wrapper over `exam_computed_status` (keeps the
  anon read path) until the frontend switches to the mirror.

---

## 7. Overview auto (G1, G2) — why the editor previewed it but the site didn't render it

**CURRENT — root cause is a field-name mismatch, now partly patched but still split-brained:**
- The CMS writes overview body into a field called **`description`** in ~268/273 records; the
  frontend overview renderer historically read only `body`/`content`, so the About-This-Exam
  text was invisible on the site while the editor previewed it. The comments say this was
  fixed by also reading `description`:
  `components/exam/sectionRenderers.tsx:254-256` (`OverviewSummary`) and the parallel read in
  `EntityDetailPage.tsx:788-790`.
- Overview is `source:"editorial"`, order 20, `showAsTab:true` (`lib/sectionRegistry.ts:85`),
  and the CT bridge maps `notification → overview` (`:396`). It still renders nothing when
  the module is absent/empty (`OverviewSummary` returns null if `moduleData` is null).

**PROPOSAL**
- **One field, auto-counted.** Standardise the overview body onto one column inside the
  module (`content_modules.overview.body`) with a migration mapping `description`→`body`;
  the presence count and the render read the SAME field, so "previewed but blank on site"
  cannot recur. Content counts feed `content_has_data` so an empty overview is hidden, not
  rendered blank — and if the editor wants to preview, it previews exactly the field the site
  will render.
- **Template from entity type + selection model + current stage**, properly cased: e.g.
  a merit-based counselling record auto-drafts "Selection is based on merit in [qualification];
  admission is through [state] counselling in [n] rounds." — assembled from structured fields
  (never free AI prose), with sentence casing applied at render.

---

## 8. Live page (H1, H3, H4)

**CURRENT**
- **Title:** built from `nameWithYear` + tab labels (`lib/seo/keywords.ts`, `EntityDetailPage`
  header) — it is name/year driven, not stage/section driven **[verify exact title fn at
  implementation]**.
- **Related exams:** `services/examService.ts:553-583` — `getRelatedExams` filters on
  **`pillar` + `category_id` only**, `.limit(4)` (`:572-574`). It ignores region and
  entity_type, and returns whatever matches that (so an unrelated same-category record can
  show). It does not "show nothing rather than unrelated" (it falls back to any 4 in category).
- **Hero next event:** `lib/exam/actionLinks.ts` `pickDisplayDate` (`:219-230`) +
  `getLeadBlock` (`:289-304`) already pick one state-relevant date via `TYPE_FOR_STATUS`
  (`:185-195`) and the `HEADLINE_BY_STATUS` map (`:254-268`). The next-event logic exists but
  keys off the old `important_dates[].type`; it does not yet read `exam_events` ranges/times
  or counselling rounds.

**PROPOSAL**
- **H1 title** = current stage (from §6 status) or the sections that actually have content,
  e.g. "UP D.El.Ed 2026 — Counselling Phase 3, Seat Allotment & Reporting".
- **H3 related exams** score candidates by **region + entity_type + category** (weighted),
  require a minimum score, and **return an empty list** (render nothing) below it — never pad
  with unrelated records. Move from the current flat pillar+category filter to a small
  weighted query/eval.
- **H4 hero next event** sourced from `exam_events` (earliest future `date_start`,
  respecting ranges + counselling rounds), replacing the label-typed single-date pick.

---

## 9. AI Fill v2 (A1–A8, F2) — extends the existing S1 Part B plan

**CURRENT** (`src/lib/ai/autofill.ts`, 329 lines)
- **Input is raw text or pasted JSON only**: `autoFillExam(rawText)` (`:136`),
  `tryDirectParse` (`:18`). **No PDF upload, no URL fetch.**
- **Prompt is built client-side** as a literal string in `autofill.ts:142-238`; the model
  call goes to the `ai-fill` **Edge Function** which holds the key server-side
  (`:9-11`, `generateText` from `aiFillClient`).
- **Dropdowns are hard-coded enums in the prompt**, not read from the DB: category
  (`:168`), pillar/entityType/status (`:146-148`). No validation that the returned value is a
  real row. **No confidence score**, no "leave empty / flag / suggest missing" behaviour.
- Fills name, slug, dates (`:183-190`), eligibility, applicationFee, selectionProcess, faqs,
  `has_*` flags, typeFields, and post-processes `contentModules` dates (`:111-124`). **Never
  emits `selection_model`** (so everything defaults to `written-exam` — the direct cause of
  "AI Fill not choosing merit-based" for D.El.Ed). **No counselling rounds, no event kinds.**
- **No per-field source quote.** `ai_metadata` column **exists** (`exams`/`content_posts`/
  `blog_posts` — `migrations/20260702153457_add_canonical_urls_and_ai_metadata.sql:13-15`)
  but is not written with a fill source here. The notice PDF home `exam_resources` exists
  (`migrations/20260910051703_create_exam_resources_library.sql:7`) but AI Fill does not attach
  it. Content posts already emit a "Official Notification PDF" quickLink shape
  (`autofill.ts:274-276`) — reusable.

**PROPOSAL**
- **A-input / server-side templates.** Move the prompt to a server-side template
  (Edge Function / a `ai_fill_templates` store) so it is versioned and not bundled client
  code. Accept **PDF upload, pasted text, or URL**; the **official notice is the primary
  source**, web search is secondary.
- **Dropdown = DB options + confidence.** Options come from the DB (`categories`,
  the `pillar`/`entity_type`/`selection_model`/`exam_status` enums, `exam_events.kind`). The
  model returns a value **plus a confidence score**; below a threshold or no match → **leave
  the field empty, flag it, and suggest a missing option** (e.g. "Teacher Education not in the
  list"). Never let AI invent an enum value.
- **Fills every supported module**, including **counselling rounds** (§5) and **event rows
  with kinds/times/ranges** (§4), and — critically — sets **`selection_model`** from evidence
  (merit/interview/written) instead of leaving it at the default.
- **Source quote per field** + a **fill report** (filled / skipped-and-why / low-confidence /
  missing-options). Store the report and the per-field quotes in **`ai_metadata`**.
- **Attach the notice PDF** to `exam_resources` and record it as the fill source in
  `ai_metadata`.
- **Never verifies, never publishes** (R5 preserved — this also aligns with T1: no fake
  verification). The unverified honest line (§T1a) is what a filled-but-unverified record
  shows.
- **Pre-publish checklist = warning, not a block**: unverified, empty modules, flagged fields,
  missing key dates surface as advisories the editor can publish over.

---

## 10. Slicing (priority order per the owner's list)

Sizes: S ≤1 day, M 2–4 days, L 1–2 weeks. Migrations are **proposed only**.

| # | Slice | Size | Migrations (proposed/) | Acceptance items |
|---|-------|------|------------------------|------------------|
| 0 | **F1–F4 build fix** (done) + **T1 trust hotfix** (done, this push) | S–M | — | E2 badge, false "Verified by" removed, H2 empty widgets hidden |
| 1 | **B1–B4 taxonomy**: CMS category admin over `categories`; Teacher Education tree; AI Fill reads DB options; **remove hard-coded `autofill.ts:168`**; stale entityType fix; breadcrumb uses `categories.name` | M | `b1_teacher_education_categories.sql`, `b4_slug_history.sql`, `a1_ai_fill_options.sql` | B1, B2, B4 (partial: history), A1(partial) |
| 2 | **A1 AI Fill selection_model** + module/DB-driven dropdown options + confidence + flag/suggest-empty | M | `a1_ai_fill_options.sql` | B3, A1, A2(partial) |
| 3 | **D1 + E1 dates & status**: `exam_events` table, backfill from `important_dates`, `exam_computed_status` fn + TS/SQL parity mirrors + fixtures | L | `d1_exam_events.sql`, `e1_exam_status_fn.sql` | D1, D2, E1 |
| 4 | **A2/A3/A5 + C1/C2 rounds + model-driven modules**: counselling rounds; modules ordered/gated by `(entity_type, selection_model)`; eligibility/fee/faqs as modules; reorder + toggle/badge cleanup | L | `c2_counselling_rounds.sql` | C1, C2, I1, I2, I3, A3, A5 |
| 5 | **A7/A8 + F2**: PDF/URL input, server-side templates, source quote/field, fill report in `ai_metadata`, attach notice PDF, never-verify/publish, checklist warning | L | `a1_ai_fill_options.sql` (+ `ai_metadata` conventions) | A7, A8, F2, A4, A6 |
| 6 | **G/H/I live page**: overview single-field auto-count; stage-driven title; weighted related-exams (show nothing); hero next event from `exam_events` | M | — | G1, G2, H1, H3, H4 |

Suggested execution order matches the owner's: F1 → B1–B4 → A1 → D1+E1 → A2/A3/A5/C1/C2 →
A7/A8/F2 → G/H/I.

---

## 11. Acceptance-test mapping (against the 10-point spec I have)

Legend: **[S#]** covered by slice #; **[GAP]** needs the owner's issue text to close.

- (1) Taxonomy: categories in CMS + Teacher Education + clean two axes — **[S1, S2]**; "smallest
  entity_type change" (reuse `university-admission`) — **[S1]**; "don't duplicate merit-based as
  entity_type" — **[S1]**.
- (2) URL safety: slug history + one-hop 301/308 + breadcrumb display name — **[S1]** (history
  table + middleware). **[GAP]** exact legacy-URL inventory to migrate from `next.config.ts`.
- (3) Modules follow model: model-driven set/order, hide irrelevant, move eligibility/fee/faqs
  into modules, reorder + toggle/badge — **[S4]**; AI Fill must set the model — **[S2]**.
- (4) Flexible event rows + no-loss migration — **[S3]**.
- (5) Counselling rounds fields + computed round status — **[S4]** structurally, but the exact
  **field list is [GAP]** (needs the issue).
- (6) One computed status mirrored CMS↔frontend↔SQL incl counselling stages, manual override —
  **[S3, S4]**.
- (7) Overview auto count+render, template from type+model+stage, casing — **[S6]**.
- (8) Live page title / weighted related / hero next-event — **[S6]**.
- (9) AI Fill v2 (server templates, DB options+confidence, fill-all-modules, source quote,
  report, PDF source in ai_metadata, never verify/publish, checklist warning) — **[S2, S5]**.
- (10) Slicing — provided in §10.

**Overall gaps that block sign-off:** (a) the owner's exact counselling-round **field list**;
(b) the **verbatim acceptance checklist** in the issue (so each box is mapped precisely, not
reconstructed from the 10 points); (c) whether a **`categories` admin UI already exists**
([UNVERIFIED] §1); (d) the exact **reorder/toggle-vs-badge help strings** ([UNVERIFIED] §3);
(e) the breadcrumb **label-source** for the entrance/admission/board/university routes
([UNVERIFIED] §2). Paste the issue (and I'll confirm c–e with targeted reads) before approving.

---

## 12. Proposed SQL files (in `indianexaminfo-cms/supabase/proposed/` — NOT applied)

1. `d1_exam_events.sql` — `exam_events` table + backfill from `exam_editions.important_dates`.
2. `e1_exam_status_fn.sql` — pure `exam_computed_status(...)` incl counselling stages + override.
3. `c2_counselling_rounds.sql` — `counselling_rounds` structured records.
4. `b4_slug_history.sql` — `entity_slug_history` + rename-capture trigger (redirect source).
5. `b1_teacher_education_categories.sql` — Teacher Education category tree rows.
6. `a1_ai_fill_options.sql` — DB-driven dropdown options view(s) for AI Fill (+ `ai_metadata`
   fill-source/quote conventions).

Each is a **draft for review**; none is added to `migrations/`, none is applied, no remote DB
touch. They pair with TS mirrors + fixture/parity tests (per the content_has_data contract)
once a slice is approved.
