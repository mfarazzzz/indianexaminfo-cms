
-- Migrate the 8 exams' flat syllabus_highlights[] into structured rows.
-- Each string → a subject row, order preserved, weightage null (unenriched, nothing lost).
-- The old column is NOT dropped here — dropped only after the user verifies the renderer.
insert into exam_syllabus_subjects (exam_id, subject, display_order)
select e.id, s.subject, s.ord - 1
from exams e
cross join lateral unnest(e.syllabus_highlights) with ordinality as s(subject, ord)
where e.syllabus_highlights is not null and array_length(e.syllabus_highlights, 1) > 0;

select e.slug, count(*) as migrated_subjects
from exam_syllabus_subjects ss join exams e on e.id = ss.exam_id
group by e.slug order by e.slug;
;
