-- ─────────────────────────────────────────────────────────────────────────────
-- PROPOSED — DO NOT move into supabase/migrations/ without the owner's approval.
-- When promoted, the version prefix is assigned AT PROMOTION TIME (UTC time of
-- the move), never a placeholder/future date.
--
-- N2 step 3: the computed bulletin signal board (no stored rows to drift).
--
--   • bulletin_rules   — the editor-tunable OFFSET table. A signal is
--     (event_type, offset window, target), NOT the event date alone. Offsets
--     live HERE (rows), not in a CASE, so editors can retune the windows without
--     a deploy.
--       - offset_from_days / offset_to_days are added to the event date to give
--         the active window [event_date+from , event_date+to].
--       - base self-date events use from=-7, to=+3, which reproduces the prior
--         "arrived (last 3d) / upcoming (next 7d)" behaviour exactly.
--       - exam_written / exam_physical / exam_practical each carry TWO rules:
--           admit-card   [-10 , 0 ]  (lead-up: admit card must exist by exam day)
--           answer-key   [ +1 , +10]  (follow-up: answer key expected after the exam)
--
--   • bulletin_signals — one row per (entity, event, target) with the bucket and
--     whether the target already has content. Two date sources UNION'd:
--       - exam_editions.important_dates  (typed jsonb array) → target = a registry
--         section, content checked by the canonical content_has_data() (§step2).
--       - sarkari_naukri date columns   → target = the paired URL/field per §a.2,
--         so vacancy signals light up the moment editors enter dates. Only
--         result_date is populated today, so the other columns contribute nothing
--         until backfilled. NAUKRI ROWS ONLY COUNT WHEN VERIFIED: a signal enters
--         the board only when sn.verified_at IS NOT NULL. Unverified vacancies
--         surface ONLY in the Verification queue — the bulletin never promotes
--         scraped, unconfirmed dates to editor work (owner rule, 2026-09-28).
--
--   • The view is created WITH (security_invoker = true): it reads the base
--     tables with the QUERYING user's privileges (and their RLS), not the owner's.
--
-- Bucket (column name "bucket", not "window" — window is a reserved word):
--       arrived  = today inside the active window AND today >= event_date
--       upcoming = today inside the active window AND today <  event_date
--       backlog  = today past the window end   ·   future = today before window start
-- A signal is OPEN work when bucket in ('arrived','upcoming') AND NOT has_content;
-- it auto-resolves the instant has_content flips true — there is no state to clear.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bulletin_rules (
  event_type       text NOT NULL,
  target_section   text NOT NULL,
  offset_from_days integer NOT NULL DEFAULT -7,
  offset_to_days   integer NOT NULL DEFAULT 3,
  PRIMARY KEY (event_type, target_section)
);

-- Default rules. ON CONFLICT DO NOTHING so a re-run never clobbers editor tunes.
INSERT INTO public.bulletin_rules (event_type, target_section, offset_from_days, offset_to_days) VALUES
  -- base self-date events (from=-7,to=+3 == "as now")
  ('notification',        'overview',             -7,  3),
  ('application_start',   'application-process',  -7,  3),
  ('application_end',     'application-process',  -7,  3),
  ('admit_card',          'admit-card',           -7,  3),
  ('answer_key',          'answer-key',           -7,  3),
  ('result',              'result',               -7,  3),
  ('merit_list',          'merit-list',           -7,  3),
  ('counselling',         'seat-allotment',       -7,  3),
  ('interview',           'interview-schedule',   -7,  3),
  -- exam events: admit-card lead window + answer-key follow window
  ('exam_written',        'admit-card',          -10,  0),
  ('exam_written',        'answer-key',            1, 10),
  ('exam_physical',       'admit-card',          -10,  0),
  ('exam_physical',       'answer-key',            1, 10),
  ('exam_practical',      'admit-card',          -10,  0),
  ('exam_practical',      'answer-key',            1, 10)
ON CONFLICT (event_type, target_section) DO NOTHING;

ALTER TABLE public.bulletin_rules ENABLE ROW LEVEL SECURITY;

