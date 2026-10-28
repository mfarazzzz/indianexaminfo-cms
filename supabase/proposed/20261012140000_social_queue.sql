-- ══════════════════════════════════════════════════════════════════════════════
-- APPLIED 2026-10-28 under the owner's batch-4 approval "APPLY SOCIAL QUEUE (after
-- amendments)" as supabase/migrations/20261028171123_social_queue.sql (version 20261028171123,
-- name social_queue). The applied file carries the J2-1..J2-5 amendments AND the privilege
-- narrowing the rollback proof showed was needed; read that file for what is live. This
-- proposal is kept as the design record — do not apply it again.
-- PROPOSED — NOT APPLIED (S7.1 Social Queue: TELEGRAM-ONLY; revised 2026-10-24)
--
-- OWNER DECISION (22 Oct): Telegram only FIRST. Reddit/Quora/Facebook/Instagram/
-- WhatsApp stay OUT of the DB until S7.2 — no channel enum value, no table, no
-- config column for them here.
--
-- READ-ONLY DESIGN ARTIFACT. Nothing here runs. The owner applies deliberately.
-- No token/secret is ever stored in a table — the ONLY credential is the Edge
-- secret TG_BOT_TOKEN (set by the owner in the dashboard, never by this agent).
-- TG_CHAT_ID is NOT a secret: it is the PUBLIC target id in social_channels.external_id.
--
-- Live counts RE-VERIFIED 2026-10-24 (read-only, project cwbhhcqsrbuoybeaondk):
--   exams published = 399   exams is_verified=true = 0   <-- EMPTY CANDIDATE POOL
--   (the owner rule "unverified never auto-post" yields ZERO candidates until the
--    verification action sets is_verified — a dependency, not a bug.)
--   social tables = 0   manage_social permission rows = 0
--
-- Batch-2 (D/E) revisions vs the 22-Oct draft:
--   (1) every RLS helper call wrapped as (select current_user_has_permission(...))
--       so it is an InitPlan (evaluated once), not per row;
--   (2) social_config UPDATE restricted to super-admin only (staff with manage_social
--       may approve/skip/edit captions but NOT touch kill_switch/dry_run/caps);
--   (3) an atomic claim_due_social_posts() using FOR UPDATE SKIP LOCKED;
--   (4) daily cap computed on the Asia/Kolkata day;
--   (5) a guard so staff cannot hand-set status='sent' and approved_by is forced to auth.uid();
--   (6) manage_social granted to super-admin only in this migration;
--   (7) header counts refreshed (above).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- BATCH-4 AMENDMENTS (owner, J2 — applied to THIS file before applying it):
--   J2-1  SET search_path = public, pg_temp on claim_due_social_posts, social_sent_today
--         and social_posts_staff_write_guard (plus the new social_queued_count), so the
--         migration adds no function_search_path_mutable finding.
--   J2-2  the guard fires on auth.role() = 'authenticated' instead of consulting
--         current_user_role(); service_role / postgres / no-JWT contexts are exempt.
--   J2-3  editing an APPROVED row's caption (or payload) sends it back to 'draft' and clears
--         approved_by/approved_at; the worker builds the Telegram body from the CURRENT
--         caption at send time and never trusts the stored payload (it now writes the body it
--         actually sent back into payload, so that column stays an honest audit trail).
--   J2-4  claim_due_social_posts first fails any row stuck in 'queued' for >15 minutes with
--         error 'stale-queued: verify in the channel before re-approving' — never back to
--         'approved'; and the worker's batch size is cap - sent_today - currently_queued,
--         never negative (queueHeadroom in _shared/social.ts, social_queued_count here).
--   J2-5  SCHEMA PRE-FLIGHT, measured 2026-10-28 against cwbhhcqsrbuoybeaondk before applying:
--           role_permissions  = role_id uuid NOT NULL, permission_id uuid NOT NULL,
--                               PRIMARY KEY (role_id, permission_id)   -> the INSERT's column
--                               list is exact and a repeat run cannot duplicate the row
--           roles             has slug; values: ad-manager, admin, content-intern, editor,
--                               super-admin, viewer, writer             -> r.slug='super-admin' resolves
--           permissions       has id, slug, label, group              -> the quoted "group" is right
--           current_user_role() = `select r.slug from user_profiles up join roles r
--                                    on r.id = up.role_id where up.id = auth.uid()`
--                               -> it really returns the APP ROLE SLUG (SECURITY DEFINER,
--                                  search_path already pinned)
--         Also measured: permissions row with slug 'manage_social' = 0 (the guarded INSERT
--         creates it), social_* tables = 0, zz-test- exams = 5 (J3 makes both functions
--         refuse them), exams = 404 published / 399 published-and-not-test.
-- ─────────────────────────────────────────────────────────────────────────────
-- ══════════════════════════════════════════════════════════════════════════════

