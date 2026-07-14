-- Migration: 007_slug_history
-- Task: M1-T5 (part of entity foundation)
-- Requirements: REQ-032, REQ-006.4
-- Design: Section 2.6

create table if not exists entity_slug_history (
  id            uuid        primary key default gen_random_uuid(),
  entity_id     uuid        not null references entity(id) on delete cascade,
  old_slug      text        not null,
  new_slug      text        not null,
  pillar_slug   text        not null,
  redirect_type text        not null default '301'
                  check (redirect_type in ('301','302')),
  created_at    timestamptz not null default now(),
  created_by    uuid        references auth.users(id)
  -- Append-only: no deleted_at, no updates (REQ-032.1)
);

create index if not exists idx_slug_hist_old
  on entity_slug_history(old_slug, pillar_slug);

create index if not exists idx_slug_hist_entity
  on entity_slug_history(entity_id, created_at desc);

alter table entity_slug_history enable row level security;

create policy "slug_hist_select" on entity_slug_history
  for select to authenticated using (true);

create policy "slug_hist_insert" on entity_slug_history
  for insert to authenticated
  with check (auth.uid() is not null);
-- No UPDATE or DELETE policies — append-only (REQ-032.1)