-- Read: editors (edit_own_post OR edit_any_post). Never the JWT role claim / names.
DROP POLICY IF EXISTS bulletin_rules_read ON public.bulletin_rules;
CREATE POLICY bulletin_rules_read ON public.bulletin_rules
  FOR SELECT TO authenticated
  USING (
    current_user_has_permission('edit_own_post')
    OR current_user_has_permission('edit_any_post')
  );

-- Write (tuning the offset table): edit_any_post only (senior editors / admins).
DROP POLICY IF EXISTS bulletin_rules_insert ON public.bulletin_rules;
CREATE POLICY bulletin_rules_insert ON public.bulletin_rules
  FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('edit_any_post'));

DROP POLICY IF EXISTS bulletin_rules_update ON public.bulletin_rules;
CREATE POLICY bulletin_rules_update ON public.bulletin_rules
  FOR UPDATE TO authenticated
  USING (current_user_has_permission('edit_any_post'))
  WITH CHECK (current_user_has_permission('edit_any_post'));

DROP POLICY IF EXISTS bulletin_rules_delete ON public.bulletin_rules;
CREATE POLICY bulletin_rules_delete ON public.bulletin_rules
  FOR DELETE TO authenticated
  USING (current_user_has_permission('edit_any_post'));

GRANT SELECT ON public.bulletin_rules TO authenticated;

