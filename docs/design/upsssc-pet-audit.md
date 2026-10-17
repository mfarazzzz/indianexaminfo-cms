# UPSSSC PET end-to-end audit (read-only) — 17 Oct 2026

Status: **READ-ONLY audit. No code change, no migration, no deploy, no push, no row
written.** The UPSSSC PET record was treated as evidence only (never edited,
unpublished or deleted). All facts below are quoted from live read-only SQL, the
unified log stream, `file:line`, and one offline pipeline run.

Project id `cwbhhcqsrbuoybeaondk`. Record under audit:
`exams.id = d49d7496-6cb8-4926-826f-b6eb04acae39`, slug `upsssc-pet`, current
edition `7caa9420-67d5-4171-8817-3db84074c8e5`.

---

## Headline correction (verified, not assumed)

The owner's corrected timeline said UPSSSC PET "did NOT exist before" and was
"created behind the scenes" by the failed Save. **The live data does not support
that.** Verbatim query results:

- The record's own `created_at` is **2026-07-09 20:40:44+00** (exam) and its
  edition `created_at` is **2026-07-30 11:12:22.074899+00**, `updated_at`
  **2026-09-02**. It predates today by months.
- `SELECT … FROM exams WHERE created_at >= '2026-10-17 00:00+00'` → **`[]`**
  (no exam created today).
- `SELECT … FROM exams WHERE updated_at >= '2026-10-17' UNION … exam_editions
  WHERE created_at/updated_at >= '2026-10-17' … name ILIKE '%Preliminary
  Eligibility Test (PET)%'` → **`[]`** (nothing touched today; the name typed
  today does not exist as a row).

So the failed Save created **no row**. The public page is the pre-existing
9-July record. What the owner actually saw was the **duplicate-slug guard** (the
slug was already taken), plus a **separate, still-present frontend bug** that
spams the Postgres logs in that same window (see A2 / A5). Everything else the
owner attributes to "today" was already on the record since July/September.

---

## A. The failed create

### A1 — the exact error on Save
`createEntranceExam` checks **slug** uniqueness only, and throws a structured
`DUPLICATE_SLUG`:
- [`entranceExamService.ts:372-392`] slug check `.select("id, name,
  workflow_status").eq("slug", slug)`; on a hit it throws
  `DUPLICATE_SLUG::<id>::<name>::<status>` with `code='DUPLICATE_SLUG'`.
- [`EntranceExamEditorPage.tsx:608-615`] renders the toast the owner quoted,
  verbatim: `` `An exam with this name already exists: ${existName}
  (${statusLabel}).` `` — `existName` = the existing record's **name**
  "UPSSSC PET (Preliminary Eligibility Test)", `statusLabel` = "Published".

