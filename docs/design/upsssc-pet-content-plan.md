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

## Recommended order

1. Step 5 (Last-Updated honesty) — S, immediate trust + SEO (a stale/meaningless
   "Last Updated" hurts E-E-A-T and freshness signals).
2. Step 2 (HTML-paste link recovery + relative→note surfacing) — M.
3. Step 3 (D-P2 Updates authoring) — M, no migration.
4. Step 1 (steps[] AI slot; needs the ai-fill redeploy) — M.
5. Step 4 (D-P3 frontend render) — L, turns 1–3 into the reader-facing page.
6. Step 6 (verification filter) alongside, so the newly-rendered content is the
   verified subset first.

Steps 5, 2, 3 need **no migration and no AI redeploy**; only step 1 touches the
Edge Function. Steps 4/6 make the wins visible and trustworthy.

## Decisions needed from the owner (do not build until answered)

1. **D-P2/D-P3 before R2.3** — confirm pulling Updates + frontend render ahead of
   the R2.3 drawer work (this plan's recommendation).
2. **"Last Updated" semantics** — which timestamp is authoritative: edition
   `updated_at` only, or newest of edition/content_post/verified? And should the
   import stop bumping `exams.updated_at` for all 356 (fix at the source)?
3. **`steps[]` schema** — put how-to-download steps on `admit-card` and general
   steps on `application-process` (my proposal), or one shared `steps` shape?
4. **Apply/Download gating** — attest-URL only (my rule) or allow a labelled
   no-URL button that links to the official site home? (Recommend attest-only.)
5. **Status engine** — approve or defer the `supabase/proposed/…` changes (audit
   Part 3): the "completed vs dates-awaited" rule and counting `exam_physical` as
   a window. This is a live-view change; it needs the read-only old-vs-new
   simulation before any apply.
6. **Verification priority** — start the 268-record verification at
   govt-vacancy + government-exam (194 of the 268), and is the S3.2 verify control
   in this push or a later one?

**STOP here for Part 4 — no code written for any of the above.**
