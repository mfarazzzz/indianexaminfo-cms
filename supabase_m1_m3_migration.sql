-- =============================================================================
-- M1–M3 Migration: Content OS Tables
-- Run this in Supabase SQL Editor AFTER supabase_schema.sql
-- This adds the entity, module, block, and all satellite tables.
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- =============================================================================

-- =============================================================================
-- ENTITY (parent table — replaces the legacy exams table for the new editor)
-- =============================================================================

create table if not exists entity (
  id                   uuid primary key default gen_random_uuid(),
  entity_type          text not null default 'exam',       -- free-text: exam, job, scholarship, etc.
  slug                 text not null,
  name                 text not null,
  short_name           text,
  conducting_body      text,
  official_website     text,
  category_id          uuid references categories(id) on delete set null,
  pillar               text,
  sub_type             text,
  exam_level           text,
  exam_mode            text,
  application_mode     text,
  exam_frequency       text,
  workflow_status      text not null default 'draft',
  is_featured          boolean not null default false,
  priority             integer,
  featured_until       timestamptz,
  tags                 text[] not null default '{}',
  search_keywords      text[] not null default '{}',
  scheduled_publish_at timestamptz,
  published_at         timestamptz,
  published_by         uuid references auth.users(id) on delete set null,
  lang                 text not null default 'en',
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id) on delete set null,
  updated_by           uuid references auth.users(id) on delete set null,
  deleted_at           timestamptz,
  unique (slug, pillar)
);

create index if not exists entity_entity_type_idx    on entity(entity_type);
create index if not exists entity_slug_idx           on entity(slug);
create index if not exists entity_pillar_idx         on entity(pillar);
create index if not exists entity_workflow_status_idx on entity(workflow_status);
create index if not exists entity_is_featured_idx    on entity(is_featured);
create index if not exists entity_deleted_at_idx     on entity(deleted_at);
create index if not exists entity_tags_idx           on entity using gin(tags);
create index if not exists entity_keywords_idx       on entity using gin(search_keywords);

-- updated_at trigger
drop trigger if exists entity_set_updated_at on entity;
create trigger entity_set_updated_at
  before update on entity
  for each row execute function set_updated_at();

-- RLS
alter table entity enable row level security;
create policy if not exists "staff_read_entity"   on entity for select using (auth.uid() is not null);
create policy if not exists "staff_write_entity"  on entity for insert with check (auth.uid() is not null);
create policy if not exists "staff_update_entity" on entity for update using (auth.uid() is not null);
create policy if not exists "admin_delete_entity" on entity for delete using (current_user_role() in ('super-admin','admin'));

-- =============================================================================
-- ENTITY SEO
-- =============================================================================

create table if not exists entity_seo (
  id                  uuid primary key default gen_random_uuid(),
  entity_id           uuid not null references entity(id) on delete cascade,
  seo_title           text,
  meta_description    text,
  focus_keywords      text[] not null default '{}',
  canonical_url       text,
  robots              text not null default 'index',
  og_title            text,
  og_description      text,
  og_image            text,
  twitter_card        text not null default 'summary_large_image',
  twitter_title       text,
  twitter_description text,
  twitter_image       text,
  faq_schema          jsonb,
  breadcrumb_schema   jsonb,
  custom_json_ld      text,
  seo_score           integer,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users(id) on delete set null,
  unique (entity_id)
);

alter table entity_seo enable row level security;
create policy if not exists "staff_read_entity_seo"   on entity_seo for select using (auth.uid() is not null);
create policy if not exists "staff_write_entity_seo"  on entity_seo for all using (auth.uid() is not null);

-- =============================================================================
-- ENTITY TIMELINE EVENT
-- =============================================================================

