
DROP POLICY IF EXISTS "public_read_exam_editions" ON exam_editions;

CREATE POLICY "public_read_exam_editions" ON exam_editions
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = exam_editions.exam_id
        AND exams.is_published = true
    )
  );
;
