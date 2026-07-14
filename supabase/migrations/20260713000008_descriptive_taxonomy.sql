-- Migration: 008_descriptive_taxonomy
-- Task: M1-T6
-- Requirements: REQ-007
-- Design: Section 2.7
--
-- All 7 descriptive taxonomy tables share the same schema.
-- After creation, FK constraints are added to the entity table.

-- ── Shared column definition macro (via separate CREATE TABLE per table) ───────

create table if not exists conducting_body (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  label       text        not null,
  usage_count integer     not null default 0,
  is_active   boolean     not null default true,
  created_via text        check (created_via in ('taxonomy_manager','inline_create')),
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users(id),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists category (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  label       text        not null,
  usage_count integer     not null default 0,
  is_active   boolean     not null default true,
  created_via text        check (created_via in ('taxonomy_manager','inline_create')),
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users(id),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists department (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  label       text        not null,
  usage_count integer     not null default 0,
  is_active   boolean     not null default true,
  created_via text        check (created_via in ('taxonomy_manager','inline_create')),
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users(id),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists exam_level (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  label       text        not null,
  usage_count integer     not null default 0,
  is_active   boolean     not null default true,
  created_via text        check (created_via in ('taxonomy_manager','inline_create')),
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users(id),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists exam_mode (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  label       text        not null,
  usage_count integer     not null default 0,
  is_active   boolean     not null default true,
  created_via text        check (created_via in ('taxonomy_manager','inline_create')),
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users(id),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists application_mode (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  label       text        not null,
  usage_count integer     not null default 0,
  is_active   boolean     not null default true,
  created_via text        check (created_via in ('taxonomy_manager','inline_create')),
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users(id),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- tag table was already referenced in existing types but may not have the new schema
create table if not exists tag (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  label       text        not null,
  usage_count integer     not null default 0,
  is_active   boolean     not null default true,
  created_via text        check (created_via in ('taxonomy_manager','inline_create')),
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users(id),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

create index if not exists idx_cb_active   on conducting_body(label)    where is_active = true and deleted_at is null;
create index if not exists idx_cat_active  on category(label)           where is_active = true and deleted_at is null;
create index if not exists idx_dept_active on department(label)         where is_active = true and deleted_at is null;
create index if not exists idx_el_active   on exam_level(label)         where is_active = true and deleted_at is null;
create index if not exists idx_em_active   on exam_mode(label)          where is_active = true and deleted_at is null;
create index if not exists idx_am_active   on application_mode(label)   where is_active = true and deleted_at is null;
create index if not exists idx_tag_active  on tag(label)                where is_active = true and deleted_at is null;

-- ── RLS (any authenticated editor can manage descriptive taxonomy) ─────────────

do $$ declare t text; begin
  foreach t in array array['conducting_body','category','department','exam_level','exam_mode','application_mode','tag']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('
      create policy if not exists "%s_select" on %I
        for select to authenticated using (deleted_at is null)', t, t);
    execute format('
      create policy if not exists "%s_write" on %I
        for all to authenticated
        using (auth.uid() is not null)
        with check (auth.uid() is not null)', t, t);
  end loop;
end $$;

-- ── Add FK constraints to entity table now that taxonomy tables exist ──────────

alter table entity
  add constraint if not exists fk_entity_conducting_body
    foreign key (conducting_body_id) references conducting_body(id) on delete set null;

alter table entity
  add constraint if not exists fk_entity_category
    foreign key (category_id) references category(id) on delete set null;

-- ── Taxonomy merge audit log ──────────────────────────────────────────────────

create table if not exists taxonomy_merge_log (
  id             uuid        primary key default gen_random_uuid(),
  taxonomy_table text        not null,
  source_id      uuid        not null,
  source_label   text        not null,
  target_id      uuid        not null,
  target_label   text        not null,
  merged_count   integer     not null,
  merged_by      uuid        references auth.users(id),
  merged_at      timestamptz not null default now()
);

-- ── Seed common taxonomy values ────────────────────────────────────────────────

insert into exam_level (slug, label) values
  ('national', 'National'), ('state', 'State'),
  ('university', 'University'), ('board', 'Board')
on conflict (slug) do nothing;

insert into exam_mode (slug, label) values
  ('online', 'Online'), ('offline', 'Offline / Pen & Paper'), ('hybrid', 'Hybrid')
on conflict (slug) do nothing;

insert into application_mode (slug, label) values
  ('online', 'Online'), ('offline', 'Offline'), ('both', 'Online & Offline')
on conflict (slug) do nothing;
