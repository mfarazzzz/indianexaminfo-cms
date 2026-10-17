# UPSSSC PET — content plan: make our page beat the aggregator (Option D)

Status: **PLAN ONLY. Nothing here is built this turn.** Read-only counts are from
2026-10-17 (project `cwbhhcqsrbuoybeaondk`). Companion to
`docs/design/upsssc-pet-audit.md` (the audit) and the Part-1/Part-2 fixes already
committed. Part 1 (frontend `exams.status` nav bug + duplicate "About This Exam")
and Part 2 (CMS duplicate guard) are DONE in code; the status-engine change is a
proposal only (`supabase/proposed/20261017_…_PROPOSAL.sql`, not applied).

## Where this sits vs the R2 track

The audit's reader/SEO gap is **content depth and freshness**, not the R2 shell.
**Recommendation: pull Option D phases D-P2 (CMS Updates authored as
`content_posts`) and D-P3 (frontend render + feeds) ahead of R2.3.** R2.3 (the
editable review drawer inside the shell) improves authoring ergonomics but adds no
reader-facing section; the PET page loses to the aggregator on sections, not on
editor comfort. Atomic-create is **not** a prerequisite (create is guarded and
draft-on-create; the owner's failure was a benign duplicate — see audit A).

## The gaps this plan closes (from the audit F/G tables)

Reader-facing things the aggregator shows and we do not: dated admit-card /
exam-city / multi-day revised exam rows; a how-to-download step list; candidate
carry-documents instructions; an important-links table with working URLs; a
per-notice Updates timeline; and a status that tracks the real calendar. We already
win on the honest unverified notice, structured eligibility/fee tables, related
exams, breadcrumbs and JSON-LD — the goal is to add the missing depth without
copying their prose (S2.14g: facts only).

## Sequenced build (each item: repo · migration? · AI-template? · size · order)

Order is dependency-driven; earlier steps unblock later renders.

**1. Notice `steps[]` slot (how-to-download + carry-documents) — order 4**
- What: add `steps[] {title, description}` and `candidateInstructions` to the
  `NOTICE_EXTRACT_V1` output; route them to the `admit-card` module (and the
  application/how-to steps to `application-process`) on Apply.
- Same no-invention rule as every field: text only from a verbatim source line; a
  step with no source is dropped, never synthesised.
- Repo: **CMS** `supabase/functions/ai-fill/templates.ts` (schema + validateAnswer)
  + client `src/lib/ai/noticePipeline.ts` (tolerant `steps`/`candidateInstructions`,
  absent→unchanged so goldens stay byte-identical) + drawer. **AI template change:
  YES → needs an ai-fill redeploy.** Migration: none. Size: **M**.

**2. Recover link URLs from an HTML paste; show relative lines as notes — order 2**
- What: the paste box reads `clipboardData.getData('text/html')`, parses `<a>`
  (label↔href) into `sourceLinks`; the pipeline already attests `important_links`
  URLs against them (`parseImportantLinks`, `noticePipeline.ts:339-368`). Plain
  text stays label-only (URL-less links dropped, never invented). Relative lines
  ("answer key: after exam") already land in `notes[]` — surface them in the drawer
  and (step 5) on the page.
- Repo: **CMS** editor paste + drawer (attestation path exists). AI template: none
  (schema already has `important_links`/`notes`). Migration: none. Size: **M**
  (paste+drawer); the page render of links/notes is part of step 5.

**3. CMS Updates = `content_posts` (D-P2) + "create update from a notice" — order 3**
- What: the drawer can create a dated `content_post` (update) from the notice,
  linked to the exam+edition (`exam_id`, `content_type`, `quick_links`,
  `attachment_urls`, `kind`, `display_order`, withdraw). This is the per-notice
  Updates timeline the aggregator has and we currently have no authoring UI for.
- Repo: **CMS**. Migration: **none** — D-P1 already applied (`20261013125113` added
  the update columns); `content_posts` exists (PET has 0 rows today). Size: **M**.

**4. Frontend renders the depth (D-P3) — order 5**
- What: on the exam page render, in reader order — (a) quick-info box (conducting
  body, official site, mode, frequency, vacancy); (b) important-dates table with
  **multi-day exams as separate rows** (the pipeline already emits 3 rows for
  25/30 Oct/1 Nov — audit E Case A); (c) important-links table; (d) admit-card
  how-to steps + candidate instructions; (e) a per-notice **Updates timeline**
  (content_posts) with the **Verified badge only when `is_verified` is true**;
  (f) FAQ; (g) an Apply/Download button **only when a URL is attested** (never for
  a label with no source URL).
- Repo: **frontend** (`components/exam/EntityDetailPage.tsx`, `sectionRenderers.tsx`,
  `contentModulesVisibility.ts` already owns what shows where). Migration: none.
  Size: **L**. (Part-1 already fixed the nav and the double "About This Exam".)

**5. "Last Updated" honesty + the verification backlog — order 1 (cheap, high trust)**
- Problem: the page shows "Last Updated: 25 Sept 2026" but that is
  `exams.updated_at` set by a **bulk touch on 25 Sep covering 356 of 398 exams** —
  it is not an edit of this record, so it is meaningless and often misleading.
- Proposed rule (frontend + a small CMS signal): show the **newest real content
  change** for the record — edition `updated_at` / a content_post's `updated_at` /
  `verified_at` when verified — not the whole-table `exams.updated_at`. If no real
  change is known, show "Compiled <create year>; last checked <verified_at or none>"
  and lean on the existing honest unverified notice.
- Repo: **frontend** (pick the timestamp) + optional **CMS** (stop bulk-touching
  `exams.updated_at` on import; stamp editions/posts instead). Migration: none for
  the read path. Size: **S**.
- Related content risk it exposes: **268 current editions are system-seeded AND
  unverified** (per pillar below). The owner has already decided unverified pages
  **stay published with the honest notice — no unpublishing.** So the action is a
  **verification workflow**, not hiding.

**6. Verification-workflow input (read-only counts, for a CMS "needs verification" filter)**

| pillar | current editions | system-seeded | system-seeded AND unverified |
|---|---|---|---|
| govt-vacancy | 100 | 98 | **98** |
| government-exam | 105 | 96 | **96** |
| board-exam | 38 | 37 | **37** |
| university-exam | 27 | 27 | **27** |
| entrance-exam | 128 | 10 | **10** |
| **total** | **398** | **268** | **268** |

- What to build: a CMS list/filter "system-seeded & unverified" (the 268) so
  editors verify top-of-funnel records first (UPSSSC PET is one). Pairs with the
  S3.2 verify control (writes `exams.is_verified/verified_at/verified_by`) —
  locked decision §7.1. Repo: **CMS**. Migration: none (columns exist). Size: **S/M**.

## Owner decisions (recorded 17 Oct 2026)

- **D1** — pull D-P2 (CMS Updates) AND D-P3 (frontend render) AHEAD of R2.3.
- **D2 — "Last Updated" trust rule.** Show the line only from a trustworthy source,
  the newest of: an edition `updated_at` whose `updated_by` is a HUMAN (not
  `system`); a published `content_post`; `is_verified` / `verified_at`. A system or
  bulk touch never counts. **If no trustworthy source exists, omit the line — we do
  not show a false date.**
- **D3 — `steps[]`.** how-to-download steps on `admit-card`; general steps on
  `application-process`.
- **D4 — Apply/Download buttons** render only with an attested (source) URL, never
  invented.
- **D5 — status engine.** Apply CHANGE 2 (count `exam_physical` as an exam window →
  `result-awaited`) and CHANGE 3 (label fallback: PET/Prelims/Written/CBT →
  `exam_written`) FIRST; CHANGE 1 (all-past confirmed → `completed`) ONLY after the
  owner reviews the 31-row table. An all-past EXAM reads `result-awaited`; `completed`
  is the last catch-all.
- **D6 — verification.** Start with govt-vacancy + government-exam (194 current
  editions), ordered by upcoming dates / traffic, and ship the S3.2 verify control.
  Unverified pages stay published with the honest notice — no unpublishing.

## Step 4 split

The old single "D-P3 frontend render" is split so the parts needing no new data ship
first:
- **4a — render EXISTING data (no new authoring):** quick-info box; important-dates
  table with **multi-day exams as separate rows**; important-links table with
  **attested URLs only**; FAQ; and the honest Last Updated (D2).
- **4b — needs new data (after D-P2 + steps[]):** the how-to-download steps and the
  per-notice Updates timeline.

## New build order (decided)

1. **Last-Updated honesty + the bulk-touch investigation** — find what stamped
   356/398 `exams.updated_at` on 25 Sep; fix at the source if it is code. (D2)
2. **4a** frontend render of existing data (quick-info, dates incl. multi-day rows,
   links attested-only, FAQ, honest Last Updated).
3. **HTML-paste link recovery + relative→notes** (paste box + drawer).
4. **D-P2** CMS Updates (`content_posts`) + create-update-from-notice.
5. **steps[]** slot (ai-fill template change → **redeploy**).
6. **4b** how-to steps + Updates timeline render.
7. **Verification filter** — start the 194 govt-vacancy + government-exam records;
   ship the S3.2 verify control.

Items 1–4 and 7 need **no migration and no AI redeploy**; only item 5 touches the
ai-fill Edge Function.

**STOP — Part C is docs-only. PART 4 decisions are now recorded; nothing here is
built without the agreed sequence above.**
