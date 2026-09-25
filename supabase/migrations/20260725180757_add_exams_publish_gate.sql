-- T3.7: Add publish gate to exams table.
-- Currently `public_read_exams` uses `qual = true`, so any saved exam is
-- immediately visible to the public. This adds a boolean is_published gate.

-- Step 1: Add column
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

-- Step 2: Backfill — all existing 131 rows are already live, mark them published
UPDATE exams SET is_published = true;

-- Step 3: Replace the overly-permissive public read policy
DROP POLICY IF EXISTS public_read_exams ON exams;
CREATE POLICY public_read_published_exams ON exams
  FOR SELECT TO public
  USING (is_published = true);

-- The staff_read_all_exams policy (qual = auth.uid() IS NOT NULL) stays — CMS
-- users can see both published and unpublished exams when authenticated.

-- Step 4: Add a partial index for the common frontend query pattern
CREATE INDEX IF NOT EXISTS idx_exams_published
  ON exams (pillar, is_featured DESC, updated_at DESC)
  WHERE is_published = true;;
