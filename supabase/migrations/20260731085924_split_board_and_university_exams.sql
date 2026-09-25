
-- Move university categories and their exams to university-exam pillar
UPDATE categories SET pillar = 'university-exam' 
WHERE pillar = 'board-exam' 
AND slug IN ('central-university', 'deemed-university', 'open-university', 'professional-university', 'state-university', 'university-exams');

-- Move exams that belong to university categories
UPDATE exams SET pillar = 'university-exam'
WHERE pillar = 'board-exam'
AND category_id IN (
  SELECT id FROM categories WHERE pillar = 'university-exam'
);
;
