-- ═══════════════════════════════════════════════════════════════════════════════════
-- PROPOSED — READ-ONLY COUNTS. NOT APPLIED. NOTHING HERE WRITES ANYTHING.
-- R-track (editor refactor): live non-empty counts for every column / JSONB key that
-- the retirement plan proposes to drop (docs/design/editor-refactor.md §7).
-- Owner rule: nothing is retired without a count first.
--
-- RUN 2026-10-03 against project "IEI" (ref cwbhhcqsrbuoybeaondk). Results are pasted
-- under each query. These queries are corrected to the REAL schema — note:
--   * exam_editions and exams have NO `deleted_at` column (soft-delete is not used here).
--   * exam_editions.vacancy is `integer`; exam_editions.selection lives on exams as
--     `exams.selection_process` which is a text ARRAY (not JSONB).
--   * the /entities workspace table is `entity` (singular); there is NO entity_modules
--     or editorial_content table.
-- ═══════════════════════════════════════════════════════════════════════════════════

-- ── 1. exam_editions.has_* flags — dead to the frontend (presence rule replaced them;
--       sectionRegistry.ts hasData() has no flags in HasDataView). Still WRITTEN on
--       every editor Save (EntranceExamEditorPage.tsx:411-418) but no live UI controls them.
SELECT
  count(*)                                AS total_editions,
  count(*) FILTER (WHERE has_notification) AS has_notification_true,
  count(*) FILTER (WHERE has_application)  AS has_application_true,
  count(*) FILTER (WHERE has_admit_card)   AS has_admit_card_true,
  count(*) FILTER (WHERE has_syllabus)     AS has_syllabus_true,
  count(*) FILTER (WHERE has_answer_key)   AS has_answer_key_true,
  count(*) FILTER (WHERE has_result)       AS has_result_true,
  count(*) FILTER (WHERE has_cutoff)       AS has_cutoff_true,
  count(*) FILTER (WHERE has_counselling)  AS has_counselling_true
FROM exam_editions;
-- RESULT: total 399 | notification 390 | application 390 | admit_card 385 | syllabus 293
--         | answer_key 260 | result 385 | cutoff 223 | counselling 9.
--         Flags are near-universally TRUE and NO frontend reader exists → stop writing
--         (R0), drop after removing the FE mapRow SELECT at examService.ts:210-220.

-- ── 2. exam_editions.notification_date — no exam-side frontend reader; duplicate of the
--       "Notification Release" important_dates row.
SELECT
  count(*) FILTER (WHERE notification_date IS NOT NULL) AS editions_with_notification_date,
  count(*) FILTER (
    WHERE notification_date IS NOT NULL
      AND COALESCE(important_dates, '[]'::jsonb) @> '[{"type":"notification"}]'::jsonb
  ) AS also_have_notification_row
FROM exam_editions;
-- RESULT: 201 editions have notification_date; only 39 of those ALSO have a
--         {"type":"notification"} row in important_dates. => ~162 editions would LOSE the
--         notification date if the column is dropped without migrating the value into a row
--         FIRST. Migration is mandatory before drop (R4), not optional.
--         Cross-check: important_dates rows carrying type "notification" total 41 across all
--         editions (see §6b), i.e. the row store is barely populated.

-- ── 3. exam_editions.faqs — the editor writes it as a SHADOW COPY of exams.faqs
--       (EntranceExamEditorPage.tsx:419). Frontend reads exams.faqs only.
SELECT
  count(ed.*) AS editions_with_faqs,
  count(*) FILTER (WHERE coalesce(e.faqs, '[]'::jsonb) = coalesce(ed.faqs, '[]'::jsonb)) AS identical_to_exams_faqs
FROM exam_editions ed
JOIN exams e ON e.id = ed.exam_id
WHERE coalesce(ed.faqs, '[]'::jsonb) <> '[]'::jsonb;
-- RESULT: 12 editions have edition-level faqs; 8 identical to exams.faqs, so 4 DIVERGE.
--         R0.8 stops the shadow write; before DROP (R4) rescue the 4 divergent rows.

-- ── 4. exam_editions.age_limit / result_summary / counselling_data — no frontend reader.
SELECT
  count(*) FILTER (WHERE age_limit        IS NOT NULL) AS age_limit_set,
  count(*) FILTER (WHERE result_summary   IS NOT NULL) AS result_summary_set,
  count(*) FILTER (WHERE counselling_data IS NOT NULL) AS counselling_data_set,
  count(*) FILTER (WHERE vacancy          IS NOT NULL) AS vacancy_set  -- KEEP: vacancy IS read
