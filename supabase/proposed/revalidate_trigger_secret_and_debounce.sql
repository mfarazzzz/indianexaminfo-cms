-- ─────────────────────────────────────────────────────────────────────────────
-- A3 (owner review 28 Sep): revalidate-frontend loses its unauthenticated path.
-- PROPOSED ONLY — not promoted, not applied. Compiled and tested inside a
-- ROLLED-BACK transaction via MCP; the owner reviews before this moves into
-- supabase/migrations/ (version = UTC time of promotion). The runner wraps each
-- file; no BEGIN/COMMIT here.
--
-- 1. notify_frontend_revalidate() (the exam_editions pg_net trigger) now sends
--    an x-trigger-secret header. The trigger reads its copy from Supabase Vault
--    (vault.decrypted_secrets, secret named `revalidate_trigger_secret`) — the
--    value is never in this file, never in git, never in a browser. The Edge
--    Function compares it in CONSTANT TIME with its own env secret
--    TRIGGER_SHARED_SECRET. Owner provisions both to the same value:
--      a) Vault:   Dashboard → Integration Hub → Vault → Store new secret
--                  name = revalidate_trigger_secret, value = <random 32+ bytes>
--                  (SQL equivalent: select vault.create_secret('<value>',
--                   'revalidate_trigger_secret');)
--      b) Function secret (same value):
--                  supabase secrets set TRIGGER_SHARED_SECRET=<same value>
--    verify_jwt stays OFF only because a trigger cannot send a JWT; every
--    request must carry a valid CMS JWT with an edit permission OR the trigger
--    secret, otherwise the function answers 401.
--
-- 2. Debounce: the TRIGGER's tag fires at most once per 10 s. Owner review
--    (30 Sep): CMS (JWT) calls are NEVER debounced — an editor who saves twice
--    within the window must get both refreshes; the debounce exists only to
--    drop the trigger's duplicate of a CMS call. Implemented as a SMALL DB
--    TABLE + atomic SECURITY DEFINER function, NOT an in-memory map — edge
--    isolates do not share memory and each fresh isolate would let one burst
--    through, so an in-memory map is not the "same tag at most once per window"
--    across trigger + CMS + several isolates. Same fixed-truth pattern as
--    message_rate_limits in reader_messages.sql. The Edge Function calls
--    revalidate_should_fire() (trigger path only) before hitting the frontend.
--
-- PROOF (2026-09-28, MCP, every statement inside begin; … rollback;) —
--   ORIGINAL 30 s / all-callers version, 9/9 green:
--   • file compiled verbatim (table + function + trigger replacement + grants).
--   1. should_fire_first          = true
--   2. should_fire_second         = false (30 s window, immediate retry)
--   3. should_fire_after_window   = true  (last_fired_at backdated 31 s)
--   4. empty_tag                  = 23514 (check_violation raised, as designed)
--   5. trigger_secret_header_matches = true  (a Vault secret named
--      revalidate_trigger_secret was created INSIDE the transaction; the UPDATE
--      to exam_editions.important_dates fired the trigger; net.http_request_queue
--      carried x-trigger-secret equal to the test value — compared as boolean,
--      the value was never printed)
--   6. trigger_body_tag           = exam:icmr-jrf (the real exam slug resolved)
--   7. anon_select_debounce       = false (no privileges, no policies)
--   8. anon_execute_rpc           = false  9. sr_execute_rpc = true
--   • after rollback the DB was re-checked: 0 debounce tables, 0
--     revalidate_should_fire functions, 0 vault secrets, 0 queued requests, the
--     fixture exam_editions row back to [], the live trigger unchanged (md5
--     1b12c94ce255286952a42931ff00013a).
--   RE-RUN PENDING: the 30 s → 10 s trigger-only change (owner review 30 Sep)
--   alters only the default window here and the CALLER side in the Edge
--   Function; the SQL above is identical except `p_window_seconds int default
--   10`. The rolled-back proof is re-run with the 10 s window (first=true,
--   immediate retry=false, backdated-11 s=true) as soon as the Supabase MCP
--   connection is restored — numbers only from a completed run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. debounce store ─────────────────────────────────────────────────────────
create table if not exists public.revalidate_debounce (
  tag           text        primary key,
  last_fired_at timestamptz not null default now()
);

alter table public.revalidate_debounce enable row level security;
-- NO policies at all — nobody reads or writes it through the API, not even
-- staff; only the definer function below touches it. Belt and braces:
revoke all on public.revalidate_debounce from anon, authenticated, public;

-- Atomic check-and-stamp: returns true (fire) when the tag has not fired within
-- the window, false (debounce) otherwise. The upsert does both halves in one
-- statement, so two concurrent calls can never both return true for the same
-- fresh window. Called ONLY for the trigger path; a CMS caller is never
-- debounced (owner review 30 Sep).
create or replace function public.revalidate_should_fire(
  p_tag text,
  p_window_seconds int default 10
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fired boolean;
begin
  if p_tag is null or btrim(p_tag) = '' or p_window_seconds < 1 then
    raise exception 'invalid debounce arguments' using errcode = 'check_violation';
  end if;

  with fire as (
    insert into public.revalidate_debounce as d (tag, last_fired_at)
    values (p_tag, now())
    on conflict (tag) do update
      set last_fired_at = now()
      where d.last_fired_at < now() - make_interval(secs => p_window_seconds)
    returning 1
  )
  select exists (select 1 from fire) into v_fired;

  -- self-pruning, like the rate-limit table: no ops job needed
  delete from public.revalidate_debounce
   where last_fired_at < now() - interval '1 day';

  return v_fired;
end;
$$;

revoke all on function public.revalidate_should_fire(text, int)
  from public, anon, authenticated;
grant execute on function public.revalidate_should_fire(text, int)
  to service_role;

-- ── 2. the trigger authenticates: same function body as today PLUS the secret
--    header read from Vault. No vault row → no call at all (the function would
--    401 it anyway; not queueing is cheaper and leaves no confusing errors).
create or replace function public.notify_frontend_revalidate()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_exam_slug text;
  v_secret    text;
begin
  -- only fire when important_dates actually changed
  if old.important_dates is not distinct from new.important_dates then
    return new;
  end if;

  -- look up the exam slug for tag-level invalidation
  select slug into v_exam_slug
    from public.exams
   where current_edition_id = new.id
   limit 1;

  -- the shared secret lives in Vault (owner provisions it; see header note).
  -- A trigger cannot send a JWT, so this header is what authenticates it —
  -- there is no unauthenticated path any more.
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'revalidate_trigger_secret'
   limit 1;

  if v_secret is null or v_secret = '' then
    return new;  -- not provisioned: do not call out without the secret
  end if;

  perform net.http_post(
    url     := 'https://cwbhhcqsrbuoybeaondk.supabase.co/functions/v1/revalidate-frontend',
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'x-trigger-secret', v_secret
               ),
    body    := jsonb_build_object(
                 'exam_slug', coalesce(v_exam_slug, ''),
                 'tag',       case
                                when v_exam_slug is not null
                                then 'exam:' || v_exam_slug
                                else 'exams'
                              end
               )
  );

  return new;
exception when others then
  -- never fail a save because revalidation errored
  return new;
end;
$$;

-- rollback: none needed for the table/function (new objects); to undo the
--           trigger body, re-apply 20260902140945_fix_revalidate_trigger_hardcode_url.sql.
