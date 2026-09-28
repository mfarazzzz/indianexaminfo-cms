-- ═══════════════════════════════════════════════════════════════════════════
-- N2 step 4 (Q4) — PROPOSED ONLY. DO NOT APPLY. Not in migrations/, so the
-- Supabase CLI never runs this; it is a reviewed proposal the owner approves
-- separately. Verified by compiling inside a rolled-back transaction (MCP).
--
-- bulletin_editor_state: the ONLY writable surface of Layer 1. It carries no
-- content and grants no publish right — it records who is on a signal, whether
-- it is snoozed, and whether an editor closed it by hand. Content itself lives
-- in exams/editions/sarkari_naukri exactly as before; the publish path remains
-- the gated verify/publish trigger from M3 (publish_post).
--
-- Auto-resolution rule (why there is no 'resolved' status): a signal leaves
-- the queue the instant content_has_data() flips true. Editor state only
-- SUPPRESSES (done-by-hand) or DEFERS (snoozed) a signal; it can never mark
-- work done, because "done" is defined by the content existing.
--
-- RLS — permission-based via public.current_user_has_permission(slug):
--   • read   → holder of edit_own_post OR edit_any_post (any working editor).
--   • write  → edit_any_post ONLY (insert + update). A junior editor with only
--              edit_own_post can see the board but cannot assign/snooze/close.
--   • delete → NO delete policy at all: deny-all through the API. Rows are
--              re-upserted, never removed; a stale row is harmless because the
--              board joins state ONTO signals, signals are computed live.
--   Never the JWT role claim (auth.role()), never role names.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.bulletin_editor_state (
  -- Same composite key the bulletin_signals view publishes:
  --   source_table ':' coalesce(edition_id, naukri_id) ':' event_type ':'
  --   event_date ':' target_section
  -- State is stored per signal, so the same date on two pillars (or two event
  -- types) is two independently assignable items.
  signal_key   text primary key,

  assignee     uuid references auth.users(id) on delete set null,
  status       text not null default 'open'
               check (status in ('open','snoozed','done-by-hand')),
  snooze_until date,
  note         text,

  updated_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now(),

  -- A snooze that doesn't say until when is meaningless; keep the two honest.
  constraint editor_state_snooze_needs_date
    check (status <> 'snoozed' or snooze_until is not null)
);

comment on table public.bulletin_editor_state is
  'Layer 1 board: assignment/snooze/note per computed signal. No content, '
  'no publish right. Auto-resolves via content_has_data(), never via editor action.';
comment on column public.bulletin_editor_state.signal_key is
  'Mirrors bulletin_signals.signal_key exactly; join the board onto it.';
comment on column public.bulletin_editor_state.status is
  'open | snoozed (hidden until snooze_until) | done-by-hand (suppressed even '
  'though content is still missing). There is no "done" — content presence does that.';

-- ── freshness: keep updated_at honest server-side, like the rest of the schema
create or replace function public.bulletin_editor_state_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists bulletin_editor_state_set_updated_at on public.bulletin_editor_state;
create trigger bulletin_editor_state_set_updated_at
  before update on public.bulletin_editor_state
  for each row execute function public.bulletin_editor_state_touch();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.bulletin_editor_state enable row level security;

-- read: any working editor
drop policy if exists editor_state_read on public.bulletin_editor_state;
create policy editor_state_read on public.bulletin_editor_state
  for select to authenticated using (
    public.current_user_has_permission('edit_own_post')
    or public.current_user_has_permission('edit_any_post')
  );

-- write: senior editors only (assign / snooze / note / done-by-hand)
drop policy if exists editor_state_insert on public.bulletin_editor_state;
create policy editor_state_insert on public.bulletin_editor_state
  for insert to authenticated with check (
    public.current_user_has_permission('edit_any_post')
  );

drop policy if exists editor_state_update on public.bulletin_editor_state;
create policy editor_state_update on public.bulletin_editor_state
  for update to authenticated
  using (public.current_user_has_permission('edit_any_post'))
  with check (public.current_user_has_permission('edit_any_post'));

-- NO delete policy on purpose: RLS denies DELETE to every authenticated role.
-- (service_role bypasses RLS, as everywhere else in this schema; the API never
--  uses it for this table.)