FROM exam_editions;                                                    -- (examService.ts:152)
-- RESULT: age_limit 0 | result_summary 0 | counselling_data 0 | vacancy 198.
--         The three empty columns are safe to drop outright (no data, no reader).
--         vacancy is NOT a retire candidate — it has a live reader and 198 rows.

-- ── 5. content_modules JSONB keys ───────────────────────────────────────────────────
SELECT
  count(*) FILTER (WHERE jsonb_typeof(coalesce(content_modules,'{}'::jsonb) -> 'newsSeo')='object')               AS with_newsseo,
  count(*) FILTER (WHERE jsonb_typeof(coalesce(content_modules,'{}'::jsonb) -> '_config' -> 'modes') IS NOT NULL) AS with_modes,
  count(*) FILTER (WHERE jsonb_typeof(coalesce(content_modules,'{}'::jsonb) -> '_config' -> 'moduleOrder')='array') AS with_moduleorder,
  count(*) FILTER (WHERE jsonb_typeof(coalesce(content_modules,'{}'::jsonb) -> '_config' -> 'enabledModules') IS NOT NULL) AS with_enabledmodules
FROM exam_editions;
-- RESULT: newsSeo 2 | modes 7 | moduleOrder 279 | enabledModules 279.
--         newsSeo (R0.1) and modes (R0.2) are tiny and have NO reader → stop writing, strip
--         opportunistically. enabledModules is the ONE _config key the frontend honours
--         (sectionRegistry.ts:242-247) → KEEP. moduleOrder is written 279× but ignored by the
--         site (registry order wins) → stop writing (R0.3), drop opportunistically.

-- ── 6. exam_editions.status — frontend reads ONLY 'cancelled'/'postponed'
--       (examService.ts:196-204); every other value is overridden by the derived view.
SELECT status, count(*) AS n FROM exam_editions GROUP BY status ORDER BY n DESC;
-- RESULT: upcoming 381 | result-declared 9 | completed 7 | registration-open 2. NO rows
--         currently hold cancelled/postponed, so the stored column is 100% decoration today.
-- NOTE: exam_editions has no CHECK constraint on status (it is an enum type; the only
--       chk_* constraints are session and year).

-- ── 6b. important_dates row-type distribution (informs the notification-row migration §2)
SELECT jsonb_extract_path_text(d,'type') AS row_type, count(*)
FROM exam_editions, jsonb_array_elements(coalesce(important_dates,'[]'::jsonb)) d
GROUP BY 1 ORDER BY count(*) DESC;
-- RESULT: exam_written 246 | result 46 | application_end 43 | notification 41 |
--         application_start 40 | counselling 17 | admit_card 12 | exam_physical 12 |
--         walkin 6 | answer_key 5 | (null) 5 | exam_practical 2 | interview 2 |
--         merit_list 2 | application_correction 1 | exam_city_intimation 1.

-- ── 7. P1 GAP SIZING — data that IS live but has NO editor input (proves R1 is needed):
SELECT
  count(*) FILTER (WHERE coalesce(eligibility, '{}'::jsonb) ->> 'qualification' <> '') AS editions_with_eligibility_data,
  count(*) FILTER (WHERE coalesce(application_fee, '{}'::jsonb) <> '{}'::jsonb)         AS editions_with_fee_data
FROM exam_editions;
-- RESULT: eligibility 376 editions, fee 322 editions have real data with no editable input.
SELECT count(*) FILTER (WHERE coalesce(selection_process,'{}') <> '{}') AS exams_with_selection_process,
       count(*) FILTER (WHERE coalesce(faqs,'[]'::jsonb) <> '[]'::jsonb) AS exams_with_faqs
FROM exams;
-- RESULT: selection_process 279 exams, faqs 134 exams. (selection_process is a text[] on
--         exams, NOT JSONB — hence the '{}' comparison.)

-- ── 8. /entities workspace blast radius (R4 delete-after-confirmation). Table is `entity`
--       (singular); there is NO entity_modules / editorial_content table.
SELECT (SELECT count(*) FROM entity) AS entity_rows;
-- RESULT: entity_rows = 3. Near-empty workspace, zero frontend readers → cheap to retire.

-- ── 9. R0.10 — content_modules.news shape distribution ────────────────────────────
-- The canonical presence-rule shape is { items: [...] } (object).
-- A legacy bare array would be invisible to sectionRegistry hasData().
SELECT jsonb_typeof(content_modules->'news') AS news_type, count(*) AS cnt
FROM exam_editions WHERE content_modules ? 'news' GROUP BY 1 ORDER BY cnt DESC;
-- RESULT (2026-10-04): object 274 | bare_array 0.
-- All 274 rows already carry {items:[…]} — no data migration required.
-- The tolerant reader in the NewsTab is defensive only (protects future edge cases).
