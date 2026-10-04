-- =============================================================================
-- FX1.6 (PROPOSED REPAIR — DO NOT APPLY WITHOUT OWNER APPROVAL)
-- Repairs the two broken edition states behind FX1:
--   (A) exams that HAVE editions but NONE is_current  → set the latest as current
--   (B) exams with ZERO editions                     → create a current edition
--
-- The owner runs the DRY-RUN SELECTs first, reviews the exact rows, then applies
-- the matching statements. Everything is idempotent and scoped so a re-run is safe.
--
-- LIVE COUNTS: the FX1.1 diagnostic counts (how many exams in each state, and
-- how many of those are PUBLISHED) could NOT be captured in this session because
-- the Supabase MCP required re-authorization (OAuth). Run the two DRY-SELECTs
-- below against production to obtain the current counts BEFORE applying any fix.
-- The record that triggered FX1 — c238f548-0d04-49cf-94f2-4e5fa33fe59f
-- (slug up-deled-entrance, PUBLISHED, "Editions (0)") — is a state-(B) row and
-- will appear in dry-run (B).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- DRY-RUN (A): exams with editions but none current.
-- These show "Editions (N>0)" but the editor has no current cycle to write to.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT e.id AS exam_id, e.slug, e.name, e.workflow_status,
       count(ed.id) AS edition_count
FROM public.exams e
JOIN public.exam_editions ed ON ed.exam_id = e.id
WHERE e.deleted_at IS NULL
GROUP BY e.id
HAVING bool_and(ed.is_current = FALSE)      -- no edition is current
ORDER BY e.workflow_status DESC, e.slug;

-- ─────────────────────────────────────────────────────────────────────────────
-- DRY-RUN (B): exams with ZERO editions (the reported symptom).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT e.id AS exam_id, e.slug, e.name, e.workflow_status, e.pillar, e.created_at
FROM public.exams e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.exam_editions ed WHERE ed.exam_id = e.id)
ORDER BY e.workflow_status DESC, e.slug;


-- =============================================================================
-- FIX (A): for exams with editions but none current, set the LATEST (highest
-- year, then session) as current. Run only after reviewing dry-run (A).
-- Wrapped so only exams that truly have no current row are touched.
-- =============================================================================
-- BEGIN;
-- WITH ranked AS (
--   SELECT ed.id, ed.exam_id,
--          row_number() OVER (PARTITION BY ed.exam_id ORDER BY ed.year DESC, ed.session DESC) AS rn
--   FROM public.exam_editions ed
--   WHERE ed.exam_id IN (
--     SELECT e.id FROM public.exams e
--     JOIN public.exam_editions x ON x.exam_id = e.id
--     WHERE e.deleted_at IS NULL
--     GROUP BY e.id
--     HAVING bool_and(x.is_current = FALSE)
--   )
-- )
-- UPDATE public.exam_editions ed
-- SET is_current = TRUE
-- FROM ranked r
-- WHERE ed.id = r.id AND r.rn = 1;
-- -- The existing trigger keeps exams.current_edition_id in sync with is_current.
-- COMMIT;


-- =============================================================================
-- FIX (B): for exams with zero editions, create a current edition for the
-- CURRENT year with empty data. Run only after reviewing dry-run (B).
-- Uses the exam's own pillar/region defaults; content_modules seeded minimal.
-- =============================================================================
-- BEGIN;
-- INSERT INTO public.exam_editions
--   (exam_id, year, session, edition_label, is_current, status, eligibility, application_fee, content_modules)
-- SELECT
--   e.id,
--   EXTRACT(YEAR FROM CURRENT_DATE)::int,
--   'main',
--   EXTRACT(YEAR FROM CURRENT_DATE)::int::text,
--   TRUE,
--   'upcoming',
--   '{}'::jsonb,
--   '{}'::jsonb,
--   '{}'::jsonb
-- FROM public.exams e
-- WHERE e.deleted_at IS NULL
--   AND NOT EXISTS (SELECT 1 FROM public.exam_editions ed WHERE ed.exam_id = e.id);
-- -- Trigger sets exams.current_edition_id for each new is_current row.
-- COMMIT;


-- =============================================================================
-- POST-FIX VERIFICATION (run after applying; both must return zero rows)
-- =============================================================================
-- (A) still no current among exams that have editions:
-- SELECT e.id FROM public.exams e JOIN public.exam_editions x ON x.exam_id = e.id
-- WHERE e.deleted_at IS NULL GROUP BY e.id HAVING bool_and(x.is_current = FALSE);
-- (B) still zero editions:
-- SELECT e.id FROM public.exams e WHERE e.deleted_at IS NULL
-- AND NOT EXISTS (SELECT 1 FROM public.exam_editions ed WHERE ed.exam_id = e.id);
