-- Migration: 011_timeline
-- Milestone: M2-T1
-- Requirements: REQ-011
-- Design: Section 2.8

create table if not exists entity_timeline_event (
  id             uuid        primary key default gen_random_uuid(),
  entity_id      uuid        not null references entity(id) on delete cascade,
  title          text        not null check (char_length(title) > 0),
  event_type     text        not null,
  event_date     date,
  event_time     time,
  description    text,
  status         text        not null default 'upcoming'
                   check (status in ('pending','upcoming','active','passed','postponed','cancelled')),
  badge_color    text        not null default 'blue'
                   check (badge_color in ('blue','green','yellow','orange','red','grey')),
  is_highlighted boolean     not null default false,
  is_featured    boolean     not null default false,
  official_link  text,
  pdf_link       text,
  image_url      text,
  visibility     text        not null default 'public'
                   check (visibility in ('public','logged_in','admin')),
  stage_key      text,
  event_subtype  text,
  publish_at     timestamptz,
  display_order  integer     not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid        references auth.users(id),
  deleted_at     timestamptz
);

create index if not exists idx_timeline_entity
  on entity_timeline_event(entity_id, event_date)
  where deleted_at is null;

create index if not exists idx_timeline_stage
  on entity_timeline_event(entity_id, stage_key)
  where deleted_at is null;

create index if not exists idx_timeline_status
  on entity_timeline_event(entity_id, status)
  where deleted_at is null;

create trigger entity_timeline_event_updated_at
  before update on entity_timeline_event
  for each row execute function set_updated_at();

alter table entity_timeline_event enable row level security;

create policy "tle_select" on entity_timeline_event
  for select to authenticated using (deleted_at is null);

create policy "tle_write" on entity_timeline_event
  for all to authenticated
  using (
    has_permission('edit_any_entity')
    or exists (
      select 1 from entity e
      where e.id = entity_id
        and e.created_by = auth.uid()
        and e.deleted_at is null
    )
  );
