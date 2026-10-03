# Exam Editor UX Refactor — Investigation + Design (R-track)

**Status:** Design only. No code changed. R0 awaits the owner writing `GO R0`.
**Scope:** `EntranceExamEditorPage.tsx` (2,302 lines) and everything it touches — the editor that serves Entrance Exams, Govt Exam (via a 3-line re-export wrapper `GovtExamEditorPage.tsx`), Govt Vacancy, University Exams and Board Exams (`src/router/index.tsx:232-249`).
**Companion files:**
- Wireframe (1366×768 HTML mock): `docs/design/editor-refactor-wireframe.html`
- Read-only retirement counts (**RUN against live IEI 2026-10-03, results embedded**): `supabase/proposed/r_retirement_counts.sql`

All line references verified 2026-10-03 against working trees. Frontend = `indianexaminfo-frontend`, CMS = `indianexaminfo-cms`; paths given relative to each repo root. Retirement counts in §7 are live numbers, not proposals.

---

## 1. Findings P1–P12 — verdicts with file:line

### P1 — Eligibility, Application Fee, Selection Process render live but have NO manual input — **CONFIRMED, and it is worse than described**

The live page reads all three:
- eligibility ← `exam_editions.eligibility` — frontend `services/examService.ts:151`, rendered by `EligibilitySummary` (see frontend `lib/contract/canonical-data-contract.json:65-69`), reads `qualification`/`ageLimit`/`nationality`/`additionalCriteria` at `components/exam/EntityDetailPage.tsx:734-744`.
- application fee ← `exam_editions.application_fee` — frontend `services/examService.ts:153`.
- selection process ← `exams.selection_process` — frontend `services/examService.ts:154`.

But no live input for any of them exists anywhere in the editor:
- The only inputs that ever existed for them are `ModulesTab` (`EntranceExamEditorPage.tsx:1582`) and `ContentModulesTab` (`:1623`, guide text at `STEP_GUIDE_MODULES:1611-1621`) — **both are dead in-file functions, never rendered** (the tabs array at `:1016-1024` does not include them; panel render `:1158-1217` never reaches them).
- The service layer accepts them — `entranceExamService.ts` `updateEdition` takes `eligibility` (:558) and `application_fee` (:560) — but the editor's Save never passes them (`EntranceExamEditorPage.tsx:406-421`).
- EditionTab ("Dates & Status", `:1430-1580`) contains **no eligibility or fee inputs** — only edition fields, the notification date (`:1543`), the syllabus PDF picker (`:1529-1540`) and the date rows (`:1556-1576`).
- IdentityTab (`:1248-1332`) has no selection-process input (its fields: name, category, conducting body `:1283-1288`, "Entity Type" `:1299`, "Selection Model *" `:1317-1324`).

So the "Edited elsewhere" links are doubly wrong — they name tabs, and the named tabs don't contain the fields:
- `ModulePanel.tsx` `COLUMN_BACKED_MODULE_SOURCE` — eligibility → "Dates & Status tab" (:48), selection-process → "Identity tab" (:51), faqs → "SEO tab" (:52); `FIXED_SECTIONS` — Eligibility → edition (:72), Application Fee → edition (:73), Selection Process → identity (:74).
- Consequence: content written by migration or AI is displayed live but **cannot be edited by a human at all**. `supabase/proposed/r_retirement_counts.sql` §7 counts how many records are affected.

### P2 — Same fact, several inputs — **CONFIRMED with three corrections**

