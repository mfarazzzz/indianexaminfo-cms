-- Migration: 014_media_downloads_links_seo
-- Milestone: M2-T4, M2-T5
-- Requirements: REQ-014, REQ-015
-- Design: Section 2.11, 2.12

-- ── entity_seo (1:1 per entity) ───────────────────────────────────────────────

create table if not exists entity_seo (
  id                       uuid        primary key default gen_random_uuid(),
  entity_id                uuid        not null unique references entity(id) on delete cascade,
  seo_title                text,
  meta_description         text,
  focus_keywords           text[]      default '{}',
  canonical_url            text,
  robots                   text        default 'index',
  og_title                 text,
  og_description           text,
  og_image                 text,
  twitter_card             text        default 'summary_large_image',
  twitter_title            text,
  twitter_description      text,
  twitter_image            text,
  faq_schema               jsonb,
  breadcrumb_schema        jsonb,
  custom_json_ld           text,
  schema_org_type_override text,
  seo_score                integer,
  updated_at               timestamptz not null default now(),
  updated_by               uuid        references auth.users(id)
);

create trigger entity_seo_updated_at
  before update on entity_seo
  for each row execute function set_updated_at();

-- ── entity_download (1:N per entity) ──────────────────────────────────────────

create table if not exists entity_download (
  id            uuid        primary key default gen_random_uuid(),
  entity_id     uuid        not null references entity(id) on delete cascade,
  download_name text        not null,
  category      text,
  media_id      uuid,
  external_url  text,
  file_type     text,
  version       text,
  description   text,
  language      text        default 'en',
  is_visible    boolean     not null default true,
  button_text   text        default 'Download',
  display_order integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists idx_download_entity
  on entity_download(entity_id) where deleted_at is null;

-- ── entity_link (1:N per entity) ──────────────────────────────────────────────

create table if not exists entity_link (
  id                 uuid        primary key default gen_random_uuid(),
  entity_id          uuid        not null references entity(id) on delete cascade,
  label              text        not null,
  url                text        not null,
  icon               text,
  button_style       text        default 'primary',
  status             text        not null default 'active'
                       check (status in ('active','inactive')),
  broken_link_status text        default 'unchecked',
  display_order      integer     not null default 0,
  last_checked_at    timestamptz,
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index if not exists idx_link_entity
  on entity_link(entity_id) where deleted_at is null;
create index if not exists idx_link_broken
  on entity_link(entity_id) where broken_link_status = 'broken';

-- ── RLS ───────────────────────────────────────────────────────────────────────

do $$ declare t text; begin
  foreach t in array array['entity_seo','entity_download','entity_link'] loop
    execute format('alter table %I enable row level security', t);
    execute format('
      create policy "%s_select" on %I
        for select to authenticated using (true)', t, t);
    execute format('
      create policy "%s_write" on %I
        for all to authenticated
        using (has_permission(''manage_entity_seo'') or has_permission(''edit_any_entity'')
               or has_permission(''edit_own_entity''))', t, t);
  end loop;
end $$;
