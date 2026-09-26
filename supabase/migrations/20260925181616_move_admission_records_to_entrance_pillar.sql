-- Move 4 admission records that have no entrance twin from the University Exams
-- pillar to entrance-exam / university-entrance, keeping their slugs.
--   du-admission, jnu-admission, bhu-uet  (central-university admissions; CUET-route)
--   amity-entrance                        (private university own entrance)
-- Region: du/jnu/bhu already all-india; amity moves uttar-pradesh -> all-india
-- (a private university's own entrance is national, per the entrance rule).

create table if not exists admission_move_backup_20260925 as
select id, slug, pillar, category_id, region from exams
where slug in ('du-admission','jnu-admission','bhu-uet','amity-entrance');

update exams
  set pillar = 'entrance-exam',
      category_id = 'd053d44d-ccb9-4724-957f-846679ca9739'  -- entrance-exam/university-entrance
  where slug in ('du-admission','jnu-admission','bhu-uet','amity-entrance');

update exams set region = 'all-india' where slug = 'amity-entrance';
