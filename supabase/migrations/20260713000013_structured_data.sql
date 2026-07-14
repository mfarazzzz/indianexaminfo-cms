-- Migration: 013_structured_data
-- Milestone: M2-T3
-- Requirements: REQ-013
-- Design: Section 2.10

-- ── entity_eligibility (1:1 per entity) ───────────────────────────────────────

create table if not exists entity_eligibility (
  id                    uuid        primary key default gen_random_uuid(),
  entity_id             uuid        not null unique references entity(id) on delete cascade,
  min_age               integer,
  max_age               integer,
  age_relaxation        jsonb       default '[]',
  nationality           text,
  education             text,
  experience            text,
  max_attempts          integer,
  physical_standards    text,
  medical_standards     text,
  language_requirements text,
  updated_at            timestamptz not null default now(),
  constraint chk_age check (min_age is null or max_age is null or min_age <= max_age)
);

-- ── entity_vacancy (1:N per entity) ───────────────────────────────────────────

create table if not exists entity_vacancy (
  id            uuid        primary key default gen_random_uuid(),
  entity_id     uuid        not null references entity(id) on delete cascade,
  category      text        not null,
  label         text        not null,
  value         integer     not null check (value >= 0),
  notes         text,
  display_order integer     not null default 0,
  deleted_at    timestamptz
);

create index if not exists idx_vacancy_entity
  on entity_vacancy(entity_id) where deleted_at is null;

-- ── entity_fee (1:1 per entity) ───────────────────────────────────────────────

create table if not exists entity_fee (
  id            uuid        primary key default gen_random_uuid(),
  entity_id     uuid        not null unique references entity(id) on delete cascade,
  general       integer     check (general >= 0),
  obc           integer     check (obc >= 0),
  sc            integer     check (sc >= 0),
  st            integer     check (st >= 0),
  ews           integer     check (ews >= 0),
  pwd           integer     check (pwd >= 0),
  female        integer     check (female >= 0),
  payment_modes text[]      default '{}',
  refund_rules  text,
  updated_at    timestamptz not null default now()
);

-- ── entity_exam_pattern (1:N per entity) ──────────────────────────────────────

create table if not exists entity_exam_pattern (
  id               uuid        primary key default gen_random_uuid(),
  entity_id        uuid        not null references entity(id) on delete cascade,
  stage_name       text        not null,
  duration_minutes integer,
  total_questions  integer,
  total_marks      integer,
  negative_marking numeric(4,2),
  subjects         text[]      default '{}',
  exam_language    text,
  qualifying_marks text,
  notes            text,
  display_order    integer     not null default 0,
  deleted_at       timestamptz
);

create index if not exists idx_exam_pattern_entity
  on entity_exam_pattern(entity_id) where deleted_at is null;

-- ── entity_selection_stage (1:N per entity) ───────────────────────────────────

create table if not exists entity_selection_stage (
  id                uuid        primary key default gen_random_uuid(),
  entity_id         uuid        not null references entity(id) on delete cascade,
  stage_name        text        not null,
  description       text,
  marks             integer,
  weightage_percent numeric(5,2),
  is_qualifying     boolean     not null default false,
  notes             text,
  display_order     integer     not null default 0,
  deleted_at        timestamptz
);

create index if not exists idx_selection_entity
  on entity_selection_stage(entity_id) where deleted_at is null;

-- ── entity_syllabus_subject (1:N per entity) ──────────────────────────────────

create table if not exists entity_syllabus_subject (
  id                uuid        primary key default gen_random_uuid(),
  entity_id         uuid        not null references entity(id) on delete cascade,
  subject_name      text        not null,
  topics            text[]      default '{}',
  description       text,
  pdf_url           text,
  video_link        text,
  study_notes       text,
  books             text,
  weightage_percent numeric(5,2),
  display_order     integer     not null default 0,
  deleted_at        timestamptz
);

create index if not exists idx_syllabus_entity
  on entity_syllabus_subject(entity_id) where deleted_at is null;

-- ── RLS: all satellite tables ─────────────────────────────────────────────────

do $$ declare t text; begin
  foreach t in array array[
    'entity_eligibility','entity_vacancy','entity_fee',
    'entity_exam_pattern','entity_selection_stage','entity_syllabus_subject'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('
      create policy "%s_select" on %I
        for select to authenticated using (true)', t, t);
    execute format('
      create policy "%s_write" on %I
        for all to authenticated
        using (has_permission(''create_entity'') or has_permission(''edit_any_entity'')
               or has_permission(''edit_own_entity''))', t, t);
  end loop;
end $$;
