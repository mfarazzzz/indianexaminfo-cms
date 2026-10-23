-- ─────────────────────────────────────────────────────────────────────────────
-- PROPOSED — DO NOT move into supabase/migrations/ without the owner's approval
-- (AGENTS.md: a CMS push may apply every file in migrations/). When the owner
-- promotes it, the version prefix is assigned AT PROMOTION TIME (UTC time of the
-- move), never a placeholder/future date. This file is READ-ONLY RESEARCH: it is
-- not applied and nothing here has been run against the database.
--
-- P1 item 3 — SITEMAP / LIST BLIND SPOT: a narrow way for list queries and the
-- sitemap to learn WHICH content types an exam has own data for, WITHOUT
-- loading the exam_editions.content_modules jsonb blob for all ~396 published
-- exams.
--
-- ── THE VERIFIED BLIND SPOT (frontend, read 23 Oct) ───────────────────────────
-- app/sitemap.ts gates every content-type sub-page on
--   lib/sectionRegistry.ts#contentTypeHasData(exam, ct)  ->  hasData(view, section)
-- where `exam` comes from services/examService.ts#getAllExams(), which selects
--   LIST_SELECT = LIST_SCALAR_COLUMNS + current_ed:exam_editions(LIST_EDITION_COLUMNS)
-- and LIST_EDITION_COLUMNS deliberately OMITS content_modules (the comment in
-- examService.ts says the blob is paid for only by the small content-hub
-- candidate set, not by every list query). So on the sitemap path
-- mapRow() sets contentModules = undefined, editorialHasData() -> moduleObj()
-- returns null, and EVERY editorial content type (notification/overview,
-- application/application-process, admit-card, result, answer-key, cutoff/
-- cut-off, previous-papers, study-material, news) evaluates FALSE — regardless of
-- whether the record actually carries that section. The detail route
-- (getExamBySlug -> DETAIL_SELECT -> current_ed = *) DOES load content_modules,
-- so a CT sub-page can be live (200, self-canonical) while its URL is never
-- submitted. That is the blind spot: the sitemap cannot know the per-exam
-- editorial presence without shipping the blob it was built to avoid.
-- (Only the column-backed `syllabus` survives, via exam_syllabus_subjects;
-- `ctPagesWithOwnContent()` is a DIFFERENT signal — the content_posts/updates
-- self-canonical rule, P1 item 14 — and does not fill this gap.)
--
-- ── DEPENDENCY ────────────────────────────────────────────────────────────────
-- Both options call public.content_has_data(view jsonb, section text), the
-- canonical SQL port of the TS hasData/contentTypeHasData rule that lives in
-- supabase/proposed/content_has_data_fn.sql and is pinned to the TS by
-- src/lib/contentHasData.parity.test.ts (CMS) and
-- lib/contract/contentHasData.contract.test.ts (frontend). content_has_data must
-- be promoted (applied) BEFORE either option here, or both fail. This proposal
-- adds NO second evaluator — it reuses the one that already has parity coverage.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- OPTION (a) — VIEW + id-scoped RPC that evaluate content_has_data server-side.
-- Recommended. Returns exam_id + text[] of content-type URL slugs with data.
-- The jsonb blob is read and evaluated inside Postgres; the client receives only
-- the compact array, so the 396-blob network/serialisation cost disappears.
-- ═══════════════════════════════════════════════════════════════════════════

