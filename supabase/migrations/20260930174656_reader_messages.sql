-- ─────────────────────────────────────────────────────────────────────────────
-- S0-5, corrected (owner brief Sprint 0 Part 2, 2026-09-28; approved live 2026-09-30 R1):
-- reader-message DATA LAYER. APPLIED via MCP apply_migration 2026-09-30
-- (version 20260930174656); promoted from supabase/proposed/reader_messages.sql
-- (version = UTC time of application). The line 24 comment-block corruption
-- ("── internal_note") found at promotion is fixed here and in the applied SQL.
--
-- THE ONE WRITE PATH is the edge function `submit-message` (verify_jwt off,
-- public). It validates, applies honeypot + minimum fill-time, rate-limits per
-- SALTED IP HASH for BOTH sources, caps lengths, resolves page_url to
-- (entity_type, entity_id), then INSERTS with the service role. RLS below
-- assumes that; there is deliberately NO anon path of any kind:
--   • anon gets NO RPC (submit_reader_message is DROPPED — the edge function
--     inserts directly, so keeping the RPC would only add a surface),
--   • anon gets NO table privileges and NO policies (no insert, no select),
--   • the rate-limit table is visible only to its SECURITY DEFINER function.
--
-- PERMISSIONS (owner correction b): a dedicated `handle_messages` slug —
--   read/update  = handle_messages (Super Admin, Admin, Editor, Content Intern)
--   delete/export = manage_settings  (admins only; "export" = the CMS CSV
--                    download, gated on manage_settings in the UI, Part 3)
--   NO policies for anon anywhere in this file.
-- The earlier draft reused edit_any_post; superseded per the owner correction.
--
-- internal_note / handled_by / handled_at are GONE from the main table (c):
-- notes live in contact_message_notes (authored, timestamped, attributable);
-- status/assignee history lives in contact_message_events (who + when). The
-- main table keeps only the current status/assignee/priority snapshot.
--
-- PROOF (2026-09-28 compiled+rolled-back; 2026-09-30 LIVE at application — R1:
-- anon submit through the function returned a ref; anon select/insert/RPC all
-- 42501 permission-denied; 6 attempts from one IP -> 5 x 200 + 429; a
-- page_report resolved a real vacancy URL to (sarkari_naukri, id); grid
-- visible to a handle_messages holder and 0 rows for a viewer):
--   • file compiled verbatim: 11 policies created, message_rate_limit_attempt
--     present, submit_reader_message gone (0 rows in pg_proc).
--   • handle_messages exists, assigned to exactly Super Admin, Admin, Editor,
--     Content Intern.
--   • anon: select DENIED, insert DENIED (privilege level), old RPC ->
--     undefined_function; 0 anon policies; no privileges on any of the four
--     tables incl. message_rate_limits; no EXECUTE on the rate RPC
--     (authenticated also has no EXECUTE; service_role only).
--   • rate limit (salted-IP-hash bucket; contactless report-sheet submissions
--     land in the same bucket — there is no contact-based path any more): 6
--     attempts -> true,true,true,true,true,false (5/10 min); bucket counted 6
--     hits; invalid args raise.
--   • Content Intern with handle_messages: saw 3 seeded messages, updated 3,
--     deleted 0 (RLS), own note/event inserted, FOREIGN author/actor insert
--     DENIED. Viewer (no handle_messages): saw 0, updated 0.
--   • Admin (manage_settings): deleted 3.
-- ─────────────────────────────────────────────────────────────────────────────

-- (a) Drop the anon-reachable RPC from the earlier draft. It never went to
-- production; the DROP makes the promotion idempotent on any environment that
-- applied the draft in a test.
DROP FUNCTION IF EXISTS public.submit_reader_message(
  text, text, text, text, text, text, text, text, text, boolean);

-- ── 1. Permission: handle_messages (owner correction b) ─────────────────────
INSERT INTO public.permissions (id, slug, label, "group")
VALUES (gen_random_uuid(), 'handle_messages', 'Handle Reader Messages', 'content')
ON CONFLICT (slug) DO NOTHING;

-- Assign to Super Admin, Admin, Editor, Content Intern (exactly — not Viewer,
-- not Writer/Ad Manager).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.slug = 'handle_messages'
 WHERE r.slug IN ('super-admin', 'admin', 'editor', 'content-intern')
ON CONFLICT DO NOTHING;

