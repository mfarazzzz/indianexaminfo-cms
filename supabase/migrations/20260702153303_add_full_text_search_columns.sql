
-- Full-text search via immutable function wrapper
-- array_to_string is not marked immutable in all PG versions; use a trigger-maintained tsvector instead

-- exams
alter table exams add column if not exists fts tsvector;
create index if not exists exams_fts_idx on exams using gin(fts);

create or replace function update_exams_fts()
returns trigger language plpgsql set search_path = public, pg_catalog as $$
begin
  new.fts := to_tsvector('english',
    coalesce(new.name,'') || ' ' ||
    coalesce(new.short_name,'') || ' ' ||
    coalesce(new.conducting_body,'') || ' ' ||
    coalesce(array_to_string(new.tags,' '),'') || ' ' ||
    coalesce(array_to_string(new.search_keywords,' '),'')
  );
  return new;
end;
$$;
drop trigger if exists trg_exams_fts on exams;
create trigger trg_exams_fts
  before insert or update on exams
  for each row execute function update_exams_fts();

-- Backfill existing rows
update exams set fts = to_tsvector('english',
  coalesce(name,'') || ' ' || coalesce(short_name,'') || ' ' ||
  coalesce(conducting_body,'') || ' ' ||
  coalesce(array_to_string(tags,' '),'') || ' ' ||
  coalesce(array_to_string(search_keywords,' '),'')
);

-- content_posts
alter table content_posts add column if not exists fts tsvector;
create index if not exists content_posts_fts_idx on content_posts using gin(fts);

create or replace function update_content_posts_fts()
returns trigger language plpgsql set search_path = public, pg_catalog as $$
begin
  new.fts := to_tsvector('english',
    coalesce(new.title,'') || ' ' ||
    coalesce(new.excerpt,'') || ' ' ||
    coalesce(new.exam_entity_name,'') || ' ' ||
    coalesce(array_to_string(new.tags,' '),'')
  );
  return new;
end;
$$;
drop trigger if exists trg_content_posts_fts on content_posts;
create trigger trg_content_posts_fts
  before insert or update on content_posts
  for each row execute function update_content_posts_fts();

update content_posts set fts = to_tsvector('english',
  coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' ||
  coalesce(exam_entity_name,'') || ' ' || coalesce(array_to_string(tags,' '),'')
);

-- blog_posts
alter table blog_posts add column if not exists fts tsvector;
create index if not exists blog_posts_fts_idx on blog_posts using gin(fts);

create or replace function update_blog_posts_fts()
returns trigger language plpgsql set search_path = public, pg_catalog as $$
begin
  new.fts := to_tsvector('english',
    coalesce(new.title,'') || ' ' ||
    coalesce(new.excerpt,'') || ' ' ||
    coalesce(array_to_string(new.tags,' '),'')
  );
  return new;
end;
$$;
drop trigger if exists trg_blog_posts_fts on blog_posts;
create trigger trg_blog_posts_fts
  before insert or update on blog_posts
  for each row execute function update_blog_posts_fts();

update blog_posts set fts = to_tsvector('english',
  coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' ||
  coalesce(array_to_string(tags,' '),'')
);
;
