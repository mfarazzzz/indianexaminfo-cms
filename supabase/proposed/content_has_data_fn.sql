-- ─────────────────────────────────────────────────────────────────────────────
-- PROPOSED — DO NOT move into supabase/migrations/ without the owner's approval
-- (AGENTS.md: a CMS push may apply every file in migrations/). When the owner
-- promotes it, the version prefix is assigned AT PROMOTION TIME (UTC time of the
-- move), never a placeholder/future date.
--
-- N2 step 2: the CANONICAL content-existence rule, in SQL.
--
-- content_has_data(view jsonb, section text) is a PURE function over the
-- HasDataView jsonb (the exact shape the TS evaluator consumes), so the same
-- fixture jsonb can be fed to BOTH this SQL and the TS
-- src/lib/sectionRegistry.ts#contentTypeHasData/hasData and asserted equal —
-- that parity test (src/lib/contentHasData.parity.test.ts) runs in CI and is
-- what keeps "one fact, one place" true rather than assumed.
--
-- It mirrors, key for key, the CMS registry + editorialHasData/hasData logic:
--   • a section applies only to its pillar set (else false);
--   • "column" sections read typed fields; "editorial" sections read the
--     contentModules jsonb store, honouring the _config.enabledModules opt-out;
--   • faqs is column-sourced with no column branch in the TS, so it is always
--     false here too (the editorial faqs case is unreachable) — the parity test
--     pins this quirk so neither side can silently "fix" it alone.
--
-- The bulletin's signals view (step 3) assembles the HasDataView jsonb per
-- edition and calls THIS function — there is no second evaluator.
-- ─────────────────────────────────────────────────────────────────────────────

-- Small private helpers (prefix _chd_) used only by content_has_data below.

-- Non-empty trimmed string at obj->key (TS nonEmptyStr). COALESCE'd because
-- jsonb_typeof(NULL) is SQL NULL (not a string), so a missing key must read as
-- false, never NULL — otherwise OR-chains leak NULL and the function can return
-- NULL where the TS evaluator returns false.
CREATE OR REPLACE FUNCTION public._chd_str(obj jsonb, key text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $h$
  SELECT COALESCE(jsonb_typeof(obj -> key) = 'string'
              AND length(btrim(obj ->> key)) > 0, false);
$h$;

-- Non-empty array at obj->key (TS nonEmptyArr).
CREATE OR REPLACE FUNCTION public._chd_arr(obj jsonb, key text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $h$
  SELECT COALESCE(jsonb_typeof(obj -> key) = 'array'
               AND jsonb_array_length(obj -> key) > 0, false);
$h$;

-- vacancy != null && > 0  (TS number compare; null-safe via jsonb_typeof).
CREATE OR REPLACE FUNCTION public._chd_vacancy_positive(view jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $h$
  SELECT COALESCE(jsonb_typeof(view -> 'vacancy') = 'number'
               AND (view ->> 'vacancy')::numeric > 0, false);
$h$;

-- applicationFee object with at least one numeric value > 0
-- (TS Object.values(appFee).some(v => typeof v === 'number' && v > 0)).
CREATE OR REPLACE FUNCTION public._chd_fee_positive(fee jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $h$
  SELECT COALESCE(jsonb_typeof(fee) = 'object'
               AND EXISTS (
                 SELECT 1 FROM jsonb_each(fee) AS e(key, value)
                 WHERE jsonb_typeof(e.value) = 'number' AND (e.value #>> '{}')::numeric > 0
               ), false);
$h$;

-- The canonical rule itself.
CREATE OR REPLACE FUNCTION public.content_has_data(view jsonb, section text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
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

  -- ── Registry: slug -> (source, appliesTo). Mirrors SECTION_REGISTRY. ──
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

  IF source IS NULL THEN RETURN false; END IF;         -- slug not in registry
  IF NOT (p = ANY(pillars)) THEN RETURN false; END IF;  -- pillar not applicable

  -- ── structure ──
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

  -- ── column ──
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
    RETURN false;  -- includes 'faqs': column-sourced, no column branch in TS -> always false
  END IF;

  -- ── editorial (reads the contentModules store) ──
  mod := cm -> section;
  IF mod IS NULL OR jsonb_typeof(mod) <> 'object' THEN RETURN false; END IF;

  -- _config.enabledModules opt-out: a non-empty list that omits this slug means
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

  -- Previous Papers / Study Material: substantive when they have items OR notes
  -- (mirrors the frontend editorial rule; shape mirrors sample-papers).
  IF section = 'previous-papers' THEN
    RETURN _chd_arr(mod,'papers') OR _chd_str(mod,'notes');
  END IF;
  IF section = 'study-material' THEN
    RETURN _chd_arr(mod,'materials') OR _chd_str(mod,'notes');
  END IF;

  -- default editorial (salary, age-limit, documents-required, reservation, …)
  RETURN _chd_str(mod,'body') OR _chd_str(mod,'content') OR _chd_str(mod,'description')
      OR _chd_str(mod,'summary');
END;
$fn$;
