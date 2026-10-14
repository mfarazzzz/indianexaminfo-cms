# R2 (editor shell) · S3 (dates/status) · S4 (counselling rounds) — build plan

Status: **read-only plan; nothing built, no migration, no DB write, no push.**
Grounded in: `docs/design/editor-refactor.md` (P1–P12, §2 target design, §4 slice plan, §7 live retirement counts), `docs/design/content-posts-as-updates.md` (Option D / D-P1 applied as migration `20261013125113`), `docs/PROGRAMME_BACKLOG.md`, and the current code: `EntranceExamEditorPage.tsx`, `ModulePanel.tsx`/`ContentModuleCard.tsx`/`ModulePanelHeader.tsx`, `NoticeReviewDrawer.tsx`/`noticeReview.ts`, `noticePipeline.ts`, `src/lib/dates/normalizeLabel.ts`, view `20260902122910_exam_derived_status_v3_postponed_fix.sql`, guard `src/lib/ai/kindTypeSingleSource.test.ts`.
Verified live facts cited below as of 2026-10-13; **ai-fill v7 is deployed and verified** (S2.13b/c markers live).

Locked owner decisions (not re-asked): lifecycle dates/status stay owned by `exam_editions.important_dates` + `exam_derived_status`; updates are in-page sections/anchors (no new routes); links/files are validated JSONB; public display gates on `status='published'` (human approval), **not** `is_verified` (0/397 are verified); a "Verified" badge shows only when `is_verified`; `entity_*` stays dormant; homepage pinned cap 3 per section; withdrawn/superseded render in a "History / Withdrawn" block below the section.

---

## 1. Scope of the R2 shell

**Layout (editor-refactor §2):** single page, no tabs, left **section rail** = the reader's order; header carries **year switcher, Draft/Published chip, Verified chip (→ verify control), Preview, Publish**. Fits 1366×768, rail always visible (§ rule 7).

**Sections are driven by `module_registry` (22 rows, live) + `applicable_pillars[]` + `isModuleApplicable`.** Verified per-pillar visibility comes from the registry `applicable_pillars` array, and the frontend presence rule `hasData`/`contentTypeHasData` (`indianexaminfo-frontend/lib/sectionRegistry.ts`) hides a section with no data — so an exam with no written test / admit card / answer key never gets a forced section.

| Rail group | Sections (registry slugs) | Pillars that see it | What it edits (single source, editor-refactor §5a) |
|---|---|---|---|
| Update front-door | *Update from a notice* (S2 flow) | all exam pillars | AI extraction → review drawer → apply to draft |
| Core | `overview`,`eligibility`(Who can apply),`important-dates`(Key dates),`application-process`(How to apply),`counselling`, fee/vacancy inputs | all exam pillars (vacancy/salary/age/reservation/documents only for `government-exam/govt-vacancy/sarkari-*`) | `exam_editions.eligibility/application_fee/vacancy/important_dates`, `exams.selection_process` |
| Model-driven block | written-exam: `exam-pattern`,`admit-card`,`answer-key`,`result`,`cut-off`; merit/admission: `counselling`,`merit_list`; interview: `interview` | chosen by the **selection question** (replaces "Entity Type"+"Selection Model *" at `:1299`,`:1317-1324`) | `exam_editions.content_modules[slug]` + `important_dates` |
| Content | `syllabus`(`exam_syllabus_subjects`), `faqs`(`exams.faqs`), **Updates** (`content_posts`), `Search appearance`(`exams.seo_*`), `Checklist` | per registry | see §5a |
| Resources | `documents-required`/"Documents & links" | `sarkari-*`/`government-exam`/`govt-vacancy` (+ syllabus PDF role tag) | `exam_resources` (+ `media` bucket `cms-public`) |