-- 0. A permission slug for the queue (guarded insert).
INSERT INTO public.permissions (id, slug, label, "group")
SELECT gen_random_uuid(), 'manage_social', 'Manage Social Queue', 'social'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE slug = 'manage_social');

-- 1. Which destinations we post to. One row per configured channel target.
CREATE TABLE IF NOT EXISTS public.social_channels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       text NOT NULL CHECK (channel IN ('telegram')),
  label         text NOT NULL,
  external_id   text,                       -- PUBLIC chat id ("@indianexaminfo" or -100…), NOT a secret
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),
  UNIQUE (channel, label)
);
ALTER TABLE public.social_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_channels_staff_read  ON public.social_channels;
DROP POLICY IF EXISTS social_channels_staff_write ON public.social_channels;
DROP POLICY IF EXISTS social_channels_admin_write ON public.social_channels;
CREATE POLICY social_channels_staff_read ON public.social_channels FOR SELECT TO authenticated
  USING ((select public.current_user_has_permission('manage_social')));
-- Only super-admin edits channel targets (the public chat id is a live posting destination).
CREATE POLICY social_channels_admin_write ON public.social_channels
  FOR ALL TO authenticated
  USING ((select public.current_user_role()) = 'super-admin')
  WITH CHECK ((select public.current_user_role()) = 'super-admin');

-- 2. The queue. A row is created as a CANDIDATE ('draft') from a publish/verify event;
--    nothing sends until a human approves. Two event types (candidate hooks):
--      a) an exam content_post PUBLISHED with kind IN ('final','revised','corrigendum');
--      b) an exam is VERIFIED (is_verified=true).
--    Candidate creation is the social-candidate Edge function (service role, bypasses
--    RLS), idempotent on idempotency_key. NO security-definer DB trigger here.
CREATE TABLE IF NOT EXISTS public.social_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','queued','sent','failed','skipped')),
  channel         text NOT NULL CHECK (channel IN ('telegram')),
  channel_id      uuid REFERENCES public.social_channels(id),
  source_type     text NOT NULL,                 -- 'exam' | 'sarkari_naukri' | 'content_post' | 'bulletin_signal'
  source_id       uuid NOT NULL,
  source_label    text,
  caption         text NOT NULL,                 -- <= 4096 (telegram) enforced app-side
  image_url       text,                          -- unused in S7.1 (kept for S7.2)
  landing_url     text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- exact body the adapter sends (auditable)
  scheduled_at    timestamptz,
  external_id     text,                          -- provider message id after a send
  idempotency_key text NOT NULL,                 -- channel|source_type|source_id|event
  attempts        int  NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  error           text,                          -- REDACTED provider error
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS social_posts_due_idx    ON public.social_posts (status, scheduled_at);
CREATE INDEX IF NOT EXISTS social_posts_source_idx ON public.social_posts (source_type, source_id);
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_posts_staff_read  ON public.social_posts;
DROP POLICY IF EXISTS social_posts_staff_write ON public.social_posts;
DROP POLICY IF EXISTS social_posts_staff_update ON public.social_posts;
CREATE POLICY social_posts_staff_read ON public.social_posts FOR SELECT TO authenticated
  USING ((select public.current_user_has_permission('manage_social')));
CREATE POLICY social_posts_staff_write ON public.social_posts FOR INSERT TO authenticated
  WITH CHECK ((select public.current_user_has_permission('manage_social')));
-- (5) staff may UPDATE (approve/skip/edit caption) but may NOT hand-set status='sent'
--     (only the Edge function, via service role, marks sent) and approved_by is forced
--     to the acting user. A BEFORE UPDATE trigger enforces both.
CREATE POLICY social_posts_staff_update ON public.social_posts FOR UPDATE TO authenticated
  USING ((select public.current_user_has_permission('manage_social')))
  WITH CHECK ((select public.current_user_has_permission('manage_social')));

