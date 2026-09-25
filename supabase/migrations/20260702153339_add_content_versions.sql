
-- Version history — stores JSON snapshots of content before each update
-- Single table covers exams, content_posts, blog_posts, pages
-- Restoring: read snapshot jsonb and write fields back via CMS

create table if not exists content_versions (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in ('exam','content_post','blog_post','page')),
  entity_id    uuid not null,
  version      integer not null,
  title        text,                    -- denormalized for quick list display
  snapshot     jsonb not null,          -- full row at time of save
  changed_by   uuid references auth.users(id) on delete set null,
  change_note  text,
  created_at   timestamptz not null default now(),
  unique (entity_type, entity_id, version)
);

create index if not exists content_versions_entity_idx on content_versions(entity_type, entity_id);
create index if not exists content_versions_created_idx on content_versions(created_at desc);

alter table content_versions enable row level security;

create policy "staff_read_versions"
  on content_versions for select
  using (auth.uid() is not null);

create policy "staff_insert_versions"
  on content_versions for insert
  with check (auth.uid() is not null);

-- Helper function: called by CMS before any UPDATE to save a snapshot
-- Usage: select save_content_version('exam', <id>, <changed_by_uid>, 'optional note');
create or replace function save_content_version(
  p_entity_type text,
  p_entity_id   uuid,
  p_changed_by  uuid,
  p_note        text default null
)
returns integer language plpgsql security definer
set search_path = public, pg_catalog as $$
declare
  v_version  integer;
  v_snapshot jsonb;
  v_title    text;
begin
  -- Get next version number
  select coalesce(max(version), 0) + 1
  into v_version
  from content_versions
  where entity_type = p_entity_type and entity_id = p_entity_id;

  -- Capture snapshot based on entity type
  case p_entity_type
    when 'exam' then
      select to_jsonb(e), e.name into v_snapshot, v_title from exams e where id = p_entity_id;
    when 'content_post' then
      select to_jsonb(c), c.title into v_snapshot, v_title from content_posts c where id = p_entity_id;
    when 'blog_post' then
      select to_jsonb(b), b.title into v_snapshot, v_title from blog_posts b where id = p_entity_id;
    when 'page' then
      select to_jsonb(p), p.title into v_snapshot, v_title from pages p where id = p_entity_id;
  end case;

  if v_snapshot is null then
    raise exception 'Entity not found: % %', p_entity_type, p_entity_id;
  end if;

  insert into content_versions (entity_type, entity_id, version, title, snapshot, changed_by, change_note)
  values (p_entity_type, p_entity_id, v_version, v_title, v_snapshot, p_changed_by, p_note);

  return v_version;
end;
$$;

-- Limit to 50 versions per entity to prevent unbounded growth
create or replace function prune_content_versions()
returns trigger language plpgsql set search_path = public, pg_catalog as $$
begin
  delete from content_versions
  where id in (
    select id from content_versions
    where entity_type = new.entity_type and entity_id = new.entity_id
    order by version desc
    offset 50
  );
  return new;
end;
$$;

drop trigger if exists trg_prune_versions on content_versions;
create trigger trg_prune_versions
  after insert on content_versions
  for each row execute function prune_content_versions();
;