The typed Short Name "UPSSSC PET" → `generateSlug` (`entranceExamService.ts:369`,
`:1001-1011`) → slug `upsssc-pet`, which the existing July record already owns →
collision. The first attempt hit the same guard (the owner summarised it as "an
ERROR"); both attempts aborted at the slug check, **before any insert** — which is
exactly why no row exists today.

### A2 — the two `column exams.status does not exist` log lines
`postgres_logs` in the owner's window contains exactly two matching errors:
```
2026-10-17T08:27:35Z  column exams.status does not exist
2026-10-17T08:35:29Z  column exams.status does not exist
```
(08:27/08:35 UTC = 13:57/14:05 IST — the two attempts.) These are **not** from the
CMS create. `exams.status` was dropped in step 4; current CMS code no longer
names it. The source is the **public frontend nav**, which still selects the
dropped column:
- [`navigationService.ts:155`] `getExamsForCategory` →
  `.select("id, slug, short_name, name, is_featured, status, category_id, pillar, …")`
- [`navigationService.ts:202`] `searchExamsInPillar` → same `… status …`

Both then `if (error) throw error` → caught at `:183` / `:211` →
**`return []`**. Net effect: the mega-menu category exam lists and the in-pillar
search are **silently empty in current code**, and every call logs a 42703. This
is a real, present defect (not a stale-deploy artifact). The exam detail/list
services are clean: [`examService.ts:75-90`] reads status from the
`exam_derived_status` VIEW, `LIST_SELECT`/`DETAIL_SELECT` use `*`, and
`getExamsByStatus` fetch-then-filters (`:712`) — so the PET page itself renders.

### A3 — the write sequence, and whether the create is atomic
Current create path (`EntranceExamEditorPage.tsx:439-502`), in order:
1. `createEntranceExam` (`entranceExamService.ts:348`):
   a. throws if entrance-exam with no category (`:361`) or no selection model (`:364`);
   b. slug-check SELECT (`:372`) — **this is where the owner's attempts died**;
   c. INSERT `exams` with `workflow_status:"draft"` (`:396-425`);
   d. INSERT `exam_editions` (status `upcoming`, seeded `_config`) (`:450-462`);
   e. on (d) failure, a **compensating DELETE** of the exam (`:465`), and if that
      also fails it says "needs manual repair" (`:468`).
2. `updateExamIdentity` (SEO/FAQs/tags) — `entranceExamService.ts:543`.
3. `updateEdition` (dates/eligibility/fee/modules) — `:483`.
4. `revalidateExams()` fire-and-forget — `:474`.

For the owner's attempts: **all writes that ran = the SELECT slug check; SUCCEEDED
inserts = none; FAILED = the guard threw.** No orphan, no partial. The create is
**non-atomic** (steps 1c + 1d are separate statements, then 2 and 3 are separate
round-trips), protected only by the best-effort compensating delete. A failure
between 1c and 1d, or a compensating-delete that also fails, can strand a
no-edition exam — the code itself acknowledges this (`:445-449`).

### A3b — the deleted atomic-create RPC (commit `10d9d2f`) — has the need returned?
`git show 10d9d2f` (verbatim message): it **removed** the proposed
`20261012120000_exam_atomic_create_first_cycle.sql` because that RPC declared
`SECURITY INVOKER`, so its internal `INSERT…RETURNING` on `exam_editions` would
have been filtered by the same SELECT policy that caused a **42501**, and could
not fix the real cause — a **missing `staff_read_all_exam_editions` policy**,
applied as migration **`20261012142358`**. The RPC was never applied.

Conclusion: that specific incident was an **RLS** problem, not an atomicity one,
and it is fixed. The *general* atomicity gap (two inserts + best-effort delete)
remains, so a single-transaction create RPC is still the clean durable fix — but
**it is NOT the cause of what happened today**, and it is **not the blocker** for
the PET page problem. The need is real-but-low; it did not "return" as an
emergency.

### A4 — why the record is published and publicly reachable
It is published because it has **always** been published since it was created in
July: `workflow_status="published"`, `is_published=true` (a DB trigger derives
`is_published` from `workflow_status`). It was **not** published by a failed save.

The create path cannot publish: `entranceExamService.ts:418` sets
`workflow_status:"draft"` for **every** pillar (owner decision R0.12). So even a
*successful* new create starts as a draft and is **not** publicly reachable until
an explicit Publish. Public reachability also needs a category (→ the URL); a
categoryless entrance-exam record is blocked at `:361`. The "a failed/incomplete
create must never leave a public page" invariant therefore already holds for the
create path; the PET page is public because it is an old, deliberately-published
record, not because a create half-succeeded.

### A5 — fix options (no code written this audit)
1. **Frontend nav (urgent, tiny):** drop the deleted `status` from the two
   `navigationService.ts:155/202` selects (source it from `exam_derived_status`
   like `examService` does). Restores mega-menu/search and stops the log spam.
2. **Create UX:** the duplicate guard is **slug-only**; a different Exam Name
   with a colliding slug is reported as "name already exists", which reads as
   unrelated to what the owner typed. Consider checking name/short-name too, and
   wording the toast with the *typed* value plus the existing slug.
3. **Atomicity (optional):** a `SECURITY DEFINER` single-transaction create RPC
   (exam + edition + first identity write), or keep the compensating delete but
   also cover the post-create `updateExamIdentity`/`updateEdition` steps. Low
   priority; not the cause here.

---

## B. Provenance of the displayed values — top priority (facts, not invented)

Every value the page shows is a **stored column on this record**, not a frontend
fallback, and not produced by the extraction pipeline or the owner's paste:

| Shown value | Where it lives (verbatim from SQL) | Written by / when |
|---|---|---|
| PET Exam **6 Oct 2026** | `exam_editions.important_dates` = `[{date:2026-10-06,type:exam_physical,label:"PET Exam",state:confirmed}]` + `notification_date=2026-10-06` | edition `created_at 2026-07-30 11:12:22.074899+00` |
| **18–40 years / 10th-12th-Graduate (varies) / Indian citizen** | `exam_editions.eligibility = {age,nationality,qualification}` and `content_modules.eligibility.details` | same 30-Jul write, `_meta.updatedBy = "system"` |
| Fee **General ₹185 / SC ₹95** | `exam_editions.application_fee = {sc:95, general:185}` | same 30-Jul write |
| **PET (Qualifying) → Main Recruitment Exam** | `exams.selection_process = ["PET (Qualifying)","Main Recruitment Exam"]` | 30-Jul / earlier identity seed |
| **"gateway for Group C posts in UP"** (About This Exam) | `content_modules.overview.description` and `exams.seo_description` (identical) | `_meta.updatedBy = "system"`, 30-Jul |
| **Last Updated 25 Sept 2026** | `exams.updated_at = 2026-09-25 16:13:29.073181+00` (frontend falls back to `updated_at`) | a **bulk touch**: 356 of 398 exams share a 25-Sept 15:00–18:00 `updated_at` |

Evidence that this is a **bulk machine seed**, not an editor action: all four
modules carry the *identical* `_meta.updatedAt = 2026-07-30 11:12:22.074899+00`
with `updatedBy:"system"`. Interactive autosave (`useModuleAutosave.ts:59`,
`ModulePanel.tsx:249`) stamps a *distinct* per-edit time and the real user id;
identical microsecond timestamps across modules means a script/import wrote them.
`content_source="manual"` and `is_verified=false`.

This is **not new**: it is the documented cohort of unverified machine-seeded
facts —
- `LAUNCH_READINESS.md:50-51`: "**AI-seeded eligibility (`updatedBy=system`,
  nested `{details}` shape) — 193** … ~48% of exams have eligibility no human
  verified … plausible-looking, exam-specific values that nobody checked against
  the official notification. Looks trustworthy, isn't."
