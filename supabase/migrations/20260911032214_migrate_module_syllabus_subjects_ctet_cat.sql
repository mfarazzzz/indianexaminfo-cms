
-- Carry structured syllabus from content_modules.syllabus.subjects (flat string arrays) into
-- exam_syllabus_subjects for the 2 exams (CTET, CAT) that stored it in the module blob rather
-- than the column. Same shape as the column migration: subject name, order preserved, no weightage.
-- (Found by the user's "did anything get entered since?" check — the earlier migration only
-- carried the syllabus_highlights COLUMN, not the module.)
insert into exam_syllabus_subjects (exam_id, subject, display_order)
select e.id, s.subject::text, s.ord - 1
from exams e
join exam_editions ed on ed.id = e.current_edition_id
cross join lateral jsonb_array_elements_text(ed.content_modules->'syllabus'->'subjects') with ordinality as s(subject, ord)
where e.slug in ('ctet','cat')
  and jsonb_array_length(coalesce(ed.content_modules->'syllabus'->'subjects','[]'::jsonb)) > 0
  and not exists (select 1 from exam_syllabus_subjects x where x.exam_id = e.id);

select e.slug, array_agg(ss.subject order by ss.display_order) as subjects
from exam_syllabus_subjects ss join exams e on e.id = ss.exam_id
where e.slug in ('ctet','cat')
group by e.slug;
;
