-- Guard: abort if any of the three unexpectedly has content_posts.
do $$
declare v_posts int;
begin
  select count(*) into v_posts from content_posts
   where exam_id in (select id from exams where slug in ('mjpru','jee','testexam'));
  if v_posts > 0 then
    raise exception 'Aborting: stub exams have % content_posts (expected 0).', v_posts;
  end if;
end $$;

-- Delete child editions first, then the exams.
delete from exam_editions
 where exam_id in (select id from exams where slug in ('mjpru','jee','testexam'));

delete from exams
 where slug in ('mjpru','jee','testexam');

-- Drop the orphaned 'university-exams' category (mjpru was its only member),
-- guarded so it only goes if nothing references it.
do $$
declare v_cat_id uuid; v_refs int;
begin
  select id into v_cat_id from categories
    where slug = 'university-exams' and pillar = 'university-exam';
  if v_cat_id is not null then
    select count(*) into v_refs from exams
      where category_id = v_cat_id or subcategory_id = v_cat_id;
    if v_refs = 0 then
      delete from categories where id = v_cat_id;
    end if;
  end if;
end $$;;
