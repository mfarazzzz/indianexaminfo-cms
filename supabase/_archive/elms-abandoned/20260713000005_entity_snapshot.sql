-- Migration: 005_entity_snapshot
-- Task: M1-T4
-- Requirements: REQ-006, REQ-041
-- Design: Section 2.4, Section 12.4
--
-- The template_snapshot is stored in a SEPARATE table from entity to avoid
-- JSONB bloat on the hot entity row (REQ-041.4).
-- The entity table has NO template_snapshot column.
-- FK to entity is added as ALTER TABLE after entity table is created in 006.

create table if not exists entity_snapshot (
  entity_id  uuid        primary key,   -- FK added in migration 006
  snapshot   jsonb       not null,      -- immutable: no UPDATE policy (ADR-005)
  created_at timestamptz not null default now()
);

alter table entity_snapshot enable row level security;

create policy "snapshot_select" on entity_snapshot
  for select to authenticated using (true);

-- INSERT only — no UPDATE policy enforces immutability (ADR-005)
create policy "snapshot_insert" on entity_snapshot
  for insert to authenticated
  with check (auth.uid() is not null);
