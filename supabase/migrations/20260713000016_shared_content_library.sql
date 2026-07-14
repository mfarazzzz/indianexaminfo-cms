-- Migration: 016_shared_content_library
-- Milestone: M2-T6
-- Requirements: REQ-028
-- Design: Section 2.17

-- ── reusable_component ────────────────────────────────────────────────────────
-- Shared content blocks that can be embedded in any module via reference.

create table if not exists reusable_component (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null unique,
  description text,
  block_type  text        not null,
  content     jsonb       not null default '{}',
  tags        text[]      default '{}',
  created_by  uuid        references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_rc_name
  on reusable_component using gin(to_tsvector('english', name));
create index if not exists idx_rc_tags
  on reusable_component using gin(tags) where deleted_at is null;

create trigger reusable_component_updated_at
  before update on reusable_component
  for each row execute function set_updated_at();

-- ── module_block_component_ref (junction) ─────────────────────────────────────
-- When a module block references a shared component, this junction is created.
-- ON DELETE RESTRICT prevents deleting a shared component that is in use.

create table if not exists module_block_component_ref (
  module_block_id       uuid not null references entity_module_block(id) on delete cascade,
  reusable_component_id uuid not null references reusable_component(id) on delete restrict,
  primary key (module_block_id, reusable_component_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table reusable_component enable row level security;
alter table module_block_component_ref enable row level security;

create policy "rc_select" on reusable_component
  for select to authenticated using (deleted_at is null);
create policy "rc_write" on reusable_component
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "mbcr_select" on module_block_component_ref
  for select to authenticated using (true);
create policy "mbcr_write" on module_block_component_ref
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
