-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSED — NOT APPLIED (S7 Social Queue: auto-post design data model)
--
-- READ-ONLY DESIGN ARTIFACT. Nothing here runs. The owner applies deliberately.
-- No token/secret is ever stored in a table — channel credentials live ONLY in
-- Supabase Edge secrets (names in the report: TG_BOT_TOKEN, TG_CHAT_ID is NOT a
-- secret and lives in social_channels.external_id; FB_PAGE_ID + FB_PAGE_TOKEN secret;
-- IG_ACCOUNT_ID + IG_ACCESS_TOKEN secret). external_id below is the PUBLIC target
-- identifier (chat @name / page id / ig account id), never a credential.
--
-- Verified live state (read-only, 2026-10-12, project cwbhhcqsrbuoybeaondk):
--   social tables            = 0        social permission rows = 0
--   exams published          = 397      exams is_verified=true = 0   <-- EMPTY POOL
--   (so the owner rule "unverified never auto-post" currently yields ZERO candidates
--    until the verification action sets is_verified — flagged as a dependency.)
--   public bucket "cms-public" exists (public, <=10MB, allows image/jpeg) -> hosts the
--    rendered card so Instagram/Facebook can cURL a PUBLIC image_url (both require it).
--   RLS helper in use across the app: public.current_user_has_permission(slug)
--   (SECURITY DEFINER, resolves via auth.uid(); see existing exam_editions/bulletin policies).
--   permission rows: (id uuid, slug, label, "group"); groups: ads/content/media/structure/system/users.
-- ══════════════════════════════════════════════════════════════════════════════

-- 0. A permission slug for the queue. Guarded insert (unknown if slug is UNIQUE).
INSERT INTO public.permissions (id, slug, label, "group")
SELECT gen_random_uuid(), 'manage_social', 'Manage Social Queue', 'social'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE slug = 'manage_social');

-- 1. Which destinations we post to. One row per configured channel target.
CREATE TABLE IF NOT EXISTS public.social_channels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       text NOT NULL CHECK (channel IN ('telegram','facebook_page','instagram','whatsapp')),
  label         text NOT NULL,
  -- PUBLIC target id, not a secret: "@indianexaminfo" / numeric -100… chat id / Page id / IG business account id.
  external_id   text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),
  -- one active target per channel type is the normal case; allow multiple for later.
  UNIQUE (channel, label)
);
ALTER TABLE public.social_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_channels_staff_read  ON public.social_channels;
DROP POLICY IF EXISTS social_channels_staff_write ON public.social_channels;
CREATE POLICY social_channels_staff_read  ON public.social_channels FOR SELECT TO authenticated
  USING (current_user_has_permission('manage_social'));
CREATE POLICY social_channels_staff_write ON public.social_channels
  FOR INSERT TO authenticated WITH CHECK (current_user_has_permission('manage_social'));
CREATE POLICY social_channels_staff_update ON public.social_channels
  FOR UPDATE TO authenticated USING (current_user_has_permission('manage_social'))
  WITH CHECK (current_user_has_permission('manage_social'));

-- 2. The queue itself. A row is created as a CANDIDATE (status 'draft') from a
--    publish/verify event; nothing sends until a human approves (first 30 days).
CREATE TABLE IF NOT EXISTS public.social_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','queued','sent','failed','skipped')),
  channel         text NOT NULL CHECK (channel IN ('telegram','facebook_page','instagram','whatsapp')),
  channel_id      uuid REFERENCES public.social_channels(id),
  -- Structured provenance — never free text. Points at the source record + the
  -- verified field set the card was built from.
  source_type     text NOT NULL,                 -- 'exam' | 'sarkari_naukri' | 'content_post' | 'bulletin_signal'
  source_id       uuid NOT NULL,
  source_label    text,                          -- denormalised name for the queue UI
  -- Built from verified fields only; rendered into a caption + a PUBLIC image_url.
  caption         text NOT NULL,                 -- <= 4096 (telegram) / <=2200 (ig caption soft cap) enforced app-side
  image_url       text,                          -- public cms-public URL when the channel needs it (IG/FB)
  landing_url     text NOT NULL,                 -- the CMS/reader page (UTM added at S7.4)
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- exact body the adapter will send (auditable)
  scheduled_at    timestamptz,                   -- null = send when approved; else future
  external_id     text,                          -- provider post/media id after a send (for a later correction)
  idempotency_key text NOT NULL,                 -- channel|source_type|source_id|event  => never double-post
  attempts        int  NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  error           text,                          -- REDACTED provider error, same discipline as ai-fill
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS social_posts_due_idx  ON public.social_posts (status, scheduled_at);
CREATE INDEX IF NOT EXISTS social_posts_source_idx ON public.social_posts (source_type, source_id);
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_posts_staff_read  ON public.social_posts;
DROP POLICY IF EXISTS social_posts_staff_write ON public.social_posts;
CREATE POLICY social_posts_staff_read  ON public.social_posts FOR SELECT TO authenticated
  USING (current_user_has_permission('manage_social'));
