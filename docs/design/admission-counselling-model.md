# Admission & Counselling Model + AI Fill v2 — Investigation and Design (D)

Status: **PROPOSAL ONLY — READ-ONLY. Nothing here is implemented, no migration is applied.**
Scope: Sprint 1 Part B (AI Fill v2) and new Part C (admission & counselling model).
R0: local commits only; no push, no deploy, no remote DB writes.

Evidence rule: every "CURRENT" claim below cites a real `file:line` or `table.column`.
Where I could not verify something, it is labelled **[UNVERIFIED]** or **[GAP]**.

> **Inputs now provided (revision after owner review).** The owner supplied the verbatim
> counselling-round field list and the acceptance checklist; they are folded into §5 and §11
> and the previous [GAP] flags there are resolved. The five [UNVERIFIED] items from the first
> draft have been resolved with targeted reads (§1, §2, §3, §7). The entity-type public-label
> question, the "no `exam_events` table" decision, the "status function REPLACES the view"
> cut-over, the OCR/upload source-input requirement and the overview-patch commit are all
> addressed below per the owner's seven review changes.

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
- **A CMS category-management UI already EXISTS** (first draft said "none found" — corrected
  by targeted read): `src/pages/categories/CategoriesPage.tsx` (add / rename / reorder
  `order_index` / set `slug`, with `checkSlugAvailable`), backed by
  `src/services/categoryService.ts:40-87` (`getCategories`/`createCategory`/`updateCategory`/
  `deleteCategory`), routed at `/categories` behind `P.MANAGE_CATEGORIES`
  (`src/router/index.tsx:196`) and linked in the sidebar (`src/components/layout/Sidebar.tsx:62`).
- **The real taxonomy gaps are therefore NOT "no admin screen"** — they are: (i) AI Fill does
  not read this table (§9); (ii) the Teacher Education rows do not exist yet; (iii) renaming a
  published category/exam `slug` orphans its URL — there is no history/redirect table (§2).

**PROPOSAL**
- **B1 — categories stay in the DB (single source of truth).** The admin screen already
  exists (`CategoriesPage.tsx`) **and the Identity form's Category dropdown already reads
  `categories`** — verified at `src/components/entity-editor/tabs/GeneralTab.tsx:12,134-137,
  271-278` (`getCategories` → `options={categories.map(c => ({ value: c.id, label: c.name }))}`).
  **So S1 does NOT touch the dropdown.** S1's taxonomy work is only the breadcrumb
  (`categories.name`, §2) + the single redirect for the D.El.Ed move; AI Fill reading the DB and
  the stale-enum fix move to S2 (§9).