- `LAUNCH_READINESS.md:49`: "status but ALL dates in the past — 202 … a visible
  contradiction."
- `CONSISTENCY_AUDIT.md:186`: the nested `{details:{…}}` eligibility is "seeded by
  `updatedBy:"system"`".

So the "never invent facts" rule was violated **upstream, in July, by a bulk
seed that wrote plausible fee/age/qualification/date values with no human
verification and no source quote**, and those values have been rendering ever
since. The honest page does flag it ("Not yet verified by our editors",
`UNVERIFIED_EXAM_NOTICE` in [`detailView.ts:24-26`]), which is the only reason a
reader can tell these are unconfirmed. I did **not** find a code path that
fabricates these at render time — the strings ("18-40", "(varies)", "gateway for
Group C") appear only in the DB, not in code (grep across both repos returned
them only in the audit `.md` docs, none in `.ts`/`.tsx`). What I could not
determine from the retained logs: the **identity of the 30-Jul seed job** (the
log retention does not reach July) — stated as unverified rather than guessed.

**Action implication:** this record is exactly the "verify or purge seeded
placeholders" class. It must be verified against the official UPSSSC notification
(or the placeholder facts removed) before it can be trusted; that is a content
task, not a code task.

---

## C. Record, pillar, and why it is under /sarkari-naukri/

Live values: `pillar = government-exam`, `entity_type = recruitment`,
`category = "State Government Jobs"` (slug `state-government-jobs`),
`selection_model = written-exam`, `workflow_status = published`, `is_published =
true`, `is_verified = false`, `region = uttar-pradesh`, edition year 2026.

- It is **not** an entrance-exam record. It was created (July) as a
  **government-exam** record. The owner's *attempt* used the "New Entrance Exam"
  form, but that attempt created nothing (A1), so it never produced an
  entrance-exam PET page. The page the owner is looking at is the old
  government-exam record.
