alter table exams add column if not exists region text;

comment on column exams.region is
  'State-page routing key -> regions(slug). all-india = national (no state page). Central universities are all-india; the Central group comes from category. Required at creation via the CMS picker (no DB default).';

alter table exams drop constraint if exists exams_region_fkey;
alter table exams
  add constraint exams_region_fkey
  foreign key (region) references regions(slug)
  on update cascade on delete restrict;

create index if not exists exams_region_idx on exams(region);
