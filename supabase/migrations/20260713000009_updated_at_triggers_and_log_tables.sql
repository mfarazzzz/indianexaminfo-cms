-- Migration: 009_updated_at_triggers_and_log_tables
-- Fixes: DB-001 (no updated_at trigger), VERIFIED-003 (entity_event_log missing),
--        NEEDS-INVESTIGATION-002 (entity_activity_log missing)

-- ── updated_at trigger function ───────────────────────────────────────────────
-- Applied to every table with an updated_at column.
-- Without this, updated_at never changes after the initial INSERT.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to entity
create trigger entity_updated_at
  before update on entity
  for each row execute function set_updated_at();

-- Apply to entity_module (will be created in M2; trigger added now for consistency)
-- create trigger entity_module_updated_at
--   before update on entity_module
--   for each row execute function set_updated_at();

-- Apply to entity_seo (created later; will be re-applied when table exists)
-- create trigger entity_seo_updated_at
--   before update on entity_seo
--   for each row execute function set_updated_at();

-- Also set updated_by on entity update to the current user
create or replace function set_updated_by()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger entity_updated_by
  before update on entity
  for each row execute function set_updated_by();

-- ── entity_event_log ──────────────────────────────────────────────────────────
-- Extension point for future automation (webhooks, notifications, revalidation).
-- Referenced in entityService.transitionWorkflow — must exist or transitions
-- silently fail to record events.

create table if not exists entity_event_log (
  id          uuid        primary key default gen_random_uuid(),
  entity_id   uuid        references entity(id) on delete set null,
  event_type  text        not null,
  actor_id    uuid        references auth.users(id),
  payload     jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists idx_event_log_entity
  on entity_event_log(entity_id, created_at desc);
create index if not exists idx_event_log_type
  on entity_event_log(event_type, created_at desc);

alter table entity_event_log enable row level security;
create policy "event_log_select" on entity_event_log
  for select to authenticated using (true);
create policy "event_log_insert" on entity_event_log
  for insert to authenticated
  with check (auth.uid() is not null);
-- Append-only: no UPDATE or DELETE policies

-- ── entity_activity_log ───────────────────────────────────────────────────────
-- Granular audit trail: every editor action on every entity.
-- Referenced in entityService.verifyEntity and other future service calls.

create table if not exists entity_activity_log (
  id                uuid        primary key default gen_random_uuid(),
  entity_id         uuid        references entity(id) on delete set null,
  module_id         uuid,       -- FK to entity_module — added when that table exists
  actor_id          uuid        references auth.users(id),
  action            text        not null,
  target_type       text,
  target_id         uuid,
  changes           jsonb,
  bulk_operation_id uuid,
  ip_address        inet,
  user_agent        text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_alog_entity
  on entity_activity_log(entity_id, created_at desc);
create index if not exists idx_alog_actor
  on entity_activity_log(actor_id, created_at desc);
create index if not exists idx_alog_bulk
  on entity_activity_log(bulk_operation_id)
  where bulk_operation_id is not null;

alter table entity_activity_log enable row level security;
create policy "alog_select" on entity_activity_log
  for select to authenticated using (true);
create policy "alog_insert" on entity_activity_log
  for insert to authenticated
  with check (auth.uid() is not null);
-- Append-only: no UPDATE or DELETE policies