-- ── 2. Main table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reader_messages (
  id            uuid        primary key default gen_random_uuid(),
  -- Human reference shown on success (IEI-XXXXX); minted by submit-message
  -- from its own random uuid; UNIQUE so every code resolves to one row.
  ref_number    text        NOT NULL UNIQUE,
  source        text        NOT NULL
    CHECK (source IN ('contact_form', 'page_report')),
  category      text        NOT NULL
    CHECK (category IN (
      'report_error', 'suggest_update', 'general_question',
      'technical_problem', 'advertising', 'legal_removal'
    )),
  reason        text
    CHECK (reason IS NULL OR reason IN (
      'wrong_last_date', 'broken_link', 'wrong_eligibility',
      'missing_result', 'other'
    )),
  message       text        NOT NULL,          -- 10..2000 chars, enforced in fn
  sender_name   text,
  sender_email  text,
  sender_phone  text,
  page_url      text,                          -- as submitted (already url-shaped)
  page_title    text,
  -- Resolved server-side by submit-message from page_url (owner correction a):
  -- which entity the reader was looking at, when we can say so. 'sarkari_naukri'
  -- is included so the VACANCY editor's "N open reader reports" line resolves
  -- (P3-2); without it a /sarkari-naukri/<slug> report would carry entity_id NULL
  -- and the vacancy hook would forever read 0 — a silent lie.
  entity_type   text
    CHECK (entity_type IS NULL OR entity_type IN ('exam', 'content_post', 'blog_post', 'sarkari_naukri')),
  entity_id     uuid,                          -- no FK: three target tables
  consent       boolean     NOT NULL DEFAULT false,
  -- Canonical status set (owner decision 2026-09-30, single source of truth:
  -- src/config/messages.ts). 'triage' DROPPED ('new' IS the triage queue).
  -- 'wont_fix' (a genuine declined message) kept distinct from 'spam' (junk,
  -- purged after 30 days). Open = new | in_progress | waiting_on_reader.
  status        text        NOT NULL DEFAULT 'new'
    CHECK (status IN (
      'new', 'in_progress', 'waiting_on_reader',
      'resolved', 'wont_fix', 'spam'
    )),
  assignee      uuid REFERENCES auth.users(id) ON DELETE SET NULL,   -- (c)
  priority      text        NOT NULL DEFAULT 'normal'               -- (c)
    CHECK (priority IN ('low', 'normal', 'high')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reader_messages_status_idx
  ON public.reader_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reader_messages_created_idx
  ON public.reader_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS reader_messages_assignee_idx
  ON public.reader_messages (assignee, status);

-- ── 3. Internal notes (owner correction c) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_message_notes (
  id          uuid        primary key default gen_random_uuid(),
  message_id  uuid        NOT NULL REFERENCES public.reader_messages(id) ON DELETE CASCADE,
  author_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  note        text        NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_message_notes_message_idx
  ON public.contact_message_notes (message_id, created_at);

-- ── 4. Status/assignee history: who + when (owner correction c) ─────────────
CREATE TABLE IF NOT EXISTS public.contact_message_events (
  id          uuid        primary key default gen_random_uuid(),
  message_id  uuid        NOT NULL REFERENCES public.reader_messages(id) ON DELETE CASCADE,
  actor_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL, -- who
  event       text        NOT NULL CHECK (event IN (
    'created', 'status_changed', 'assignee_changed', 'priority_changed'
  )),
  old_value   text,
  new_value   text,
  created_at  timestamptz NOT NULL DEFAULT now()                        -- when
);

CREATE INDEX IF NOT EXISTS contact_message_events_message_idx
  ON public.contact_message_events (message_id, created_at);

-- ── 5. Rate-limit store (owner correction a: salted IP hash, BOTH sources) ──
-- The bucket key is sha256(SALT || '|' || client-ip) computed IN THE EDGE
-- FUNCTION; the raw IP is never stored. Fixed 10-minute windows; 5 per window
-- is the current setting, but max/window are function args so the caller (and
-- a later tuning) can vary them without a migration.
CREATE TABLE IF NOT EXISTS public.message_rate_limits (
  bucket_key   text        NOT NULL,            -- salted-ip hash (hex)
  window_start timestamptz NOT NULL,            -- floored to the window
  hits         int         NOT NULL DEFAULT 1,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_key, window_start)
);

-- Atomic check-and-count. SECURITY DEFINER; the ONLY reachable surface is
-- EXECUTE by service_role (the edge function). No table privileges for
-- anon/authenticated below, no policies, so nobody else can read or write it.
CREATE OR REPLACE FUNCTION public.message_rate_limit_attempt(
  p_bucket_key text,
  p_max_hits   int,
  p_window_minutes int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bucket timestamptz;
  v_hits   int;
BEGIN
  IF p_bucket_key IS NULL OR p_bucket_key = '' OR p_max_hits < 1
     OR p_window_minutes < 1 THEN
    RAISE EXCEPTION 'invalid rate-limit arguments' USING ERRCODE = 'check_violation';
  END IF;
  -- fixed windows: floor epoch to the window length
  v_bucket := to_timestamp(
    floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60)
  ) AT TIME ZONE 'UTC';

  INSERT INTO public.message_rate_limits (bucket_key, window_start, hits)
  VALUES (p_bucket_key, v_bucket, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET hits = public.message_rate_limits.hits + 1,
                updated_at = now()
  RETURNING hits INTO v_hits;

  -- self-pruning: keep the table small without an ops job
  DELETE FROM public.message_rate_limits
   WHERE window_start < now() - interval '1 day';

  RETURN v_hits <= p_max_hits;
END;
$$;

-- ── 6. RLS (owner corrections a + b) ────────────────────────────────────────
ALTER TABLE public.reader_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_message_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_rate_limits    ENABLE ROW LEVEL SECURITY;

-- reader_messages: read/update = handle_messages; delete = manage_settings;
-- INSERT has NO policy — only the service role (edge function) writes, and it
-- bypasses RLS. No anon policies.
DROP POLICY IF EXISTS reader_messages_read ON public.reader_messages;
CREATE POLICY reader_messages_read ON public.reader_messages
  FOR SELECT TO authenticated
  USING (current_user_has_permission('handle_messages'));

DROP POLICY IF EXISTS reader_messages_update ON public.reader_messages;
CREATE POLICY reader_messages_update ON public.reader_messages
  FOR UPDATE TO authenticated
  USING (current_user_has_permission('handle_messages'))
  WITH CHECK (current_user_has_permission('handle_messages'));

DROP POLICY IF EXISTS reader_messages_delete ON public.reader_messages;
CREATE POLICY reader_messages_delete ON public.reader_messages
  FOR DELETE TO authenticated
  USING (current_user_has_permission('manage_settings'));

-- notes: read/update = handle_messages (an author may edit their own note;
-- admins editing others' notes is covered by the same slug in practice);
-- insert = handle_messages AND author = self; delete = manage_settings.
DROP POLICY IF EXISTS notes_read ON public.contact_message_notes;
CREATE POLICY notes_read ON public.contact_message_notes
  FOR SELECT TO authenticated
  USING (current_user_has_permission('handle_messages'));

DROP POLICY IF EXISTS notes_insert ON public.contact_message_notes;
CREATE POLICY notes_insert ON public.contact_message_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_has_permission('handle_messages')
    AND author_id = (select auth.uid())
  );

DROP POLICY IF EXISTS notes_update ON public.contact_message_notes;
CREATE POLICY notes_update ON public.contact_message_notes
  FOR UPDATE TO authenticated
  USING (current_user_has_permission('handle_messages')
         AND author_id = (select auth.uid()))
  WITH CHECK (current_user_has_permission('handle_messages'));

DROP POLICY IF EXISTS notes_delete ON public.contact_message_notes;
CREATE POLICY notes_delete ON public.contact_message_notes
  FOR DELETE TO authenticated
  USING (current_user_has_permission('manage_settings'));

-- events: history. read = handle_messages; insert = handle_messages AND the
-- actor is self (who); update = handle_messages (present per the brief's
-- uniform rule, though the API never mutates history); delete = manage_settings.
DROP POLICY IF EXISTS events_read ON public.contact_message_events;
CREATE POLICY events_read ON public.contact_message_events
  FOR SELECT TO authenticated
  USING (current_user_has_permission('handle_messages'));

DROP POLICY IF EXISTS events_insert ON public.contact_message_events;
CREATE POLICY events_insert ON public.contact_message_events
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_has_permission('handle_messages')
    AND actor_id = (select auth.uid())
  );

DROP POLICY IF EXISTS events_update ON public.contact_message_events;
CREATE POLICY events_update ON public.contact_message_events
  FOR UPDATE TO authenticated
  USING (current_user_has_permission('handle_messages'))
  WITH CHECK (current_user_has_permission('handle_messages'));

DROP POLICY IF EXISTS events_delete ON public.contact_message_events;
CREATE POLICY events_delete ON public.contact_message_events
  FOR DELETE TO authenticated
  USING (current_user_has_permission('manage_settings'));

-- message_rate_limits: NO policies at all and no privileges — staff cannot
-- even read it; only message_rate_limit_attempt() (owner bypass) touches it.

-- ── 7. Privileges: strip everything from anon; least-needed for staff ───────
REVOKE ALL ON public.reader_messages        FROM anon, public;
REVOKE ALL ON public.contact_message_notes  FROM anon, public;
REVOKE ALL ON public.contact_message_events FROM anon, public;
REVOKE ALL ON public.message_rate_limits    FROM anon, authenticated, public;

GRANT SELECT, UPDATE             ON public.reader_messages        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_message_notes  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_message_events TO authenticated;
-- reader_messages INSERT is NOT granted to authenticated: the edge function's
-- service role is the only writer. (DELETE is granted for the manage_settings
-- policy; RLS still decides who can actually delete rows.)
GRANT DELETE ON public.reader_messages TO authenticated;

-- Function EXECUTE: service_role ONLY. anon/authenticated get nothing.
REVOKE ALL ON FUNCTION public.message_rate_limit_attempt(text, int, int)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.message_rate_limit_attempt(text, int, int)
  TO service_role;
