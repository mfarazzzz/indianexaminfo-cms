-- ─────────────────────────────────────────────────────────────────────────────
-- 20261028171123_social_queue.sql — S7.1 social queue, Telegram only (owner batch 4, J2)
--
-- Owner approval line for this batch: "APPLY SOCIAL QUEUE (after amendments)".
-- Applied to project cwbhhcqsrbuoybeaondk through Supabase MCP apply_migration on
-- 2026-10-28 and recorded by that tool as version 20261028171123, name social_queue.
-- This is supabase/proposed/20261012140000_social_queue.sql WITH the five batch-4
-- amendments already folded in, plus the J2 privilege narrowing the proof revealed.
--
-- THE FIVE AMENDMENTS (all in this file, all proved):
--   J2-1 SET search_path = public, pg_temp on claim_due_social_posts, social_sent_today,
--        social_posts_staff_write_guard and the new social_queued_count. After applying, all
--        four read proconfig = {search_path=public, pg_temp} and prosecdef = false.
--   J2-2 the guard is keyed on auth.role() = 'authenticated' — the token claim itself —
--        instead of current_user_role(), which reads user_profiles and returns NULL for a
--        signed-in user without a profile (an exemption that depends on data, not on the
--        caller's credentials). service_role / postgres / no-JWT stay exempt, which is what
--        lets the publish worker mark a row 'sent' at all.
--   J2-3 editing an APPROVED row's caption OR payload drops it back to 'draft' and clears
--        approved_by/approved_at, so an approval can never be spent on different text than
--        the one a human read. The worker builds the Telegram body from the CURRENT caption
--        and writes what it actually sent back into payload (supabase/functions/
--        social-publish/index.ts), so `payload` is an audit trail, never an input.
--   J2-4 claim_due_social_posts first fails rows abandoned in 'queued' for >15 minutes with
--        error 'stale-queued: verify in the channel before re-approving' — never back to
--        'approved' — and the worker's batch size is
--        cap - sent_today - currently_queued, never negative (queueHeadroom in
--        _shared/social.ts, social_queued_count() here).
--   J2-5 schema pre-flight before applying (measured, in the proposal file's header):
--        role_permissions(role_id uuid NOT NULL, permission_id uuid NOT NULL, PK both),
--        roles.slug exists with 'super-admin' among {ad-manager, admin, content-intern,
--        editor, super-admin, viewer, writer}, permissions(id, slug, label, "group") all
--        present, and current_user_role() really returns roles.slug.
--   J2-extra the rollback proof showed anon held EXECUTE on claim_due_social_posts through
--        the default PUBLIC grant. RLS made it harmless (SECURITY INVOKER, zero visible
--        rows) but a queue mutator does not belong on the public API surface: EXECUTE is
--        revoked from PUBLIC/anon/authenticated and granted to service_role, which is what
--        the social-publish Edge function actually uses (the CMS never calls the RPC from
--        the browser — src/services/social/socialQueueService.ts invokes the function).
--
-- PROVED IN A BEGIN … ROLLBACK TRANSACTION BEFORE APPLYING (verbatim results):
--   P0_profile_role_assigned=1;  T1_staff_set_sent=rejected;  T1b_status_after=approved;
--   T2_forced_to_acting_user=true,approved_at_set=true;
--       (the UPDATE supplied a DIFFERENT approved_by; the trigger replaced it with the
--        acting user from the JWT, and stamped approved_at)
--   T3_caption_edit=(status=draft,approved_by_null=true,approved_at_null=true,
--       caption=Edited after approval);
--   T3b_payload_edit=(status=draft,approved_by_null=true);
--   T7a_with_permission_visible_rows=2;  T7b_without_permission_visible_rows=0;
--   T4_first_claim_rows=2;  T5_second_claim_rows=0 (must be 0);  T5b_queued=2,sent_today=0;
--   T6_claim_after_stale_rows=0; stale_p1=(status=failed,error=stale-queued: verify in the
--       channel before re-approving),p2_now=queued
--
-- AFTER APPLYING (measured): 5 social tables, 9 policies, manage_social permission present
--   and granted to super-admin only, 0 rows in the queue, and
--   {"id":1,"kill_switch":true,"dry_run":true,"telegram_daily_cap":20,"updated_by":null}
--   — ship OFF, exactly as designed. Privileges: anon_claim=false, authed_claim=false,
--   service_claim=true, service_role SELECT+UPDATE on social_posts=true.
-- SECURITY ADVISOR AFTER: unchanged — ERROR 1 (exam_derived_status, by design),
--   WARN 2 + 10 + 19 + 1, INFO 6. No function_search_path_mutable finding was added, and no
--   new rls_enabled_no_policy entry (every new table has a policy).
--
-- NOTHING POSTS YET: kill_switch/dry_run are true, the tables are empty, and the two Edge
--   Functions are only deployed separately by the owner (see docs/social-queue-runbook.md).
--   No token is stored in any table; TG_BOT_TOKEN lives only in Edge Function Secrets.
-- ─────────────────────────────────────────────────────────────────────────────

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

-- 2. The queue. A row is created as a CANDIDATE ('draft') by the social-candidate Edge
--    function; nothing sends until a human approves. No security-definer DB trigger here.
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
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- exact body the adapter SENT (auditable)
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
CREATE POLICY social_posts_staff_update ON public.social_posts FOR UPDATE TO authenticated
  USING ((select public.current_user_has_permission('manage_social')))
  WITH CHECK ((select public.current_user_has_permission('manage_social')));

-- Guard (J2-1 pinned, J2-2 auth.role(), J2-3 re-approval).
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
    IF OLD.status = 'approved'
       AND (NEW.caption IS DISTINCT FROM OLD.caption OR NEW.payload IS DISTINCT FROM OLD.payload) THEN
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

-- 5. Provider-call log (redacted error, never a token).
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

-- Atomic claim (J2-4: stale-queued first, then FOR UPDATE SKIP LOCKED).
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

CREATE OR REPLACE FUNCTION public.social_sent_today(p_channel text)
RETURNS int LANGUAGE sql STABLE SET search_path = public, pg_temp AS $d$
  SELECT count(*)::int FROM public.social_posts
   WHERE channel = p_channel AND status = 'sent'
     AND last_attempt_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
                              AT TIME ZONE 'Asia/Kolkata';
$d$;

-- J2-4: the third number of the headroom formula (cap - sent_today - currently_queued).
CREATE OR REPLACE FUNCTION public.social_queued_count(p_channel text)
RETURNS int LANGUAGE sql STABLE SET search_path = public, pg_temp AS $q$
  SELECT count(*)::int FROM public.social_posts
   WHERE channel = p_channel AND status = 'queued';
$q$;

-- J2-extra: keep the queue mutator off the public API surface (see header). service_role is
-- what the social-publish Edge function runs as.
REVOKE ALL ON FUNCTION public.claim_due_social_posts(int, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_sent_today(text)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_queued_count(text)        FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_social_posts(int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.social_sent_today(text)           TO service_role;
GRANT EXECUTE ON FUNCTION public.social_queued_count(text)         TO service_role;

-- 6. manage_social to super-admin only (guarded; role id resolved by slug).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r JOIN public.permissions p ON p.slug = 'manage_social'
 WHERE r.slug = 'super-admin'
   AND NOT EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (destructive — drops the queue and its audit trail; owner action only)
--   DROP TRIGGER IF EXISTS social_posts_staff_write_guard ON public.social_posts;
--   DROP FUNCTION IF EXISTS public.social_posts_staff_write_guard();
--   DROP FUNCTION IF EXISTS public.claim_due_social_posts(int, text);
--   DROP FUNCTION IF EXISTS public.social_sent_today(text);
--   DROP FUNCTION IF EXISTS public.social_queued_count(text);
--   DROP TABLE IF EXISTS public.social_publish_log, public.social_post_events,
--                        public.social_config, public.social_posts, public.social_channels;
--   DELETE FROM public.role_permissions WHERE permission_id =
--          (SELECT id FROM public.permissions WHERE slug='manage_social');
--   DELETE FROM public.permissions WHERE slug='manage_social';
-- ─────────────────────────────────────────────────────────────────────────────
