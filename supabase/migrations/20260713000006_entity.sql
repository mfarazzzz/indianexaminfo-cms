-- Migration: 006_entity
-- Task: M1-T5
-- Requirements: REQ-006
-- Design: Section 2.5
--
-- This creates the universal content entity table.
-- NOTE: template_snapshot column does NOT exist here — it lives in entity_snapshot (REQ-041.4).
-- The existing `exams` and `content_posts` tables are LEFT INTACT (backward compat).

-- pg_trgm extension needed for live name search (REQ-041)
create extension if not exists pg_trgm;

create table if not exists entity (
  id                  uuid        primary key default gen_random_uuid(),
  entity_type         text        not null default 'exam',
  slug                text        not null,
  name                text        not null check (char_length(name) <= 200),
  short_name          text,
  conducting_body_id  uuid,       -- FK to conducting_body added in migration 008
  official_website    text,
  category_id         uuid,       -- FK to category added in migration 008
  pillar              text        references pillar(slug) on delete restrict,
  content_type_id     uuid        references content_type(id) on delete restrict,
  template_version_id uuid        not null references lifecycle_template_version(id) on delete restrict,
  workflow_status     text        not null default 'draft'
                        check (workflow_status in ('draft','review','published','archived','hidden','deleted')),
  is_featured         boolean     not null default false,
  priority            integer     check (priority between 1 and 999),
  featured_until      date,
  tags                text[]      not null default '{}',
  search_keywords     text[]      not null default '{}',
  lang                text        not null default 'en',
  metadata            jsonb       not null default '{}',
  last_verified_at    timestamptz,
  last_verified_by    uuid        references auth.users(id),
  verification_status text        not null default 'unverified'
                        check (verification_status in ('unverified','verified','needs_reverification')),
  verification_source text,
  verification_notes  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid        references auth.users(id),
  updated_by          uuid        references auth.users(id),
  deleted_at          timestamptz,
  -- Slug unique per pillar among non-deleted records (REQ-006.2)
  constraint uq_entity_slug_pillar unique nulls not distinct (slug, pillar, deleted_at)
);

-- Add FK from entity_snapshot to entity (created in migration 005)
alter table entity_snapshot
  add constraint if not exists fk_snapshot_entity
  foreign key (entity_id) references entity(id) on delete cascade;

-- Indexes
create index if not exists idx_entity_pillar   on entity(pillar)           where deleted_at is null;
create index if not exists idx_entity_status   on entity(workflow_status)  where deleted_at is null;
create index if not exists idx_entity_featured on entity(is_featured, priority) where deleted_at is null;
create index if not exists idx_entity_verified on entity(verification_status, last_verified_at) where deleted_at is null;
create index if not exists idx_entity_updated  on entity(updated_at desc, id) where deleted_at is null;
-- Full-text search
create index if not exists idx_entity_fts on entity
  using gin(to_tsvector('english', name));
-- Live trgm index for sub-300ms search (REQ-026.10, REQ-041)
create index if not exists idx_entity_trgm on entity
  using gin(name gin_trgm_ops);

-- RLS
alter table entity enable row level security;

create policy "entity_select" on entity
  for select to authenticated using (deleted_at is null);

create policy "entity_insert" on entity
  for insert to authenticated
  with check (has_permission('create_entity'));

create policy "entity_update" on entity
  for update to authenticated
  using (
    has_permission('edit_any_entity')
    or (has_permission('edit_own_entity') and created_by = auth.uid())
  );

create policy "entity_delete" on entity
  for delete to authenticated
  using (has_permission('edit_any_entity'));