-- The CT -> section bridge, mirroring lib/sectionRegistry.ts#CONTENT_TYPE_TO_SECTION
-- EXACTLY (URL slug -> registry section slug). THIS VALUES list is the only NEW
-- parity surface option (a) introduces; the extend-the-parity-test step below pins
-- it. A CT absent here (date-sheet, mock-test, books, faqs) is never returned —
-- same as the TS, where contentTypeHasData returns false for an unmapped CT.
--
-- SECURITY INVOKER (default): the view inherits the caller's RLS on exams /
-- exam_editions / exam_syllabus_subjects — the SAME reader policy getAllExams()
-- already runs under — so it returns exactly the exams the caller may see
-- (published for anon; broader for staff). No new policy is required and the
-- sitemap's own visibility is preserved by construction.
CREATE OR REPLACE VIEW public.exam_content_types_with_data AS
WITH syllabus_exams AS (            -- ≥1 exam_syllabus_subjects row => structured syllabus
  SELECT DISTINCT exam_id FROM public.exam_syllabus_subjects
),
hv AS (                            -- assemble the HasDataView jsonb from the CURRENT edition
  SELECT
    e.id AS exam_id,
    jsonb_build_object(
      'pillar',              e.pillar,
      'dates',               COALESCE(ed.important_dates, '[]'::jsonb),
      'eligibility',         ed.eligibility,
      'vacancy',             ed.vacancy,
      'applicationFee',      ed.application_fee,
      'selectionProcess',    e.selection_process,
      'academicInfo',        jsonb_build_object(
                               'academicYear', e.academic_year,
                               'semester',     e.semester,
                               'admissionTo',  e.admission_to),
      'hasStructuredSyllabus', (sx.exam_id IS NOT NULL),
      'faqs',                COALESCE(e.faqs, '[]'::jsonb),
      'contentModules',      ed.content_modules   -- read HERE, server-side; never leaves as a blob
    ) AS view_jsonb
  FROM public.exams e
  LEFT JOIN public.exam_editions ed ON ed.id = e.current_edition_id
  LEFT JOIN syllabus_exams sx       ON sx.exam_id = e.id
),
bridge(content_type, section) AS (
  VALUES
    ('notification','overview'), ('application','application-process'),
    ('admit-card','admit-card'), ('result','result'), ('answer-key','answer-key'),
    ('syllabus','syllabus'),     ('cutoff','cut-off'),
    ('previous-papers','previous-papers'), ('study-material','study-material'),
    ('news','news')
)
SELECT
  hv.exam_id,
  COALESCE(
    array_agg(bridge.content_type ORDER BY bridge.content_type)
      FILTER (WHERE public.content_has_data(hv.view_jsonb, bridge.section)),
    '{}'::text[]
  ) AS content_types
FROM hv
CROSS JOIN bridge
GROUP BY hv.exam_id;

-- id-scoped RPC for list queries (mirrors the "small candidate set" idea the
-- content-hub select already uses): pass the exam ids a page is about to render
-- and get back only those rows. Same predicate, same RLS (SECURITY INVOKER).
CREATE OR REPLACE FUNCTION public.exam_content_types_with_data(exam_ids uuid[])
RETURNS TABLE (exam_id uuid, content_types text[])
LANGUAGE sql STABLE
SECURITY INVOKER
AS $fn$
  SELECT v.exam_id, v.content_types
    FROM public.exam_content_types_with_data v
   WHERE v.exam_id = ANY (exam_ids);
$fn$;


