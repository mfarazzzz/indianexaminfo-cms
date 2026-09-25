-- Migration: 017_field_change_log
-- Milestone: M3-T3
-- Requirements: REQ-018
-- Design: Section 2.14

-- Tracks individual field-level changes on entities.
-- Used to drive the Amendment prompt for factual field edits on published content.
-- is_factual is derived from the field's amend_on_change property in fieldDefinitions.

create table if not exists entity_field_change_log (
  id         uuid        primary key default gen_random_uuid(),
  entity_id  uuid        not null references entity(id) on delete cascade,
  field_key  text        not null,
  old_value  text,
  new_value  text,
  changed_by uuid        references auth.users(id),
  changed_at timestamptz not null default now(),
  is_factual boolean     not null default false
);

create index if not exists idx_fcl_entity
  on entity_field_change_log(entity_id, changed_at desc);

alter table entity_field_change_log enable row level security;

create policy "fcl_select" on entity_field_change_log
  for select to authenticated using (true);
create policy "fcl_insert" on entity_field_change_log
  for insert to authenticated
  with check (auth.uid() is not null);
-- Append-only: no UPDATE or DELETE
