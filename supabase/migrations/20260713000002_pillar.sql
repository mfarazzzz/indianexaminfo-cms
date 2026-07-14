-- Migration: 002_pillar
-- Task: M1-T2
-- Requirements: REQ-001
-- Design: Section 2.1

create table if not exists pillar (
  id            uuid        primary key default gen_random_uuid(),
  slug          text        not null unique,
  label         text        not null,
  description   text,
  icon          text,
  display_order integer     not null default 0,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists idx_pillar_active
  on pillar(display_order)
  where is_active = true and deleted_at is null;

-- RLS
alter table pillar enable row level security;

create policy "pillar_select" on pillar
  for select to authenticated
  using (deleted_at is null);

create policy "pillar_write" on pillar
  for all to authenticated
  using (has_permission('manage_structural_taxonomy'))
  with check (has_permission('manage_structural_taxonomy'));

-- Seed: 4 initial content domains (REQ-001.2)
-- Note: 'news-editorial' is added here — it was missing from the legacy PILLARS constant.
insert into pillar (slug, label, description, display_order) values
  ('recruitment',     'Recruitment',       'Government job notifications and hiring lifecycle', 1),
  ('entrance-exam',   'Entrance Exams',    'National and state competitive entrance exams',     2),
  ('board-university','University / Board','Board and university examination calendars',         3),
  ('news-editorial',  'News & Editorial',  'News, blogs, guides, and analysis',                 4)
on conflict (slug) do nothing;