- Route `/sarkari-naukri/state-government-jobs/upsssc-pet` is the **government-
  exam** pillar's public home (group `sarkari-naukri`) + the category slug
  `state-government-jobs`. So the URL is correct for a government-exam record;
  it only looks wrong because the owner expected it under Entrance Exams.
- Which sidebar shows it: **Govt Exams** (the `government-exam` list), filtered to
  category "State Government Jobs". Not Entrance Exams, not Govt Vacancy Exams,
  not Vacancy Pages. (Public nav aside — those lists are currently empty because
  of the A2 nav bug; the CMS list itself queries by `pillar` and does show it.)
- Is it wrong that a recruitment eligibility test (PET) can be created from the
  Entrance Exams form? PET genuinely straddles both (it is a state-recruitment
  prelim, i.e. a government-exam, not a university/entrance exam). Today **nothing
  at the form stops a wrong-pillar create**: the pillar is fixed by *which* "New"
  form/sidebar the editor opens (`pillarFromUrl` → the editor's pillar), and the
  only cross-pillar guard is the **global slug uniqueness** (that is what fired).
  There is no rule tying an exam's nature to its pillar; a mis-pillared record
  simply lands under the wrong public group and the wrong sidebar.

---

## D. Stale / contradictory display ("Dates Awaited" + a past 6 Oct date + Last Updated 25 Sept)

Verified from the `exam_derived_status` VIEW (`pg_get_viewdef` read in full) and
the live `postgres` row:

- The row for this exam today: `derived_status = "dates-awaited"`,
  `has_confirmed_dates = true`, but `exam_start_date = exam_end_date =
  next_confirmed_date = null`.
- Why null: the VIEW computes the exam window only from
  `date_type = ANY(ARRAY['exam_written','exam_practical'])`. This record's single
  date row is `type = "exam_physical"` → **not counted as an exam window**, so
  `exam_start_confirmed`/`exam_end_confirmed` stay null. Independently, the 6 Oct
  date is **in the past** (today 17 Oct), so `next_confirmed_date`
  (`min confirmed date >= today_ist`) is null too. With no window date and no
  future confirmed date, the CASE falls through to `dates-awaited`.
- **Also a latent mis-typing:** the VIEW's label fallback maps `'% pet %'` (and
  '%rally%', '%physical test%') → `exam_physical`. For UPSSSC "PET" (Preliminary
  **Eligibility Test** — a written prelim), `exam_physical` is semantically wrong;
  it should be `exam_written`. The seed hard-set `type:"exam_physical"`, so it was
  never a written exam in the engine's eyes.
- **"Last Updated 25 Sept"** = `exams.updated_at` (the 356/398 bulk touch), read by
  the frontend as `exam.lastUpdated` (falls back to `updated_at`;
  [`EntityDetailPage.tsx:436,587`]). It is a whole-table stamp, not this record's
  edit, so it is effectively meaningless today.
- **Contradiction ("Dates Awaited" yet shows 6 Oct past):** the page renders the
  raw `important_dates` list ("PET Exam: 6 Oct 2026") *and* the derived chip
  ("Dates Awaited") side by side. Both are true of the stored data; the visible
  oddity is the **stale past date being presented as current** plus an
  un-annotated status.

Verdict: this is a **data problem first** (a past, mis-typed `exam_physical` date
seeded in July) surfaced by **presentation** (raw list + derived chip, no
past-date handling), and a **meaningless Last-Updated** from a bulk touch. It is
**not** a cache/ISR bug — the rendered values match the live DB and the live VIEW
(`today_ist = 2026-10-17`). No revalidate defect found.

Secondary render bug observed on the live page (fetched HTML): **"About This Exam"
appears twice** (top and again lower). Likely the overview module rendered via
both `sectionRenderers.tsx:260` and `EntityDetailPage` `MODULE_LABELS`
(`:676 overview → "About This Exam"`). Flagged for a frontend fix; not confirmed
against a controlled local render in this read-only pass.

---

## E. The test notice through the real S2 pipeline — OFFLINE (AI step NOT run)