-- ── The signal view ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.bulletin_signals
WITH (security_invoker = true)
AS
WITH raw AS (
  -- (1) EXAM EDITION EVENTS  (exam_editions.important_dates → registry sections)
  SELECT
    'exam_editions'::text              AS source_table,
    ex.id                              AS exam_id,
    e.id                               AS edition_id,
    NULL::uuid                         AS naukri_id,
    ex.slug                            AS slug,
    ex.name                            AS title,
    ex.pillar::text                    AS pillar,
    ex.region                          AS region,
    lower(d->>'type')                  AS event_type,
    r.target_section                   AS target_section,
    ((d->>'date')::date)               AS event_date,
    r.offset_from_days                 AS offset_from_days,
    r.offset_to_days                   AS offset_to_days,
    public.content_has_data(
      jsonb_build_object(
        'pillar',              ex.pillar::text,
        'vacancy',             e.vacancy,
        'eligibility',         e.eligibility,
        'applicationFee',      e.application_fee,
        'selectionProcess',    to_jsonb(ex.selection_process),
        'hasStructuredSyllabus', EXISTS (
          SELECT 1 FROM public.exam_syllabus_subjects s WHERE s.exam_id = ex.id
        ),
        'academicInfo',        jsonb_build_object(
          'academicYear', ex.academic_year,
          'semester',     ex.semester,
          'admissionTo',  ex.admission_to
        ),
        'dates',               e.important_dates,
        'faqs',                ex.faqs,
        'contentModules',      e.content_modules
      ),
      r.target_section
    )                                  AS has_content
  FROM public.exam_editions e
  JOIN public.exams ex ON ex.id = e.exam_id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(e.important_dates) = 'array'
         THEN e.important_dates ELSE '[]'::jsonb END
  ) AS d
  JOIN public.bulletin_rules r ON r.event_type = lower(d->>'type')
  WHERE jsonb_typeof(d) = 'object'
    AND d->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'

  UNION ALL

  -- (2) SARKARI NAUKRI DATE EVENTS  (flat one-pagers → paired URL/field, §a.2)
  SELECT
    'sarkari_naukri'::text             AS source_table,
    NULL::uuid                         AS exam_id,
    NULL::uuid                         AS edition_id,
    sn.id                              AS naukri_id,
    sn.slug                            AS slug,
    sn.title                           AS title,
    'sarkari-naukri'::text             AS pillar,
    sn.state                           AS region,
    x.event_type                       AS event_type,
    CASE x.event_type
      WHEN 'notification'           THEN 'official_notification_url'
      WHEN 'application_start'      THEN 'application_url'
      WHEN 'application_end'        THEN 'application_url'
      WHEN 'admit_card'             THEN 'admit_card_url'
      WHEN 'exam_written'           THEN 'exam_mode'
      WHEN 'answer_key'             THEN 'answer_key_url'
      WHEN 'result'                 THEN 'result_url'
      WHEN 'merit_list'             THEN 'merit_list_url'
      WHEN 'interview'              THEN 'alternate_links'
      WHEN 'document_verification'  THEN 'joining_details'
      WHEN 'walk_in'                THEN 'walk_in_venue'
    END                                AS target_section,
    x.event_date                       AS event_date,
    -7                                 AS offset_from_days,   -- base window (§d)
    3                                  AS offset_to_days,
    CASE x.event_type
      WHEN 'notification'           THEN NULLIF(btrim(sn.official_notification_url), '') IS NOT NULL
      WHEN 'application_start'      THEN NULLIF(btrim(sn.application_url), '')           IS NOT NULL
      WHEN 'application_end'        THEN NULLIF(btrim(sn.application_url), '')           IS NOT NULL
      WHEN 'admit_card'             THEN NULLIF(btrim(sn.admit_card_url), '')            IS NOT NULL
      WHEN 'exam_written'           THEN NULLIF(btrim(sn.exam_mode), '')                 IS NOT NULL
      WHEN 'answer_key'             THEN NULLIF(btrim(sn.answer_key_url), '')            IS NOT NULL
      WHEN 'result'                 THEN NULLIF(btrim(sn.result_url), '')                IS NOT NULL
      WHEN 'merit_list'             THEN NULLIF(btrim(sn.merit_list_url), '')            IS NOT NULL
      WHEN 'interview'              THEN COALESCE(jsonb_typeof(sn.alternate_links) = 'array'
                                              AND jsonb_array_length(sn.alternate_links) > 0, false)
      WHEN 'document_verification'  THEN NULLIF(btrim(sn.joining_details), '')           IS NOT NULL
      WHEN 'walk_in'                THEN NULLIF(btrim(sn.walk_in_venue), '')             IS NOT NULL
    END                                AS has_content
  FROM public.sarkari_naukri sn
  CROSS JOIN LATERAL (VALUES
    ('notification',          sn.notification_date),
    ('application_start',     sn.application_start_date),
    ('application_end',       sn.application_end_date),
    ('admit_card',            sn.admit_card_date),
    ('exam_written',          sn.exam_date),
    ('answer_key',            sn.answer_key_date),
    ('result',                sn.result_date),
    ('merit_list',            sn.merit_list_date),
    ('interview',             sn.interview_date),
    ('document_verification', sn.document_verification_date),
    ('walk_in',               sn.walk_in_date)
  ) AS x(event_type, event_date)
  WHERE x.event_date IS NOT NULL
    -- Verified-only (Q2): unverified scraped rows stay in the Verification queue
    -- and must not light up the bulletin board.
    AND sn.verified_at IS NOT NULL
)
SELECT
  raw.source_table,
  raw.exam_id,
  raw.edition_id,
  raw.naukri_id,
  raw.slug,
  raw.title,
  raw.pillar,
  raw.region,
  raw.event_type,
  raw.target_section,
  raw.event_date,
  raw.offset_from_days,
  raw.offset_to_days,
  raw.has_content,
  CASE
    WHEN current_date BETWEEN raw.event_date + raw.offset_from_days
                          AND raw.event_date + raw.offset_to_days
         AND current_date >= raw.event_date THEN 'arrived'
    WHEN current_date BETWEEN raw.event_date + raw.offset_from_days
                          AND raw.event_date + raw.offset_to_days
         AND current_date <  raw.event_date THEN 'upcoming'
    WHEN current_date > raw.event_date + raw.offset_to_days THEN 'backlog'
    ELSE 'future'
  END AS bucket,
  (raw.source_table || ':' ||
   COALESCE(raw.edition_id::text, raw.naukri_id::text) || ':' ||
   raw.event_type || ':' || raw.event_date::text || ':' || raw.target_section
  ) AS signal_key
FROM raw;

GRANT SELECT ON public.bulletin_signals TO authenticated;