CREATE POLICY social_posts_staff_write ON public.social_posts FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('manage_social'));
CREATE POLICY social_posts_staff_update ON public.social_posts FOR UPDATE TO authenticated
  USING (current_user_has_permission('manage_social')) WITH CHECK (current_user_has_permission('manage_social'));
-- NOTE: candidate creation from a DB trigger runs as SECURITY DEFINER (service role in
-- the Edge path bypasses RLS anyway). A definer trigger inserting 'draft' rows is the
-- intended source; it is NOT added here (needs the owner to pick the exact publish hook).

-- 3. Config: global kill-switch + per-channel daily caps (a single row, id=1).
CREATE TABLE IF NOT EXISTS public.social_config (
  id                 int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  kill_switch        boolean NOT NULL DEFAULT true,   -- ship OFF; owner flips to enable
  telegram_daily_cap int NOT NULL DEFAULT 20,
  facebook_daily_cap int NOT NULL DEFAULT 20,
  instagram_daily_cap int NOT NULL DEFAULT 25,        -- hard ceiling is IG's 100/24h (verified)
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES auth.users(id)
);
INSERT INTO public.social_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.social_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_config_staff_read  ON public.social_config;
DROP POLICY IF EXISTS social_config_staff_write ON public.social_config;
CREATE POLICY social_config_staff_read  ON public.social_config FOR SELECT TO authenticated
  USING (current_user_has_permission('manage_social'));
CREATE POLICY social_config_staff_write ON public.social_config FOR UPDATE TO authenticated
  USING (current_user_has_permission('manage_social')) WITH CHECK (current_user_has_permission('manage_social'));

-- 4. Append-only audit trail (who approved/skipped/edited and why).
CREATE TABLE IF NOT EXISTS public.social_post_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id    uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  action     text NOT NULL,            -- created|approved|edited|skipped|queued|sent|failed|corrected
  actor      uuid REFERENCES auth.users(id),
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_post_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_post_events_staff_read ON public.social_post_events;
CREATE POLICY social_post_events_staff_read ON public.social_post_events FOR SELECT TO authenticated
  USING (current_user_has_permission('manage_social'));
-- inserts happen from the Edge function (service role) / definer; no client write policy.

-- 5. Provider-call log — mirrors public.ai_request_logs (status, redacted error, latency).
CREATE TABLE IF NOT EXISTS public.social_publish_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id      uuid REFERENCES public.social_posts(id) ON DELETE SET NULL,
  channel      text NOT NULL,
  status       text NOT NULL CHECK (status IN ('success','error','skipped')),
  provider_code text,                  -- HTTP status / Telegram 429 / Graph error subcode
  error_message text,                  -- REDACTED (never a token); <=500 chars
  latency_ms   int,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_publish_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_publish_log_staff_read ON public.social_publish_log;
CREATE POLICY social_publish_log_staff_read ON public.social_publish_log FOR SELECT TO authenticated
  USING (current_user_has_permission('manage_social'));

-- Daily-cap helper (called by the Edge function; counts today's sent per channel):
--   SELECT count(*) FROM social_posts
--   WHERE channel=$1 AND status='sent'
--     AND last_attempt_at >= date_trunc('day', now());
-- compared against social_config.<channel>_daily_cap. Kept as app/SQL logic, not a
-- trigger, so the kill-switch and caps are evaluated in ONE place (the function).
