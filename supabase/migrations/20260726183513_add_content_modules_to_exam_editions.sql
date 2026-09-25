
-- Add content_modules JSONB column to exam_editions
-- Stores all structured content: step guides, exam pattern, syllabus, news, links, etc.
ALTER TABLE exam_editions ADD COLUMN IF NOT EXISTS content_modules jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add expanded FAQs column (separate from exam-level faqs, edition-specific)
-- Supports up to 15+ FAQs with rich answers
ALTER TABLE exam_editions ADD COLUMN IF NOT EXISTS faqs jsonb NOT NULL DEFAULT '[]'::jsonb;
;
