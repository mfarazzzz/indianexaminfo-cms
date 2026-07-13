-- =============================================================================
-- M3.8 / M3.9 Content OS Architecture — Complete Fresh-Install Schema
-- IndianExamInfo Content Operating System
-- =============================================================================
-- Run this on a fresh Supabase project to get the complete M3.8+ schema.
-- Idempotent: safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT).
-- Prerequisites: supabase_schema.sql must have been run first (auth, storage, etc.)
-- =============================================================================

-- =============================================================================
-- HELPER: set_updated_at trigger function (create if not exists)
-- =============================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

-- =============================================================================
-- HELPER: slugify function
-- =============================================================================

create or replace function slugify(input text)
returns text as $$
begin
  return lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(trim(input), '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
end;
$$ language plpgsql immutable;

-- =============================================================================
-- DROP LEGACY TABLES (clean slate — no production data)
-- =============================================================================

drop table if exists exams cascade;
drop table if exists content_posts cascade;

-- =============================================================================
-- STRUCTURAL TAXONOMY TIER 1: PILLAR
-- =============================================================================

create table if not exists pillar (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  label         text not null,
  description   text,
  icon          text,
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

drop trigger if exists pillar_set_updated_at on pillar;
create trigger pillar_set_updated_at
  before update on pillar
  for each row execute function set_updated_at();

alter table pillar enable row level security;
create policy if not exists "all_read_pillar"   on pillar for select using (true);
create policy if not exists "admin_write_pillar" on pillar for all
  using (auth.uid() is not null);

-- =============================================================================
-- STRUCTURAL TAXONOMY TIER 2: CONTENT TYPE
-- =============================================================================

create table if not exists content_type (
  id                      uuid primary key default gen_random_uuid(),
  pillar_id               uuid not null references pillar(id) on delete cascade,
  slug                    text not null unique,
  label                   text not null,
  url_pattern             text not null default '/{pillar}/{slug}',
  default_schema_org_type text not null default 'Article',
  is_active               boolean not null default true,
  display_order           integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

create index if not exists content_type_pillar_id_idx on content_type(pillar_id);

drop trigger if exists content_type_set_updated_at on content_type;
create trigger content_type_set_updated_at
  before update on content_type
  for each row execute function set_updated_at();

alter table content_type enable row level security;
create policy if not exists "all_read_content_type"    on content_type for select using (true);
create policy if not exists "admin_write_content_type" on content_type for all
  using (auth.uid() is not null);

-- =============================================================================
-- STRUCTURAL TAXONOMY TIER 3: LIFECYCLE TEMPLATE
-- =============================================================================

create table if not exists lifecycle_template (
  id                       uuid primary key default gen_random_uuid(),
  pillar_id                uuid not null references pillar(id) on delete cascade,
  name                     text not null,
  slug                     text not null unique,
  description              text,
  -- Configuration JSONB fields (denormalised into versions at save time)
  default_modules          jsonb not null default '[]'::jsonb,
  default_timeline_stages  jsonb not null default '[]'::jsonb,
  default_validation_rules jsonb not null default '{}'::jsonb,
  default_schema_org_type  text not null default 'Article',
  lifecycle_rules          jsonb not null default '[]'::jsonb,
  frontend_layout          text not null default 'default_layout',
  -- NO default_workflow_template_id: workflow is universal (ADR-007)
  is_active                boolean not null default true,
  display_order            integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz
);

create index if not exists lifecycle_template_pillar_id_idx on lifecycle_template(pillar_id);

drop trigger if exists lifecycle_template_set_updated_at on lifecycle_template;
create trigger lifecycle_template_set_updated_at
  before update on lifecycle_template
  for each row execute function set_updated_at();

alter table lifecycle_template enable row level security;
create policy if not exists "all_read_lifecycle_template"    on lifecycle_template for select using (true);
create policy if not exists "admin_write_lifecycle_template" on lifecycle_template for all
  using (auth.uid() is not null);

-- =============================================================================
-- STRUCTURAL TAXONOMY TIER 4: LIFECYCLE TEMPLATE VERSION
-- Immutable after insert — configuration JSONB is never updated
-- =============================================================================

create table if not exists lifecycle_template_version (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references lifecycle_template(id) on delete cascade,
  version_number integer not null,
  configuration  jsonb not null,  -- IMMUTABLE: never UPDATE this column
  change_summary text,
  is_active      boolean not null default false,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (template_id, version_number)
);

-- Enforce: only one active version per template
create unique index if not exists ltv_one_active_per_template
  on lifecycle_template_version(template_id)
  where is_active = true;

create index if not exists ltv_template_id_idx on lifecycle_template_version(template_id);

alter table lifecycle_template_version enable row level security;
create policy if not exists "all_read_ltv"    on lifecycle_template_version for select using (true);
create policy if not exists "admin_write_ltv" on lifecycle_template_version for all
  using (auth.uid() is not null);

-- =============================================================================
-- DESCRIPTIVE TAXONOMY TABLES (editor-managed)
-- All follow the same schema pattern
-- =============================================================================

create table if not exists conducting_body (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  usage_count integer not null default 0,
  is_active   boolean not null default true,
  created_via text,  -- 'taxonomy_manager' | 'inline_create'
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

drop trigger if exists conducting_body_set_updated_at on conducting_body;
create trigger conducting_body_set_updated_at
  before update on conducting_body
  for each row execute function set_updated_at();

alter table conducting_body enable row level security;
create policy if not exists "staff_rw_conducting_body" on conducting_body for all
  using (auth.uid() is not null);

-- ----

create table if not exists department (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  usage_count integer not null default 0,
  is_active   boolean not null default true,
  created_via text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

drop trigger if exists department_set_updated_at on department;
create trigger department_set_updated_at
  before update on department
  for each row execute function set_updated_at();

alter table department enable row level security;
create policy if not exists "staff_rw_department" on department for all
  using (auth.uid() is not null);

-- ----

create table if not exists tag (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  usage_count integer not null default 0,
  is_active   boolean not null default true,
  created_via text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

drop trigger if exists tag_set_updated_at on tag;
create trigger tag_set_updated_at
  before update on tag
  for each row execute function set_updated_at();

alter table tag enable row level security;
create policy if not exists "staff_rw_tag" on tag for all
  using (auth.uid() is not null);

-- ----

create table if not exists exam_level (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  usage_count integer not null default 0,
  is_active   boolean not null default true,
  created_via text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

drop trigger if exists exam_level_set_updated_at on exam_level;
create trigger exam_level_set_updated_at
  before update on exam_level
  for each row execute function set_updated_at();

alter table exam_level enable row level security;
create policy if not exists "staff_rw_exam_level" on exam_level for all
  using (auth.uid() is not null);

-- ----

create table if not exists exam_mode (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  usage_count integer not null default 0,
  is_active   boolean not null default true,
  created_via text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

drop trigger if exists exam_mode_set_updated_at on exam_mode;
create trigger exam_mode_set_updated_at
  before update on exam_mode
  for each row execute function set_updated_at();

alter table exam_mode enable row level security;
create policy if not exists "staff_rw_exam_mode" on exam_mode for all
  using (auth.uid() is not null);

-- ----

create table if not exists application_mode (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  usage_count integer not null default 0,
  is_active   boolean not null default true,
  created_via text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

drop trigger if exists application_mode_set_updated_at on application_mode;
create trigger application_mode_set_updated_at
  before update on application_mode
  for each row execute function set_updated_at();

alter table application_mode enable row level security;
create policy if not exists "staff_rw_application_mode" on application_mode for all
  using (auth.uid() is not null);

-- =============================================================================
-- ENTITY — Universal parent content record
-- All content lives here regardless of pillar or domain (ADR-001)
-- =============================================================================

create table if not exists entity (
  id                   uuid primary key default gen_random_uuid(),
  -- Identity
  entity_type          text not null default 'exam',     -- free-text, extensible (ADR-001)
  slug                 text not null,
  name                 text not null,
  short_name           text,
  -- Classification
  pillar               text references pillar(slug) on update cascade,
  content_type_id      uuid references content_type(id) on delete set null,
  template_version_id  uuid references lifecycle_template_version(id) on delete set null,
  template_snapshot    jsonb not null default '{}'::jsonb,  -- IMMUTABLE (ADR-005)
  -- Descriptive fields (FK to taxonomy tables)
  conducting_body_id   uuid references conducting_body(id) on delete set null,
  category_id          uuid references categories(id) on delete set null,
  department_id        uuid references department(id) on delete set null,
  exam_level_id        uuid references exam_level(id) on delete set null,
  exam_mode_id         uuid references exam_mode(id) on delete set null,
  application_mode_id  uuid references application_mode(id) on delete set null,
  -- Legacy text fields (kept for backwards compatibility, populate conducting_body_id preferred)
  official_website     text,
  sub_type             text,
  exam_frequency       text,
  -- Editorial Workflow (ADR-007 — universal, no per-template variance)
  workflow_status      text not null default 'draft'
    check (workflow_status in ('draft','review','published','archived','hidden','deleted')),
  -- Publication
  is_featured          boolean not null default false,
  priority             integer,
  featured_until       timestamptz,
  scheduled_publish_at timestamptz,
  published_at         timestamptz,
  published_by         uuid references auth.users(id) on delete set null,
  -- Search
  tags                 text[] not null default '{}',
  search_keywords      text[] not null default '{}',
  -- Localization
  lang                 text not null default 'en',
  -- Verification (ADR-011 — separate from updated_at)
  last_verified_at     timestamptz,
  last_verified_by     uuid references auth.users(id) on delete set null,
  -- Template-specific fields (dynamic field definitions with storeIn:'metadata')
  metadata             jsonb not null default '{}'::jsonb,
  -- Audit
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id) on delete set null,
  updated_by           uuid references auth.users(id) on delete set null,
  deleted_at           timestamptz,
  -- Constraints
  unique (slug, pillar)
);

-- Indexes
create index if not exists entity_entity_type_idx      on entity(entity_type);
create index if not exists entity_slug_idx             on entity(slug);
create index if not exists entity_pillar_idx           on entity(pillar);
create index if not exists entity_content_type_id_idx  on entity(content_type_id);
create index if not exists entity_workflow_status_idx  on entity(workflow_status);
create index if not exists entity_is_featured_idx      on entity(is_featured);
create index if not exists entity_deleted_at_idx       on entity(deleted_at);
create index if not exists entity_tags_idx             on entity using gin(tags);
create index if not exists entity_keywords_idx         on entity using gin(search_keywords);
create index if not exists entity_template_version_idx on entity(template_version_id);
create index if not exists entity_last_verified_idx    on entity(last_verified_at);

-- updated_at trigger
drop trigger if exists entity_set_updated_at on entity;
create trigger entity_set_updated_at
  before update on entity
  for each row execute function set_updated_at();

-- RLS
alter table entity enable row level security;
create policy if not exists "staff_read_entity"   on entity for select using (auth.uid() is not null);
create policy if not exists "staff_insert_entity" on entity for insert with check (auth.uid() is not null);
create policy if not exists "staff_update_entity" on entity for update using (auth.uid() is not null);
create policy if not exists "admin_delete_entity" on entity for delete
  using (auth.uid() is not null);

-- =============================================================================
-- ENTITY SEO — 1:1 satellite
-- =============================================================================

create table if not exists entity_seo (
  id                      uuid primary key default gen_random_uuid(),
  entity_id               uuid not null references entity(id) on delete cascade,
  seo_title               text,
  meta_description        text,
  focus_keywords          text[] not null default '{}',
  canonical_url           text,
  robots                  text not null default 'index',
  og_title                text,
  og_description          text,
  og_image                text,
  twitter_card            text not null default 'summary_large_image',
  twitter_title           text,
  twitter_description     text,
  twitter_image           text,
  schema_org_type_override text,  -- NEW: override template default (ADR-012)
  faq_schema              jsonb,
  breadcrumb_schema       jsonb,
  custom_json_ld          text,
  seo_score               integer,
  updated_at              timestamptz not null default now(),
  updated_by              uuid references auth.users(id) on delete set null,
  unique (entity_id)
);

alter table entity_seo enable row level security;
create policy if not exists "staff_rw_entity_seo" on entity_seo for all
  using (auth.uid() is not null);

-- =============================================================================
-- ENTITY TIMELINE EVENT — Timeline instances (ADR-013: split from definitions)
-- Definitions live in template_snapshot.defaultTimelineStages
-- Instances live here with loose coupling via stage_key (not a FK)
-- =============================================================================

create table if not exists entity_timeline_event (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entity(id) on delete cascade,
  -- Loose reference to template's stage definition (NOT a FK — ADR-013)
  stage_key      text,           -- e.g. 'application', 'exam', 'result'
  event_subtype  text,           -- e.g. 'application_open', 'application_close'
  -- Event data
  title          text not null,
  event_type     text not null,
  event_date     date,           -- nullable: stubs created without dates
  event_time     time,
  description    text,
  status         text not null default 'pending'
    check (status in ('pending','upcoming','active','passed','postponed','cancelled')),
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

create index if not exists entity_timeline_entity_id_idx  on entity_timeline_event(entity_id);
create index if not exists entity_timeline_stage_key_idx  on entity_timeline_event(stage_key);
create index if not exists entity_timeline_event_date_idx on entity_timeline_event(event_date);
create index if not exists entity_timeline_deleted_at_idx on entity_timeline_event(deleted_at);

drop trigger if exists entity_timeline_set_updated_at on entity_timeline_event;
create trigger entity_timeline_set_updated_at
  before update on entity_timeline_event
  for each row execute function set_updated_at();

alter table entity_timeline_event enable row level security;
create policy if not exists "staff_rw_timeline" on entity_timeline_event for all
  using (auth.uid() is not null);

-- =============================================================================
-- ENTITY RELATIONSHIP — Typed directional many-to-many (ADR-009)
-- =============================================================================

create table if not exists entity_relationship (
  id                uuid primary key default gen_random_uuid(),
  source_entity_id  uuid not null references entity(id) on delete cascade,
  target_entity_id  uuid not null references entity(id) on delete cascade,
  relationship_type text not null,  -- free-text: 'parent_exam', 'related_news', etc.
  display_order     integer not null default 0,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  deleted_at        timestamptz,
  -- No self-reference
  constraint no_self_relationship check (source_entity_id <> target_entity_id),
  -- No duplicate active relationships
  unique (source_entity_id, target_entity_id, relationship_type)
);

create index if not exists entity_relationship_source_idx on entity_relationship(source_entity_id);
create index if not exists entity_relationship_target_idx on entity_relationship(target_entity_id);

alter table entity_relationship enable row level security;
create policy if not exists "staff_rw_relationship" on entity_relationship for all
  using (auth.uid() is not null);

-- =============================================================================
-- ENTITY AMENDMENT — Corrigendum / corrections (ADR-008-amendments)
-- =============================================================================

create table if not exists entity_amendment (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references entity(id) on delete cascade,
  title           text not null,
  description     text,
  changed_fields  text[] not null default '{}',
  change_summary  text not null,
  effective_date  date not null,
  published_date  timestamptz,
  workflow_status text not null default 'draft'
    check (workflow_status in ('draft','published','archived')),
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id) on delete set null,
  deleted_at      timestamptz
);

create index if not exists entity_amendment_entity_id_idx    on entity_amendment(entity_id);
create index if not exists entity_amendment_effective_dt_idx on entity_amendment(effective_date);

drop trigger if exists entity_amendment_set_updated_at on entity_amendment;
create trigger entity_amendment_set_updated_at
  before update on entity_amendment
  for each row execute function set_updated_at();

alter table entity_amendment enable row level security;
create policy if not exists "staff_rw_amendment" on entity_amendment for all
  using (auth.uid() is not null);

-- =============================================================================
-- ENTITY LOCALIZATION — Row-per-field translations (ADR-008)
-- =============================================================================

create table if not exists entity_localization (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entity(id) on delete cascade,
  lang          text not null,        -- 'hi', 'en', 'ta', etc.
  field_key     text not null,        -- 'name', 'overview', 'seo_title', etc.
  value         text not null,
  translator_id uuid references auth.users(id) on delete set null,
  is_reviewed   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (entity_id, lang, field_key)
);

create index if not exists entity_localization_entity_lang_idx on entity_localization(entity_id, lang);
create index if not exists entity_localization_lang_idx        on entity_localization(lang);

drop trigger if exists entity_localization_set_updated_at on entity_localization;
create trigger entity_localization_set_updated_at
  before update on entity_localization
  for each row execute function set_updated_at();

alter table entity_localization enable row level security;
create policy if not exists "staff_rw_localization" on entity_localization for all
  using (auth.uid() is not null);

-- =============================================================================
-- ENTITY SLUG HISTORY — Append-only redirect chain (never delete rows)
-- =============================================================================

create table if not exists entity_slug_history (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entity(id) on delete cascade,
  old_slug      text not null,
  new_slug      text not null,
  pillar_slug   text not null,
  redirect_type text not null default '301'
    check (redirect_type in ('301','302')),
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
  -- NO deleted_at: this table is append-only (governance policy)
);

create index if not exists entity_slug_history_old_slug_idx on entity_slug_history(old_slug, pillar_slug);
create index if not exists entity_slug_history_entity_id_idx on entity_slug_history(entity_id);

alter table entity_slug_history enable row level security;
create policy if not exists "staff_read_slug_history"  on entity_slug_history for select using (auth.uid() is not null);
create policy if not exists "staff_insert_slug_history" on entity_slug_history for insert with check (auth.uid() is not null);
-- Intentionally no UPDATE or DELETE policy (append-only)

-- =============================================================================
-- ENTITY EVENT LOG — Extension point for automation (dispatcher deferred to M8+)
-- =============================================================================

create table if not exists entity_event_log (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid references entity(id) on delete cascade,
  event_type  text not null,  -- 'workflow.published', 'timeline.result_set', etc.
  actor_id    uuid references auth.users(id) on delete set null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists entity_event_log_entity_id_idx  on entity_event_log(entity_id);
create index if not exists entity_event_log_event_type_idx on entity_event_log(event_type);
create index if not exists entity_event_log_created_at_idx on entity_event_log(created_at);

alter table entity_event_log enable row level security;
create policy if not exists "staff_insert_event_log" on entity_event_log for insert with check (auth.uid() is not null);
create policy if not exists "admin_read_event_log"   on entity_event_log for select using (auth.uid() is not null);

-- =============================================================================
-- SATELLITE TABLES (retained from M1–M3 with adjustments)
-- These are domain-specific structured tables that remain as dedicated satellites
-- because their data is frequently queried/filtered (see design.md §Critical Decision 3)
-- =============================================================================

create table if not exists entity_eligibility (
  id                    uuid primary key default gen_random_uuid(),
  entity_id             uuid not null references entity(id) on delete cascade,
  min_age               integer,
  max_age               integer,
  age_relaxation        jsonb not null default '[]'::jsonb,
  nationality           text,
  education             text,
  experience            text,
  max_attempts          integer,
  physical_standards    text,
  medical_standards     text,
  language_requirements text,
  updated_at            timestamptz not null default now(),
  unique (entity_id)
);

alter table entity_eligibility enable row level security;
create policy if not exists "staff_rw_eligibility" on entity_eligibility for all
  using (auth.uid() is not null);

-- ----

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
create policy if not exists "staff_rw_vacancy" on entity_vacancy for all
  using (auth.uid() is not null);

-- ----

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
create policy if not exists "staff_rw_fee" on entity_fee for all
  using (auth.uid() is not null);

-- ----

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
create policy if not exists "staff_rw_exam_pattern" on entity_exam_pattern for all
  using (auth.uid() is not null);

-- ----

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
create policy if not exists "staff_rw_selection" on entity_selection_stage for all
  using (auth.uid() is not null);

-- ----

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
create policy if not exists "staff_rw_syllabus" on entity_syllabus_subject for all
  using (auth.uid() is not null);

-- ----

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
create policy if not exists "staff_rw_download" on entity_download for all
  using (auth.uid() is not null);

-- ----

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
create policy if not exists "staff_rw_link" on entity_link for all
  using (auth.uid() is not null);

-- =============================================================================
-- MODULE SYSTEM (M3 — retained)
-- =============================================================================

create table if not exists entity_module (
  id                   uuid primary key default gen_random_uuid(),
  entity_id            uuid not null references entity(id) on delete cascade,
  module_type          text not null,
  sub_title            text,
  display_order        integer not null default 0,
  workflow_status      text not null default 'draft',
  is_featured          boolean not null default false,
  tags                 text[] not null default '{}',
  scheduled_publish_at timestamptz,
  published_at         timestamptz,
  published_by         uuid references auth.users(id) on delete set null,
  seo_override_title   text,
  seo_override_desc    text,
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id) on delete set null,
  updated_by           uuid references auth.users(id) on delete set null,
  deleted_at           timestamptz
);

create index if not exists entity_module_entity_id_idx  on entity_module(entity_id);
create index if not exists entity_module_deleted_at_idx on entity_module(deleted_at);
create index if not exists entity_module_type_idx       on entity_module(module_type);

drop trigger if exists entity_module_set_updated_at on entity_module;
create trigger entity_module_set_updated_at
  before update on entity_module
  for each row execute function set_updated_at();

alter table entity_module enable row level security;
create policy if not exists "staff_rw_module" on entity_module for all
  using (auth.uid() is not null);

-- ----

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

create index if not exists entity_module_block_module_id_idx  on entity_module_block(module_id);
create index if not exists entity_module_block_deleted_at_idx on entity_module_block(deleted_at);

drop trigger if exists entity_module_block_set_updated_at on entity_module_block;
create trigger entity_module_block_set_updated_at
  before update on entity_module_block
  for each row execute function set_updated_at();

alter table entity_module_block enable row level security;
create policy if not exists "staff_rw_block" on entity_module_block for all
  using (auth.uid() is not null);

-- =============================================================================
-- ENTITY REVISION — Full snapshots at key milestones
-- =============================================================================

create table if not exists entity_revision (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references entity(id) on delete cascade,
  version_number integer not null,
  snapshot       jsonb not null,   -- full EntityFull serialized
  snapshot_hash  text,             -- SHA-256 for integrity
  trigger_event  text,             -- 'workflow.published' | 'manual'
  comment        text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists entity_revision_entity_id_idx on entity_revision(entity_id);
alter table entity_revision enable row level security;
create policy if not exists "staff_read_revision"  on entity_revision for select using (auth.uid() is not null);
create policy if not exists "staff_insert_revision" on entity_revision for insert with check (auth.uid() is not null);

-- =============================================================================
-- ENTITY ACTIVITY LOG — Audit trail (append-only)
-- =============================================================================

create table if not exists entity_activity_log (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid references entity(id) on delete cascade,
  module_id   uuid references entity_module(id) on delete set null,
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  changes     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists entity_activity_log_entity_id_idx on entity_activity_log(entity_id);
create index if not exists entity_activity_log_actor_id_idx  on entity_activity_log(actor_id);
create index if not exists entity_activity_log_created_at_idx on entity_activity_log(created_at);

alter table entity_activity_log enable row level security;
create policy if not exists "staff_insert_activity_log" on entity_activity_log for insert with check (auth.uid() is not null);
create policy if not exists "admin_read_activity_log"   on entity_activity_log for select using (auth.uid() is not null);

-- =============================================================================
-- SEED DATA — Initial structural taxonomy
-- =============================================================================

-- PILLARS
insert into pillar (slug, label, description, display_order, is_active) values
  ('recruitment',    'Recruitment',         'Government and PSU recruitment notifications', 1, true),
  ('entrance-exam',  'Entrance Exams',      'National, state, and university entrance examinations', 2, true),
  ('board-university','University / Board', 'Board exams and university semester examinations', 3, true),
  ('news-editorial', 'News & Editorial',    'Education news, guides, blogs, and editorials', 4, true)
on conflict (slug) do nothing;

-- CONTENT TYPES
with p as (select id, slug from pillar)
insert into content_type (pillar_id, slug, label, url_pattern, default_schema_org_type, display_order) values
  -- Recruitment
  ((select id from p where slug='recruitment'), 'notification',   'Notification',    '/{pillar}/{slug}', 'JobPosting', 1),
  ((select id from p where slug='recruitment'), 'result',         'Result',          '/{pillar}/{slug}', 'Article',    2),
  ((select id from p where slug='recruitment'), 'admit_card',     'Admit Card',      '/{pillar}/{slug}', 'Article',    3),
  ((select id from p where slug='recruitment'), 'answer_key',     'Answer Key',      '/{pillar}/{slug}', 'Article',    4),
  ((select id from p where slug='recruitment'), 'cutoff',         'Cutoff',          '/{pillar}/{slug}', 'Article',    5),
  ((select id from p where slug='recruitment'), 'vacancy_details','Vacancy Details', '/{pillar}/{slug}', 'JobPosting', 6),
  ((select id from p where slug='recruitment'), 'application',    'Application',     '/{pillar}/{slug}', 'JobPosting', 7),
  -- Entrance Exams
  ((select id from p where slug='entrance-exam'), 'entrance_notification','Notification',  '/{pillar}/{slug}', 'Article',  1),
  ((select id from p where slug='entrance-exam'), 'entrance_result',      'Result',        '/{pillar}/{slug}', 'Article',  2),
  ((select id from p where slug='entrance-exam'), 'entrance_answer_key',  'Answer Key',    '/{pillar}/{slug}', 'Article',  3),
  ((select id from p where slug='entrance-exam'), 'counselling',          'Counselling',   '/{pillar}/{slug}', 'Article',  4),
  ((select id from p where slug='entrance-exam'), 'seat_allotment',       'Seat Allotment','/{pillar}/{slug}', 'Article',  5),
  -- University / Board
  ((select id from p where slug='board-university'), 'exam_schedule',  'Exam Schedule', '/{pillar}/{slug}', 'Course',   1),
  ((select id from p where slug='board-university'), 'hall_ticket',    'Hall Ticket',   '/{pillar}/{slug}', 'Article',  2),
  ((select id from p where slug='board-university'), 'board_result',   'Result',        '/{pillar}/{slug}', 'Article',  3),
  ((select id from p where slug='board-university'), 'revaluation',    'Revaluation',   '/{pillar}/{slug}', 'Article',  4),
  -- News & Editorial
  ((select id from p where slug='news-editorial'), 'news',      'News',      '/{pillar}/{slug}', 'NewsArticle', 1),
  ((select id from p where slug='news-editorial'), 'editorial', 'Editorial', '/{pillar}/{slug}', 'Article',     2),
  ((select id from p where slug='news-editorial'), 'guide',     'Guide',     '/{pillar}/{slug}', 'HowTo',       3),
  ((select id from p where slug='news-editorial'), 'faq',       'FAQ',       '/{pillar}/{slug}', 'FAQPage',     4),
  ((select id from p where slug='news-editorial'), 'blog_post', 'Blog Post', '/{pillar}/{slug}', 'BlogPosting', 5),
  ((select id from p where slug='news-editorial'), 'analysis',  'Analysis',  '/{pillar}/{slug}', 'Article',     6)
on conflict (slug) do nothing;

-- LIFECYCLE TEMPLATES
with p as (select id, slug from pillar)
insert into lifecycle_template (
  pillar_id, name, slug, description,
  default_schema_org_type, frontend_layout,
  is_active, display_order
) values
  -- Recruitment
  ((select id from p where slug='recruitment'), 'Exam Based',        'recruitment-exam-based',       'Exams with written test, admit card, answer key, result', 'JobPosting', 'exam_layout',   true, 1),
  ((select id from p where slug='recruitment'), 'Direct Recruitment','recruitment-direct',           'Walk-in or direct selection without written exam',        'JobPosting', 'exam_layout',   true, 2),
  ((select id from p where slug='recruitment'), 'Merit Based',       'recruitment-merit-based',      'Selection based on academic merit or marks',              'JobPosting', 'exam_layout',   true, 3),
  ((select id from p where slug='recruitment'), 'Interview Only',    'recruitment-interview-only',   'Selection based only on interview',                       'JobPosting', 'exam_layout',   true, 4),
  ((select id from p where slug='recruitment'), 'Physical Test',     'recruitment-physical-test',    'Selection based on physical fitness test',                'JobPosting', 'exam_layout',   true, 5),
  ((select id from p where slug='recruitment'), 'Skill Test',        'recruitment-skill-test',       'Selection based on skill or trade test',                  'JobPosting', 'exam_layout',   true, 6),
  -- Entrance Exams
  ((select id from p where slug='entrance-exam'), 'National Entrance',   'entrance-national',        'National level entrance examinations (JEE, NEET, etc.)',  'Article', 'exam_layout',   true, 1),
  ((select id from p where slug='entrance-exam'), 'State Entrance',      'entrance-state',           'State level entrance examinations',                       'Article', 'exam_layout',   true, 2),
  ((select id from p where slug='entrance-exam'), 'University Entrance', 'entrance-university',      'University specific entrance examinations',               'Article', 'exam_layout',   true, 3),
  ((select id from p where slug='entrance-exam'), 'Counselling',         'entrance-counselling',     'Counselling process after entrance exam',                  'Article', 'exam_layout',   true, 4),
  -- University / Board
  ((select id from p where slug='board-university'), 'Semester',      'university-semester',        'Semester end examinations',                               'Course',   'university_layout', true, 1),
  ((select id from p where slug='board-university'), 'Annual',        'university-annual',          'Annual examinations',                                     'Course',   'university_layout', true, 2),
  ((select id from p where slug='board-university'), 'Supplementary', 'university-supplementary',   'Supplementary / back examinations',                       'Course',   'university_layout', true, 3),
  ((select id from p where slug='board-university'), 'Revaluation',   'university-revaluation',     'Revaluation / rechecking of answer sheets',               'Course',   'university_layout', true, 4),
  -- News & Editorial
  ((select id from p where slug='news-editorial'), 'News',      'news-article',     'Breaking news and news reports',        'NewsArticle', 'news_layout',  true, 1),
  ((select id from p where slug='news-editorial'), 'Blog',      'news-blog',        'Long-form blog articles',               'BlogPosting', 'blog_layout',  true, 2),
  ((select id from p where slug='news-editorial'), 'Editorial', 'news-editorial',   'Opinion and editorial pieces',          'Article',     'news_layout',  true, 3),
  ((select id from p where slug='news-editorial'), 'Guide',     'news-guide',       'Step-by-step guides and how-to content','HowTo',       'guide_layout', true, 4),
  ((select id from p where slug='news-editorial'), 'Analysis',  'news-analysis',    'Data-driven analysis and explainers',   'Article',     'news_layout',  true, 5),
  ((select id from p where slug='news-editorial'), 'FAQ',       'news-faq',         'Frequently asked questions',            'FAQPage',     'guide_layout', true, 6)
on conflict (slug) do nothing;

-- LIFECYCLE TEMPLATE VERSIONS
-- Each template gets version 1 as the initial active version
-- configuration JSONB contains the full TemplateConfiguration object
insert into lifecycle_template_version (template_id, version_number, configuration, change_summary, is_active)
select
  lt.id,
  1,
  jsonb_build_object(
    'defaultModules', case lt.slug
      when 'recruitment-exam-based'    then '["general","overview","timeline","eligibility","vacancy","fee","exam_pattern","syllabus","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'recruitment-direct'        then '["general","overview","timeline","eligibility","vacancy","fee","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'recruitment-merit-based'   then '["general","overview","timeline","eligibility","vacancy","fee","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'recruitment-interview-only' then '["general","overview","timeline","eligibility","vacancy","fee","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'recruitment-physical-test' then '["general","overview","timeline","eligibility","vacancy","fee","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'recruitment-skill-test'    then '["general","overview","timeline","eligibility","vacancy","fee","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'entrance-national'         then '["general","overview","timeline","eligibility","fee","exam_pattern","syllabus","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'entrance-state'            then '["general","overview","timeline","eligibility","fee","exam_pattern","syllabus","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'entrance-university'       then '["general","overview","timeline","eligibility","fee","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'entrance-counselling'      then '["general","overview","timeline","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'university-semester'       then '["general","overview","timeline","exam_pattern","syllabus","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'university-annual'         then '["general","overview","timeline","exam_pattern","syllabus","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'university-supplementary'  then '["general","overview","timeline","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'university-revaluation'    then '["general","overview","timeline","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'news-article'              then '["general","overview","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'news-blog'                 then '["general","overview","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'news-editorial'            then '["general","overview","modules","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'news-guide'                then '["general","overview","modules","downloads","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'news-analysis'             then '["general","overview","modules","links","seo","publishing","relationships","amendments"]'::jsonb
      when 'news-faq'                  then '["general","overview","modules","seo","publishing","relationships","amendments"]'::jsonb
      else '["general","overview","modules","seo","publishing"]'::jsonb
    end,
    'defaultSchemaOrgType', lt.default_schema_org_type,
    'frontendLayout', lt.frontend_layout,
    'lifecycleRules', '[]'::jsonb,
    'featureFlags', case
      when lt.slug like 'recruitment-exam-%' or lt.slug like 'entrance-%'
      then '{"supports_syllabus":true,"supports_answer_key":true,"supports_cutoff":true,"supports_books":true,"supports_counselling":false,"supports_mock_test":true,"supports_previous_papers":true,"supports_admit_card":true,"supports_result":true,"supports_downloads":true,"supports_links":true,"supports_exam_pattern":true,"supports_selection_process":true,"supports_vacancy":true,"supports_fee":true,"supports_eligibility":true}'::jsonb
      when lt.slug like 'recruitment-direct' or lt.slug like 'recruitment-merit%' or lt.slug like 'recruitment-interview%' or lt.slug like 'recruitment-physical%' or lt.slug like 'recruitment-skill%'
      then '{"supports_syllabus":false,"supports_answer_key":false,"supports_cutoff":false,"supports_books":false,"supports_counselling":false,"supports_mock_test":false,"supports_previous_papers":false,"supports_admit_card":false,"supports_result":true,"supports_downloads":true,"supports_links":true,"supports_exam_pattern":false,"supports_selection_process":true,"supports_vacancy":true,"supports_fee":true,"supports_eligibility":true}'::jsonb
      when lt.slug like 'university-%'
      then '{"supports_syllabus":true,"supports_answer_key":false,"supports_cutoff":true,"supports_books":true,"supports_counselling":false,"supports_mock_test":false,"supports_previous_papers":true,"supports_admit_card":true,"supports_result":true,"supports_downloads":true,"supports_links":true,"supports_exam_pattern":true,"supports_selection_process":false,"supports_vacancy":false,"supports_fee":false,"supports_eligibility":false}'::jsonb
      else
      '{"supports_syllabus":false,"supports_answer_key":false,"supports_cutoff":false,"supports_books":false,"supports_counselling":false,"supports_mock_test":false,"supports_previous_papers":false,"supports_admit_card":false,"supports_result":false,"supports_downloads":true,"supports_links":true,"supports_exam_pattern":false,"supports_selection_process":false,"supports_vacancy":false,"supports_fee":false,"supports_eligibility":false}'::jsonb
    end,
    'fieldDefinitions', '[]'::jsonb,
    'defaultTimelineStages', case
      when lt.slug like 'recruitment-exam-%'
      then '[{"stageKey":"notification","label":"Notification","isRequired":false,"dependsOn":[]},{"stageKey":"application","label":"Application","isRequired":false,"dependsOn":["notification"],"eventSubtypes":["application_open","application_close"]},{"stageKey":"admit_card","label":"Admit Card","isRequired":false,"dependsOn":["application"]},{"stageKey":"exam","label":"Exam","isRequired":false,"dependsOn":["application"]},{"stageKey":"answer_key","label":"Answer Key","isRequired":false,"dependsOn":["exam"]},{"stageKey":"result","label":"Result","isRequired":false,"dependsOn":["exam"]},{"stageKey":"counselling","label":"Counselling","isRequired":false,"dependsOn":["result"]}]'::jsonb
      when lt.slug like 'news-%'
      then '[]'::jsonb
      else '[{"stageKey":"notification","label":"Notification","isRequired":false,"dependsOn":[]},{"stageKey":"result","label":"Result","isRequired":false,"dependsOn":["notification"]}]'::jsonb
    end,
    'moduleVisibility', jsonb_build_object(
      'general',           '{"enabled":true,"required":true,"displayOrder":1}'::jsonb,
      'overview',          '{"enabled":true,"required":false,"displayOrder":2}'::jsonb,
      'timeline',          case when lt.slug like 'news-%' then '{"enabled":false,"required":false,"displayOrder":3}'::jsonb else '{"enabled":true,"required":false,"displayOrder":3}'::jsonb end,
      'eligibility',       case when lt.slug like 'news-%' or lt.slug like 'university-%' or lt.slug like 'entrance-counselling' then '{"enabled":false,"required":false,"displayOrder":4}'::jsonb else '{"enabled":true,"required":false,"displayOrder":4}'::jsonb end,
      'vacancy',           case when lt.slug like 'recruitment-%' then '{"enabled":true,"required":false,"displayOrder":5}'::jsonb else '{"enabled":false,"required":false,"displayOrder":5}'::jsonb end,
      'fee',               case when lt.slug like 'recruitment-%' or lt.slug like 'entrance-%' then '{"enabled":true,"required":false,"displayOrder":6}'::jsonb else '{"enabled":false,"required":false,"displayOrder":6}'::jsonb end,
      'exam_pattern',      case when lt.slug in ('recruitment-exam-based','entrance-national','entrance-state','entrance-university','university-semester','university-annual') then '{"enabled":true,"required":false,"displayOrder":7}'::jsonb else '{"enabled":false,"required":false,"displayOrder":7}'::jsonb end,
      'selection_process', case when lt.slug like 'recruitment-%' and lt.slug not like 'recruitment-exam-%' then '{"enabled":true,"required":false,"displayOrder":8}'::jsonb else '{"enabled":false,"required":false,"displayOrder":8}'::jsonb end,
      'syllabus',          case when lt.slug in ('recruitment-exam-based','entrance-national','entrance-state','entrance-university','university-semester','university-annual') then '{"enabled":true,"required":false,"displayOrder":9}'::jsonb else '{"enabled":false,"required":false,"displayOrder":9}'::jsonb end,
      'modules',           '{"enabled":true,"required":false,"displayOrder":10}'::jsonb,
      'downloads',         '{"enabled":true,"required":false,"displayOrder":11}'::jsonb,
      'links',             '{"enabled":true,"required":false,"displayOrder":12}'::jsonb,
      'media',             '{"enabled":true,"required":false,"displayOrder":13}'::jsonb,
      'seo',               '{"enabled":true,"required":true,"displayOrder":14}'::jsonb,
      'publishing',        '{"enabled":true,"required":false,"displayOrder":15}'::jsonb,
      'relationships',     '{"enabled":true,"required":false,"displayOrder":16}'::jsonb,
      'amendments',        '{"enabled":true,"required":false,"displayOrder":17}'::jsonb
    )
  ),
  'Initial version — M3.8 architecture',
  true
from lifecycle_template lt
where not exists (
  select 1 from lifecycle_template_version ltv
  where ltv.template_id = lt.id and ltv.version_number = 1
);

-- SEED DEFAULT TAXONOMY ENTRIES
insert into exam_level (slug, label, is_active) values
  ('national', 'National', true), ('state', 'State', true),
  ('district', 'District', true), ('university', 'University', true),
  ('school', 'School', true)
on conflict (slug) do nothing;

insert into exam_mode (slug, label, is_active) values
  ('online', 'Online', true), ('offline', 'Offline (OMR)', true),
  ('computer-based', 'Computer Based Test (CBT)', true),
  ('descriptive', 'Descriptive', true), ('hybrid', 'Online + Offline', true)
on conflict (slug) do nothing;

insert into application_mode (slug, label, is_active) values
  ('online', 'Online', true), ('offline', 'Offline', true),
  ('both', 'Online + Offline', true)
on conflict (slug) do nothing;

-- =============================================================================
-- VERIFICATION
-- Run: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- Expected: 30+ tables including pillar, content_type, lifecycle_template,
-- lifecycle_template_version, entity, entity_seo, entity_timeline_event,
-- entity_relationship, entity_amendment, entity_localization, entity_slug_history,
-- entity_event_log, entity_activity_log, entity_revision, entity_module,
-- entity_module_block, conducting_body, department, tag, exam_level, exam_mode,
-- application_mode, and all satellite tables.
-- =============================================================================
