-- ─────────────────────────────────────────────────────────────────────────────
-- 20261028165448_sitemap_content_types_view.sql — the SITEMAP VIEW (owner batch 4, J1)
--
-- Owner approval line for this batch: "APPLY SITEMAP VIEW".
-- Applied to project cwbhhcqsrbuoybeaondk through Supabase MCP apply_migration on
-- 2026-10-28 and recorded by that tool as version 20261028165448, name
-- sitemap_content_types_view. Two parts, in dependency order:
--   Part 1 = supabase/proposed/content_has_data_fn.sql (the canonical SQL port of
--            lib/sectionRegistry.ts#hasData/contentTypeHasData), with the search_path pins
--            added at J1 pre-flight — the six functions were IMMUTABLE and not SECURITY
--            DEFINER but NONE was pinned, so applying it verbatim would have re-created the
--            lint batch 3 had just cleared.
--   Part 2 = the H-2 view + id-scoped RPC, exactly as pasted and proven in
--            supabase/proposed/20261028_sitemap_view_security_invoker_PROPOSAL.sql.
--
-- PRE-FLIGHT (measured immediately before applying): functions_existing=0, view_existing=0,
--   array_rpc_existing=0 — none of the objects existed. exams = 404 rows, 399 published and
--   not zz-test-.
-- PROVED TWICE in BEGIN … ROLLBACK transactions; the numbers below are the applied-state
-- re-run, all as the ANON role where the role matters:
--   view rows (postgres) 399 = published non-test exams 399
--   view rows (anon)     399
--   planted DRAFT row in the view?            false
--   planted PUBLISHED zz-test- row in view?   false
--   RPC as anon over 5 real ids               5 rows
--   anon SELECT on view / EXECUTE on RPC      true / true; authenticated SELECT false
--   reloptions of the new view                security_invoker=true
--   reloptions of the advisor-flagged exam_derived_status   (none)  -> stays the ONLY 1 ERROR
--   functions pinned 7/7, SECURITY DEFINER 0, volatility IMMUTABLE x6 + STABLE (the RPC)
--   20-fixture SQL-vs-TS parity re-run as anon on the live evaluator: 20/20 equal
--   per-content-type counts over live published exams:
--     notification=272 syllabus=13 admit-card=7 application=7 result=6 news=3
--     (answer-key / cutoff / previous-papers / study-material = 0)
-- WHY THE VIEW EXISTS: the sitemap gates every content-type sub-page on
-- contentTypeHasData(exam, ct), but getAllExams() deliberately omits
-- exam_editions.content_modules, so on the sitemap path EVERY editorial content type
-- evaluated false. The evaluator now runs inside Postgres and the client receives one
-- small text[] per exam instead of 396 jsonb blobs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ PART 1 — the canonical evaluator (content_has_data_fn.sql, search_path pinned) ═══

CREATE OR REPLACE FUNCTION public._chd_str(obj jsonb, key text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $h1$
  SELECT COALESCE(jsonb_typeof(obj -> key) = 'string'
              AND length(btrim(obj ->> key)) > 0, false);
$h1$;

CREATE OR REPLACE FUNCTION public._chd_arr(obj jsonb, key text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $h2$
  SELECT COALESCE(jsonb_typeof(obj -> key) = 'array'
               AND jsonb_array_length(obj -> key) > 0, false);
$h2$;

CREATE OR REPLACE FUNCTION public._chd_faq_meaningful(view jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $h3$
  SELECT CASE WHEN jsonb_typeof(view -> 'faqs') = 'array' THEN
    EXISTS (
      SELECT 1
        FROM jsonb_array_elements(view -> 'faqs') AS f
       WHERE regexp_replace(
               btrim(lower(coalesce(f ->> 'answer', ''))),
               '[.?!,:;[:space:]]+$',
               ''
             ) NOT IN
             ('', 'not specified', 'n/a', 'na', '-', 'tba', 'tbd', 'none', 'nil')
    )
  ELSE false END;
$h3$;

CREATE OR REPLACE FUNCTION public._chd_vacancy_positive(view jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $h4$
  SELECT COALESCE(jsonb_typeof(view -> 'vacancy') = 'number'
               AND (view ->> 'vacancy')::numeric > 0, false);
$h4$;

CREATE OR REPLACE FUNCTION public._chd_fee_positive(fee jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $h5$
  SELECT COALESCE(jsonb_typeof(fee) = 'object'
               AND EXISTS (
                 SELECT 1 FROM jsonb_each(fee) AS e(key, value)
                 WHERE jsonb_typeof(e.value) = 'number' AND (e.value #>> '{}')::numeric > 0
               ), false);
$h5$;

-- The canonical rule itself. Mirrors the CMS/frontend registry key for key; kept in parity
-- by qa/parity/sitemap-view-parity.test.ts (frontend) and
-- src/lib/contentHasData.parity.test.ts (CMS).
CREATE OR REPLACE FUNCTION public.content_has_data(view jsonb, section text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  cm       jsonb := view -> 'contentModules';
  mod      jsonb;
  source   text;
  pillars  text[];
  p        text  := COALESCE(view ->> 'pillar', '');
  items    jsonb;
BEGIN
  IF view IS NULL OR section IS NULL THEN
    RETURN false;
  END IF;

  -- Registry: slug -> (source, appliesTo). Mirrors SECTION_REGISTRY.
  SELECT r.source, r.pillars INTO source, pillars
  FROM (VALUES
    ('key-highlights',       'structure', ARRAY['government-exam','govt-vacancy','entrance-exam','university-exam','board-exam']),
    ('overview',             'editorial', ARRAY['government-exam','govt-vacancy','entrance-exam','university-exam','board-exam']),
    ('important-dates',      'column',    ARRAY['government-exam','govt-vacancy','entrance-exam','university-exam','board-exam']),
    ('eligibility',          'column',    ARRAY['government-exam','govt-vacancy','entrance-exam','university-exam','board-exam']),
    ('application-fee',      'column',    ARRAY['government-exam','govt-vacancy','entrance-exam']),
    ('vacancy',              'column',    ARRAY['government-exam','govt-vacancy']),
    ('application-process',  'editorial', ARRAY['government-exam','govt-vacancy','entrance-exam','university-exam']),
    ('selection-process',    'column',    ARRAY['government-exam','govt-vacancy','entrance-exam']),
    ('salary',               'editorial', ARRAY['government-exam','govt-vacancy']),
    ('age-limit',            'editorial', ARRAY['government-exam','govt-vacancy','entrance-exam']),
    ('admit-card',           'editorial', ARRAY['government-exam','govt-vacancy','entrance-exam','university-exam','board-exam']),
    ('result',               'editorial', ARRAY['government-exam','govt-vacancy','entrance-exam','university-exam','board-exam']),
    ('documents-required',   'editorial', ARRAY['government-exam','govt-vacancy']),
    ('reservation',          'editorial', ARRAY['government-exam','govt-vacancy']),
    ('faqs',                 'column',    ARRAY['government-exam','govt-vacancy','entrance-exam','university-exam','board-exam']),
    ('syllabus',             'column',    ARRAY['government-exam','govt-vacancy','entrance-exam','university-exam','board-exam']),
    ('cut-off',              'editorial', ARRAY['government-exam','govt-vacancy','entrance-exam']),
    ('answer-key',           'editorial', ARRAY['government-exam','govt-vacancy','entrance-exam']),
    ('previous-papers',      'editorial', ARRAY['government-exam','govt-vacancy','entrance-exam']),
    ('study-material',       'editorial', ARRAY['government-exam','govt-vacancy','entrance-exam']),
    ('news',                 'editorial', ARRAY['government-exam','govt-vacancy','entrance-exam','university-exam','board-exam']),
    ('merit-list',           'editorial', ARRAY['government-exam','govt-vacancy']),
    ('document-verification','editorial', ARRAY['government-exam','govt-vacancy']),
    ('interview-schedule',   'editorial', ARRAY['government-exam','govt-vacancy']),
    ('final-selection',      'editorial', ARRAY['government-exam','govt-vacancy']),
    ('seat-allotment',       'editorial', ARRAY['university-exam']),
    ('academic-info',        'column',    ARRAY['entrance-exam','university-exam'])
  ) AS r(slug, source, pillars)
  WHERE r.slug = section;

  IF source IS NULL THEN RETURN false; END IF;               -- slug not in registry
  IF NOT (p = ANY(pillars)) THEN RETURN false; END IF;       -- pillar not applicable

  -- structure
  IF source = 'structure' THEN
    IF section = 'key-highlights' THEN
      RETURN (
        _chd_vacancy_positive(view)
        OR _chd_str(view -> 'eligibility', 'qualification')
        OR _chd_str(view -> 'eligibility', 'age')
        OR _chd_fee_positive(view -> 'applicationFee')
        OR _chd_arr(view, 'dates')
      );
    END IF;
    RETURN false;
  END IF;

  -- column
  IF source = 'column' THEN
    IF section = 'important-dates' THEN RETURN _chd_arr(view, 'dates'); END IF;
    IF section = 'eligibility' THEN
      RETURN COALESCE(jsonb_typeof(view -> 'eligibility') = 'object'
         AND (_chd_str(view -> 'eligibility', 'qualification')
              OR _chd_str(view -> 'eligibility', 'age')
              OR _chd_str(view -> 'eligibility', 'nationality')), false);
    END IF;
    IF section = 'vacancy' THEN RETURN _chd_vacancy_positive(view); END IF;
    IF section = 'application-fee' THEN RETURN _chd_fee_positive(view -> 'applicationFee'); END IF;
    IF section = 'selection-process' THEN RETURN _chd_arr(view, 'selectionProcess'); END IF;
    IF section = 'syllabus' THEN
      RETURN COALESCE(jsonb_typeof(view -> 'hasStructuredSyllabus') = 'boolean'
         AND (view ->> 'hasStructuredSyllabus')::boolean, false);
    END IF;
    IF section = 'academic-info' THEN
      RETURN COALESCE(jsonb_typeof(view -> 'academicInfo') = 'object'
         AND (_chd_str(view -> 'academicInfo', 'academicYear')
              OR _chd_str(view -> 'academicInfo', 'semester')
              OR _chd_str(view -> 'academicInfo', 'admissionTo')), false);
    END IF;
    IF section = 'faqs' THEN RETURN public._chd_faq_meaningful(view); END IF;
    RETURN false;
  END IF;

  -- editorial (reads the content_modules store)
  mod := cm -> section;
  IF mod IS NULL OR jsonb_typeof(mod) <> 'object' THEN RETURN false; END IF;

  -- _config.enabledModules opt-out: an explicit non-empty list that omits this slug means
  -- the editor turned the section off on purpose -> no data regardless of content.
  IF jsonb_typeof(cm -> '_config' -> 'enabledModules') = 'array'
     AND jsonb_array_length(cm -> '_config' -> 'enabledModules') > 0
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(cm -> '_config' -> 'enabledModules') AS m(name)
       WHERE m.name = section
     )
  THEN
    RETURN false;
  END IF;

  IF section IN ('overview','application-process') THEN
    RETURN _chd_str(mod,'body') OR _chd_str(mod,'content') OR _chd_str(mod,'description')
        OR _chd_str(mod,'summary') OR _chd_arr(mod,'steps');
  END IF;

  IF section = 'news' THEN
    items := mod -> 'items';
    RETURN COALESCE(jsonb_typeof(items) = 'array'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(items) AS e(elem) WHERE _chd_str(e.elem, 'title')), false);
  END IF;

  IF section = 'result' THEN
    RETURN _chd_str(mod,'body') OR _chd_str(mod,'content') OR _chd_str(mod,'description')
        OR _chd_str(mod,'summary') OR _chd_str(mod,'releaseDate') OR _chd_str(mod,'date')
        OR _chd_str(mod,'checkLink') OR _chd_str(mod,'declarationDate') OR _chd_str(mod,'statistics');
  END IF;

  IF section IN ('admit-card','answer-key','cut-off') THEN
    RETURN _chd_str(mod,'body') OR _chd_str(mod,'content') OR _chd_str(mod,'description')
        OR _chd_str(mod,'summary') OR _chd_str(mod,'releaseDate') OR _chd_str(mod,'date');
  END IF;

  IF section = 'merit-list' THEN
    RETURN _chd_str(mod,'meritListUrl') OR _chd_str(mod,'releaseDate');
  END IF;

  IF section = 'interview-schedule' THEN
    RETURN _chd_str(mod,'callLetterUrl') OR _chd_str(mod,'callLetterDate') OR _chd_arr(mod,'rounds');
  END IF;

  IF section = 'document-verification' THEN
    RETURN _chd_str(mod,'startDate') OR _chd_str(mod,'venue') OR _chd_str(mod,'callLetterUrl')
        OR _chd_arr(mod,'documentsRequired');
  END IF;

  IF section = 'final-selection' THEN
    RETURN _chd_str(mod,'finalListUrl') OR _chd_str(mod,'releaseDate');
  END IF;

  IF section = 'seat-allotment' THEN
    RETURN _chd_arr(mod,'rounds') OR _chd_str(mod,'allotmentResultUrl') OR _chd_str(mod,'acceptanceProcess');
  END IF;

  IF section = 'previous-papers' THEN
    RETURN _chd_arr(mod,'papers') OR _chd_str(mod,'notes');
  END IF;
  IF section = 'study-material' THEN
    RETURN _chd_arr(mod,'materials') OR _chd_str(mod,'notes');
  END IF;

  RETURN _chd_str(mod,'body') OR _chd_str(mod,'content') OR _chd_str(mod,'description')
      OR _chd_str(mod,'summary');
END;
$fn$;

-- ═══ PART 2 — the view + id-scoped RPC + grants (security invoker, published-only) ═══

CREATE OR REPLACE VIEW public.exam_content_types_with_data
WITH (security_invoker = true)
AS
WITH syllabus_exams AS (
  SELECT DISTINCT exam_id FROM public.exam_syllabus_subjects
),
visible_exams AS (                  -- THE PUBLISHED FILTER LIVES INSIDE THE VIEW
  SELECT e.*
    FROM public.exams e
   WHERE e.is_published = true
     AND e.workflow_status = 'published'
     AND e.slug NOT LIKE 'zz-test-%'
),
hv AS (
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
      'contentModules',        ed.content_modules   -- evaluated here; never shipped as a blob
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

-- Id-scoped RPC. SECURITY INVOKER + pinned search_path, so neither the definer-function
-- nor the mutable-search_path lint can fire on it.
CREATE OR REPLACE FUNCTION public.exam_content_types_with_data(exam_ids uuid[])
RETURNS TABLE (exam_id uuid, content_types text[])
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $wr$
  SELECT v.exam_id, v.content_types
    FROM public.exam_content_types_with_data v
   WHERE v.exam_id = ANY (exam_ids);
$wr$;

-- The consumer is the frontend sitemap, whose client is built from
-- NEXT_PUBLIC_SUPABASE_ANON_KEY (config/env.ts exposes no service key), so PostgREST sees
-- role `anon` for every read it makes. Revoke first (Postgres grants to PUBLIC by default),
-- then grant exactly that: SELECT on the view, EXECUTE on the RPC, to anon only.
REVOKE ALL ON PUBLIC.exam_content_types_with_data FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION PUBLIC.exam_content_types_with_data(uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON PUBLIC.exam_content_types_with_data TO anon;
GRANT EXECUTE ON FUNCTION PUBLIC.exam_content_types_with_data(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION PUBLIC.content_has_data(jsonb, text) TO anon;

COMMENT ON VIEW public.exam_content_types_with_data IS
  'Which content types each PUBLISHED, non-test exam has own data for. security_invoker: '
  'RLS of the querying role applies. Consumer: the frontend sitemap (anon role).';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.exam_content_types_with_data(uuid[]);
--   DROP VIEW      IF EXISTS public.exam_content_types_with_data;
--   DROP FUNCTION IF EXISTS public.content_has_data(jsonb, text);
--   DROP FUNCTION IF EXISTS public._chd_fee_positive(jsonb);
--   DROP FUNCTION IF EXISTS public._chd_vacancy_positive(jsonb);
--   DROP FUNCTION IF EXISTS public._chd_faq_meaningful(jsonb);
--   DROP FUNCTION IF EXISTS public._chd_arr(jsonb, text);
--   DROP FUNCTION IF EXISTS public._chd_str(jsonb, text);
-- ─────────────────────────────────────────────────────────────────────────────
