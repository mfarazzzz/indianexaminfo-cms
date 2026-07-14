-- Migration: 012_modules_blocks
-- Milestone: M2-T2
-- Requirements: REQ-012
-- Design: Section 2.9

create table if not exists entity_module (
  id                   uuid        primary key default gen_random_uuid(),
  entity_id            uuid        not null references entity(id) on delete cascade,
  module_type          text        not null,
  sub_title            text        check (char_length(sub_title) <= 200),
  title                text        check (char_length(title) <= 200),
  workflow_status      text        not null default 'draft'
                         check (workflow_status in ('draft','review','published')),
  is_featured          boolean     not null default false,
  tags                 text[]      not null default '{}',
  scheduled_publish_at timestamptz,
  published_at         timestamptz,
  published_by         uuid        references auth.users(id),
  seo_override_title   text        check (char_length(seo_override_title) <= 60),
  seo_override_desc    text        check (char_length(seo_override_desc) <= 160),
  display_order        integer     not null default 0,
  metadata             jsonb       not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid        references auth.users(id),
  updated_by           uuid        references auth.users(id),
  deleted_at           timestamptz,
  constraint uq_module_sub_title
    unique nulls not distinct (entity_id, module_type, sub_title, deleted_at)
);

create index if not exists idx_module_entity
  on entity_module(entity_id, display_order) where deleted_at is null;
create index if not exists idx_module_type
  on entity_module(module_type) where deleted_at is null;

create trigger entity_module_updated_at
  before update on entity_module
  for each row execute function set_updated_at();

-- ── module_block ──────────────────────────────────────────────────────────────

create table if not exists entity_module_block (
  id            uuid        primary key default gen_random_uuid(),
  module_id     uuid        not null references entity_module(id) on delete cascade,
  block_type    text        not null,
  display_order integer     not null default 0,
  content       jsonb       not null default '{}',
  is_visible    boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint chk_rich_text_length check (
    block_type <> 'rich_text' or char_length(content->>'html') <= 50000
  )
);

create index if not exists idx_block_module
  on entity_module_block(module_id, display_order) where deleted_at is null;

create trigger entity_module_block_updated_at
  before update on entity_module_block
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table entity_module enable row level security;
alter table entity_module_block enable row level security;

create policy "em_select" on entity_module
  for select to authenticated using (deleted_at is null);
create policy "em_write" on entity_module
  for all to authenticated
  using (has_permission('create_entity') or has_permission('edit_any_entity')
         or has_permission('edit_own_entity'));

create policy "mb_select" on entity_module_block
  for select to authenticated using (deleted_at is null);
create policy "mb_write" on entity_module_block
  for all to authenticated
  using (has_permission('create_entity') or has_permission('edit_any_entity')
         or has_permission('edit_own_entity'));

-- ── Add FK from entity_activity_log.module_id ─────────────────────────────────
alter table entity_activity_log
  add constraint if not exists fk_alog_module
  foreign key (module_id) references entity_module(id) on delete set null;