| Fact | Confirmed evidence |
|---|---|
| Notification date | Edition column input at `EntranceExamEditorPage.tsx:1543` AND the "Notification Release" row via `STANDARD_DATE_LABELS` (`:1361-1372`, notification at :1362). Frontend reads only `important_dates` rows (`examService.ts:141-150`); `notification_date` has **zero** exam-side reads in the frontend (grep: only `services/sarkariNaukriService.ts:100`, a different table). |
| Syllabus | Syllabus tab (`:1019`) + Resources tab links + "Syllabus PDF (this cycle)" picker inside Dates tab (`:1529-1540`) + Modules tab "Syllabus" card (`ModulePanel.tsx:75` "Syllabus Highlights" → identity). |
| FAQs | **One input, two stores** — not multiple inputs. The SEO/FAQ tab UI writes `form.faqs` once; Save sends the SAME value to `exams.faqs` (`:385` via `updateExamIdentity`) and `exam_editions.faqs` (`:419` via `updateEdition`). Frontend reads `exams.faqs` only (`examService.ts:155`; gate `sectionRegistry.ts:360-370`). Owner's framing "exams AND exam_editions" is right about stores, wrong about "inputs". |
| Exam news | News tab writing `content_modules.news` (`:1825-1976`, item `isPublished: true` hardcoded :1864) + the "News & Updates" module card in Modules + Content posts linked to the exam — three surfaces, one render consumer. |
| Exam-pattern facts | `typeFields` is a **phantom input** — declared in `CMS examService.ts:208` (`ExamUpdateInput.typeFields`) but ABSENT from the `fieldMap` (`:216-245`), so it is never persisted at all, and the frontend never reads it (grep: 0 matches). The live pattern section renders from the registry `exam-pattern` module (`sectionRegistry.ts:385-415`). |
| Admit-card / result dates | Key-dates rows (`important_dates` with `type: "admit-card"|"result"`) AND the module's own date field — but the frontend deliberately ignores the module date and uses the derived timeline date (`frontend examService.ts:240-244`, `admitCardDate`/`resultDate` "instead of the module's own date field"). |
| Legacy `exams.*` cycle columns + `exam_editions.*` | **STALE — already fixed.** The legacy `exams.*` cycle columns (`has_*`, `important_dates`, `vacancy`, `status`, `last_updated`, `syllabus_highlights`) were DROPPED in step 4. Documented at `frontend examService.ts:205-209` and `:265-268`, `CMS examService.ts:227-235` and `:262-263`. No dual exams/exam_editions store survives for these; the live duplicates are the ones in the rows above. |

### P3 — Inputs the site never reads — **CONFIRMED (all six), with frontend-grep proof**

| Input | Where written | Frontend proof |
|---|---|---|
| News SEO block (7 fields: `newsKeywords`, `standout`, `syndicationSource`, `maxImagePreview`, `robotsNewsTag`, `googleNewsCategory`, `discoverOptIn`) | SEOTab `EntranceExamEditorPage.tsx:1980-1988` → `content_modules.newsSeo` (Save merge `:393-401`) | Grep `newsSeo\|news_keywords\|newsKeywords\|standout\|syndication\|discoverOptIn\|maxImagePreview\|robotsNews` → only an unrelated CSP entry in `next.config.ts`. The module renderer iterates registry slugs only and skips `_config`; `newsSeo` is not a registry module (`EntityDetailPage.tsx:707-717`, `sectionRenderers.tsx:238-240`). |
| Auto/Hybrid/Manual mode | `content_modules._config.modes` (module UI) | Grep `dataMode\|hybrid\|Hybrid\|"manual"\|'manual'` → 0 matches. |
| `has_*` flags | EditionTab Save `:411-418` → `exam_editions.has_*`; AI flips them `:711-717` | Frontend maps them into `ExamEntity` (`examService.ts:210-220`) **but no renderer consumes them**: the one gate is the presence rule `hasData()` and its `HasDataView` type has NO `has_*` fields (`sectionRegistry.ts:165-180`); `CT_TO_FLAG` (`examService.ts:249-262`) is dead; the sitemap's `CT_FLAGS` list (`app/sitemap.ts:82-94`) is not what filters — emission uses `contentTypeHasData` (`sitemap.ts:166-167`, `sectionRegistry.ts:424-428`). |
| Edition notification date | `:1543` → `exam_editions.notification_date` | Grep `notification_date` → only `sarkariNaukriService.ts:100` (sarkari table). |
| Edition FAQs | `:419` → `exam_editions.faqs` | No read of `edition.faqs` anywhere; `mapRow` takes `row.faqs` from `exams` (`examService.ts:155`). |
| `typeFields` | Declared input `CMS examService.ts:208` | 0 frontend matches; and never persisted (fieldMap omits it — `:216-245`). |

Nuance worth keeping: the entrance editor has **no flag inputs any more** (the checkbox UI lives only in the dead `ModulesTab:1582`), yet Save still writes the flags (`:411-418`) and AI Fill still flips them (`:711-717`) — writes with no reader AND no control.

### P4 — Three save behaviours — **CONFIRMED, plus a fourth and a fifth**

1. **Autosave (2 s):** content modules via `useModuleAutosave.ts:33` `DEBOUNCE_MS = 2000` (editor note `:159-163`). There is also a separate `useAutosave.ts:27` at `DEBOUNCE_MS = 30_000` — a third timing on a fourth surface.
2. **Save button:** identity, dates, news, SEO/FAQs (`handleSave:340-440`).
3. **Immediate-on-action:** Resources tab create/update/delete/publish toggle write at once (`ResourcesTab.tsx:52-99`); syllabus saves similarly.
4. **AI Fill direct-to-DB on an existing record:** `:736-757` (owner said ~713–737; the block moved — gate `if (currentEdition && ...)` at :728, `updateEdition` :739-742, `updateExamIdentity` :745, content-modules write :756) — no Save click, no review, bypasses the diff the Save path would produce. Tab-level AI handlers also auto-persist (`:815-818`, `:878-880`, `:920-921`).
5. **New records publish on create** (S1 fixes this; see S1 report).

