-- Migration: 015_relationships_amendments_revisions_localization
-- Milestone: M2-T6, M2-T7, M3-T1, M4-T5
-- Requirements: REQ-019, REQ-033, REQ-018, REQ-016, REQ-031
-- Design: Section 2.14, 2.15, 2.13, 2.16

-- ── entity_relationship ───────────────────────────────────────────────────────

create table if not exists entity_relationship (
  id                uuid        primary key default gen_random_uuid(),
  source_entity_id  uuid        not null references entity(id) on delete cascade,
  target_entity_id  uuid        not null references entity(id) on delete cascade,
  relationship_type text        not null,
  display_order     integer     not null default 0,
  created_at        timestamptz not null default now(),
  created_by        uuid        references auth.users(id),
  deleted_at        timestamptz,
  check (source_entity_id <> target_entity_id),
  unique (source_entity_id, target_entity_id, relationship_type)
);

create index if not exists idx_rel_source
  on entity_relationship(source_entity_id) where deleted_at is null;
create index if not exists idx_rel_target
  on entity_relationship(target_entity_id) where deleted_at is null;

-- ── entity_amendment ──────────────────────────────────────────────────────────

create table if not exists entity_amendment (
  id              uuid        primary key default gen_random_uuid(),
  entity_id       uuid        not null references entity(id) on delete cascade,
  title           text        not null,
  description     text,
  changed_fields  text[]      not null default '{}',
  change_summary  text        not null,
  effective_date  date        not null,
  published_date  timestamptz,
  workflow_status  text        not null default 'draft'
                    check (workflow_status in ('draft','published','archived')),
  display_order   integer     not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid        references auth.users(id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid        references auth.users(id),
  deleted_at      timestamptz
);

create index if not exists idx_amendment_entity
  on entity_amendment(entity_id, effective_date desc) where deleted_at is null;

create trigger entity_amendment_updated_at
  before update on entity_amendment
  for each row execute function set_updated_at();

-- ── entity_revision (version history snapshots) ───────────────────────────────

create table if not exists entity_revision (
  id              uuid        primary key default gen_random_uuid(),
  entity_id       uuid        not null references entity(id) on delete cascade,
  version_number  integer     not null,
  snapshot        jsonb       not null,
  comment         text,
  created_by      uuid        references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (entity_id, version_number)
);

create index if not exists idx_revision_entity
  on entity_revision(entity_id, version_number desc);

-- ── entity_localization (row-per-field translations) ──────────────────────────

create table if not exists entity_localization (
  id            uuid        primary key default gen_random_uuid(),
  entity_id     uuid        not null references entity(id) on delete cascade,
  lang          text        not null,
  field_key     text        not null,
  value         text        not null check (char_length(value) > 0),
  translator_id uuid        references auth.users(id),
  is_reviewed   boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (entity_id, lang, field_key)
);

create index if not exists idx_loc_entity_lang
  on entity_localization(entity_id, lang);

-- ── RLS for all tables ────────────────────────────────────────────────────────

do $$ declare t text; begin
  foreach t in array array[
    'entity_relationship','entity_amendment','entity_revision','entity_localization'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('
      create policy "%s_select" on %I
        for select to authenticated using (true)', t, t);
    execute format('
      create policy "%s_write" on %I
        for all to authenticated
        using (auth.uid() is not null)
        with check (auth.uid() is not null)', t, t);
  end loop;
end $$;
