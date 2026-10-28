-- ─────────────────────────────────────────────────────────────────────────────
-- PROPOSED — DO NOT move into supabase/migrations/ without the owner's word
-- ("APPLY SITEMAP VIEW"). Nothing in this file has been applied. The proof runs in
-- a BEGIN … ROLLBACK transaction, so the live database is unchanged by it.
--
-- H-2 (owner batch 3) — REVISE the 2026-10-23 "sitemap view" (option a) before it is
-- ever applied. Revisions over the original proposal, each requested by the owner:
--   1) the view is created WITH (security_invoker = true);
--   2) the published filter lives INSIDE the view (a reader of the view can no longer
--      depend on remembering to add WHERE is_published);
--   3) zz-test- slugs are excluded inside the view, the same rule the pages use
--      (frontend lib/testContent.ts, mirrored in the CMS);
--   4) EXECUTE/SELECT are granted to exactly the role the consumer signs in as. The
--      consumer is the FRONTEND sitemap generator: services run through
--      lib/supabase/server.ts, which builds its client from
--      NEXT_PUBLIC_SUPABASE_ANON_KEY (config/env.ts exposes no service key at all).
--      So PostgREST sees role `anon` for every read the sitemap makes -> GRANT SELECT
--      TO anon, and nothing else. (If the CMS ever reads it through its service-role
--      client, that grant must be added deliberately, not inherited from PUBLIC.)
--   5) the wrapper function stays SECURITY INVOKER and is pinned to a search_path, so
--      the advisor cannot flag it either.
--
-- WHY (1) MATTERS AND HOW IT IS PROVEN: the security advisor's `security_definer_view`
-- ERROR exists for views whose DEFINER-side rights exceed the caller's — the current
-- single ERROR on this project is public.exam_derived_status, whose pg_class.reloptions
-- are NULL (no security_invoker), so its base-table RLS is enforced as the VIEW OWNER
-- (postgres) rather than as the querying role. `WITH (security_invoker = true)` sets
-- reloptions = {security_invoker=true}, and Postgres then evaluates the view's query
-- with the CALLER's privileges and RLS: the view stops being a privilege boundary and
-- the lint's condition no longer holds. The proof below reads reloptions for both views
-- side by side, so this is a measurement, not an interpretation.
--
-- DEPENDENCY (must already be applied; it is NOT applied yet):
--   supabase/proposed/content_has_data_fn.sql  -> public.content_has_data(jsonb, text)
--   plus its _chd_* helpers. The proof re-creates them inside its own transaction.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ THE FINAL SQL ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.exam_content_types_with_data
WITH (security_invoker = true)
AS
WITH syllabus_exams AS (            -- ≥1 exam_syllabus_subjects row => structured syllabus
  SELECT DISTINCT exam_id FROM public.exam_syllabus_subjects
),
visible_exams AS (                  -- THE FILTER LIVES HERE (revision 2 + 3)
  SELECT e.*
    FROM public.exams e
   WHERE e.is_published = true
     AND e.workflow_status = 'published'
     AND e.slug NOT LIKE 'zz-test-%'
),
hv AS (                             -- assemble the HasDataView jsonb from the CURRENT edition
  SELECT
    e.id AS exam_id,
    jsonb_build_object(
      'pillar',                e.pillar,
      'dates',                 COALESCE(ed.important_dates, '[]'::jsonb),
      'eligibility',           ed.eligibility,
      'vacancy',               ed.vacancy,
      'applicationFee',        ed.application_fee,
      'selectionProcess',      e.selection_process,
      'academicInfo',          jsonb_build_object(
                                 'academicYear', e.academic_year,
                                 'semester',     e.semester,
                                 'admissionTo',  e.admission_to),
      'hasStructuredSyllabus', (sx.exam_id IS NOT NULL),
      'faqs',                  COALESCE(e.faqs, '[]'::jsonb),
      'contentModules',        ed.content_modules   -- read in here; never leaves as a blob
    ) AS view_jsonb
  FROM visible_exams e
  LEFT JOIN public.exam_editions ed ON ed.id = e.current_edition_id
  LEFT JOIN syllabus_exams sx       ON sx.exam_id = e.id
),
bridge(content_type, section) AS (  -- mirrors lib/sectionRegistry.ts#CONTENT_TYPE_TO_SECTION
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

-- id-scoped RPC. SECURITY INVOKER (revision 5) + pinned search_path, so neither the
-- definer-function nor the mutable-search_path lint can fire on it.
CREATE OR REPLACE FUNCTION public.exam_content_types_with_data(exam_ids uuid[])
RETURNS TABLE (exam_id uuid, content_types text[])
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
  SELECT v.exam_id, v.content_types
    FROM public.exam_content_types_with_data v
   WHERE v.exam_id = ANY (exam_ids);
$fn$;

-- Grants (revision 4). Default object privileges in Postgres come from PUBLIC, so the
-- revoke is what makes the grant meaningful: after this, ONLY anon can read the view and
-- call the RPC, and only for SELECT/EXECUTE.
REVOKE ALL ON PUBLIC.exam_content_types_with_data               FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION PUBLIC.exam_content_types_with_data(uuid[]) FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON PUBLIC.exam_content_types_with_data                  TO anon;
GRANT EXECUTE ON FUNCTION PUBLIC.exam_content_types_with_data(uuid[]) TO anon;

-- The view calls content_has_data, so the reading role must be able to execute it.
GRANT EXECUTE ON FUNCTION PUBLIC.content_has_data(jsonb, text) TO anon;

COMMENT ON VIEW public.exam_content_types_with_data IS
  'Which content types each PUBLISHED, non-test exam has own data for. security_invoker: '
  'RLS of the querying role applies. Consumer: the frontend sitemap (anon role).';

-- ═══ ROLLBACK (of this proposal, when applied) ═══════════════════════════════
--   DROP FUNCTION IF EXISTS public.exam_content_types_with_data(uuid[]);
--   DROP VIEW      IF EXISTS public.exam_content_types_with_data;
