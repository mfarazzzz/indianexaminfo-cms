-- Add type_fields JSONB column to store entity-type-specific fields
-- (e.g., examDuration, totalMarks, negativeMarking for entrance exams)
ALTER TABLE exams ADD COLUMN IF NOT EXISTS type_fields jsonb DEFAULT '{}'::jsonb;;
