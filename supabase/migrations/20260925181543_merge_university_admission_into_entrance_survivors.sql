-- Merge six admission records that were mispillared under University Exams into
-- their existing Admissions (entrance-exam) twins, preserving BOTH sides'
-- content, then delete the university-side duplicates.
--   bits-pilani-exam -> bitsat        vit-viteee      -> viteee
--   srm-entrance     -> srmjeee       manipal-entrance -> met-manipal
--   amu-admission    -> amu-entrance  jamia-admission  -> jmi-entrance
-- Survivors carry NO content_modules, so copying the university-side modules
-- into them cannot overwrite anything. Empty-shell survivors (met-manipal,
-- amu-entrance, jmi-entrance) also receive the university-side important_dates.

-- Backup the 12 editions (survivors + university-side sources) before merge.
create table if not exists uni_merge_backup_20260925 as
select ed.* from exam_editions ed
where ed.id in (
  '3e6d6ed5-4599-4bb5-afa6-6a92223fa4bf', -- amu-admission
  '9484cc67-3270-4e0d-a58c-0bd1ef23c4fc', -- jamia-admission
  'c606fe8e-928b-400a-a1bf-89867e11ca0c', -- bits-pilani-exam
  '605f3409-a4ce-4093-8b09-66bdc20dc1a7', -- vit-viteee
  'a27393d8-d73b-418b-ba85-bd5f9fd5507a', -- srm-entrance
  '161ab550-ac67-4339-826f-a886b053f5f3', -- manipal-entrance
  'b607969e-7d75-4fae-917f-4337e58fa8be', -- bitsat
  'def7cb89-dd24-4561-95c2-da989318aec3', -- viteee
  '26d7bd5b-db26-4292-993a-38b52fcf98d5', -- srmjeee
  'd974160d-a738-4b69-a14b-1d5370d5f490', -- met-manipal
  '711a91ec-e6f2-4eae-9694-dd4b0040ab26', -- amu-entrance
  '44991e93-4a9f-42e3-9138-a2f6ee9ac8ac'  -- jmi-entrance
);

-- bitsat <- bits-pilani-exam (survivor keeps its 5 dates; gains the modules)
update exam_editions dst
  set content_modules = src.content_modules
  from exam_editions src
  where dst.id = 'b607969e-7d75-4fae-917f-4337e58fa8be'
    and src.id = 'c606fe8e-928b-400a-a1bf-89867e11ca0c'
    and (dst.content_modules is null or dst.content_modules = '{}'::jsonb);
-- viteee <- vit-viteee
update exam_editions dst
  set content_modules = src.content_modules
  from exam_editions src
  where dst.id = 'def7cb89-dd24-4561-95c2-da989318aec3'
    and src.id = '605f3409-a4ce-4093-8b09-66bdc20dc1a7'
    and (dst.content_modules is null or dst.content_modules = '{}'::jsonb);
-- srmjeee <- srm-entrance
update exam_editions dst
  set content_modules = src.content_modules
  from exam_editions src
  where dst.id = '26d7bd5b-db26-4292-993a-38b52fcf98d5'
    and src.id = 'a27393d8-d73b-418b-ba85-bd5f9fd5507a'
    and (dst.content_modules is null or dst.content_modules = '{}'::jsonb);

-- Empty-shell survivors: copy BOTH content_modules AND important_dates.
-- met-manipal <- manipal-entrance
update exam_editions dst
  set content_modules = src.content_modules,
      important_dates = case when coalesce(jsonb_array_length(dst.important_dates),0) = 0
                            then src.important_dates else dst.important_dates end
  from exam_editions src
  where dst.id = 'd974160d-a738-4b69-a14b-1d5370d5f490'
    and src.id = '161ab550-ac67-4339-826f-a886b053f5f3'
    and (dst.content_modules is null or dst.content_modules = '{}'::jsonb);
-- amu-entrance <- amu-admission
update exam_editions dst
  set content_modules = src.content_modules,
      important_dates = case when coalesce(jsonb_array_length(dst.important_dates),0) = 0
                            then src.important_dates else dst.important_dates end
  from exam_editions src
  where dst.id = '711a91ec-e6f2-4eae-9694-dd4b0040ab26'
    and src.id = '3e6d6ed5-4599-4bb5-afa6-6a92223fa4bf'
    and (dst.content_modules is null or dst.content_modules = '{}'::jsonb);
-- jmi-entrance <- jamia-admission
update exam_editions dst
  set content_modules = src.content_modules,
      important_dates = case when coalesce(jsonb_array_length(dst.important_dates),0) = 0
                            then src.important_dates else dst.important_dates end
  from exam_editions src
  where dst.id = '44991e93-4a9f-42e3-9138-a2f6ee9ac8ac'
    and src.id = '9484cc67-3270-4e0d-a58c-0bd1ef23c4fc'
    and (dst.content_modules is null or dst.content_modules = '{}'::jsonb);

-- Delete the 6 merged university-side records (editions first).
delete from exam_editions where exam_id in (
  select id from exams where slug in
    ('bits-pilani-exam','vit-viteee','srm-entrance','manipal-entrance','amu-admission','jamia-admission')
);
delete from exams where slug in
  ('bits-pilani-exam','vit-viteee','srm-entrance','manipal-entrance','amu-admission','jamia-admission');