### P5 — No verification control for exams — **CONFIRMED**

The Modules header shows a red "Unverified" badge (`ModulePanelHeader.tsx:27-33`, title at :25). Nothing in this editor can ever set it: CMS-wide grep found exactly one verification write — `entityService.verifyEntity:339-348` — and it targets the `entities` table (the orphan `/entities` workspace, P11), not `exams`. Frontend `ExamIdentity.isVerified` is read (`CMS entranceExamService.ts:227`) with no writer. Sarkari bulletins have a verification affordance; exams have none.

### P6 — AI Fill loses work — **CONFIRMED, all seven sub-claims**

| Claim | Evidence |
|---|---|
| Content modules discarded on a new record | Persistence gate requires `currentEdition` — `:728`, `:736`; the modules write at :756 is inside it. On a new record the whole block is skipped. |
| Stage-1 eligibility/fee never returned or saved | `entranceExamAI.ts`: stage-1 prompt asks for fee (:54) and eligibility (:55), `Stage1Result` keeps them (:73-74), but the final `AIExamData` return (`:234-254`) has no eligibility/fee fields — they only feed the stage-2 prose prompt (:155-156). |
| Unmatched date labels dropped | `processStage1Dates` skips `normalizeLabel` nulls (:123-124). `normalizeLabel.ts:26-50` is a ~10-pattern whitelist, default `null` (:52). |
| Time dropped | `indianDateParser.ts` parses `YYYY-MM-DD` only (:32-73); no time anywhere. |
| Input sliced | `.slice(0, 5000)` stage-1 (`entranceExamAI.ts:44`), `.slice(0, 3500)` stage-2 (:159). |
| Cut-off typed "result" | `normalizeLabel.ts:46-47` maps `cut\s*off` → `type: "result"`. |
| Stage-1 parse failure silently returns empty | `entranceExamAI.ts:102-104`. |

Extras found: on the extraction path the flags are hard-coded `true` (`:241-248`) — AI "verifies" sections it may not have filled; on the no-raw path dates are blanked and flags defaulted (:196-199, :274-281); `parseDateText` takes the FIRST date of an "X to Y" range (`indianDateParser.ts:52-54`), silently dropping the window's end; range/dedupe by label at `entranceExamAI.ts:129`.

### P7 — Jargon — **CONFIRMED**

"Entity Type" (`:1299`), "Selection Model *" (:1317-1324), edition tab labelled by edition mechanics, "Content Modules" (`ModulePanelHeader.tsx:25`), Auto/Hybrid/Manual mode (mode legend header `ContentModuleCard.tsx:1-4`), "Edited elsewhere" (`ModulePanel.tsx:417`), and the toggle juxtaposition: a card showing an **on** toggle next to a **Hidden** badge whose tooltip says "The on/off toggle does not affect it" (`ContentModuleCard.tsx:64-87`, title :73).

### P8 — Modules not shaped by selection model + contradictory reorder text — **HALF WRONG**

- **Wrong half:** modules ARE filtered by the selection model in the UI. `ModulePanel.tsx` receives `entityType`/`selectionModel` (:112-114) and filters with `isModuleApplicable(m.slug, entityType, selectionModel)` (:175-180). (Partial: unknown slugs bypass the filter, :177-178 — worth fixing, but the claim "not shaped in the UI" is false.)
- **Right half:** the reorder text contradicts itself at exactly the quoted lines — `:389` "Only Editable content modules can be reordered — that order is what the page renders" vs `:402-405` "Drag-to-reorder REMOVED… main page renders in registry order" and the GroupHeading at :405 "the main page renders them in a fixed order". Removal-of-handler comment at `:352-354`.

### P9 — Date-state dead-end instruction — **CONFIRMED**

Derived-status panel says "…set that state on the specific date row" (`EntranceExamEditorPage.tsx:1523-1526`), but date rows expose only label/date/isUrgent/delete (`:1556-1576`). The `DateRow` type carries `state`/`type`/`verified`/`stage_label` as opaque pass-through (`:1334-1355`), and the contract comment says the editor "must never rebuild a row as an object literal" (the prior CTET/NEET-UG erasure bug). No UI produces `cancelled`/`postponed`: `normalizeLabel.ts:16,24` emits only `confirmed`/`expected`.

### P10 — Editions "Edit" loads another year into the open form — **CONFIRMED**