Method: I fed **synthetic raw model answers** (representing what a well-behaved
and a careless extraction would emit for the UPSSSC admit-card notice) through the
real deterministic stage `runNoticePipeline → postProcessExtraction`
[`noticePipeline.ts:397-583`], the same entry the goldens use. **No live provider
was called.** A temporary harness was used and deleted; the repo tree is clean.
Because the AI text→JSON step was not run, these results prove what **our code**
does with a given answer — not whether the model would produce that answer.

Case A — plain-text paste (link labels only, no URLs), well-behaved answer:
- Dates kept (confirmed, correct ISO): Admit Card **2026-10-17** (type
  `admit_card`); Exam City **2026-10-12** (kind `exam_city` → **type `other`**);
  **three** exam rows 2026-10-25, 2026-10-30, 2026-11-01 (type `exam_written`).
- Answer Key "after exam" → **rejected as a dated row** ("no parseable date in
  the text the model gave") **and preserved as a `note`**. ✔ (iii)
- `important_links` with empty URLs → **dropped entirely** (no `importantLinks`
  in the output). ✔ (v) URLs are never invented.
- **Multi-day exam → three separate rows**, not a range. ✔ (ii) The pipeline does
  not collapse same-section exam days into a start→end window; `pairWindowRows`
  only pairs start/end windows, not parallel single days.
- **Chrome noise:** not present in this synthetic input, so not demonstrated here;
  ignoring aggregator chrome is a **prompt-level** (S2.14d) concern, not something
  postProcess adds or removes. ✔(iv) only in the sense that postProcess never
  *invents* rows for text it was not given.

Case B — HTML paste where the six links carry clearly-marked TEST URLs and those
URLs are in the pasted text (simulating an anchor-bearing paste, `sourceLinks`
attesting them):
- All six links **kept with their URLs** (attested), e.g.
  `Download Admit Card → https://upsssc.gov.in/admit-card`. This is the only path
  that recovers link URLs, and it depends on the paste carrying `href`s
  (`postProcessExtraction` `:405-407` `sourceLinks`; `parseImportantLinks`
  `:339-368`). A plain-text paste cannot.

Case C — a **careless** extraction that copies BOTH the stale header
("23, 24 & 25 Oct") AND the revised dates:
- The stale **2026-10-23 and 2026-10-24 rows SURVIVE** as confirmed
  `exam_written` rows alongside the revised 25/30/1. **postProcess cannot tell a
  stale header from a revised notice** — it has no notion of "superseded by a
  later date". ✔(i) the "must not become dates" requirement is therefore an
  **AI/prompt + editor-review responsibility**, not a deterministic guarantee.
  The review drawer is where a human (or a "latest wins by section" rule, not yet
  built) must reject the stale rows.

What the notice carries but the pipeline has **no slot for** and therefore drops:
the eight how-to-download steps and the carry-documents instructions (the
NOTICE_EXTRACT_V1 schema emits only `fields/dates/vacancy/important_links/notes`
— confirmed in `templates.ts:119-142`). Those live in per-module editors, not the
notice extraction.

---

## F. Field-by-field gap table

Legend — CMS: the field/section exists in the model + editor today; AI: the
notice extraction (`NOTICE_EXTRACT_V1`) or a module-AI fill can populate it; FE:
the public page renders it. OK / CMS gap / AI gap / FRONTEND gap.

| Fact / section (aggregator) | Lives in our model | CMS? | AI? | FE renders today? | Verdict |
|---|---|---|---|---|---|
| Conducting body | `exams.conducting_body` | yes | yes (field) | yes "Conducted by" | OK |
| Official website | `exams.official_website` | yes | yes | yes | OK |
| Quick-info (mode, frequency) | `content_modules.overview` + `exams.cycle_frequency` | yes | module-AI | yes (About) | OK |
| Status chip (notified/…/result) | derived `exam_derived_status` | n/a (view) | — | yes | OK mechanism; D mis-typing |
| Important dates **single** | `exam_editions.important_dates` | yes | yes (dates) | yes | OK |
| **Multi-day exam (25/30 Oct, 1 Nov)** | 3× `important_dates` (`exam_written`) | yes | yes (3 rows) | yes, but as a list not "25–1 Nov range" | CMS/AI OK; FE: no range display |
| **Admit-card release date** | `important_dates` type `admit_card` | yes | yes | yes if present (PET: none) | OK |
| **Exam-city release** | `important_dates` (`exam_city`) | yes | yes, but `type→other` | shows in list; not a status date | CMS/AI nuance (city→other) |
| **Revised-date notice (supersedes stale)** | needs a supersede link on the row | partial (`dateRowMerge` extension) | AI must not emit stale (prompt) | n/a | **AI gap** (E Case C proves FE/postProcess can't) |
| Relative "after exam" (answer key) | `notes[]` | yes (pipeline) | yes (notes) | **no public notes surface** | **FRONTEND gap** |
| **How-to-download steps (8)** | `content_modules.admit-card.downloadInstructions` / `application-process.howToApply` | field exists | **notice AI does not emit steps** | not rendered for PET | **AI gap + FRONTEND gap** |
| Carry printout / valid ID / photographs | `admit-card.importantInstructions` / `itemsToCarry` | field exists | module-AI only | not rendered | **AI gap + FRONTEND gap** |
| **Important links table (6)** | `content_modules.important-links.links` (+ `content_posts.quick_links`) | yes (module) | AI emits label, **drops URL-less**; recovers URL only via HTML paste | page shows only 2 links today | **AI gap** (URL recovery not built) + **FRONTEND gap** |
| Eligibility (age/qual/nat) | `exam_editions.eligibility` (+`age_limit`) | yes | module-AI | yes (table) | OK (but unverified seed, B) |
| Application fee (per category) | `exam_editions.application_fee` | yes | module-AI | yes (table) | OK (unverified seed) |
| Selection process | `exams.selection_process[]` | yes | module-AI / identity | yes | OK (unverified seed) |
| Vacancy total | `exam_editions.vacancy` | yes | yes (`vacancy.total`) | yes (related cards) | OK |
| **Per-notice Updates timeline** | `content_posts` (D-P2) | **not built in CMS UI yet** | — | **not rendered** (0 posts) | **CMS gap (D-P2) + FRONTEND gap (D-P3)** |
| Exam pattern / syllabus / result / cutoff / answer key | their `content_modules` + edition cols | yes | module-AI | render if present (PET: empty) | OK |
| FAQ | `exams.faqs` / `content_modules.faqs` | yes | module-AI | yes if present (PET: none) | OK |
| Verified badge / unverified notice | `exams.is_verified` | yes (S3.2 pending verify control) | — | yes ("Not yet verified…") | OK (a strength) |

---

## G. Public page vs the aggregator — plain words

**Aggregator (UPSSSC admit-card page) has, ours lacks:**
- Dated admit-card timeline: "admit card out 17 Oct", "exam city out 12 Oct", and
  **three concrete revised exam days**. Ours shows one stale 6 Oct date and no
  admit-card/exam-city rows (the notice was never applied to this record).
- A **contradiction-proof** dates block: they show revised dates prominently.
  Ours would, if fed, but the reviewer must reject the stale header (E Case C).
- The **8-step "how to download" guide** and **candidate instructions** (carry a
  printout, valid ID, photographs). We have fields for these but the notice AI
  does not extract them and the page does not render them.
- A **links table** (6 links) with working URLs. Ours shows only "Official
  Website" + channel CTAs; link URLs need an HTML paste we don't build yet.
- A **"status: exam date out"** headline that tracks the real calendar. Ours
  derived "Dates Awaited" from a past, mis-typed date.

**Ours has, the aggregator lacks (real strengths to keep and lean on):**
- An **honest verification line** ("Compiled from the official notification. Not
  yet verified by our editors. Always confirm on the official website before you
  apply or pay.") — the aggregator never says this.
- **Structured, per-category eligibility and fee tables** (not prose), and a
  numbered **selection process** — machine-readable, good for featured snippets.
- **Related exams** with live derived status + vacancy counts (UPPSC/UP Police/
  Rajasthan/MP, each "result awaited · <vacancies> · <date>") — internal linking
  and topical authority the aggregator doesn't offer.
- **Breadcrumbs + canonical structure**, a stable URL, and JSON-LD (FAQ/`
  structured-data.ts`) for SEO.
- The data model can hold **everything** the aggregator shows plus more (updates
  timeline, resources) once filled and verified.

Guardrail honored: this compares **structure and facts**, not their prose. Their
descriptive text is not ours to republish (S2.14g); we beat them on freshness,
verification, and structured facts, not on copied wording.

---

## H. Proposal (no code) — smallest sequence to make the PET page better, in order

Ordered by reader+SEO impact per unit of effort. Each tagged by repo and size.

1. **Frontend (S) — fix `navigationService.ts:155/202`** to stop selecting the
   dropped `exams.status` (use the `exam_derived_status` VIEW like `examService`).
   Restores mega-menu category lists + in-pillar search (currently silently empty)
   and stops the 42703 log spam. Zero migration. This is independent of PET but
   touches every page. **Do first.**
2. **Frontend (S) — past-date + Last-Updated honesty.** Do not show a
   "Dates Awaited" chip beside a past date as if current; when the newest
   confirmed date is in the past, render "Exam held on <date>" / route to a
   Result-awaiting state, and hide the whole-table bulk "Last Updated" when it is
   a synthetic bulk touch (or use the edition's own latest real date). Fixes the
   visible contradiction in G/D.
3. **CMS (S) — apply the notice to the real record.** The PET page is poor mostly
   because **the notice was never applied** (it's a 30-Jul placeholder seed). Use
   Update-from-a-notice (already built) to put the admit-card 17 Oct, exam-city
   12 Oct and revised exam days 25/30 Oct–1 Nov into `important_dates` with the
   correct `exam_written` type, and **reject the stale header rows** at review
   (E Case C). This is a content action; no code. Also **verify** the seeded
   fee/age/qualification against the official notification (B).
4. **AI template (S) + paste (M) — recover the links and the steps.**
   - 4a. Make the paste **HTML-aware** so the six link labels keep their URLs
     (E Case B) — the attestation path exists (`sourceLinks`); the paste box must
     carry `href`s (S2.14b). Frontend+CMS, size M.
   - 4b. Add a `steps[]` / `instructions` slot to the notice schema so the
     how-to-download steps and carry-documents instructions are captured into
     the `admit-card` module (AI template change + a small `templates.ts`/
     `validateAnswer` edit + the client post-process tolerance). AI template, S/M.
5. **Frontend (M) — render what we already store.** Show `notes` (relative
   answer-key line), the admit-card **how-to steps / candidate instructions**, and
   the `important-links` table on the public page. These are CMS-gap=none but
   FRONTEND-gap rows in F.
6. **Pull ahead Option D phases D-P2 (CMS Updates) and D-P3 (frontend render +
   feeds) — decision:** **Yes, pull them ahead of R2.3.** The PET reader/SEO gap
   is *content depth and freshness* (a per-notice Updates timeline, dated admit-
   card/city rows, a links table), not the R2 shell. D-P2 (updates authored as
   `content_posts` in the CMS) + D-P3 (render the Updates timeline + feeds, quick-
   links) directly close the biggest G/F gaps. R2.3 (editable review drawer inside
   the shell) improves *authoring ergonomics* but does not add reader-facing
   sections. Recommend ordering: **H1–H5 (this audit's cheap wins) → D-P2 → D-P3 →
   R2.3**, with S3.2 verify-control folded in at H3 so the honest "unverified"
   line can flip to a real verified badge after human check.
7. **Atomic-create: NOT a prerequisite.** Create is guarded and draft-on-create;
   the owner's failure was a benign duplicate. The `10d9d2f` incident was RLS
   (fixed via `20261012142358`). Do the atomicity RPC later, opportunistically,
   **before** we rely on multi-step create, not before fixing PET.

No migration is strictly required for 1–5,6 except D-P2/D-P3 which build on the
already-applied D-P1 (`20261013125113`). Live counts that bound the impact: 398
exams total; 356 share the meaningless 25-Sept bulk `updated_at`; 193 carry
unverified `system`-seeded eligibility (`LAUNCH_READINESS.md:50`).

---

## I. Housekeeping

### I1 — why the production CMS footer says "built with uncommitted changes" for 142db3f
- How the stamp is computed: at build time `vite.config.ts` `gitStamp()` runs, on
  the **build host**, `git rev-parse --short HEAD` (sha) and `git status
  --porcelain` (`sync`), classifying `clean/ahead/behind/dirty/unknown`
  ([`vite.config.ts:19-34`, `buildStampPlugin` `:64-89`]); the value is injected as
  `__BUILD_SHA__/__BUILD_SYNC__` and shown by `buildInfo.ts` (`:38 dirty → "built
  with uncommitted changes"`).
- Live read (this audit): the deployed CMS `<meta name="build">` content is
  **`142db3f dirty 2026-10-17T08:16:15.604Z`** — sha `142db3f`, sync **dirty**.
- The stamp itself is behaving correctly; "dirty" simply means the **build host's
  working tree had uncommitted changes** when `vite build` ran. It is *not* proof
  the code differs from a clean `142db3f` in any particular way, and it is *not*
  reliable as a "this is a released commit" signal — the flag can be triggered by
  build artifacts / generated files / local edits on the host, and a build can be
  `clean` yet stale relative to `origin/main`.
- The real problem it exposes: `deploy-cms.sh:17` builds by **`git pull origin
  main` on the VPS**, but `142db3f` is **unpushed** (`main…origin/main [ahead 5]`)
  — so a standard `git pull origin main` deploy could **not** have produced
  `142db3f`. The running artifact was therefore built from a working copy that
  already carried the unpushed commits **and** a dirty tree. Conclusion: the
  deployed bundle is **not reproducible from `origin/main`** and cannot be trusted
  to equal any clean commit. That is the honest reason the "which commit is
  deployed?" answer is unreliable here.
- Recommended guardrail (no code now): treat any non-`clean` stamp as "not a
  release"; build only from a pushed, clean `origin/main`; keep the `git status
  --porcelain` file list (the plugin already prints it, `vite.config.ts:74-76`) in
  the build log so the offending paths are inspectable.

### I2 — admincms1 "1 threat detected and cleaned" + "Vulnerabilities" warning
- **No Hostinger MCP is available in this session.** The only MCP servers
  configured are `supabase`, `browser-use`, `genui` (verified by listing the MCP
  directory). There is **no read-only Hostinger tool** to query deployment status,
  build info, or the malware/vulnerability scan results, so I could not read those
  panels. I made **no hosting changes** and did not log into the control panel.
- What I *could* read, read-only: the deployed CMS build meta (I1: `142db3f dirty
  …`) via `browser-use` on the public admin origin, and the live frontend page via
  HTTP (D/G). Both confirm the sites are up.
- The "1 threat cleaned" / "Vulnerabilities" notices are Hostinger-panel scan
  findings that need a scan surface I do not have here. To close this properly the
  owner (or a session with a Hostinger MCP) should read the hPanel Malware Scan +
  Vulnerabilities pages and the CMS Deployments log. **Flagged as unverified — not
  guessed.** (Note the same bulk-touch/seed and dirty-build themes above are the
  kind of thing a "vulnerabilities" scan sometimes reflects for a Node/PM2 VPS,
  but I have no data to assert that.)

---

## Reproducibility notes (read-only)
- SQL via Supabase MCP `execute_sql` (project `cwbhhcqsrbuoybeaondk`).
- Logs via `query_logs` window `2026-10-17T08:00–10:00Z` (sources: 533
  `edge_logs`, 92 `postgrest_logs` [only Warp system msgs], 2 `postgres_logs`
  [the two `exams.status` errors], 8 `auth_logs`, 4 `auth_audit_logs`).
- Build meta via `browser-use` `evaluate_script` on `admincms1.indianexaminfo.com`
  (redirects to `/login`; the `<meta name="build">` is in the served HTML).
- Offline pipeline: `runNoticePipeline` on synthetic raw answers; temp harness
  created and **deleted**, `git status --short` verified empty.

## What this audit changes vs R2.2
Nothing was built here (read-only). R2.2's five commits are untouched and the tree
is clean at `142db3f`. The PET findings feed a **separate** plan (H), and surface
two defects that likely outrank R2.3: the frontend `exams.status` nav bug (I/A2)
and the unverified bulk-seeded facts (B).