-- ═══════════════════════════════════════════════════════════════════════════
-- OPTION (b) — MATERIALIZED FLAG (for comparison only; NOT recommended).
-- A text[] column on exam_editions, kept current by a trigger so the sitemap/
-- list reads it with zero jsonb evaluation. Sketch, not to be applied:
--
--   ALTER TABLE public.exam_editions
--     ADD COLUMN content_types_with_data text[] NOT NULL DEFAULT '{}';
--   -- trigger BEFORE INSERT OR UPDATE OF content_modules, important_dates,
--   -- eligibility, application_fee, vacancy re-runs content_has_data over the
--   -- bridge and writes the array. The syllabus / exams-side inputs
--   -- (hasStructuredSyllabus via exam_syllabus_subjects; selection_process, faqs,
--   -- academic_* on EXAMS) are NOT on exam_editions, so a single editions trigger
--   -- CANNOT keep the array correct: it needs companion triggers on
--   -- exam_syllabus_subjects AND exams, plus a one-time backfill of ~396 rows.
--
-- It is included to make the comparison concrete; the write-path breadth below
-- is why option (a) is preferred.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- COMPARISON (cost, parity, RLS) — reasoned from the code above, not measured;
-- the EXPLAIN numbers are left to the apply-time checks because nothing here was
-- run against the live DB.
--
-- READ COST
--   (a) Server-side: reads content_modules for the current edition of each
--       VISIBLE exam once and calls content_has_data 10x/exam (~3,960 immutable
--       predicate calls per full pass). The blob never crosses the network; the
--       client payload is ~396 rows of (uuid, text[]). Recomputed on the sitemap's
--       own revalidate cadence (3600s) / the list's cache (1800s) — NOT per hit.
--   (b) Cheapest reads: the flag is a column, no per-request evaluation at all.
--
-- WRITE COST / STALENESS
--   (a) None. No stored state, so nothing to go stale or to backfill.
--   (b) Write amplification on every save; correctness needs triggers spanning
--       THREE tables (exam_editions, exams, exam_syllabus_subjects) and an
--       initial backfill. A missed trigger = a silently wrong array that the
--       sitemap then trusts. This is the deciding downside.
--
-- PARITY RISK with the TS predicate (lib/sectionRegistry.ts)
--   (a) Uses content_has_data directly, already pinned to the TS by the two CI
--       parity tests. The ONLY new drift surface is the CONTENT_TYPE_TO_SECTION
--       bridge mirrored into VALUES above; a test can pin it (see checks #4).
--   (b) Same bridge risk PLUS a whole derived-state staleness class (the array
--       is a second copy of the truth that can diverge from both TS and SQL).
--
-- RLS
--   (a) SECURITY INVOKER view inherits the existing reader policy — returns the
--       exams the caller already sees. Nothing new to grant or audit.
--   (b) A column on exam_editions inherits editions RLS (fine); but exams-side /
--       syllabus inputs live elsewhere, so the flag's provenance spans policies.
--
-- RECOMMENDATION: OPTION (a). It closes the blind spot by moving the SAME
-- pinned predicate to the server, shrinks the sitemap/list payload from 396
-- jsonb blobs to 396 small arrays, and introduces no mutable derived state that
-- can drift. Adopt only after the bridge parity test is added and EXPLAIN
-- ANALYZE confirms the recompute is acceptable at the build/cache cadence.
--
-- CONSUMER CHANGE (out of scope, REPORT ONLY — frontend, later): getAllExams/
-- sitemap would call exam_content_types_with_data (or the id-scoped RPC) and
-- feed the returned set into the existing CT gate INSTEAD of recomputing
-- contentTypeHasData from an absent blob; the detail route keeps its own
-- DETAIL_SELECT evaluation. Until that wiring lands, this view/RPC are inert —
-- nothing reads them — which is why shipping them is low-risk.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- APPLY-TIME CHECKS (run when promoting, in this order — all read-only):
-- 1. dependency present:
--      SELECT proname FROM pg_proc WHERE proname = 'content_has_data';
--    (must exist before this file can even create the view).
-- 2. coverage matches the reader's set:
--      SELECT count(*) FROM public.exam_content_types_with_data;
--    equals the number of exams getAllExams() returns for anon (~396 published).
-- 3. empty-array sanity: the share of '{}' rows should be exams whose DETAIL page
--    shows no editorial CT tab. Sample 10, open each detail page, confirm none
--    has a live editorial tab the view dropped.
-- 4. parity (the load-bearing one): for ~20 fixture exams across all five pillars,
--    assert the view's content_types equals, set-for-set, the TS
--    contentTypeHasData(ct) over the SAME exam loaded with content_modules
--    (DETAIL). Add this as a contract test in the frontend next to
--    contentHasData.contract.test.ts and pin the bridge VALUES against
--    CONTENT_TYPE_TO_SECTION there, so a future edit to either side fails CI.
-- 5. cost: EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM exam_content_types_with_data;
--    and the id-scoped RPC. Confirm no per-exam N+1 and a build-cadence cost the
--    deploy box tolerates.
-- 6. RLS: run #2/#4 as the anon role — only published/reader-visible exams
--    appear; a staff token sees its broader set.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK — the objects are additive and read-only; dropping them cannot alter
-- data. Nothing in this file mutates a row, so there is no data to restore.
--      DROP FUNCTION IF EXISTS public.exam_content_types_with_data(uuid[]);
--      DROP VIEW      IF EXISTS public.exam_content_types_with_data;
-- ─────────────────────────────────────────────────────────────────────────────