`onEdit` at `:1196-1216` fires a `form.setValue` storm across edition fields (:1198-1211, including the dead `has_*` values), swaps `currentEdition` (:1212), and jumps to the Dates tab (:1214) — without routing through the unsaved-changes guard (`pendingExit` dialog at `:1233-1241` only guards tab switches/navigation, not this in-page mutation). The user can save the other year's data believing they were still editing the current one.

### P11 — Dead/orphan code — **CONFIRMED with two corrections**

- In-file dead tabs: `ModulesTab:1582`, `ContentModulesTab:1623` ✓.
- `/exams` → `ExamEditorPage.tsx` (1,067 lines) ✓ — router comment calls it "directly targets legacy `exams` table" (`router/index.tsx:183-186`) — not in sidebar ✓.
- **Correction:** the `/entities` workspace (`router:176-179`) does NOT write the `exams` table — it writes `entities`/`entity_modules` via `entityService`. That makes it *more* orphaned, not less: the frontend has ZERO reads of `entities`/`entity_modules`/`editorial_content` (grep), so the whole workspace is dead weight: `EntityEditorPage.tsx` (51 lines) + exactly 11 stub tab files of 3-4 lines each (DownloadsTab, EligibilityTab, ExamPatternTab, FeeTab, LinksTab, MediaTab, OverviewTab, SelectionProcessTab, SEOTab, SyllabusTab, VacancyTab — e.g. EligibilityTab body is `<p>Eligibility tab — entityId: {entityId}</p>`) + the real-but-unused tabs (GeneralTab 436, PublishingTab 262, RelationshipsTab 230, ModulesTab 148, TimelineTab 186).
- `GovtExamEditorPage.tsx` is a 3-line re-export of `EntranceExamEditorPage` (not a second editor to maintain, but a second route to retire).

### P12 — Taxonomy menu mismatch — **CONFIRMED**

Sidebar item `{ label: "Taxonomy", to: "/navigation" }` (`Sidebar.tsx:63`); `/taxonomy` is a different page (`TaxonomyManagerPage`, `router/index.tsx:181-182`).

### Count corrections

- The editor is **2,302 lines** (owner said 2,280).
- There are **6 AI entry points**, not 5: five tab-level `AIFillButton`s (`:1150-1154`) plus the whole-exam button (`:1102` existing / `:1119` new) opening `AIFillDialog` (`:1224`).
- AI direct-write block is at `:736-757`, not ~713–737.

---

## 2. Target design (refined — owner's skeleton kept)

### Rules (unchanged, restated for implementers)
1. **One fact = one input.** The fact map (§5) is the contract; the CI test enforces it.
2. **Every reader-visible section has exactly one input** somewhere in the editor (this kills the P1 gap class).
3. **Nothing goes live without Publish.** AI never writes to a live record; AI output lands in a review screen with source quotes, then applies to the draft.
4. **"Update from a notice" is the front door** — paste/upload notice text → AI extraction → review each change against the quote → apply.
5. **Selection type decides the sections** (make the existing `isModuleApplicable` filter visible and strict — close the unknown-slug bypass, `ModulePanel.tsx:177-178`).
6. **Plain words only** — the UI must pass a jargon blacklist (`entity type`, `selection model`, `edition`, `module`, `auto/hybrid/manual`, `edited elsewhere`, `typeFields`).
7. **Must fit 1366×768** without horizontal scroll; section rail always visible.

### Layout
Single page, no tabs, left section rail (see wireframe):

- **Header:** exam name · year switcher (replaces the Editions tab and the P10 footgun — switching year is explicit and guarded) · Draft/Published chip · Verified chip (clickable → verify control, §"Publish panel") · Preview · **Publish**.
- **Sections (rail order = reader order where the registry fixes it):**
  `Update from notice` · `Basics` · `Key dates` · `Who can apply` · `Fee` · `How to apply` · **[model-driven block]** `Counselling rounds, Merit list` | `Exam pattern, Admit card, Answer key, Result, Cut-off` | `Accepted scores, Interview` · `Syllabus` · `Documents & links` · `FAQs` · `Updates` · `Search appearance` · `Checklist`

