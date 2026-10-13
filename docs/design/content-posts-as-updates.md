# Design note — Exam Updates as Content Posts (Option D), phases D-P2 → D-P4

Status: **D-P1 proposed only** (`supabase/proposed/20261013045209_content_posts_update_columns.sql`, NOT applied). Owner approved Option D: `content_posts` IS the exam update item; `kind` ∈ {provisional, final, revised, corrigendum, withdrawn}; no new `post_status` value; no `event_date` column.

## Ownership map (one owner per fact — nothing entered twice)
- **Lifecycle dates + status** → `exam_editions.important_dates` + `exam_derived_status`. Unchanged. A content_post never owns status/lifecycle.
- **Exam updates / announcements** (body, links, files, publish, pin, expiry, supersession) → **`content_posts`** (`exam_id`, nullable `exam_edition_id`, `content_type`, `quick_links`, `attachment_urls`, `important_dates` for the item's own display dates, plus the new `kind/supersedes_id/expires_at/display_order/verified_by`).
- **Document library** (previous papers, study material, browsable PDFs) → `exam_resources` (2 rows) — stays separate; a download lives in ONE place (subject of an update → the post's `attachment_urls`; browsable material → `exam_resources`).
- **`content_modules.news.items` (empty JSONB slot) + the News tab** → migrated into `content_posts` and retired (this IS backlog item **R4**, "exam news → Content posts").

## D-P2 — CMS "Updates" surface (writes exam-linked content_posts)
- Where: a section inside the **R2 editor shell** (the Workspace/section framework that `module_registry` + `EntranceExamEditorPage` already drive). Each relevant section (Admit Card, Answer Key, Result, Cut-off/Merit, Application, Other) gets an "Updates" list; add/edit/reorder/publish/unpublish/withdraw. Fields all optional; links/files as validated JSONB; a "Withdrawn" toggle = `kind='withdrawn'` (status stays published); full hide = `status='unpublished'`.
- **Dependency: D-P2 should WAIT for R2 (+ S3 dates/status)** — the Updates surface lives inside the R2 shell; building it against the pre-R2 editor would be thrown away.
  - *Reason that could justify starting earlier:* a thin interim is possible without R2 — `contentService.createContentPost` already writes `exam_id` + `content_type` + `quick_links`/`attachment_urls`, so an editor could hand-author exam-linked content_posts today with near-zero new UI. Recommend using that only as a stopgap if updates must go live before R2; do not build the polished tab twice.
- Gated by D-P1 (columns must exist to set `kind`/`supersedes_id`/`expires_at`/`display_order`).

## D-P3 — Public render + feeds (frontend repo, independent of R2)
- Exam page: exam-linked posts already render via `contentPostService.getContentPostsByExam` (`select "*" where exam_id, status='published'`) passed into `EntityDetailPage.renderOrderedSections`. Place each update inside the section its `content_type` maps to (`sectionRegistry.CONTENT_TYPE_TO_SECTION`); render `quick_links`/`attachment_urls` via the existing renderers/`AttachmentsSection`; show a **kind chip** (Provisional/Final/Revised/Corrigendum) and a **history block** for `kind='withdrawn'`/superseded chains.
- Homepage / hub feeds: extend `getLatestByContentType` (and the homepage `app/page.tsx` Promise.all) with `AND (expires_at IS NULL OR expires_at > now())` + `ORDER BY is_pinned DESC, display_order, published_at DESC` + **pinned cap 3 per section**. This is the query-level expiry filter (RLS stays time-free — see the migration note).
- "Latest updates" section = newest published content_posts across exams; Verified badge only when `is_verified` (never a gate — 0/397 verified).
- **Can proceed once D-P1 is applied**; does not depend on R2.

## D-P4 — Supersession, Social Queue, AI drafts, R4 cleanup
- Provisional→final / revised / corrigendum chains surfaced as an on-page history (`supersedes_id` chain; integrity kept by the proposed `content_posts_supersedes_same_exam` trigger).
- Social Queue: register `content_posts` as `source_type='content_post'`, `source_id=post.id` — a published post already carries title/excerpt/attachment/landing slug → the natural candidate.
- AI intern drafts: reuse the existing "AI Auto-Fill Content Post" path; drafts land as `status='draft'` content_posts (human approval gate).
- Retire `content_modules.news.items` + the News tab per R4 once content_posts updates are the live path; keep `exam_resources` as the library.

## Sequencing
`D-P1 (apply migration)` → `D-P3 (frontend feeds/render)` in parallel with `D-P2 (CMS Updates tab, gated on R2/S3)` → `D-P4 (chains + Social Queue + R4 retire)`. D-P3 gives visible value first without touching R2.

## Code-path audit (verified — why D-P1 is safe)
- `frontend services/contentPostService.ts` `mapRow` L14–38: named-field mapping, **no spread** → new columns neither break nor leak. Readers: `getContentPostsByExam` L43, get-by-slug L84, `getLatestByContentType` L98 (all `select "*"` server-side).
- `cms src/services/contentService.ts` `mapRow` L11–23+ (named fields); list `select "*"` L42; create/update set explicit columns.
- `INSERT INTO content_posts`: only in already-applied migrations `20260730164022` and `20260730164054`, both with **explicit column lists** → columns appended at the end don't affect them. No positional/`SELECT *` inserts anywhere.

## Owner decisions (recorded 2026-10-13; D-P1 applied as migration 20261013125113)
1. The withdrawn/superseded block sits **below the section content**, under a **"History / Withdrawn"** heading on the exam page.
2. **No interim hand-authoring** of exam-linked posts before R2/S3 — the Updates surface is built once, inside the R2 shell.
3. **D-P2 waits for R2/S3**; **D-P3 (frontend render + feeds) can follow now that D-P1 is applied** (it does not depend on R2).

D-P1 was **applied** to the remote DB via MCP at version **20261013125113** (columns/check/indexes/trigger verified read-only; `pg_policies` unchanged; 112 rows unaffected; authenticated simulation still returns 112). The applied SQL is recorded at `supabase/migrations/20261013125113_content_posts_update_columns.sql`; the proposed copy was removed (no duplicate). No push; owner deploys/pushes from disk.