-- (5) Guard: staff cannot fake a send; approved_by is always the acting user; and editing
--     an APPROVED caption/payload withdraws the approval (batch-4 amendment J2-3).
--
--     J2-2: the condition is auth.role() = 'authenticated' — the token claim itself, not
--     current_user_role(), which reads user_profiles and returns NULL for a signed-in user
--     with no profile (so the whole guard could be skipped by accident, and the exemption
--     depended on data instead of on the caller's credentials). service_role, postgres and
--     any no-JWT context (worker, migration) are exempt, which is what lets the publish
--     worker mark rows 'sent' at all.
--     J2-1: search_path pinned, so this migration adds no function_search_path_mutable finding.
CREATE OR REPLACE FUNCTION public.social_posts_staff_write_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $g$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.status = 'sent' AND OLD.status <> 'sent' THEN
      RAISE EXCEPTION 'social_posts: only the publish worker may set status=sent'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- J2-3: what a human approved is the caption they saw. Change it (or the audited
    -- payload) on an approved row and the row is a draft again, with the approval cleared,
    -- so an approval can never be spent on different text than the one it covered.
    IF OLD.status = 'approved'
       AND (NEW.caption IS DISTINCT FROM OLD.caption
            OR NEW.payload IS DISTINCT FROM OLD.payload) THEN
      NEW.status      := 'draft';
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    ELSIF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := now();
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $g$;
DROP TRIGGER IF EXISTS social_posts_staff_write_guard ON public.social_posts;
CREATE TRIGGER social_posts_staff_write_guard BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.social_posts_staff_write_guard();

-- 3. Config: global kill-switch + dry-run + per-channel daily cap (single row id=1).
CREATE TABLE IF NOT EXISTS public.social_config (
  id                 int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  kill_switch        boolean NOT NULL DEFAULT true,   -- ship OFF
  dry_run            boolean NOT NULL DEFAULT true,   -- log exact payload, post nothing
  telegram_daily_cap int NOT NULL DEFAULT 20,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES auth.users(id)
);
INSERT INTO public.social_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.social_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_config_staff_read  ON public.social_config;
DROP POLICY IF EXISTS social_config_admin_write ON public.social_config;
-- (2) read for manage_social staff; UPDATE restricted to SUPER-ADMIN only.
CREATE POLICY social_config_staff_read ON public.social_config FOR SELECT TO authenticated
  USING ((select public.current_user_has_permission('manage_social')));
CREATE POLICY social_config_admin_write ON public.social_config FOR UPDATE TO authenticated
  USING ((select public.current_user_role()) = 'super-admin')
  WITH CHECK ((select public.current_user_role()) = 'super-admin');

-- 4. Append-only audit trail.
CREATE TABLE IF NOT EXISTS public.social_post_events (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  action  text NOT NULL,            -- created|approved|edited|skipped|queued|sent|failed|corrected
  actor   uuid REFERENCES auth.users(id),
  detail  jsonb NOT NULL DEFAULT '{}'::jsonb,
  at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_post_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_post_events_staff_read ON public.social_post_events;
CREATE POLICY social_post_events_staff_read ON public.social_post_events FOR SELECT TO authenticated
  USING ((select public.current_user_has_permission('manage_social')));

-- 5. Provider-call log (mirrors ai_request_logs; redacted error, never a token).
CREATE TABLE IF NOT EXISTS public.social_publish_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id       uuid REFERENCES public.social_posts(id) ON DELETE SET NULL,
  channel       text NOT NULL,
  status        text NOT NULL CHECK (status IN ('success','error','skipped')),
  provider_code text,
  error_message text,               -- REDACTED (never a token); <=500 chars
  latency_ms    int,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_publish_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_publish_log_staff_read ON public.social_publish_log;
CREATE POLICY social_publish_log_staff_read ON public.social_publish_log FOR SELECT TO authenticated
  USING ((select public.current_user_has_permission('manage_social')));

-- (3) Atomic claim — two "Run due queue" clicks can never double-post. Marks the
--     oldest approved, due rows 'queued' under FOR UPDATE SKIP LOCKED and returns them.
--     J2-4: rows abandoned in 'queued' for more than 15 minutes (a worker that died
--     mid-send) are failed FIRST, never re-approved or re-claimed — the message may already
--     be in the channel, so a human must look before it can be approved again. Silently
--     re-claiming them is exactly the double-post this function exists to prevent.
--     J2-1: search_path pinned.
CREATE OR REPLACE FUNCTION public.claim_due_social_posts(p_limit int, p_channel text)
RETURNS SETOF public.social_posts
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $c$
BEGIN
  UPDATE public.social_posts
     SET status          = 'failed',
         error           = 'stale-queued: verify in the channel before re-approving',
         last_attempt_at = now(),
         updated_at      = now()
   WHERE status = 'queued'
     AND channel = p_channel
     AND last_attempt_at < now() - interval '15 minutes';

  RETURN QUERY
  UPDATE public.social_posts sp
     SET status = 'queued', attempts = attempts + 1, last_attempt_at = now(), updated_at = now()
   WHERE sp.id IN (
     SELECT c.id FROM public.social_posts c
      WHERE c.status = 'approved' AND c.channel = p_channel
        AND (c.scheduled_at IS NULL OR c.scheduled_at <= now())
      ORDER BY c.scheduled_at NULLS FIRST, c.approved_at
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED)
  RETURNING sp.*;
END; $c$;

-- (4) Daily cap on the Asia/Kolkata day (called by the publish worker). J2-1: pinned.
CREATE OR REPLACE FUNCTION public.social_sent_today(p_channel text)
RETURNS int LANGUAGE sql STABLE SET search_path = public, pg_temp AS $d$
  SELECT count(*)::int FROM public.social_posts
   WHERE channel = p_channel AND status = 'sent'
     AND last_attempt_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                              AT TIME ZONE 'Asia/Kolkata';
$d$;

-- J2-4: the worker's batch size is cap - sent_today - currently_queued, never negative.
-- 'queued' rows must be counted, not just 'sent': a row claimed by a request that is still
-- in flight is capacity that has already been spent, and ignoring it lets the caller claim
-- past the cap. The arithmetic itself lives in _shared/social.ts (queueHeadroom) where a
-- unit test can pin it; this function only reports the third number.
CREATE OR REPLACE FUNCTION public.social_queued_count(p_channel text)
RETURNS int LANGUAGE sql STABLE SET search_path = public, pg_temp AS $q$
  SELECT count(*)::int FROM public.social_posts
   WHERE channel = p_channel AND status = 'queued';
$q$;

-- J2 batch-4 (measured, not assumed): the rollback proof reported
--   anon_claim_execute=true — Postgres grants EXECUTE/SELECT to PUBLIC by default, so
--   /rest/v1/rpc/claim_due_social_posts would be callable by an anonymous visitor. RLS
--   makes it harmless (the function is SECURITY INVOKER and an anon caller can see zero
--   rows), but the queue mutator has no business being on the public API surface, and the
--   CMS does not call it from the browser anyway: "Run due queue" invokes the social-publish
--   Edge function, which runs as service_role (src/services/social/socialQueueService.ts).
--   service_role is NOT revoked here — the worker needs it (verified after applying).
REVOKE ALL ON FUNCTION public.claim_due_social_posts(int, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_sent_today(text)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_queued_count(text)        FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_social_posts(int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.social_sent_today(text)          TO service_role;
GRANT EXECUTE ON FUNCTION public.social_queued_count(text)        TO service_role;

-- (6) Grant manage_social to super-admin only (guarded; role id resolved by slug).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r JOIN public.permissions p ON p.slug = 'manage_social'
 WHERE r.slug = 'super-admin'
   AND NOT EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PERMISSIONS-UI CHECK (required report): the permissions table has a free-text
-- "group" column (existing groups: ads/content/media/structure/system/users). A new
-- group value 'social' is just another distinct string — the CMS permissions UI
-- groups by this column, so 'manage_social' will appear under a new "social" heading
-- automatically (no UI code change needed). VERIFY the UI does not hard-code the
-- group list; if it does, add 'social' there. (Confirmed by reading the permissions
-- screen before applying.)
-- ─────────────────────────────────────────────────────────────────────────────