create table if not exists entity_timeline_event (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entity(id) on delete cascade,
  title          text not null,
  event_type     text not null,
  event_date     date not null,
  event_time     time,
  description    text,
  status         text not null default 'upcoming',
  badge_color    text not null default 'blue',
  is_highlighted boolean not null default false,
  is_featured    boolean not null default false,
  official_link  text,
  pdf_link       text,
  image_url      text,
  visibility     text not null default 'public',
  display_order  integer not null default 0,
  publish_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index if not exists entity_timeline_entity_id_idx on entity_timeline_event(entity_id);
create index if not exists entity_timeline_event_date_idx on entity_timeline_event(event_date);
create index if not exists entity_timeline_deleted_at_idx on entity_timeline_event(deleted_at);

alter table entity_timeline_event enable row level security;
create policy if not exists "staff_read_timeline"   on entity_timeline_event for select using (auth.uid() is not null);
create policy if not exists "staff_write_timeline"  on entity_timeline_event for all using (auth.uid() is not null);

-- =============================================================================
-- ENTITY ELIGIBILITY
-- =============================================================================

create table if not exists entity_eligibility (
  id                   uuid primary key default gen_random_uuid(),
  entity_id            uuid not null references entity(id) on delete cascade,
  min_age              integer,
  max_age              integer,
  age_relaxation       jsonb not null default '[]'::jsonb,
  nationality          text,
  education            text,
  experience           text,
  max_attempts         integer,
  physical_standards   text,
  medical_standards    text,
  language_requirements text,
  updated_at           timestamptz not null default now(),
  unique (entity_id)
);

alter table entity_eligibility enable row level security;
create policy if not exists "staff_rw_eligibility" on entity_eligibility for all using (auth.uid() is not null);

-- =============================================================================
-- ENTITY VACANCY
-- =============================================================================

create table if not exists entity_vacancy (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entity(id) on delete cascade,
  category      text not null,
  label         text not null,
  value         integer not null default 0,
  notes         text,
  display_order integer not null default 0,
  deleted_at    timestamptz
);

create index if not exists entity_vacancy_entity_id_idx on entity_vacancy(entity_id);
alter table entity_vacancy enable row level security;
create policy if not exists "staff_rw_vacancy" on entity_vacancy for all using (auth.uid() is not null);

-- =============================================================================
-- ENTITY FEE
-- =============================================================================

create table if not exists entity_fee (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entity(id) on delete cascade,
  general       integer,
  obc           integer,
  sc            integer,
  st            integer,
  ews           integer,
  pwd           integer,
  female        integer,
  payment_modes text[] not null default '{}',
  refund_rules  text,
  updated_at    timestamptz not null default now(),
  unique (entity_id)
);

alter table entity_fee enable row level security;
create policy if not exists "staff_rw_fee" on entity_fee for all using (auth.uid() is not null);

-- =============================================================================
-- ENTITY EXAM PATTERN
-- =============================================================================

create table if not exists entity_exam_pattern (
  id               uuid primary key default gen_random_uuid(),
  entity_id        uuid not null references entity(id) on delete cascade,
  stage_name       text not null,
  duration_minutes integer,
  total_questions  integer,
  total_marks      integer,
  negative_marking numeric(5,2),
  subjects         text[] not null default '{}',
  exam_language    text,
  qualifying_marks text,
  notes            text,
  display_order    integer not null default 0,
  deleted_at       timestamptz
);

create index if not exists entity_exam_pattern_entity_id_idx on entity_exam_pattern(entity_id);
alter table entity_exam_pattern enable row level security;
create policy if not exists "staff_rw_exam_pattern" on entity_exam_pattern for all using (auth.uid() is not null);

-- =============================================================================
-- ENTITY SELECTION STAGE
-- =============================================================================

create table if not exists entity_selection_stage (
  id                uuid primary key default gen_random_uuid(),
  entity_id         uuid not null references entity(id) on delete cascade,
  stage_name        text not null,
  description       text,
  marks             integer,
  weightage_percent numeric(5,2),
  is_qualifying     boolean not null default false,
  notes             text,
  display_order     integer not null default 0,
  deleted_at        timestamptz
);

create index if not exists entity_selection_entity_id_idx on entity_selection_stage(entity_id);
alter table entity_selection_stage enable row level security;
create policy if not exists "staff_rw_selection" on entity_selection_stage for all using (auth.uid() is not null);

-- =============================================================================
-- ENTITY SYLLABUS SUBJECT
-- =============================================================================

create table if not exists entity_syllabus_subject (
  id                uuid primary key default gen_random_uuid(),
  entity_id         uuid not null references entity(id) on delete cascade,
  subject_name      text not null,
  topics            text[] not null default '{}',
  description       text,
  pdf_url           text,
  video_link        text,
  study_notes       text,
  books             text,
  weightage_percent numeric(5,2),
  display_order     integer not null default 0,
  deleted_at        timestamptz
);

create index if not exists entity_syllabus_entity_id_idx on entity_syllabus_subject(entity_id);
alter table entity_syllabus_subject enable row level security;
create policy if not exists "staff_rw_syllabus" on entity_syllabus_subject for all using (auth.uid() is not null);

-- =============================================================================
-- ENTITY DOWNLOAD
-- =============================================================================

create table if not exists entity_download (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entity(id) on delete cascade,
  download_name text not null,
  category      text,
  media_id      uuid,
  external_url  text,
  file_type     text,
  version       text,
  description   text,
  language      text not null default 'en',
  is_visible    boolean not null default true,
  button_text   text not null default 'Download',
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists entity_download_entity_id_idx on entity_download(entity_id);
alter table entity_download enable row level security;
create policy if not exists "staff_rw_download" on entity_download for all using (auth.uid() is not null);

-- =============================================================================
-- ENTITY LINK
-- =============================================================================

create table if not exists entity_link (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entity(id) on delete cascade,
  label         text not null,
  url           text not null,
  icon          text,
  button_style  text not null default 'primary',
  status        text not null default 'active',
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists entity_link_entity_id_idx on entity_link(entity_id);
alter table entity_link enable row level security;
create policy if not exists "staff_rw_link" on entity_link for all using (auth.uid() is not null);

-- =============================================================================
-- ENTITY MODULE (M3)
-- =============================================================================

create table if not exists entity_module (
  id                  uuid primary key default gen_random_uuid(),
  entity_id           uuid not null references entity(id) on delete cascade,
  module_type         text not null,
  sub_title           text,
  display_order       integer not null default 0,
  workflow_status     text not null default 'draft',
  is_featured         boolean not null default false,
  tags                text[] not null default '{}',
  scheduled_publish_at timestamptz,
  published_at        timestamptz,
  published_by        uuid references auth.users(id) on delete set null,
  seo_override_title  text,
  seo_override_desc   text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  updated_by          uuid references auth.users(id) on delete set null,
  deleted_at          timestamptz
);

create index if not exists entity_module_entity_id_idx on entity_module(entity_id);
create index if not exists entity_module_deleted_at_idx on entity_module(deleted_at);
create index if not exists entity_module_type_idx on entity_module(module_type);

drop trigger if exists entity_module_set_updated_at on entity_module;
create trigger entity_module_set_updated_at
  before update on entity_module
  for each row execute function set_updated_at();

alter table entity_module enable row level security;
create policy if not exists "staff_read_module"   on entity_module for select using (auth.uid() is not null);
create policy if not exists "staff_write_module"  on entity_module for all using (auth.uid() is not null);

-- =============================================================================
-- ENTITY MODULE BLOCK (M3)
-- =============================================================================

create table if not exists entity_module_block (
  id            uuid primary key default gen_random_uuid(),
  module_id     uuid not null references entity_module(id) on delete cascade,
  block_type    text not null,
  display_order integer not null default 0,
  content       jsonb not null default '{}'::jsonb,
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists entity_module_block_module_id_idx on entity_module_block(module_id);
create index if not exists entity_module_block_deleted_at_idx on entity_module_block(deleted_at);

drop trigger if exists entity_module_block_set_updated_at on entity_module_block;
create trigger entity_module_block_set_updated_at
  before update on entity_module_block
  for each row execute function set_updated_at();

alter table entity_module_block enable row level security;
create policy if not exists "staff_read_block"  on entity_module_block for select using (auth.uid() is not null);
create policy if not exists "staff_write_block" on entity_module_block for all using (auth.uid() is not null);

-- =============================================================================
-- Done. All M1–M3 tables are created.
-- Verify with: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- =============================================================================