### Field decisions (owner's list, refined)
| Owner decision | Refinement |
|---|---|
| Entity Type + Selection Model → one question "How are candidates selected?" setting both, no default | Keep. Map the 6 UI answers to `(entity_type, selection_model)` pairs; the current required-but-defaulted "Selection Model *" (`:1317-1324`) and "Entity Type" (`:1299`) both disappear. No default = the Checklist blocks Publish until answered. |
| Slug → under "More" | Keep. Slug stays editable but with the 301-warning affordance from S1. |
| Frequency/session → cycle settings | Keep — move out of Basics into the Key dates header area ("This exam runs: yearly / once-per-year / multiple sessions"). |
| Featured → Publish panel | `exams.is_featured` (read at `frontend examService.ts:234`). |
| Remove edition Notification Date, migrate into the Notification row | Save currently writes both (`:408` and the row). R0 stops NEW duplicate writes where trivial; R4 drops the column after `r_retirement_counts.sql` §2 counts the overlap. Migration = copy `notification_date` into the row where the row is missing. |
| Vacancy → "Seats / posts", shown only where meaningful | Keep the input (frontend READS vacancy, `examService.ts:152`), label per entity type; hide for selection models where it is noise. |
| Module date inputs → read-only from Key dates | Frontend already prefers derived timeline dates (`examService.ts:240-244`); make the UI say so. |
| Eligibility / Fee / Selection process / FAQs → real sections; FAQs exam-level only | New first-class inputs over `exam_editions.eligibility` / `.application_fee` / `exams.selection_process`; FAQs input bound to `exams.faqs` ONLY — stop the shadow write at `:419` (R0 candidate, gated by counts §3). |
| Syllabus → one section | Structured syllabus store (`exam_syllabus_subjects`, see CMS `examService.ts:234-235` comment) is the input; the PDF picker joins Documents & links with a "Syllabus PDF" role tag. |
| Resources → "Documents & links", notice PDF auto-attached | Keep `exam_resources` as the store (it has a real consumer); the "this cycle" syllabus picker (`:1529-1540`) folds in here. |
| Overview → saved AI draft paragraph | Editorial `overview` module key only; remove any live-preview promise the current UI can't keep. |
| Remove Enable all / mode dropdown; keep per-module toggle (backed by `_config.enabledModules`, the ONE `_config` key with a presence-rule reader, `sectionRegistry.ts:242-247`); `_config.moduleOrder` is KEPT and strengthened (a second live reader: `EntityDetailPage.tsx:704-707`, the editorial block's render list). Enable-all/Disable-all (`ModulePanel.tsx:372-386`) and the Auto/Hybrid/Manual dropdown (`ContentModuleCard.tsx:188-195`) go. |
| News tab → "Updates" = Content posts linked to the exam + "Write an update" | Kills the third news surface. `content_modules.news` keeps rendering until posts migration lands (R4); the NEW editor offers only the Content-posts path. |
| SEO → "Search appearance" with auto template | `seo_title`/`seo_description` (`frontend examService.ts:236-237`) with a preview card and a "reset to template" action. |
| Remove the News SEO block | §6 retirement; UI removal is R0. |
| One "Update from a notice" flow replaces the AI buttons (all 6) | Single flow, single entry point. |
| Publish panel: checklist + exam verification (`verified_by`/`verified_at`, notice link), like sarkari | New columns on `exam_editions` (proposed migration in R1; the badge at `ModulePanelHeader.tsx:27-33` becomes a real control). |

---

## 3. R0 — honesty quick wins (SMALL; awaiting `GO R0`)

Every R0 item is a delete, a text fix, or a reorder of existing calls — no new stores, no schema change, no frontend change.

| # | Change | File(s) | Detail |
|---|---|---|---|
| R0.1 | Remove News SEO block UI (7 fields) and stop writing `content_modules.newsSeo` | `EntranceExamEditorPage.tsx` SEOTab `:1980-1988`, merge builder `:393-401` | Keys already in DB stay (read counts §5a first; harmless either way — no reader). |
| R0.2 | Remove Auto/Hybrid/Manual mode dropdown + Enable all/Disable all | `ModulePanel.tsx:372-386`, `ContentModuleCard.tsx` mode UI (`:1-4` legend) | Stops new `_config.modes` writes; existing keys unread. |
| R0.3 | Fix contradictory reorder text | `ModulePanel.tsx:389` vs `:402-405` | Keep only the truth: registry order renders; `_config.moduleOrder` ignored. |
| R0.4 | Fix date-state dead end | `EntranceExamEditorPage.tsx:1523-1526`, rows `:1556-1576` | Replace the instruction with an actual per-row state control writing `state` through the pass-through spread contract (`:1334-1355`) — or, if a control is too big for R0, delete the sentence and point at the derived panel. Recommended: minimal select on the row (defaults preserved by spread). |
| R0.5 | AI Fill on a NEW record: create the Draft exam+edition FIRST, then apply everything | `EntranceExamEditorPage.tsx:728-757` (persistence gate) + create path | No lost modules. S1 already made create produce a Draft. |
| R0.6 | Pass stage-1 eligibility/fee through to the form/DB | `entranceExamAI.ts:73-74, :234-254` + editor apply logic | Add `eligibility`/`applicationFee` to `AIExamData`; write via the (new) draft-first path from R0.5. |
| R0.7 | Delete in-file dead tabs | `EntranceExamEditorPage.tsx:1582-1824` (`ModulesTab`, `STEP_GUIDE_MODULES:1611-1621`, `ContentModulesTab`) | ~240 lines of never-rendered code. |
| R0.8 | Stop the FAQs shadow write to `exam_editions.faqs` | `EntranceExamEditorPage.tsx:419` | One input, one store (`exams.faqs`, the only read). Column left in place; retirement is R4. |
| R0.9 | Jargon micro-pass (text only) | `ModulePanelHeader.tsx:25`, "Edited elsewhere" `ModulePanel.tsx:417`, toggle tooltip `ContentModuleCard.tsx:73` | Rename "Content Modules" → "Page sections"; "Edited elsewhere" → "Edited in {section}" with §P1-corrected targets or "no editor yet — coming in R1". |

**R0 gates:** `tsc --noEmit` + `vitest run` green; new tests for R0.5 (create-then-apply) and R0.6 (eligibility/fee passthrough) using the existing `entranceExamAI` test patterns.
**Deliberately NOT in R0:** any layout change, any new section, any route deletion (`/exams`, `/entities` are R4-after-confirmation), any column drop.

---

## 4. Merged slice plan (R-track × S-track)

Order: **S1 → R0 → R1 → S2 → R2(+S3,S4) → S5 → R3 → R4 → S6** (owner's sequence, sizes proposed).

| Slice | Size | Contents | Depends on |
|---|---|---|---|
| S1 | done | Publish-on-create fix, slug/301 root fix, category authority — committed, gates green | — |
| **R0** | S | Honesty quick wins (§3). All in 4 CMS files. | S1 |
| **R1** | M | Real inputs: Eligibility ("Who can apply"), Fee, Selection process, FAQs (exam-level only) as first-class sections IN THE OLD TABS (bridge until R2); `verified_by`/`verified_at` proposed migration + verification control. | R0; counts §7 |
| **S2** | M | AI options + review screen: paste/upload notice text, extraction with per-change source quote, accept/reject, apply-to-draft. Built as the first piece of the new shell but reachable from the old editor. Fixes P6 class permanently (no more blind direct-write). | R0.5/R0.6 |
| **R2** | L | New editor shell: single page + section rail + header (year switcher, Draft/Published, Verified, Preview, Publish) at 1366×768; selection-model-driven section list; jargon purge. **S3 (Key dates UI) and S4 (counselling rounds) are built inside R2's shell, never in the old tabs.** | R1, S2 |
| **S3** | (inside R2) | Key dates: per-row state, stage labels, verified marks, window ranges ("X to Y") without the first-date loss. | R2 |
| **S4** | (inside R2) | Counselling rounds section fed by selection model. | R2 |
| **S5** | M | PDF/OCR into the Update-from-notice flow. | S2 |
| **R3** | L | True drafts for published records: "Publish changes" with a diff (currently a Save mutates live rows; only new records are draft-first). | R2 |
| **R4** | M | Cleanup, all gated on `r_retirement_counts.sql` output + owner confirm: drop dead columns/keys (§6); exam news → Content posts; delete `/exams` editor, `/entities` workspace (+11 stub tabs), `GovtExamEditorPage` wrapper route. | counts; R2 live |
| **S6** | S | Whatever the owner parks last. | — |

---

## 5. Fact map

Every reader-visible fact on the live exam page → its ONE CMS input, and every CMS input the editor writes → its consumer. `FE` = `indianexaminfo-frontend`, `CMS` = `indianexaminfo-cms`.

### 5a. Frontend fact → canonical CMS input

| Live fact (FE read) | Single input (CMS write) | Store |
|---|---|---|
| Name / short name (`FE examService.ts:174-176`) | IdentityTab → `updateExamIdentity` (`CMS editor:385` region, `CMS entranceExamService.ts`) | `exams.name/short_name` |
| Category / breadcrumb (`:180-183`) | IdentityTab category picker (`:1283-1288`) | `categories` (authority per S1) |
| Entity type (`:185`) | IdentityTab "Entity Type" (`:1299`) — R2 folds into the selection question | `exams.entity_type` |
| Conducting body (`:186`) / website (`:193`) | IdentityTab | `exams.conducting_body/official_website` |
| Important dates list (`:141-150`) | EditionTab date rows (`CMS editor:1556-1576`) | `exam_editions.important_dates` |
| Status chip (`:196-204`) | Derived: `exam_derived_status` VIEW; editor asserts only cancelled/postponed (per-row, P9) | view + `exam_editions.status` |
| Eligibility (`:151`; render `EntityDetailPage.tsx:734-744`) | **NO INPUT (P1)** — R1 "Who can apply". **376 editions hold live eligibility.** | `exam_editions.eligibility` |
| Application fee (`:153`) | **NO INPUT (P1)** — R1 "Fee". **322 editions hold live fee.** | `exam_editions.application_fee` |
| Selection process (`:154`) | **NO INPUT (P1)** — R1. **279 exams hold live selection_process.** | `exams.selection_process` |
| Vacancy (`:152`) | EditionTab (`form.setValue("vacancy")` `:1202` region) | `exam_editions.vacancy` |
| FAQs (`:155`; gate `sectionRegistry.ts:360-370`) | SEOTab FAQs UI (`CMS editor:2084-2099`) | `exams.faqs` (editions copy is a shadow — §6) |
| SEO title/description (`:236-237`) | SEOTab | `exams.seo_title/seo_description` |
| Editorial modules (overview, admit-card, result, news…) (`EntityDetailPage.tsx:707-717`, `sectionRenderers.tsx:238+`) | ModulePanel autosave (`useModuleAutosave.ts:33`) per registry slug | `exam_editions.content_modules[slug]` |
| Module visibility (`sectionRegistry.ts:242-247`) | `content_modules._config.enabledModules` — the ONLY `_config` key with a reader | same column |
| Admit-card / result date shown (`:240-244`) | Key-dates rows via derived view | `important_dates` + view |
| Syllabus (structured) | Syllabus tab (`CMS editor:1019`) | `exam_syllabus_subjects` |
| Resources / links | ResourcesTab (`ResourcesTab.tsx:52-99`) | `exam_resources` |
| Edition year label in title (`:190`) | Editions mechanics (`current_edition_id`) — R2 year switcher | `exam_editions.year` |

### 5b. CMS input → consumer (or NONE)

| CMS input | Consumer |
|---|---|
| News SEO 7 fields → `content_modules.newsSeo` | **NONE** (§1 P3) |
| `_config.modes` | **NONE** (session-only editor view after Step 4; the FE has no reader) |
| `_config.moduleOrder` | **LIVE** — `ContentModulesBlock` builds the main exam page's editorial render list FROM it (`indianexaminfo-frontend/components/exam/EntityDetailPage.tsx:704-712`), falling back to `Object.keys(contentModules)` only when `moduleOrder` is absent. A slug missing from `moduleOrder` is HIDDEN on the site. Content-type TAB pages (`ContentTypeModules.tsx`, `SarkariNaukriContentTypeView.tsx`) synthesize their own `moduleOrder` from `CT_TO_MODULES` and pass through the same block. |
| `exam_editions.has_*` (Save `:411-418`, AI `:711-717`) | **NONE** (mapped `FE examService.ts:210-220`, no renderer; presence rule owns all gating; `CT_TO_FLAG:249-262` dead; sitemap uses `contentTypeHasData` `sitemap.ts:166-167`) |
| `exam_editions.notification_date` | **NONE** for exams |
| `exam_editions.faqs` | **NONE** (shadow copy) |
| `typeFields` (declared `CMS examService.ts:208`) | **NONE + never persisted** (absent from fieldMap `:216-245`) |
| `exam_editions.age_limit`, `.result_summary`, `.counselling_data` | **NONE** (grep 0 matches; the eligibility table's `ageLimit` is the JSON key inside `eligibility`, a different store) |
| `exam_editions.status` | PARTIAL — only `cancelled`/`postponed` honoured (`FE examService.ts:196-204`) |
| SEOTab FAQs, identity fields, date rows, vacancy, eligibility/fee/selection (via services) | Live as §5a |

## 6. Fact-map CI test proposal

The frontend already has the exact machinery: `lib/contract/canonical-data-contract.json` (per fact: `editorFields`, `rendererFields`, `syncsTo`, note) + `lib/contract/contractAudit.logic.test.ts` (extracts renderer reads from source, compares against the contract) + `lib/contract/module-registry.snapshot.json`. Extend that file — do not build a new framework.

Add three fails-closed rules to the existing audit:
1. **Exactly-one-input rule:** every fact with ≥1 `rendererFields` entry must declare exactly one `syncsTo` store AND exactly one editor surface (new field `editorSurfaces: [{ repo, file, component }]`). Fail on 0 (the P1 class — eligibility today) or >1 (the P2 class — notification date, FAQs, news today).
2. **No-orphan-input rule:** every editor surface registered must map to a fact with ≥1 renderer read. Fail on the P3 class (newsSeo, modes, notification_date, edition faqs, has_*).
3. **Drift rule:** the existing extraction test already parses renderer reads; add CMS-side extraction of the Save payload keys (`handleSave` + `updateEdition`/`updateExamIdentity` call sites) so a NEW write with no contract entry fails CI.

The contract can't be complete until R1 lands the missing inputs; seed it with `knownGaps: [...]` listing exactly §5a's NO-INPUT rows and §5b's NONE rows, and set the test to fail if that list grows. R0/R1/R4 delete entries from `knownGaps` as they close — the shrinking list IS the refactor's progress meter.

## 7. Retirement list (R4) — LIVE COUNTS, run read-only on IEI 2026-10-03

Queries + pasted output: **`supabase/proposed/r_retirement_counts.sql`** (executed via Supabase MCP `execute_sql`; still PROPOSED — nothing is dropped). NOTHING is retired without the owner's drop decision, but the numbers below already change two plan assumptions (notification_date migration is mandatory, and three columns are provably empty).

Schema corrections found while running (the file was originally written against an assumed schema): `exam_editions`/`exams` have **no `deleted_at`** column; `exam_editions.vacancy` is `integer`; `exams.selection_process` is a **text ARRAY** (not JSONB); the `/entities` table is **`entity` (singular)** — there is no `entity_modules`/`editorial_content`.

Live totals: **399 editions, 403 exams** (`entity` workspace = **3 rows**).

| # | Column / JSON key | Non-empty (live) | Reader | Retirement decision |
|---|---|---|---|---|
| 1 | `exam_editions.has_*` (8 flags) | notification 390, application 390, admit_card 385, result 385, syllabus 293, answer_key 260, cutoff 223, counselling 9 | **NONE** | R0 stops writes; drop in R4 only in the same release that removes the dead `FE examService.ts:210-220` mapRow SELECT (else the SELECT errors). Presence rule already owns all gating. |
| 2 | `exam_editions.notification_date` | **201** editions; only **39** also have a `type:"notification"` important_dates row | **NONE** (exams) | **Migration MANDATORY before drop** — ~162 editions hold the date ONLY in this column. Copy into the row first (R4), then drop. |
| 3 | `exam_editions.faqs` | **12** editions; **8** identical to `exams.faqs` → **4 diverge** | **NONE** (shadow) | R0.8 stops the shadow write; rescue the 4 divergent rows before drop. |
| 4 | `exam_editions.age_limit` / `result_summary` / `counselling_data` | **0 / 0 / 0** | **NONE** | Empty AND unread → safe to drop in R4 with no migration. |
| 4b | `exam_editions.vacancy` | 198 | LIVE (`examService.ts:152`) | **NOT a retire candidate** — keep (frontend reads it). |
| 5 | `content_modules->newsSeo` | **2** | **NONE** | R0.1 removes UI + stops writes; strip key opportunistically. |
| 5b | `_config.modes` | **7** | **NONE** | R0.2 removes UI; strip opportunistically. |
| 5c | `_config.moduleOrder` | **279** | **LIVE** (`EntityDetailPage.tsx:704-707` — ContentModulesBlock builds the main-page render list from it; a slug missing here is HIDDEN) | **KEEP + STRENGTHEN** — R0.3 keeps writing it and appends the slug on enable AND on save-with-content, so no content-bearing module can silently disappear from the page. |
| 5d | `_config.enabledModules` | 279 | **LIVE** (`sectionRegistry.ts:242-247`) | **KEEP** — this is the one `_config` key honoured, backing "Hide on site". |
| 6 | `exam_editions.status` | upcoming 381, result-declared 9, completed 7, registration-open 2; **0** cancelled/postponed | PARTIAL (only cancelled/postponed honoured) | Today the stored column is 100% decoration (derived view wins). No enum CHECK; keep column, drop the removed manual UI only. |
| 7 | `/exams` editor (1,067 lines), `/entities` workspace (`entity`=3 rows, near-empty), `GovtExamEditorPage` wrapper, dead in-file tabs | — | **NONE** (frontend never reads `entity`) | R4 delete after owner confirms. |

## 8. Wireframe

`docs/design/editor-refactor-wireframe.html` — static HTML mock at 1366×768 (open in a browser; fixed-size viewport, no app code). Shows: header (year switcher, Draft chip, Verified chip, Preview, Publish), the section rail with the model-driven block expanded for the "written exam → merit list" answer, Key dates with per-row state, and the Update-from-notice review card with source quotes.

---

*Prepared for owner review. Awaiting `GO R0`. Nothing in this session changed app code; artifacts are this doc + the wireframe + the read-only SQL file (executed 2026-10-03, results in §7).*