- **B1 — add "Teacher Education" as ONE FLAT category row** (owner decision, 2026-10-03: "one
  flat category under the admission pillar (slug `teacher-education`). No sub-category tree
  unless you show me why it's needed now." Nothing needs a tree today → **no children created**;
  `parent_id`/`subcategory_id` stay available for a future tree. The owner adds the row
  themselves via `/categories`, so it is **not** in S1's code scope. Sketch (documentation only):
  `supabase/proposed/b1_teacher_education_categories.sql`.
- **B2 — keep the two axes clean.** UP D.El.Ed = `entity_type='university-admission'`
  (the existing counselling-route value) **AND** `selection_model='merit-based'`. Do **not**
  add `merit-based` as an entity_type: "WHAT it is" (an admission) is orthogonal to "HOW
  selection happens" (merit). The smallest change that fits a state counselling admission is
  therefore **zero new enum values** — it is the pairing the schema already allows but the
  UI/AI Fill never produce. Only gap: nothing today *drives* modules/order from
  `selection_model` (§3) or sets it from AI Fill (§9).

- **Owner change #1 — public label never says "University" for an admission record.**
  `entity_type='university-admission'` + `selection_model='merit-based'` is fine **internally**;
  the string the reader sees must be "Admission / Counselling". I confirmed every place a
  public label is printed for such a record (pillar `entrance-exam`, public root `/admission`):
  1. **Pillar label map** `indianexaminfo-frontend/lib/utils.ts:142-146` —
     `entrance-exam → "Admissions"` (already safe; not entity_type-derived).
  2. **Breadcrumb category segment** — derived from the URL **slug**
     (`category.replace(/-/g," ").title-case`) at
     `app/(public)/admission/[category]/[slug]/page.tsx:49` and the university route
     `app/(public)/university-exam/[...segments]/page.tsx:214`. If a record sits under a
     category whose slug contains "university" (the old `university-exams` / `university-entrance`
     slugs the D.El.Ed bug hit), the breadcrumb literally prints "University …".
  3. **JSON-LD** `lib/seo/structured-data.ts` — verified there is **no** `entity_type →
     EducationalOrganization/"University"` mapping (only `Organization`/`JobPosting`), so an
     admission record leaks no "University" here today; keep it that way for any future
     programme schema.
  4. **Page title** — built from `exam.name` (`admission/[category]/[slug]/page.tsx:34`), not
     entity_type; safe unless the name itself says "University".
  5. **AI Fill report (CMS)** — echoes `entityType`; the stale enum `recruitment|exam|board|
     university` at `src/lib/ai/autofill.ts:169` would print a raw "university" (fixed in §9).
  **Mechanism:** introduce ONE display helper (`getEntityTypeLabel(entity_type)` returning
  "Admission / Counselling" for `university-admission`) and never render the raw enum in the
  breadcrumb/filter/report/title paths. The category-tree move (B1) removes the slug-derived
  "University" string at its source.

---

## 2. URL safety (B4)

**CURRENT**
- **Owner change #2 context — the redirect mechanism today is a hand-maintained list.**
  Legacy URLs are static `redirects()` entries in the frontend `next.config.ts:113`
  (`async redirects()`): pillar rewrites `:117-124` (`permanent:false`), legacy
  `/exam/:slug→/sarkari-naukri/:slug` `:127` (`permanent:true`), category 308s `:133-134`,
  and **individual per-slug 301/308 entries for renamed/moved records** — e.g. the deleted
  MJPRU stub `:155-156` and the mispillared admission records `:158-162`. This is exactly the
  ad-hoc, human-remembered guard the owner's B4 targets: every slug change must be hand-added
  here or the old URL 404s.
- There is **no slug/category history table** — renaming a published record's slug orphans
  its old URL unless someone also edits `next.config.ts` and redeploys. **[GAP → resolves in
  the b4 proposal]**
- **Breadcrumb label source — CONFIRMED slug-derived for the exam pillars** (first draft
  flagged this [UNVERIFIED]; resolved by read): the admission route builds the category crumb
  by title-casing the URL slug at `app/(public)/admission/[category]/[slug]/page.tsx:49`, and
  the university route does the same at
  `app/(public)/university-exam/[...segments]/page.tsx:214`. The sarkari path uses the same
  anti-pattern via `lib/sarkari/categories.ts:57-67` `titleCaseSlug`. None of these reads
  `categories.name`, so a slug rename silently changes the visible breadcrumb text.

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
- **Reorder contradiction (I2) — verbatim, confirmed:** 
  `components/entity-editor/modules/ModuleCard.tsx:24-26` carries the comment *"Drag was
  removed (System B reorder wrote to entity_module.display_order, a column the frontend never
  reads — see CONSISTENCY_AUDIT Phase 1 Q2). Kept optional so the card renders without a
  handle; the service/table stay parked."* A drag handle is still conditionally rendered
  (`:51-53`, `aria-label="Drag to reorder module"`) whenever `dragHandleProps` is supplied.
  Separately, the **Timeline** tab has its own *live* reorder that writes `displayOrder`
  (`entity-editor/timeline/TimelineEventForm.tsx:139` "Display Order" field;
  `TimelineEventCard.tsx` drag) — so "System B" (the parked `display_order`) and the timeline
  `displayOrder` are two different things, and the module drag is the dead one. Single source
  for module order must be `_config.moduleOrder`.
- **Toggle vs badge (I3) — resolved by read:** enabling a module uses `enabledModules` (the
  toggle in the editor), while tab visibility is a **separate registry flag** `showAsTab`
  (`lib/sectionRegistry.ts:85`). There is **no on-screen help string** explaining the
  difference — the two controls are simply adjacent with no connecting copy (the first draft's
  "[UNVERIFIED] help wording" is resolved: the wording does not exist, which is itself the
  problem). One control should mean one thing (§3 proposal).

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

**PROPOSAL — owner change #2: NO new table. Extend `important_dates` in place.**
Keep `exam_editions.important_dates` as the **single** date source so the existing
`exam_derived_status` view and the new status function (§6) never fork. Each event object
**gains optional keys** (JSONB, so no `ALTER TABLE` and no data loss — old rows simply lack
the new keys and keep working):
- `end_date` (nullable → turns a point date into a range, e.g. reporting 9 Oct – 14 Oct),
- `start_time` / `end_time` (nullable text, e.g. `"18:00"` → "…6:00 PM", "…5:00 PM"),
- `round_id` (nullable → links the date row to a `counselling_rounds` metadata row, §5),
- `sort` (explicit order; falls back to date order when absent).
- Add `phase`/`kind` only as a **tidy-up** where the label-inference is wrong; the existing
  `type` field already carries the machine event kind and `state` the confirmed/expected axis,
  so no replacement of those. The status function keeps reading `.type`/`.state`/`.date` and
  now also `.end_date`/`.start_time`/`.end_time`/`.round_id`.
- **Migration:** a one-time `UPDATE exam_editions SET important_dates = …` that normalises any
  labels the old `LIKE` inference mis-typed (e.g. a "Registration Opens" that is really
  choice-filling) into the correct `type`, and back-fills `sort`. Nothing is dropped; nothing
  moves to a second table. The revalidation trigger already fires on `important_dates`
  (`migrations/20260930171935_…sql:131-133`) and needs no change.
- Draft: `supabase/proposed/d1_exam_events.sql` is **replaced** by
  `supabase/proposed/d1_important_dates_extension.sql` (JSONB-key guidance + the normalising
  `UPDATE`), so there is never a second source of truth.

---

## 5. Counselling rounds (C2)

**CURRENT**
- Counselling exists only as (a) a free-text **module** (`moduleRegistry.ts:605`
  "Counselling rounds, seat allotment, and choice filling") and (b) a label-inferred date
  `kind='counselling'` in the view (`exam_derived_status…:48-50`). There is **no structured
  round record, no allotment/reporting fields, no per-round status** (the §5 proposal below
  adds these). UP D.El.Ed's
  Phase 1/2/3, choice locking, seat allotment, and reporting cannot be represented.

**PROPOSAL — owner change #3: `counselling_rounds` holds METADATA ONLY; every date WINDOW is a
date row in `important_dates` linked by `round_id`.** No start/end/date columns on the round
record itself (that would be a second date source and re-create the split-brain §4 removes).

`supabase/proposed/c2_counselling_rounds.sql` — round metadata (the owner's verbatim list):
- `round_label` / phase label (e.g. "Phase-3")
- `round_order` (integer — orders rounds)
- `rank_from` / `rank_to` (eligible rank band, e.g. 1 – 1,52,202)
- `eligibility_text` (e.g. "not yet allotted an institution")
- `seat_note` (e.g. "unfilled OBC/SC/ST/special-reserved seats converted to unreserved")
- `fee_amount` numeric + `fee_label` text (e.g. 5000, "choice-filling fee")
- `notice_resource_id` FK → `exam_resources` (the round's notice)
- `edition_id` FK, `created_at`, `updated_at`
- **`round_status` is NOT a column** — it is computed from the round's linked date rows
  (upcoming / ongoing / closed) by the §6 function.

**Linked date rows** = `important_dates` entries whose `round_id` points at this round, each
with `label`, `date`, `end_date`, `start_time`, `end_time` (§4 extension):
- choice filling + payment window (start date+time → end date+time, e.g. 5 Oct afternoon →
  7 Oct 6:00 PM)
- allotment date (e.g. 8 Oct)
- reporting / document-verification window (end time matters, e.g. 9 Oct → 14 Oct 5:00 PM)
- institution-side deadline (online report / lock, e.g. 15 Oct)

Round status derivation (in §6, never stored): if a linked window row's `[date, end_date]`
(+ times) contains today ⇒ **ongoing**; all linked rows in the future ⇒ **upcoming**; all in
the past ⇒ **closed**. The **entity** status picks the active round's stage label (e.g.
"Counselling – Phase 3: choice filling open").

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
     `exam_computed_status(important_dates jsonb, counselling_rounds jsonb, manual_override text,
     today date)` returning one status string over the **extended `important_dates` rows** (§4)
     + the **round metadata** (§5) — no `exam_events` table, so the date source stays single.
     It carries a clearly-marked manual override (reuse the `exams.status` override idea) and the
     missing counselling **stages**: a linked round window open → "Choice filling open" /
     "Reporting open"; allotment date passed → "Allotment out"; else fall back to the existing
     exam-lifecycle statuses. The whole status CASE lives **only** in this function.
  2. Frontend TS mirror + CMS TS mirror (both over the same `HasDataView`-style shape).
  3. Shared **fixtures + sha256 parity tests** in both repos, modelled exactly on
     `content-has-data.fixtures.json` / `contentHasData.contract.test.ts` /
     `contentHasData.parity.test.ts`, so a status can never mean different things in
     CMS ↔ frontend ↔ SQL.

- **Owner change #6 — the function REPLACES `exam_derived_status`; cut-over plan (one source,
  zero read-path change):**
  1. **Add** `exam_computed_status(...)` (the pure SQL function, step 1 above) in a new
     migration. Nothing consumes it yet.
  2. **Recreate the view as a projection of the function:** `CREATE OR REPLACE VIEW
     exam_derived_status AS SELECT e.id AS exam_id,
     public.exam_computed_status(ed.important_dates, round_agg.rounds, e.status, get_today_ist())
     AS derived_status, … , ed.admit_card_date, ed.result_date …`. The old **inline CASE
     (`migrations/20260902122910_…sql:162-220`) is deleted from the view body** — the view now
     only *selects* the function's result plus the `strip_eligible` / `has_confirmed_dates` /
     `admit_card_date` / `result_date` columns the readers already ask for.
  3. **Readers untouched:** the frontend `fetchDerivedStatuses`
     (`services/examService.ts:69-100`, `.from("exam_derived_status").select("exam_id,
     derived_status, strip_eligible, has_confirmed_dates, admit_card_date, result_date")` from
     ~8 call sites) keeps working byte-for-byte — it still reads the same view name/columns, but
     the number now comes from the single function. Same `GRANT … TO anon`
     (`migrations/20260902122910_…sql:237`) is re-applied to the recreated view.
  4. **Prove parity before removing anything:** run the new function against the OLD view over
     every live edition (a one-off comparison query) and the fixture/parity tests; only after
     100 % agreement (plus the intended new counselling stages) is the old inline logic dropped.
  5. **No two sources:** after step 2 there is exactly one status algorithm (the function). The
     view is a thin projection; the TS mirrors and the SQL function are pinned equal by fixtures.
     If a later slice wants to drop the view entirely, callers move to the `exam_computed_status`
     RPC — but that is optional and *after* this cut-over, never alongside it.

---

## 7. Overview auto (G1, G2) — why the editor previewed it but the site didn't render it

**CURRENT — root cause is a field-name mismatch, patched READ-side only by commit `da349ea`:**
- The CMS writes overview body into a field called **`description`** in ~268/273 records; the
  frontend overview renderer historically read only `body`/`content`, so the About-This-Exam
  text was invisible on the site while the editor previewed it.
- **Owner change #4 — the "partly patched" is exactly one commit (NOT in T1's 7 files):**
  `da349ea fix(exam-page): render overview 'description' field (recovers 268 exams'
  About-This-Exam text)`, verified via `git show --stat` to touch **two files** —
  `components/exam/sectionRenderers.tsx` (`OverviewSummary` now also reads `description`,
  `:254-256`) and `components/exam/EntityDetailPage.tsx` (the parallel read, `:788-790`).
- **What is STILL OPEN** (why it is only "partly" fixed): the fix is **read-side only** — it
  makes the site accept the `description` field, but the **write side still has two homes**.
  Some records store the overview in the `exams.description`/edition column and others in
  `content_modules.overview.body` (what AI Fill writes), so (i) the content-presence count
  (`content_has_data`) and the editor preview can still disagree with what renders for
  module-shaped records; (ii) there is no single field the editor, the counter and the site all
  read; (iii) nothing forces new records onto one field. §7 PROPOSAL closes this by unifying the
  field and pointing the render + presence count at the SAME one.
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
- **Title — resolved (first draft flagged [verify]):** each pillar route builds it via
  `buildExamMetadata` (`lib/seo/metadata.ts`), e.g.
  `app/(public)/admission/[category]/[slug]/page.tsx:34` sets
  `title: exam.seoTitle ?? `${exam.name} ${year} — Notification, Eligibility & Apply`` —
  **name/year driven, not stage-driven.** A stage map already exists but the `<title>`/H1 do not
  use it: `HEADLINE_BY_STATUS` in `lib/exam/actionLinks.ts:254-268` (lead block only).
- **Related exams:** `services/examService.ts:553-583` — `getRelatedExams` filters on
  **`pillar` + `category_id` only**, `.limit(4)` (`:572-574`). It ignores region and
  entity_type, and returns whatever matches that (so an unrelated same-category record can
  show). It does not "show nothing rather than unrelated" (it falls back to any 4 in category).
- **Hero next event:** `lib/exam/actionLinks.ts` `pickDisplayDate` (`:219-230`) +
  `getLeadBlock` (`:289-304`) already pick one state-relevant date via `TYPE_FOR_STATUS`
  (`:185-195`) and the `HEADLINE_BY_STATUS` map (`:254-268`). The next-event logic exists but
  keys off the old `important_dates[].type`; it does not yet read the new `.end_date` /
  `.start_time` / `.end_time` / `.round_id` keys (§4) or the counselling rounds.

**PROPOSAL**
- **H1 title** = current stage (from §6 status) or the sections that actually have content,
  e.g. "UP D.El.Ed 2026 — Counselling Phase 3, Seat Allotment & Reporting".
- **H3 related exams** score candidates by **region + entity_type + category** (weighted),
  require a minimum score, and **return an empty list** (render nothing) below it — never pad
  with unrelated records. Move from the current flat pillar+category filter to a small
  weighted query/eval.
- **H4 hero next event** sourced from the extended `important_dates` rows (§4) — earliest
  future `date` (honouring `end_date` ranges, `start_time`/`end_time`, and the active
  counselling round), replacing the label-typed single-date pick. **Same table as the status
  function**, so the hero and the badge can never disagree.

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
  (Edge Function / an `ai_fill_templates` store) so it is versioned and not bundled client code.
- **Owner change #5 — source input = PDF upload WITH text extraction AND an OCR fallback, plus a
  pasted-text path.** Many UP notices (incl. the UP D.El.Ed one) are **scanned Hindi images**, so
  plain PDF text extraction returns nothing. The pipeline must (a) try embedded-text extraction,
  and (b) when a page yields little/no text, fall back to **OCR** (Hindi + English) before the
  model call. A **pasted-text** path is always available as the manual fallback. The **official
  notice is the primary source**; web search is secondary (only to fill gaps the notice does not
  cover, never to override it).
- **Always store the source PDF and record it.** Every fill puts the notice PDF into
  `exam_resources` (`migrations/20260910051703_create_exam_resources_library.sql:7`) and writes
  its id + extraction method (`text | ocr | pasted`) into `ai_metadata.fill_source` (the fill
  report below).
- **Dropdown = DB options + confidence.** Options come from the DB (`categories`,
  the `pillar`/`entity_type`/`selection_model`/`exam_status` enums, the `important_dates` `type`
  vocabulary). The
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
| 1 | **S1 (confirmed this slice)** — breadcrumb reads `categories.name` (never slug title-case; `&` survives) at `admission/[category]/[slug]/page.tsx:49` + `university-exam/[...segments]/page.tsx:214` (add `name` to the `DETAIL_SELECT` join + `categoryName` on `ExamEntity`); **one 301 in `next.config.ts`** for the UP D.El.Ed move `research-fellowships`→`teacher-education` (needs the exact slug from the owner). Identity dropdown already reads `categories` (no change); owner adds the flat `teacher-education` row via `/categories`. | S | — | B1 (row by owner), this one redirect, breadcrumb |
| 2 | **A1 (S2)** — AI Fill reads DB options (`categories` + the enums) + sets `selection_model`; confidence + flag/suggest-empty; **remove hard-coded `autofill.ts:168`**; `getEntityTypeLabel` + stale `autofill.ts:169` entityType fix; `b4_slug_history` for the general auto-redirect | M | `b4_slug_history.sql`, `a1_ai_fill_options.sql` | A1, A2, B3, B4 (history) |
| 3 | **D1 + E1 dates & status**: extend `important_dates` in place (JSONB keys `end_date`/`start_time`/`end_time`/`round_id`/`sort`, **no new table**) + `exam_computed_status` fn that **replaces** the `exam_derived_status` view (§6 cut-over) + TS/SQL parity mirrors + fixtures | L | `d1_important_dates_extension.sql`, `e1_exam_status_fn.sql` | D1, D2, E1 |
| 4 | **A2/A3/A5 + C1/C2 rounds + model-driven modules**: `counselling_rounds` (metadata only, §5); modules ordered/gated by `(entity_type, selection_model)`; eligibility/fee/faqs as modules; reorder + toggle/badge cleanup | L | `c2_counselling_rounds.sql` | C1, C2, I1, I2, I3, A3, A5 |
| 5 | **A7/A8 + F2**: PDF input (text-extraction **+ OCR fallback for scanned Hindi**) + pasted-text path, server-side templates, source quote/field, fill report in `ai_metadata`, **store notice PDF in `exam_resources` + record it as fill source**, never-verify/publish, checklist warning | L | `a1_ai_fill_options.sql` (+ `ai_metadata` conventions) | A7, A8, F2, A4, A6 |
| 6 | **G/H/I live page**: overview single-field auto-count (finish what `da349ea` started, §7); stage-driven title; weighted related-exams (show nothing); hero next event from **extended `important_dates`** | M | — | G1, G2, H1, H3, H4 |

Suggested execution order matches the owner's: F1 → B1–B4 → A1 → D1+E1 → A2/A3/A5/C1/C2 →
A7/A8/F2 → G/H/I.

---

## 11. Acceptance test — the owner's verbatim checklist, mapped to slices

Source: the owner's "new record from the UP D.El.Ed 01 Oct 2026 Phase-3 notice, AI Fill only,
no manual edits". Legend: **[S#]** = covered by slice #; **[DONE]** = already satisfied by the
T1 push; **[S#+,S#]** = needs more than one slice.

- [ ] **Category = Teacher Education** (or flagged "no match", never guessed) — **[S1]**: AI
      Fill reads `categories` (incl the new Teacher Education rows) + confidence/flag rule.
- [ ] **Entity type = university-admission, shown publicly as "Admission / Counselling"** (never
      "University") — **[S1]**: `getEntityTypeLabel` (§1 change #1) + category-tree move kills the
      slug-derived "University" breadcrumb.
- [ ] **Selection model = merit-based, set by AI Fill** (not left at `written-exam`) — **[S2]**.
- [ ] **Name uses the official name, not "…Entrance"** — **[S2]** (AI Fill fills from notice).
- [ ] **Exam Pattern, Admit Card, Result, Cut-off hidden; Counselling near the top** — **[S4]**
      (model-driven module set/order via `appliesToSelection`).
- [ ] **Phase-3 round: rank 1–1,52,202, ₹5,000 fee, eligibility + seat note filled** — **[S4]**
      (round metadata) **+ [S5]** (AI Fill fills it).
- [ ] **Important Dates**: choice filling 5 Oct (afternoon)–7 Oct 6:00 PM; allotment 8 Oct;
      verification 9 Oct–14 Oct 5:00 PM; institution lock 15 Oct; notification 7 Aug. Nothing
      says "Registration Opens 5 Oct" — **[S3]** (range/time/round keys) **+ [S5]** (AI Fill),
      and the §4 normalising `UPDATE` retypes any legacy mislabelled row.
- [ ] **One status everywhere** (edition label, overview, badge, hero box) reading as Phase-3
      counselling — **[S3]** (fn replaces view) **+ [S4]** (round stages) **+ [S6]** (hero/title
      consume it); all four surfaces call the SAME §6 function.
- [ ] **Eligibility and Application Fee filled; institution-lock rule shown as a Warning Box** —
      **[S5]** (fill) **+ [S6]** (Warning-box rendering for the institution-lock row).
- [ ] **Notice PDF stored in Resources and recorded as the fill source** — **[S5]** (change #5).
- [ ] **Fill report lists filled / skipped / low-confidence / no-match fields** — **[S5]**.
- [ ] **Overview renders on the live page and matches the editor** — **[S6]** (finish `da349ea`
      by unifying the write-side field, §7).
- [ ] **Breadcrumb, title and Related Exams match the category and region** (show none rather
      than unrelated exams) — **[S1]** (breadcrumb from `categories.name`) **+ [S6]** (stage
      title; weighted related-exams with empty fallback).
- [ ] **No "Verified" claim until the owner verifies the record** — **[DONE, T1]**: the honest
      unverified line ships in `54fdf9e`; `verifiedAt/verifiedBy` stay unset until a real check.
- [ ] **Changing category or slug on the existing record 301-redirects the old URL** — **[S1]**
      (`b4_slug_history` + one-hop middleware, §2).

**Boxes already closed without new code:** the "No Verified claim" box (T1). **Boxes that need
more than one slice:** Phase-3 round (S4+S5), Important Dates (S3+S5), one-status (S3+S4+S6),
Eligibility/Fee/Warning (S5+S6), breadcrumb+title+related (S1+S6). **Everything else is a single
slice.** No box is a [GAP] — the field list and checklist are now the owner's verbatim text.

> **Owner numbering — RESOLVED (2026-10-03).** S1 is **not** A1. Because the Identity form's
> Category dropdown already reads `categories`, **S1 = breadcrumb (`categories.name`) + the one
> hand-written 301** for the D.El.Ed move; the owner adds the flat `teacher-education` row via
> `/categories` themselves. **A1 (AI Fill DB-read + `selection_model` + confidence) is S2**, and it
> *depends on* the owner's `teacher-education` row existing so "Teacher Education" is a real option
> (acceptance box 1). The general `b4_slug_history` auto-redirect is deferred to S2 — S1 ships only
> the single 301.

---

## 12. Proposed SQL files (in `indianexaminfo-cms/supabase/proposed/` — NOT applied)

1. `d1_important_dates_extension.sql` — **JSONB-key extension of `important_dates`
   (`end_date`/`start_time`/`end_time`/`round_id`/`sort`) + a normalising `UPDATE`; NO new table**
   (owner change #2). Replaces the earlier `d1_exam_events.sql` draft.
2. `e1_exam_status_fn.sql` — pure `exam_computed_status(...)` incl counselling stages + override,
   plus the `CREATE OR REPLACE VIEW exam_derived_status` projection that **retires the old inline
   CASE** (owner change #6 cut-over).
3. `c2_counselling_rounds.sql` — `counselling_rounds` **metadata only** (round label/order, rank
   band, eligibility text, seat note, fee amount+label, notice resource FK); **no date columns** —
   windows live in `important_dates` keyed by `round_id` (owner change #3).
4. `b4_slug_history.sql` — `entity_slug_history` + rename-capture trigger (redirect source).
5. `b1_teacher_education_categories.sql` — **ONE flat Teacher Education row** (sketch; the owner
   adds it via `/categories`; no children — a tree is deferred until justified, §1 B1).
6. `a1_ai_fill_options.sql` — DB-driven dropdown options view(s) for AI Fill (+ `ai_metadata`
   fill-source / OCR-method / quote conventions).

Each is a **draft for review**; none is added to `migrations/`, none is applied, no remote DB
touch. They pair with TS mirrors + fixture/parity tests (per the content_has_data contract)
once a slice is approved.

---

## 13. Changes applied in this revision (owner review, 2026-10-03)

| # | Owner change | Where resolved |
|---|--------------|----------------|
| 1 | `university-admission` OK internally, but public label never says "University" | §1 (label-site enumeration + `getEntityTypeLabel`); acceptance box 2 |
| 2 | **No `exam_events` table** — extend `important_dates`, single date source | §4 (rewritten), §12 item 1; `d1_exam_events.sql` retired → `d1_important_dates_extension.sql` |
| 3 | Round windows are `important_dates` rows linked by `round_id`; `counselling_rounds` = metadata only | §5 (rewritten), §12 item 3 |
| 4 | "Overview partly patched" — which commit/files, what's open | §7: commit `da349ea` (2 files, verified by `git show --stat`); write-side still split |
| 5 | AI Fill source = PDF **text-extraction + OCR fallback** (scanned Hindi) + pasted text; store PDF in `exam_resources` + record in `ai_metadata` | §9 (change #5 block), §12 item 6 |
| 6 | Status function **replaces** `exam_derived_status`; show cut-over | §6 (5-step cut-over: fn → view-as-projection → readers untouched → prove parity → drop old CASE) |
| 7 | Resolve the 5 [UNVERIFIED] items with targeted reads | §1 (categories admin **exists**: `CategoriesPage.tsx`/`categoryService.ts`), §2 (redirects `next.config.ts:113,117-134,155-162`; breadcrumb **is** slug-title-cased at `admission/[category]/[slug]/page.tsx:49`), §3 (reorder comment verbatim `ModuleCard.tsx:24-26`; toggle-vs-badge has **no** help string), §7 (title via `buildExamMetadata`). JSON-LD verified to leak no "University" (§1 site 3). All 5 resolved; no [UNVERIFIED] markers remain. |

**Still open for the owner:** the exact **slug** of the UP D.El.Ed record so the S1 301 can be
written correctly (see §14 note: I could not self-verify it — the Supabase MCP tool schemas are
not present in this project's cache, so I will not guess a URL or fire an unverified DB read).
**S1 code NOT started — awaiting your go-ahead after this scope confirmation.**

---

## 14. Additional design constraints (owner, 2026-10-03) — for LATER slices, not S1

### 14.1 D1 — times are evaluated in IST end-to-end
- Store `start_time`/`end_time` in `important_dates` with an **explicit `Asia/Kolkata`
  interpretation** — either an offset-bearing time (e.g. `"18:00+05:30"`) or `date`+`time`
  assembled to an IST instant. Never treat a bare time as wall-clock UTC.
- **Every consumer evaluates in IST, not server UTC**: the countdown, a row's `closed` state, and
  `exam_computed_status` (§6). The view already anchors "today" via `getTodayIST()` /
  `(now() AT TIME ZONE 'Asia/Kolkata')::date` (`migrations/20260902122910…sql:35`); the same IST
  anchor must apply once a time-of-day is present.
- **Required test (pin this):** a deadline of `end_date` 7 Oct `end_time` **18:00 IST** is **OPEN
  at 17:59 IST and CLOSED at 18:01 IST**, asserted against a **fixed instant** (e.g.
  `2026-10-07T12:31:00Z` = 18:01 IST) so it never depends on the runner's server timezone. This
  is exactly the bug where a 6:00 PM IST deadline judged in UTC server time flips by ~5.5 hours.

### 14.2 D1/C2 — validate the `important_dates` JSONB on save (CMS service, not the DB)
JSONB cannot enforce relational rules, so the edition write path
(`entranceExamService.updateEdition` / edition save) must reject an invalid array before insert:
- **range:** if `end_date` present → `end_date >= date`.
- **time needs a day:** `start_time`/`end_time` only allowed on a row that has `date`.
- **time ordering:** if both `start_time` and `end_time` are on the same day → `end_time >= start_time`.
- **round link:** if `round_id` present → a row MUST exist in `counselling_rounds` for the **same
  edition** (`edition_id`); no dangling links (FK cannot live inside JSONB, so it is checked here).
- **sort:** integer when present.

### 14.3 C2 — deleting a round: fate of its linked date rows
**Proposed (I was asked to pick one): UNLINK WITH A WARNING**, not block, not cascade-delete.
- Deleting a `counselling_rounds` row sets `round_id = NULL` on the `important_dates` rows that
  referenced it; the **date rows REMAIN** (they are edition timeline history — cascade-deleting
  would silently destroy dates the owner curated, against the single-date-source principle §4).
- The CMS shows an explicit pre-delete warning with a count: "This round has N linked date rows.
  Deleting the round keeps the dates but detaches them from the round."
- Rationale vs BLOCK: blocking is too rigid for editorial cleanup and forces deleting dates first;
  a round is metadata layered over dates that pre-exist it. If a date row is meaningless without
  its round, the owner deletes that row separately.

---

## 15. AI Fill v2 (S2) — the extraction-failure analysis, the vision-model gap, and the golden test

Design only (owner S1 item 6). No code was written for this section.

### 15.0 CORRECTION to the earlier note (owner, 2026-10-03)

My earlier note said the owner's pasted input "included junk (the distribution list)". **That was
wrong and is retracted.** The pasted input was a **clean, structured English/Hindi extraction of
the notice** — the full timeline, times, fee, rank range and lock warning were all present in it.
The old AI Fill still filled **no dates and no modules** from it. So this is not a dirty-input
problem; it is an **extraction failure inside AI Fill itself**. The rest of §15.1 explains, from
the current code, exactly why.

### 15.1 WHY the current AI Fill produced nothing — from the code, with file:line

The entrance editor's "Fill Entire Exam" runs `generateExamDataWithAI`
(`src/pages/entrance-exams/EntranceExamEditorPage.tsx:609` → `src/lib/gemini/entranceExamAI.ts:183`),
a two-stage pipeline. Every failure mode below is silent by design — which is why the fill looked
like "the model gave up" instead of "the pipeline dropped every row".

1. **Input truncation.** Stage 1 sees only `rawContent.slice(0, 5000)`
   (`entranceExamAI.ts:44`); Stage 2 only `slice(0, 3500)` (`:159`). A full structured extraction
   of a 2-page Hindi notice with a timeline exceeds the caps — the tail (lock warning, emails,
   reference number) is cut **before the model ever sees it**.
2. **The schema cannot express the notice.** The Stage 1 JSON shape is
   `{dates:[{label,dateText}], fee:{general,scSt}, eligibility, vacancy, status}`
   (`:47-58`). There is **no round/phase, no rank range, no start/end time, no condition
   ("not yet allotted"), no reserved-to-unreserved note, no notice reference, no contact emails**.
   Fields the schema has no slot for cannot be extracted no matter what the model reads.
3. **The label whitelist discarded the counselling timeline.** `processStage1Dates` calls
   `normalizeLabel(label)` and **silently `continue`s on null** (`:123-124`). The whitelist
   (`src/lib/dates/normalizeLabel.ts:26-52`) recognizes only registration / exam / admit-card /
   answer-key / result / notification / correction / counselling / cutoff patterns. "Choice
   Filling", "Seat Allotment", "Document Verification", "Institution Locking/FREEZE" match none
   of them → **every Phase-3 row except the original-notification date was dropped in code, not
   in the model.** (This is exactly what the D1 `important_dates` extension + round kinds fix.)
4. **The date parser cannot hold a window or Hindi.** `parseDateText` documents English single
   dates and, for ranges, **keeps only the first date** (`src/lib/utils/indianDateParser.ts:47-53`)
   — "05 Oct afternoon to 07 Oct 18:00" loses its end; Devanagari dates are not in the supported
   list. A parse failure is another silent `continue` (`entranceExamAI.ts:126-127`).
5. **Stage 2 all-or-nothing JSON.** The modules come from ONE giant single-line JSON schema
   (`:162`); any parse error is caught and **logged only to console.warn**, leaving
   `contentModules = {}` (`:223-232`). Groq's small models truncating that payload = "no modules",
   with the Stage-1 facts still reported partially — or, when items 1–4 already emptied Stage 1,
   the editor's honest no-op gate fires: `gotAnything === false` → "AI found nothing to fill"
   (`EntranceExamEditorPage.tsx:618-629`).
6. **Fields AI Fill is even allowed to write.** The apply step is EMPTY-ONLY over a fixed list:
   shortName, conductingBody, officialWebsite, importantDates (fill-blank/append only), vacancy,
   edition status, `has_*` false→true, seoTitle/seoDescription, tags, faqs, contentModules merge
   (`EntranceExamEditorPage.tsx:645-711`). It **cannot write category, subcategory, region or
   selection_model at all** — so "AI Fill not choosing teacher-education / merit-based" was
   structurally impossible even when extraction worked. S2 must widen this list **with
   per-field preview + approve**, and S1 item 4 made the two identity fields required-on-create
   instead of silently defaulted.

**Net:** the pipeline produced nothing usable because of prompt truncation (:44/:159), a schema
that cannot express counselling-round data (:47-58), a label whitelist that discarded every
round-specific row (normalizeLabel.ts:26-52 via entranceExamAI.ts:123-124), a date parser that
flattens windows (indianDateParser.ts:47-53), and silent-catch parsing (:102-104, :229-232) —
not because the input was junk.

### 15.2 Vision-model check — which configured provider can read a scanned Hindi PDF

The original notice (`Press_Release_01102026.pdf`) is a **2-page scanned CamScanner image in
Hindi with NO text layer**. Text extraction returns nothing; only a **vision-capable model** on
the page images can read it.

- Provider resolution lives in the `ai-fill` Edge Function: rows are read from `ai_providers`
  and matched through `SECRET_BY_PROVIDER` (`supabase/functions/ai-fill/index.ts:86-93, 174-199`).
  The function **supports `gemini`** (vision-capable family) via a dedicated
  `:generateContent` branch (`:215-216`) with `AI_KEY_GEMINI` (`:92`) and
  `BASE_URL_BY_PROVIDER.gemini` (`:106`). **No other listed provider is wired for images.**
- **But `callOne` is text-only**: its signature takes `prompt: string`
  (`ai-fill/index.ts:214`) and the gemini branch builds a text `contents` part; there is no
  `inline_data`/image part anywhere in the function, and no client path uploads the PDF
  (`autofill.ts:136` accepts raw text only — §9 CURRENT). So even a gemini row cannot see a page.
- **Currently configured rows (names only, no keys):** the last verified inventory
  (`docs/` measurements from the 2026-10 session) shows **two `groq` rows — `gpt-oss-120b` and
  `llama-3.3-70b-versatile` — both TEXT-only.** Live re-check is **[GAP]** this session: the
  Supabase MCP requires OAuth and every query attempt returned "requires OAuth authorization".
- **Answer: NONE of the currently configured providers can read the Hindi scan.** Needed for S2:
  (a) a vision-capable model row enabled in `ai_providers` — a Gemini 2.x Flash-class model is
  the wired path; (b) the `AI_KEY_GEMINI` edge-function secret set; (c) `callOne` extended to
  send image/PDF bytes (page rasterization server-side or `inline_data` parts); (d) per-page
  token budget, since two scanned Hindi pages as images are far larger than the current text
  caps. Pasted text **remains a supported input** (manual fallback, unchanged contract).

### 15.3 Golden test for S2 — fixtures, expected.json, and the two pitfalls it must catch

**Fixtures** (committed, deterministic inputs) at
`src/lib/ai/__fixtures__/up-deled-2026-phase3/`:
- `notice.pdf` — the original 2-page scanned CamScanner Hindi notice (ground truth);
- `pasted.txt` — the owner's clean structured extraction;
- `model.responses.json` — the RECORDED model response(s) per stage/provider, so CI replays the
  pipeline without network (`vitest`) while a `LIVE=1` opt-in run exercises the real model on demand.
  The test harness injects the transport: recorded mode stubs `aiFillClient.generateText` /
  the `ai-fill` call with the stored responses; live mode calls the edge function with the owner
  key. Same assertions both ways — only the transport differs.

**`expected.json`** — built from the owner's acceptance table. Each expected field carries
`{ value, sourceQuote }`:
- official name; category `teacher-education`; selection model `merit-based`;
- the five dated rows with **IST times**: choice filling + payment 05 Oct (afternoon) → 07 Oct
  18:00; allotment 08 Oct; document verification 09 Oct → 14 Oct 17:00; institution lock 15 Oct;
  original notification 07 Aug;
- Phase-3 round with rank **1 to 152202** and the "not yet allotted" condition;
- fee ₹5,000; the reserved-to-unreserved seat-conversion note; the lock warning; contact emails;
- notice ref **"डीएलएड 2026 / 530-5603 / 2026-27" dated 01 Oct 2026**.

**Pitfall 1 — transcription error must be catchable by the editor, not by luck.** The pasted
summary contains "समस्त आवंटित अभ्यर्थी" ("all allotted candidates") where the notice actually
says "आवेदित … जिन्हें … आवंटित न हुआ हो" ("applicants … to whom allotment has NOT been done") —
an exact reversal of meaning. **Rule: EVERY extracted field must carry a verbatim `sourceQuote`
from the accepted source.** The golden test asserts the quote for the Phase-3 condition row
resolves (normalized fuzzy match) INSIDE `notice.pdf`'s text/OCR of that page — and because the
pasted.txt version's wording does NOT appear in the notice, a pipeline that quotes its paste
FAILS the test. Editors see the quote next to every filled field in the approve-diff (§9 fill
report), which is what turns this class of error from invisible to one-glance.

**Pitfall 2 — the page-2 distribution list must NOT become content.** The "copy to
District Magistrate / banks / DIETs" list is addressing metadata, not exam data. The test
asserts none of its strings (or their names/addresses) appear in ANY filled field — and the
prompt/template must mark the distribution block as non-content (structural cue: it follows
"प्रतिलिपि"), with the fixture pinning that behaviour.

**S2 build dependency order:** D1 (date windows) + C2 (rounds) land first — without them the
golden test's five dated rows and Phase-3 round have nowhere to be stored; the vision provider
(§15.2 b–d) can be added independently because the paste path already reproduces every
assertion except the OCR-of-the-scan parity check.
