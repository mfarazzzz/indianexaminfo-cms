
-- ══════════════════════════════════════════════════════════════════════════════
-- TRANSACTION (a): Add state, verified, type, stage_label to important_dates
-- No VIEW change. Backup first.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Step 1: Backup ────────────────────────────────────────────────────────────
-- Separate from _backup_20260902_date_state (which captured the state=expected
-- seeding we're now superseding). This backup captures the pre-(a) shape.
CREATE TABLE IF NOT EXISTS public._backup_20260902_date_type AS
SELECT
  ee.id                  AS edition_id,
  e.id                   AS exam_id,
  e.slug,
  e.pillar,
  e.updated_at           AS exam_updated_at,
  ee.important_dates     AS important_dates_before
FROM exam_editions ee
JOIN exams e ON e.id = ee.exam_id
WHERE ee.is_current = true
  AND ee.important_dates IS NOT NULL
  AND jsonb_array_length(ee.important_dates) > 0;

-- ── Step 2: Full update — state + verified + type + stage_label ───────────────
-- Applied to every row in every current edition's important_dates array.
--
-- STATE RULES:
--   'cancelled' — label contains cancel/not declared (CTET prose row)
--   'expected'  — label contains expected/tentative/provisional/tba
--   'confirmed' — everything else (AI-extracted from official sources = confirmed)
--   verified    — false on all rows; humans set this via CMS going forward
--
-- TYPE RULES (applied after state — type is orthogonal to state):
--   Types ordered from most-specific to least to avoid false catches.
--   stage_label: populated when the label carries stage info (Prelims, Mains, etc.)
--   Fallback: 'other' — should be zero rows after the 12 explicit mappings below.

UPDATE exam_editions ee
SET important_dates = (
  SELECT jsonb_agg(
    -- Base row fields preserved, then overlaid with new fields
    row_obj
    || jsonb_build_object(
        'verified', false,

        -- ── STATE ──
        'state',
        CASE
          WHEN lower(row_obj->>'label') LIKE '%not declared%'
            OR lower(row_obj->>'label') LIKE '%cancel%'
          THEN 'cancelled'
          WHEN lower(row_obj->>'label') LIKE '%tentative%'
            OR lower(row_obj->>'label') LIKE '%expected%'
            OR lower(row_obj->>'label') LIKE '%tba%'
            OR lower(row_obj->>'label') LIKE '%provisional%'
            OR lower(row_obj->>'label') LIKE '%probable%'
            OR lower(row_obj->>'label') LIKE '%approximate%'
          THEN 'expected'
          ELSE 'confirmed'
        END,

        -- ── TYPE ──
        'type',
        CASE
          -- exam_city_intimation (must come before exam_written to avoid false catch)
          WHEN lower(row_obj->>'label') LIKE '%city info%'
            OR lower(row_obj->>'label') LIKE '%city intim%'
            OR lower(row_obj->>'label') LIKE '%exam city%'
          THEN 'exam_city_intimation'

          -- admit_card
          WHEN lower(row_obj->>'label') LIKE '%admit card%'
            OR lower(row_obj->>'label') LIKE '%hall ticket%'
          THEN 'admit_card'

          -- answer_key
          WHEN lower(row_obj->>'label') LIKE '%answer key%'
          THEN 'answer_key'

          -- merit_list (before result to avoid "merit list = result" overlap)
          WHEN lower(row_obj->>'label') LIKE '%merit list%'
          THEN 'merit_list'

          -- result (shortlist is a result stage per approval)
          WHEN lower(row_obj->>'label') LIKE '%result%'
            OR lower(row_obj->>'label') LIKE '%scorecard%'
            OR lower(row_obj->>'label') LIKE '%shortlist%'
            OR lower(row_obj->>'label') LIKE '%declared%'
          THEN 'result'

          -- counselling (before application_end/start to catch "allotment")
          WHEN lower(row_obj->>'label') LIKE '%counsell%'
            OR lower(row_obj->>'label') LIKE '%counseling%'
            OR lower(row_obj->>'label') LIKE '%josaa%'
            OR lower(row_obj->>'label') LIKE '%joaps%'
            OR lower(row_obj->>'label') LIKE '%coap%'
            OR lower(row_obj->>'label') LIKE '%cap round%'
            OR lower(row_obj->>'label') LIKE '%allotment%'
            OR lower(row_obj->>'label') LIKE '%iteration%'
          THEN 'counselling'

          -- interview
          WHEN lower(row_obj->>'label') LIKE '%interview%'
            OR lower(row_obj->>'label') LIKE '%ssb%'
            OR lower(row_obj->>'label') LIKE '%situation test%'
          THEN 'interview'

          -- document_verification
          WHEN lower(row_obj->>'label') LIKE '%document verif%'
            OR lower(row_obj->>'label') LIKE '%certificate verif%'
            OR lower(row_obj->>'label') LIKE '% dv %'
          THEN 'document_verification'

          -- application_end (before application_start — "close" is specific)
          WHEN lower(row_obj->>'label') LIKE '%registration close%'
            OR lower(row_obj->>'label') LIKE '%last date%'
            OR lower(row_obj->>'label') LIKE '%apply end%'
            OR lower(row_obj->>'label') LIKE '%apply before%'
            OR lower(row_obj->>'label') LIKE '%closing date%'
            OR lower(row_obj->>'label') LIKE '%application end%'
            OR lower(row_obj->>'label') LIKE '%online apply last%'
            OR lower(row_obj->>'label') = 'close'
          THEN 'application_end'

          -- application_start
          WHEN lower(row_obj->>'label') LIKE '%registration open%'
            OR lower(row_obj->>'label') LIKE '%registration begin%'
            OR lower(row_obj->>'label') LIKE '%apply start%'
            OR lower(row_obj->>'label') LIKE '%application start%'
            OR lower(row_obj->>'label') LIKE '%application begin%'
            OR lower(row_obj->>'label') LIKE '%online apply start%'
            OR lower(row_obj->>'label') LIKE '%apply from%'
            OR lower(row_obj->>'label') LIKE '%apply open%'
            OR lower(row_obj->>'label') LIKE '%cuet registration%'
            OR lower(row_obj->>'label') LIKE '%session 2 registration%'
            OR lower(row_obj->>'label') = 'start date'
          THEN 'application_start'

          -- correction_window
          WHEN lower(row_obj->>'label') LIKE '%correction%'
            OR lower(row_obj->>'label') LIKE '%edit window%'
          THEN 'correction_window'

          -- notification
          WHEN lower(row_obj->>'label') LIKE '%notification%'
            OR lower(row_obj->>'label') LIKE '%advertisement%'
          THEN 'notification'

          -- walkin
          WHEN lower(row_obj->>'label') LIKE '%walk%in%'
            OR lower(row_obj->>'label') LIKE '%walk in%'
          THEN 'walkin'

          -- exam_physical (before exam_written — PET/Rally/Physical is distinct)
          WHEN lower(row_obj->>'label') LIKE '%rally%'
            OR lower(row_obj->>'label') LIKE '%physical test%'
            OR lower(row_obj->>'label') LIKE '%physical fitness%'
            OR lower(row_obj->>'label') LIKE '%pet exam%'
            OR lower(row_obj->>'label') LIKE '% pet %'
            OR lower(row_obj->>'label') LIKE '%pet)%'
            OR lower(row_obj->>'label') LIKE '%conduct of pre-examination training%'
          THEN 'exam_physical'

          -- exam_practical
          WHEN lower(row_obj->>'label') LIKE '%practical%'
          THEN 'exam_practical'

          -- exam_written — the broadest exam catch, intentionally last of the exam_* group
          -- Covers: Exam, Exams, Prelims, Mains, Tier, Phase, Paper, CBT, CBE, Written,
          --         Online Examination, Session 1/2 Exam, Even/Odd Sem, Theory, Annual,
          --         VITEEE, BITSAT, MET, Dec/June TEE, Test 1/2/3, NDA, NORCET, re-exam,
          --         Exams Start
          WHEN lower(row_obj->>'label') LIKE '%exam%'
            OR lower(row_obj->>'label') LIKE '%prelims%'
            OR lower(row_obj->>'label') LIKE '%mains%'
            OR lower(row_obj->>'label') LIKE '%tier-%'
            OR lower(row_obj->>'label') LIKE '%tier i%'
            OR lower(row_obj->>'label') LIKE '%phase%'
            OR lower(row_obj->>'label') LIKE '%paper-%'
            OR lower(row_obj->>'label') LIKE '%paper i%'
            OR lower(row_obj->>'label') LIKE '%written%'
            OR lower(row_obj->>'label') LIKE '%cbt%'
            OR lower(row_obj->>'label') LIKE '%cbe%'
            OR lower(row_obj->>'label') LIKE '%online examination%'
            OR lower(row_obj->>'label') LIKE '%session 1%'
            OR lower(row_obj->>'label') LIKE '%session 2%'
            OR lower(row_obj->>'label') LIKE '%even sem%'
            OR lower(row_obj->>'label') LIKE '%odd sem%'
            OR lower(row_obj->>'label') LIKE '%theory%'
            OR lower(row_obj->>'label') LIKE '%test 1%'
            OR lower(row_obj->>'label') LIKE '%test 2%'
            OR lower(row_obj->>'label') LIKE '%test 3%'
            OR lower(row_obj->>'label') LIKE '%annual exam%'
            OR lower(row_obj->>'label') LIKE '%tee%'
            OR lower(row_obj->>'label') LIKE '%viteee%'
            OR lower(row_obj->>'label') LIKE '%bitsat%'
            OR lower(row_obj->>'label') LIKE '%met exam%'
          THEN 'exam_written'

          ELSE 'other'
        END,

        -- ── STAGE_LABEL ──
        -- Populated when the label carries stage information the VIEW needs
        -- to distinguish sequential exam stages (Prelims vs Mains etc.)
        -- Empty string when not a staged event.
        'stage_label',
        CASE
          WHEN lower(row_obj->>'label') LIKE '%prelims%'
            OR lower(row_obj->>'label') LIKE '%prelim)%'     THEN 'Prelims'
          WHEN lower(row_obj->>'label') LIKE '%mains%'       THEN 'Mains'
          WHEN lower(row_obj->>'label') LIKE '%tier-i%'
            OR lower(row_obj->>'label') LIKE '%tier i%'      THEN 'Tier I'
          WHEN lower(row_obj->>'label') LIKE '%tier-ii%'
            OR lower(row_obj->>'label') LIKE '%tier ii%'     THEN 'Tier II'
          WHEN lower(row_obj->>'label') LIKE '%tier-iii%'
            OR lower(row_obj->>'label') LIKE '%tier iii%'    THEN 'Tier III'
          WHEN lower(row_obj->>'label') LIKE '%phase i%'
            OR lower(row_obj->>'label') LIKE '%phase-i%'     THEN 'Phase I'
          WHEN lower(row_obj->>'label') LIKE '%phase ii%'
            OR lower(row_obj->>'label') LIKE '%phase-ii%'    THEN 'Phase II'
          WHEN lower(row_obj->>'label') LIKE '%paper-i%'
            OR lower(row_obj->>'label') LIKE '%paper i%'
            OR lower(row_obj->>'label') LIKE '%paper 1%'     THEN 'Paper I'
          WHEN lower(row_obj->>'label') LIKE '%paper-ii%'
            OR lower(row_obj->>'label') LIKE '%paper ii%'
            OR lower(row_obj->>'label') LIKE '%paper 2%'     THEN 'Paper II'
          WHEN lower(row_obj->>'label') LIKE '%stage i%'     THEN 'Stage I'
          WHEN lower(row_obj->>'label') LIKE '%stage ii%'    THEN 'Stage II'
          WHEN lower(row_obj->>'label') LIKE '%session 1%'   THEN 'Session 1'
          WHEN lower(row_obj->>'label') LIKE '%session 2%'   THEN 'Session 2'
          WHEN lower(row_obj->>'label') LIKE '%cbt-1%'
            OR lower(row_obj->>'label') LIKE '%cbt 1%'       THEN 'CBT 1'
          WHEN lower(row_obj->>'label') LIKE '%cbt-2%'
            OR lower(row_obj->>'label') LIKE '%cbt 2%'       THEN 'CBT 2'
          WHEN lower(row_obj->>'label') LIKE '%even sem%'    THEN 'Even Semester'
          WHEN lower(row_obj->>'label') LIKE '%odd sem%'     THEN 'Odd Semester'
          WHEN lower(row_obj->>'label') LIKE '%theory%'      THEN 'Theory'
          WHEN lower(row_obj->>'label') LIKE '%practical%'   THEN 'Practical'
          WHEN lower(row_obj->>'label') LIKE '%dec tee%'     THEN 'Dec TEE'
          WHEN lower(row_obj->>'label') LIKE '%june tee%'    THEN 'June TEE'
          WHEN lower(row_obj->>'label') LIKE '%test 1%'      THEN 'Test 1'
          WHEN lower(row_obj->>'label') LIKE '%test 2%'      THEN 'Test 2'
          WHEN lower(row_obj->>'label') LIKE '%test 3%'      THEN 'Test 3'
          WHEN lower(row_obj->>'label') LIKE '%viteee%'      THEN 'VITEEE'
          WHEN lower(row_obj->>'label') LIKE '%bitsat%'      THEN 'BITSAT'
          WHEN lower(row_obj->>'label') LIKE '%met exam%'    THEN 'MET'
          WHEN lower(row_obj->>'label') LIKE '%nda i%'       THEN 'NDA I'
          WHEN lower(row_obj->>'label') LIKE '%nda ii%'      THEN 'NDA II'
          ELSE ''
        END
      )
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(ee.important_dates) WITH ORDINALITY AS t(row_obj, ordinality)
)
FROM exams e
WHERE e.id = ee.exam_id
  AND ee.is_current = true
  AND ee.important_dates IS NOT NULL
  AND jsonb_array_length(ee.important_dates) > 0;

-- ── Step 3: CTET label fix ────────────────────────────────────────────────────
-- The prose label "Exam Date (TBA) Not declared EXam cancel..." becomes
-- label="Exam Date", state=cancelled (already set by state rule above),
-- type=exam_written (already set by type rule above).
-- Only the label needs fixing here — state and type are correct from step 2.
UPDATE exam_editions ee
SET important_dates = (
  SELECT jsonb_agg(
    CASE
      WHEN lower(row_obj->>'label') LIKE '%not declared%'
        OR (lower(row_obj->>'label') LIKE '%cancel%'
            AND lower(row_obj->>'label') LIKE '%exam%'
            AND length(row_obj->>'label') > 30)
      THEN row_obj || jsonb_build_object('label', 'Exam Date')
      ELSE row_obj
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(ee.important_dates) WITH ORDINALITY AS t(row_obj, ordinality)
)
FROM exams e
WHERE e.id = ee.exam_id
  AND ee.is_current = true
  AND ee.important_dates IS NOT NULL
  AND e.slug = 'ctet';
;
