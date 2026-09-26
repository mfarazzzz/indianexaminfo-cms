-- Migration B (separate transaction — runs after A committed, so the new
-- 'university-exam' enum value is usable here).

-- The 27 records in the University Exams pillar are the institution's own
-- semester/term-end exams. After the rename they read 'university-admission',
-- which is wrong — re-point them to the new 'university-exam' value.
update exams
  set entity_type = 'university-exam'
  where pillar = 'university-exam' and entity_type = 'university-admission';

-- ibps-po was mistyped as 'exam' (an entrance-exam type) though it is a
-- government recruitment. Correct it so the CHECK constraint (migration C) holds.
update exams
  set entity_type = 'recruitment'
  where slug = 'ibps-po' and pillar = 'government-exam' and entity_type = 'exam';
