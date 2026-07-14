-- Migration: 004_lifecycle_template
-- Task: M1-T3
-- Requirements: REQ-002
-- Design: Section 2.3

create table if not exists lifecycle_template (
  id            uuid        primary key default gen_random_uuid(),
  pillar_id     uuid        not null references pillar(id) on delete restrict,
  name          text        not null,
  slug          text        not null unique,
  description   text,
  is_active     boolean     not null default true,
  display_order integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists idx_lt_pillar
  on lifecycle_template(pillar_id)
  where is_active = true and deleted_at is null;

alter table lifecycle_template enable row level security;

create policy "lt_select" on lifecycle_template
  for select to authenticated using (deleted_at is null);

create policy "lt_write" on lifecycle_template
  for all to authenticated
  using (has_permission('manage_structural_taxonomy'))
  with check (has_permission('manage_structural_taxonomy'));

-- ── lifecycle_template_version ────────────────────────────────────────────────

create table if not exists lifecycle_template_version (
  id             uuid        primary key default gen_random_uuid(),
  template_id    uuid        not null references lifecycle_template(id) on delete restrict,
  version_number integer     not null,
  -- configuration is IMMUTABLE after insert (ADR-005) — no UPDATE policy
  configuration  jsonb       not null,
  change_summary text,
  is_active      boolean     not null default false,
  created_by     uuid        references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (template_id, version_number)
);

-- Only one active version per template at a time (REQ-002.2)
create unique index if not exists ltv_one_active_per_template
  on lifecycle_template_version(template_id)
  where is_active = true;

create index if not exists idx_ltv_template
  on lifecycle_template_version(template_id);

alter table lifecycle_template_version enable row level security;

create policy "ltv_select" on lifecycle_template_version
  for select to authenticated using (true);

-- INSERT only — no UPDATE policy enforces immutability (ADR-005)
create policy "ltv_insert" on lifecycle_template_version
  for insert to authenticated
  with check (has_permission('manage_structural_taxonomy'));

-- ── Seed Lifecycle Templates (REQ-002.5) ──────────────────────────────────────
-- Minimal seed: one template per pillar. Full field definitions are seeded in
-- migration 009_seed_field_definitions.sql after the entity table is created.

do $$
declare
  rec_pillar_id uuid;
  ent_pillar_id uuid;
  board_pillar_id uuid;
  news_pillar_id uuid;
  tmpl_id uuid;
  base_config jsonb;
begin
  select id into rec_pillar_id   from pillar where slug = 'recruitment';
  select id into ent_pillar_id   from pillar where slug = 'entrance-exam';
  select id into board_pillar_id from pillar where slug = 'board-university';
  select id into news_pillar_id  from pillar where slug = 'news-editorial';

  -- Base configuration shared across exam-type templates
  base_config := jsonb_build_object(
    'defaultModules',         '["notification","application","admit_card","answer_key","result","cutoff","syllabus","eligibility","vacancy","fee","exam_pattern","selection_process","downloads","links","media"]'::jsonb,
    'defaultTimelineStages',  '[]'::jsonb,
    'defaultValidationRules', '{}'::jsonb,
    'defaultSchemaOrgType',   'JobPosting',
    'lifecycleRules',         '[]'::jsonb,
    'moduleVisibility',       '{}'::jsonb,
    'frontendLayout',         'exam_layout',
    'featureFlags', jsonb_build_object(
      'supports_syllabus', true, 'supports_answer_key', true, 'supports_cutoff', true,
      'supports_books', true, 'supports_counselling', false, 'supports_mock_test', true,
      'supports_previous_papers', true, 'supports_admit_card', true, 'supports_result', true,
      'supports_downloads', true, 'supports_links', true, 'supports_exam_pattern', true,
      'supports_selection_process', true, 'supports_vacancy', true, 'supports_fee', true,
      'supports_eligibility', true
    ),
    'fieldDefinitions', '[]'::jsonb
  );

  -- Recruitment: Exam Based
  insert into lifecycle_template (pillar_id, slug, name, description, display_order)
  values (rec_pillar_id, 'recruitment-exam-based', 'Exam Based',
          'Recruitment with written exam phases', 1)
  on conflict (slug) do nothing returning id into tmpl_id;

  if tmpl_id is not null then
    insert into lifecycle_template_version (template_id, version_number, configuration, change_summary, is_active)
    values (tmpl_id, 1, base_config, 'Initial version', true)
    on conflict do nothing;
  end if;
  tmpl_id := null;

  -- Recruitment: Direct Recruitment
  insert into lifecycle_template (pillar_id, slug, name, description, display_order)
  values (rec_pillar_id, 'recruitment-direct', 'Direct Recruitment',
          'Merit-based or interview-only recruitment', 2)
  on conflict (slug) do nothing returning id into tmpl_id;

  if tmpl_id is not null then
    insert into lifecycle_template_version (template_id, version_number, configuration, change_summary, is_active)
    values (tmpl_id, 1,
      base_config || jsonb_build_object(
        'featureFlags', (base_config->'featureFlags') ||
          jsonb_build_object('supports_exam_pattern', false, 'supports_admit_card', false)
      ),
      'Initial version', true)
    on conflict do nothing;
  end if;
  tmpl_id := null;

  -- Entrance: National Entrance
  insert into lifecycle_template (pillar_id, slug, name, description, display_order)
  values (ent_pillar_id, 'entrance-national', 'National Entrance',
          'National level entrance exam (JEE, NEET, CAT)', 1)
  on conflict (slug) do nothing returning id into tmpl_id;

  if tmpl_id is not null then
    insert into lifecycle_template_version (template_id, version_number, configuration, change_summary, is_active)
    values (tmpl_id, 1,
      base_config || jsonb_build_object('defaultSchemaOrgType', 'Article', 'frontendLayout', 'entrance_layout'),
      'Initial version', true)
    on conflict do nothing;
  end if;
  tmpl_id := null;

  -- University/Board: Semester
  insert into lifecycle_template (pillar_id, slug, name, description, display_order)
  values (board_pillar_id, 'board-semester', 'Semester',
          'University semester examination', 1)
  on conflict (slug) do nothing returning id into tmpl_id;

  if tmpl_id is not null then
    insert into lifecycle_template_version (template_id, version_number, configuration, change_summary, is_active)
    values (tmpl_id, 1,
      base_config || jsonb_build_object(
        'defaultSchemaOrgType', 'Course',
        'frontendLayout', 'university_layout',
        'featureFlags', (base_config->'featureFlags') ||
          jsonb_build_object('supports_vacancy', false, 'supports_selection_process', false)
      ),
      'Initial version', true)
    on conflict do nothing;
  end if;
  tmpl_id := null;

  -- News: News Article
  insert into lifecycle_template (pillar_id, slug, name, description, display_order)
  values (news_pillar_id, 'news-article', 'News',
          'News article or current affairs post', 1)
  on conflict (slug) do nothing returning id into tmpl_id;

  if tmpl_id is not null then
    insert into lifecycle_template_version (template_id, version_number, configuration, change_summary, is_active)
    values (tmpl_id, 1, jsonb_build_object(
      'defaultModules',         '["overview","downloads","links","media"]'::jsonb,
      'defaultTimelineStages',  '[]'::jsonb,
      'defaultValidationRules', '{}'::jsonb,
      'defaultSchemaOrgType',   'NewsArticle',
      'lifecycleRules',         '[]'::jsonb,
      'moduleVisibility',       '{}'::jsonb,
      'frontendLayout',         'news_layout',
      'featureFlags', jsonb_build_object(
        'supports_syllabus', false, 'supports_answer_key', false, 'supports_cutoff', false,
        'supports_books', false, 'supports_counselling', false, 'supports_mock_test', false,
        'supports_previous_papers', false, 'supports_admit_card', false, 'supports_result', false,
        'supports_downloads', true, 'supports_links', true, 'supports_exam_pattern', false,
        'supports_selection_process', false, 'supports_vacancy', false, 'supports_fee', false,
        'supports_eligibility', false
      ),
      'fieldDefinitions', '[]'::jsonb
    ), 'Initial version', true)
    on conflict do nothing;
  end if;

end $$;