**The "Updates" section (D-P2) inside the shell:** a list of exam-linked `content_posts` (already: `contentPostService.getContentPostsByExam`, CMS `contentService` writes `exam_id`+`content_type`+`quick_links`+`attachment_urls`). Per content_type it maps to its section via `CONTENT_TYPE_TO_SECTION`; add/edit/reorder(`display_order`)/publish/unpublish/**withdraw**(`kind='withdrawn'`, stays published, renders in the History block); links/files as validated JSONB; **no new routes** (anchors). Replaces the old News tab + `content_modules.news` (R4 retires those). Built once inside the shell (§ decision: no interim hand-authoring before R2/S3).

**Save / Publish / Draft in R2 (what R2 needs, and the R3 boundary):**
- R2 keeps the current behaviour for *new* records: draft-on-create (S1/R0.5) → explicit **Publish** sets `workflow_status='published'` (`examService.setExamWorkflowStatus`/`publishExam`; `is_published` is DB-derived). The shell must expose one Publish action + a Draft/Published chip; **no Save silently publishes**.
- R2 needs **per-section Save** to one store per fact (the fact map is the contract; the §6 CI audit enforces exactly-one-input / no-orphan / drift). It must **stop** the known double-writes while re-homing UI: the FAQs shadow write to `exam_editions.faqs` (`:419` → R0.8), `has_*` flags writes (`:411-418`, AI `:711-717`) that have **no reader**, `notification_date` (`:408`) vs the Notification row, and `_config.modes`/`newsSeo` (R0.1/R0.2).
- **R3 (true drafts for already-published records, with a diff) is SEPARATE.** R2 only needs from R3 the **state seam**: a `draft` vs `live` notion on the header chip and a "Publish changes" affordance slot, without building the diff engine now. R2 must not fake "draft on a published record" — for now editing a published record saves live (unchanged); R3 layers the staged-diff on top. **Do not build R3's diff inside R2.**

---

## 2. The editable review drawer (kind + date editable before Accept)

Today `NoticeReviewDrawer` is **read-only**: one row per proposed change (label, current, proposed, verbatim quote, confidence, Accept/Reject), and S2.10 read-only panels (merged/warnings/rejected/provenance). It never edits kind or date.

**Target:** the editor may fix a **kind** and a **date/time** before Accept. Hard constraint — the **single code path must not fork**:
- `kindTypeSingleSource.test.ts` pins must stay green: (a) the `typeForKind`/`KIND_TO_VIEW_TYPE`/`KindRule` **definitions live only in `normalizeLabel.ts`**; (b) `typeForKind(` is **called only by `normalizeLabel.ts` and `noticePipeline.ts`**; (c) `noticeReview.ts` does **no** derivation (no `toProposedRow`, no `normalizeLabel`/`indianDateParser` import); (d) the editor runs the server answer through `postProcessExtraction` **before** `buildReviewRows`.
- So the drawer edits the **row object's `kind` (+ `dateText`/`date`/`end_date`/`start_time`/`end_time`)** only — **never `type`** — and preserves every other key by **spread** (P9's rule: never rebuild a row as an object literal — the prior CTET/NEET-UG erasure bug). On **Apply**, the edited rows are re-run through `postProcessExtraction`, which re-derives `type` from the edited `kind` via the model-gated `typeForKind`. The UI never calls `typeForKind` itself (would fail pin b/c).
- Editing the **date** must go through the same `indianDateParser` window parse used by the pipeline (a `kind`-change that becomes a `STATUS_DATE_TYPES` type re-applies the two-row rule; `pairWindowRows`/`isStatusWindowType` still run). The date-row **verbatim-quote flag** (S2.10) and the S2.2a status-safety gate keep applying post-edit.
- **Kind control** = a dropdown of the `DateEventKind` vocabulary (a list, not a derivation); **date control** = the same fields the Key-dates row will edit in S3 (kind, date, end_date, times, state, phase) so the drawer and the section share one row editor.

**Acceptance test:** a structural pin (extend `kindTypeSingleSource.test.ts`) asserts `NoticeReviewDrawer.tsx`/`noticeReview.ts` never reference `typeForKind`/`KIND_TO_VIEW_TYPE`; plus a golden test: seed the recorded raw answer, edit one row's `kind` (e.g. `result`→`cutoff`) and one `date` before Accept, and assert the applied rows match a re-derived expectation with `type` coming only from `typeForKind` and the S2.2a gate holding.

---

## 3. S3 — dates & status model

**Storage (verified):** `exam_editions.important_dates` = JSONB array of `{date, type, label, state, isUrgent, stage_label}` (the sampled edition confirmed), and the pipeline rows also carry `end_date`, `start_time`, `end_time`, `phase`, `rank_batch`, `audience`, `confidence`, `sourceQuote`, `custom`. The view (`20260902122910:36,77-79`) reads **only `d->>'date'`** as `date_val::date`, derives `date_type` from `d->>'type'` (label fallback `:39-68`), and computes each window's END from **its own row** — `app_close_confirmed = MAX(date_val) WHERE date_type='application_end'` (`:99-101`). So `end_date`/`end_time` are **never read by the status engine today**; the two-row registration contract (kept by `STATUS_DATE_TYPES`/`isStatusWindowType`/`pairWindowRows`) is what makes "registration closed" work.

**Time with dates (owner decision — CMS shows/edits time):** store `end_time`/`start_time` on the row and render `"X to Y, until HH:MM"` in Key dates and the drawer. **No view change for time** (see safest change below).

**`is_verified` flow (today 0 of 397 verified — verified):** `exams` already has `is_verified/verified_at/verified_by` columns, but **nothing writes them for exams** (editor-refactor P5: the only writer `entityService.verifyEntity` targets the orphan `entity` table). So:
1. R2 header Verified chip → a real **verify control** that writes `exams.is_verified=true, verified_at=now(), verified_by=auth.uid()` (permission-gated; the column exists — no schema change needed to *store* it). A `verified_by` on `exam_editions` (editor-refactor R1 "proposed migration") is optional; prefer `exams.*` which already exists — **decide** (open question 1).
2. Un-verify (back to unverified) also allowed; record in the audit trail.
**"Unverified never auto-posted / promoted" in code:** `is_verified` is **not** a visibility gate (public display is `status='published'`), so unverified-but-published records still show. `is_verified` gates **automation and promotion only**: (a) the **Social Queue** auto-post candidate is only enqueued when the source record `is_verified` (matches the S2.13 rule "unverified records never auto-post"); (b) an auto-"promote/pin to homepage" affordance, if added, requires `is_verified`. It never hides content and never blocks a human Publish.

**The `end_date`/`end_time` question — safest change + simulation:**
- **Recommended (safest, phase S3.1): change nothing in the view.** Keep the two-row contract (already enforced) and use `end_date`/`end_time` purely for display. Zero risk to a live, graded status engine that 397 records depend on.
- **Only if we later want single-window storage (phase S3.x, "E1" already anticipated in `normalizeLabel.ts:70`): a COALESCE fallback, proposed-only.** Make `app_close` fall back to an `application_start` row's own `end_date` when no `application_end` row exists: `COALESCE(MAX(date_val) FILTER(date_type='application_end'), MAX((d->>'end_date')::date) FILTER(date_type='application_start' AND d->>'end_date' IS NOT NULL))`, and add a time-aware "closes today at HH:MM" only if a timezone-safe timestamp is stored (currently `::date` — so time stays display-only for now).
- **Simulation before any view change (read-only, required):** in a `BEGIN READ ONLY` session, build the candidate logic as a CTE over the real `exam_editions.important_dates` for all 397 published exams and diff `derived_status` **old vs new**; report every flip with its exam. Ship only if flips are all intended. If any unintended flip → do not change the view.

**Other S3 rows:** the model-driven block (written-exam vs merit/admission vs interview) chooses which lifecycle rows to show; `stage_label`/`phase`/`rank_batch` surface for counselling rounds (§4); `state` per-row control fixes P9 (currently the "set state on the row" instruction has no control).

---

## 4. S4 — counselling rounds (inside R2)

**Data shape (no new table; use `exam_editions.counselling_data`, currently 0 rows / unread — editor-refactor §7 #4):** a JSONB array of rounds:
```
[{ "round": 1, "phase_label": "Phase 3 | Round 2", "rank_batch": "1–1,52,202",
   "events": [ {kind, date, end_date, start_time, end_time, state, quote} … ],
   "supersedes_round": <int|null>, "status": "upcoming|open|closed|withdrawn" }]
```
Each event's `kind` is already in the counselling family (`choice_filling, allotment, document_verification, admission, institute_lock, session_start`) → `typeForKind` maps them to `type:"counselling"`. Round/phase/`rank_batch` ride `phase`/`rank_batch` fields (already in the drawer/pipeline row contract). Provisional→final/corrigendum within a round uses `supersedes_round` (parallel to `content_posts.supersedes_id`/`kind`), NOT a new type.

**Display:** a "Counselling rounds / Merit list" block (model-driven), one card per round with its dated events as a mini-timeline; withdrawn/superseded rounds fold into the **History / Withdrawn** block (consistent with the Updates decision).

**Interaction with the status engine:** counselling-family rows (`type:"counselling"`) are **not** read by `exam_derived_status` as status windows (the view's read types are `application_*`, `notification`, `admit_card`, `result`/`merit_list`, `exam_*`, via `STATUS_DATE_TYPES`), so rounds are **status-neutral** — they render + feed the presence rule/hub, and only the `merit_list`/`rank_release` kinds touch `result_confirmed`, which the **S2.2a gate already demotes to `other` for merit-based/internal-admission** records (prevents the D.El.Ed false "Result declared"). So S4 must not hand-set `type`; it reuses `typeForKind`. Rounds do not change the derivation except through those already-gated rows.

---

## 5. Phased build plan (each phase ≤ one Qoder run)

Ship order roughly: **R2.1 → R2.2 → S3.1 → R2.3 → S3.2 → S3.3 → S4 → R2.4 → (R2.5/R2.6 cleanup)**. Most R2 phases are UI/store-wiring in the CMS only (no view change), so several ship independently of S3/S4.

| Phase | Size | Content | Ships before | Acceptance tests | Migration (proposed only) | Risk |
|---|---|---|---|---|---|---|
| **R2.1 shell skeleton** | M | Single page + section rail from `module_registry.applicable_pillars` + header (year switcher guarded vs P10, Draft/Published chip, Publish action). Old tabs still reachable. | most | structural: rail order = registry order; year switch does not mutate without guard | none | layout regression |
| **R2.2 selection question** | M | One "How are candidates selected?" → sets `(entity_type, selection_model)` pair, **no default**; drives the model-driven block; closes the `ModulePanel.tsx:177-178` unknown-slug bypass | R2.3 | unit: 6 answers→pairs; required-until-answered blocks Publish | none | mis-mapping pair |
| **S3.1 dates display + time** | S | Key-dates row editor over `important_dates` with `end_date`/`end_time` **display + per-row `state`/`phase` control** (fixes P9). No view change. | S3.2/3, S4 | golden: window rows render "X to Y until HH:MM"; state edit persists via spread | none | pass-through erasure (mitigate: spread) |
| **S3.2 verify flow** | S | Verified chip → write `exams.is_verified/verified_at/verified_by`; "unverified → no auto-post/promote" rule documented for S7 | — | unit: verify writes all three; unverified not auto-enqueued | optional: `exam_editions.verified_by` (decide §7 Q1) | none |
| **S3.3 time-aware status (E1)** | L | *Only if data needs it.* View COALESCE fallback read of `end_date` on `application_start` when no `application_end` row + optional time compare | after S3.1 | **read-only simulation old-vs-new derived_status over 397 exams; ship only on intended flips** | proposed view replacement | HIGH — live status for all exams; gated by sim |
| **S4 counselling rounds** | M | `counselling_data` rounds editor + cards; events via `typeForKind`; History block for superseded rounds | after S3.1 | golden round→cards; status-neutrality asserted (rounds don't move status except gated merit_list) | none (reuses `counselling_data` jsonb) | over-structure |
| **R2.3 Update-from-notice in shell** | M | Move the S2 flow + **editable drawer** (§2) into the shell; apply re-runs `postProcessExtraction` | after R2.1 | drawer guard stays green (no `typeForKind` in component); golden edit-then-accept | none | forking single source |
| **R2.4 Updates section (D-P2)** | M | content_posts Updates surface inside the shell (§1) | after D-P1 (done) | CMS create exam-linked post renders via `getContentPostsByExam` | none (D-P1 applied) | double news surface until R4 |
| **R2.5 first-class sections** | M | Eligibility/Fee/Selection/FAQs real inputs (§5a) in the shell (R1 bridge folded in) | — | fact-map audit §6 green (exactly-one-input) | none | — |
| **R2.6 honesty/cleanup** | S | R0.1–R0.9 (drop newsSeo/modes, fix reorder text, stop FAQs shadow write, jargon pass) | anytime | no-orphan rule; counts §5a §7 | none | — |

**Owner must decide per phase:** §7. **Golden fixtures:** the existing `__fixtures__/up-deled-2026-phase3/` + the notice pipeline cover R2.3; add a counselling-rounds fixture for S4; time-window fixtures for S3.1. **Structural guards:** keep `kindTypeSingleSource`, `editorPathParity`, `noticeTemplateParity`, frontend `contractAudit` (§6). **Live checks:** after any view change run the S3.3 read-only sim; the create-a-draft smoke test (release checklist item 3.7) after R2 changes the create path.

---

## 6. Dependencies

- **S2 pipeline (`noticePipeline.parseNoticeAnswer`/`postProcessExtraction`, `runNoticePipeline`):** R2.3's editable drawer **must** re-enter `postProcessExtraction` (single code path). S2 is complete; R2 builds on it. **Hard dep.**
- **ai-fill v7:** live + verified (list_models, per-attempt timeout, thinking override). R2.3 "Update from a notice" and the AI draft paths use it; the `manage_social`/permission gate + `AI_KEY_*` secrets are already in place. **Ready; no blocker.**
- **D-P1 (`content_posts` update columns — applied `20261013125113`):** R2.4 (Updates section) depends on `kind/supersedes_id/expires_at/display_order/verified_by` existing — they do. **Ready.**
- **Social Queue (S7):** S3.2's verify flow + S4 rounds + the "unverified never auto-posted" rule feed S7's `social_posts` candidate; the candidate `source_type='content_post'` (D-P4). S7 depends on R2/S3 being real (a published, verified update to post), so **S7 lands after R2.4 + S3.2**, not before.
- **R3 (true drafts + diff), R4 (retire columns / `content_modules.news` → content_posts / delete `/exams`,`/entities`,`GovtExamEditorPage`):** after R2; R2 only reserves the Publish/Draft seam, does not implement R3.

---

## 7. Owner decisions (locked 2026-10-14 — no longer open)

1. **`verified_by` lives on `exams`** — reuse the existing `exams.is_verified / verified_at / verified_by` columns; **no new column** on `exam_editions`. *(S3.2)*
2. **Time-aware view change (S3.3) is NOT funded now** — the status view stays date-only; the two-row registration contract is the mechanism. Revisit only if real data demands it (and only behind the read-only old-vs-new simulation).
3. **Counselling rounds stay JSONB** in `exam_editions.counselling_data` — no new relational table. *(S4)*
4. **One page-level Save** across the shell, with **per-section dirty markers** (each section shows unsaved state; a single Save writes the dirty sections). No section silently publishes. *(R2.1/2.5)*
5. **Verify permission reuses `publish_exam`** for now (no new `verify_exam` slug). *(S3.2)*
6. **File ownership:** an update's own PDF lives in that update's `content_posts.attachment_urls`; browsable papers (previous papers / study material) live in `exam_resources`. One file, one owner. *(R2.4)*

---

## 8. S2.14 — Notice coverage (widen `NOTICE_EXTRACT_V1`)

Motivation: the RRB NTPC run captured only identity + 3 dates from a rich notice — because the template's output schema has no slot for total vacancy, per-post vacancy, or the Important-Links block, and a plain-text paste of an aggregator page drops the link hrefs. **The owner confirmed the intended source is an aggregator page (sarkariresult-style) — it carries all the facts we want — so the design must be robust to its chrome, not ask users to paste official PDFs.** S2.14a (shipped) fixed the false "verbatim" flags on ellipsis-stitched quotes and the category UUID-on-current bug. S2.14b is the schema/coverage work, design only here.

**(a) Vacancy — total + optional post-wise list.**
- **Total** (e.g. 3548) → the **existing `exam_editions.vacancy` integer** (LIVE, frontend reads it — editor-refactor §7 #4b). Add `vacancy: { value, confidence, sourceQuote }` to the template output; the editor writes the integer.
- **Post-wise list** — **first check the existing `content_modules["vacancy-details"]` JSONB slot** (`module_registry` has a `vacancy-details` section). The per-post rows (post name, count, eligibility) are exactly that section's content → store them in `content_modules["vacancy-details"].items` (or a `posts[]` array under it). **Do not add a column** unless the vacancy-details slot proves unusable; if a structured store is later needed, `entity_vacancy` exists (dormant) as the relational fallback. Decide at build time from the actual module `fields` schema.

**(b) `important_links[]` = {label, url, kind}.**
- Template emits `important_links: [{label, url, kind}]` where `kind ∈ official | apply | notification | short_notice | result | admit_card | other`.
- **Destination:** an update's links → `content_posts.quick_links` / `attachment_urls` (Option D); the editor's Documents & links → `exam_resources`. No new table.
- **URL recovery (the real blocker):** a plain-text paste drops `href`s, so links can only be captured if the source carries them. Add an **HTML-aware paste** to the paste box: read `clipboardData.getData('text/html')`, parse anchors (`DOMParser`), and pair each anchor's text with its `href` into `important_links`. **URLs are only ever taken from the source — never invented** (same rule as `suggestedNewOption`). Fallback: if only text is available, capture the link LABEL with an empty url and let the editor paste the URL.

**(c) Relative / TBN exam-stage lines → notes, never dated rows.** "Exam Date: To be notified", "Admit Card: 4 Days Before Exam", "Exam City: 10 Days Before Exam" have no absolute date. The template must put them in a `notes[]` (or into the relevant section's `content_modules` text) with `confidence`+`sourceQuote`, NOT into `dates[]` (they'd be dropped by `parseDateWindow` anyway). This preserves the info without polluting the timeline or the status engine.

**(d) Be robust to aggregator chrome (the intended source).** Do NOT tell users to paste official PDFs — assume an aggregator paste and tolerate its surroundings. Add a prompt rule: *ignore navigation, "Trending Now", related-post lists, comment forms, social/app/download-widget blocks and footer — extract only the notice facts.* Optionally a deterministic **pre-clean** in the CMS before sending (strip known chrome regions / keep the article body), mirroring the existing distribution-list rejection. Keep it conservative — never drop real content.

**(e) New golden fixture from the RRB NTPC notice.** Add `__fixtures__/rrb-ntpc-2026/` built from the owner's paste **trimmed of chrome**: `pasted.txt`, `model.responses.json` (recorded), `expected.json` asserting: total vacancy 3548, the post-wise list, apply-start `2026-10-08` + apply-last `2026-11-06` as the **two-row registration contract** (`application_start` + `application_end`), fee `2026-11-06` (`other`), and the important-links/notes — with the S2.9a status-safety gate and the two-row rule holding.

**(f) Deploy + keep live tests green.** (a)–(d) change **`supabase/functions/ai-fill/templates.ts`** (the prompt + `validateAnswer` for the new arrays) → **requires an ai-fill redeploy (v8)** by the owner. The client `noticePipeline.ts` post-processing must accept the new `vacancy`/`important_links`/`notes` fields additively (ignore-absent) so the **S2.9a synthetic** and **S2.12/S2.13 golden LIVE** tests stay green: run those LIVE before/after; the two-row registration and the option-vocabulary guards are unchanged. Ship the client-side tolerance first (no behaviour change when the fields are absent), then the template, then the golden fixture.

**(g) Content policy — facts, never the aggregator's prose.** Aggregator text is not ours to republish. The extractor returns **structured facts only** (dates, vacancy total + post list, eligibility, fee, links, notes); the originating URL is kept for **attribution only** (the existing official-website + "Last verified" E-E-A-T block). **Never copy the aggregator's descriptive prose verbatim into published content** — `NOTICE_EXTRACT_V1` is already field-scoped; keep it that way and do NOT add a free-text "summary" field that would launder copied prose. If prose is ever needed it must be original editorial writing, not the aggregator's.

**Reliability note (measure before acting):** Gemini returned **503 on 3 of 6** attempts in the v7 verification and again forced the RRB run to fall through to groq. **Propose measuring the Gemini 503 rate from `ai_request_logs` over ~7 days** (group by provider/model, status, error) **before adding any Gemini-specific retry/backoff** — the current fall-through already rescues every golden, so a retry may be unnecessary; decide from data, not from the sample.

---

Design + S2.14a code only; no migration, no DB change, no deploy, no push. S2.14a is committed (see git); S2.14b awaits owner approval before any build.
