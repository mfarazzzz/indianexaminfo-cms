-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSED — NOT APPLIED (S7.1 Social Queue: TELEGRAM-ONLY, revised 2026-10-22)
--
-- OWNER DECISION (22 Oct): Telegram only FIRST. Reddit/Quora stay OUT of the DB
-- until S7.2 — no channel enum value, no table, no config column for them here.
-- Facebook/Instagram are deferred (their columns are commented out, not dropped,
-- so the S7.2 revision can reinstate them deliberately).
--
-- READ-ONLY DESIGN ARTIFACT. Nothing here runs. The owner applies deliberately.
-- No token/secret is ever stored in a table — the ONLY credential is the Edge
-- secret TG_BOT_TOKEN (set by the owner in the dashboard, never by this agent).
-- TG_CHAT_ID is NOT a secret: it is the PUBLIC target id and lives in
-- social_channels.external_id ("@indianexaminfo" or numeric -100… id).
-- External update: an earlier revision of this file listed facebook_page /
-- instagram / whatsapp; per this decision they are removed from every CHECK
-- constraint and from the live surface until S7.2.
--
-- Verified live state (read-only, 2026-10-12, project cwbhhcqsrbuoybeaondk):
--   social tables            = 0        social permission rows = 0
--   exams published          = 397      exams is_verified=true = 0   <-- EMPTY POOL
--   (so the owner rule "unverified never auto-post" currently yields ZERO candidates
--    until the verification action sets is_verified — flagged as a dependency.)
--   Telegram does NOT need a public image URL (it renders a link preview from
--    landing_url), so the cms-public bucket dependency is dropped for S7.1.
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
  channel       text NOT NULL CHECK (channel IN ('telegram')),   -- S7.1: Telegram only; FB/IG/WhatsApp/Reddit/Quora are NOT in the enum (S7.2 decision)
  label         text NOT NULL,
  -- PUBLIC target id, not a secret: "@indianexaminfo" or numeric -100… chat id.
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
--    CANDIDATE HOOKS (owner decision 22 Oct) — exactly two event types:
--      a) an exam UPDATE (content_post) is PUBLISHED with kind IN
--         ('final','revised','corrigendum')  — drafted/cancelled kinds never queue;
--      b) an exam is VERIFIED (exam verify control sets is_verified=true).
--    Hook mechanics for S7.1: the CMS publish path and the verify path call the
--    social-candidate Edge function (service role, bypasses RLS) which inserts a
--    'draft' row idempotently (idempotency_key below). No DB trigger needed, so
--    no pg_cron and no migration on exam/content_posts behaviour.
--    MANUAL APPROVAL FIRST 30 DAYS: 'draft' -> a staff user with manage_social
--    approves -> 'approved'. Only after the owner's explicit 30-day sign-off may
--    auto-approval be discussed; nothing in this file automates it.
CREATE TABLE IF NOT EXISTS public.social_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','queued','sent','failed','skipped')),
  channel         text NOT NULL CHECK (channel IN ('telegram')),  -- S7.1 Telegram only
  channel_id      uuid REFERENCES public.social_channels(id),
  -- Structured provenance — never free text. Points at the source record + the
  -- verified field set the card was built from.
  source_type     text NOT NULL,                 -- 'exam' | 'sarkari_naukri' | 'content_post' | 'bulletin_signal'
  source_id       uuid NOT NULL,
  source_label    text,                          -- denormalised name for the queue UI
  -- Built from verified fields only; rendered into a caption + a PUBLIC image_url.
  caption         text NOT NULL,                 -- <= 4096 (telegram) enforced app-side
  image_url       text,                          -- unused in S7.1 (Telegram previews landing_url); kept for S7.2
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
-- NOTE: candidate creation is the Edge-function call in the publish/verify paths
-- (service role bypasses RLS) — see the CANDIDATE HOOKS block above. There is
-- deliberately NO security-definer DB trigger on content_posts/exams in S7.1, so
-- the bulletin and verify triggers stay untouched and reviewable on their own.

-- 3. Config: global kill-switch + dry-run + per-channel daily cap (a single row, id=1).
--    RUN MECHANISM (owner decision 22 Oct): the CMS "Run due queue" BUTTON calls the
--    Edge function on demand — NO pg_cron dependency. The button evaluates,
--    in ONE place: kill_switch -> dry_run -> daily cap -> approve-only.
CREATE TABLE IF NOT EXISTS public.social_config (
  id                 int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  kill_switch        boolean NOT NULL DEFAULT true,   -- ship OFF; owner flips to enable
  dry_run            boolean NOT NULL DEFAULT true,   -- run queue but DO NOT call Telegram; logs 'skipped' + the exact payload
  telegram_daily_cap int NOT NULL DEFAULT 20,
  -- deferred to S7.2 (kept as comments so the decision is visible, not silent):
  -- facebook_daily_cap  int NOT NULL DEFAULT 20,
  -- instagram_daily_cap int NOT NULL DEFAULT 25,
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

-- Daily-cap helper (called by the Edge function when the CMS "Run due queue"
-- button fires; counts today's sent per channel):
--   SELECT count(*) FROM social_posts
--   WHERE channel=$1 AND status='sent'
--     AND last_attempt_at >= date_trunc('day', now());
-- compared against social_config.<channel>_daily_cap. Kept as app/SQL logic, not a
-- trigger, so the kill-switch, dry-run and caps are evaluated in ONE place (the
-- function) — and the only scheduler is the staff member who clicks the button.
