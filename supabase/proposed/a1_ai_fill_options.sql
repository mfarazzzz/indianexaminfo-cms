-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSED — NOT APPLIED. Design doc §9 (A1/A2/F2).
-- AI Fill v2: dropdown options are chosen ONLY from values read from the DB, never from
-- the hard-coded prompt enums in src/lib/ai/autofill.ts (category :168; pillar/entityType/
-- status :146-148). The model returns a value + a confidence score; below threshold or no
-- match → the field is left empty, flagged, and a missing option is SUGGESTED. It never
-- verifies and never publishes (R5), so a filled record shows the honest unverified line.
--
-- The official NOTICE is the primary source (PDF upload / pasted text / URL); web search is
-- secondary. The notice PDF is attached to exam_resources
-- (migrations/20260910051703) and recorded as the fill source in ai_metadata
-- (migrations/20260702153457:13-15, jsonb on exams/content_posts/blog_posts).
-- ══════════════════════════════════════════════════════════════════════════════

-- Option sources the AI Fill prompt is assembled from (read-only views):
CREATE OR REPLACE VIEW public.ai_fillable_categories AS
  SELECT slug, name, pillar FROM categories WHERE is_active = true;

-- selection_model / entity_type / exam_status are Postgres ENUMs — their labels are read
-- from pg_enum rather than duplicated in code:
--   SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
--   WHERE t.typname = 'selection_model';    -- merit-based, written-exam, interview-based, internal-admission
--   -- likewise 'entity_type', 'exam_status', 'pillar_type'

-- exam_events.kind vocabulary once d1_exam_events.sql is approved.

-- ai_metadata jsonb CONVENTION (no schema change; document the shape AI Fill writes):
-- {
--   "fill_source": "notice_pdf" | "pasted_text" | "url",
--   "source_document_id": "<exam_resources.id>",
--   "report": {
--     "filled": ["name","categorySlug","selection_model", ...],
--     "skipped": [{ "field":"seat_matrix", "reason":"not in notice" }],
--     "low_confidence": [{ "field":"application_end", "confidence":0.42 }],
--     "missing_options": [{ "field":"categorySlug", "wanted":"teacher-education/d-el-ed" }]
--   },
--   "field_quotes": { "application_fee": "<verbatim line from the notice>" },
--   "verified": false,
--   "published_by_ai": false
-- }
