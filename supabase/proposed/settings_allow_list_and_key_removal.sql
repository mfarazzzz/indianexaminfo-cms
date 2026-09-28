/*
  PROPOSED - NOT APPLIED. Do not copy into supabase/migrations/ until approved.
  On approval it is promoted with version = the UTC time of promotion.

  S0-1b - close the settings read leak and remove key material from the database
  ----------------------------------------------------------------------------------
  Measured on project cwbhhcqsrbuoybeaondk on 2026-09-28 (values never printed):

  * public.settings holds 25 rows; 2 are is_sensitive = true, so 23 are readable by
    the anon role. Three RLS policies exist, all defined FOR ALL ROLES ({public}):
      public_read_settings     SELECT  USING (is_sensitive = false)
      admin_read_all_settings  SELECT  USING (auth.uid() is not null)
      admin_write_settings     ALL     USING (current_user_role() in
                                                      ('super-admin','admin'))
    admin_write_settings is cmd = ALL, so it also acts as a SELECT policy.
  * The anon-readable 23 include ai_fallback_key, whose value has the shape of a
    live provider key (56 chars, provider prefix) and which is NOT flagged
    is_sensitive. That is the leak: the policy trusts a flag on the row instead of
    naming what the public site is allowed to see.
  * admin_read_all_settings is not an admin check. auth.uid() is not null is true
    for every signed-in user, so a writer with no admin rights can read
    revalidate_token (64 chars) and gemini_api_key (56 chars, provider prefix).
  * The public site needs 16 keys and nothing else: services/settingsService.ts in
    indianexaminfo-frontend maps exactly site_name, site_tagline, site_url,
    site_description, logo_url, favicon_url, primary_color, telegram_channel,
    whatsapp_group, youtube_channel, twitter_handle, ga_id, gsc_verify,
    adsense_publisher_id, adsense_enabled, direct_ads_enabled - and it reads them
    with the ANON key (lib/supabase/server.ts). Ten of the sixteen are not rows
    yet; they are allow-listed because the frontend already looks for them and
    falls back to config/site.ts when absent.
  * public.ai_providers has 2 rows, both provider=groq, both with a plaintext,
    provider-prefixed api_key; api_key_encrypted is unused (0 non-null). Its read
    policy is also auth.uid() is not null, so every signed-in user can read those
    keys too. Keys move to edge-function secrets, so the columns go.
  * anon and authenticated hold INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES on
    public.settings (Supabase default grants). RLS blocks the DML for non-admins,
    but TRUNCATE/TRIGGER/REFERENCES are not covered by RLS at all, so those grants
    go. INSERT/UPDATE/DELETE stay for the authenticated role, because the CMS
    settings screen writes through PostgREST and is gated by admin_write_settings -
    revoking them there would break every admin "Save" in Settings. anon keeps no
    DML at all.

  What this migration does
  ------------------------
  1  public_read_settings becomes an explicit allow-list: the 16 keys above, and
     nothing else. Adding a setting no longer publishes it.
  2  Signed-in staff may read non-sensitive rows; only super-admin/admin may read
     sensitive rows. The blanket "any uid" read policy is dropped.
  3  Every secret-shaped key is flagged is_sensitive = true (pattern based, so
     future rows are caught by the same rule).
  4  Provider key material AND the revalidate token are deleted from settings, and
     the plaintext key columns are dropped from ai_providers. All of it moves to
     edge-function secrets (S0-1c, and the S0-1 follow-up for REVALIDATE_TOKEN).
  5  ai_request_logs gains user_id so the edge function can rate-limit per user
     across isolates, not just inside one.
  6  Grants on settings are trimmed to what the roles actually need.

  Proof (run before promoting, inside a rolled-back transaction, as anon):
  the allow-listed keys are readable and nothing else - see the SELECTs at the
  bottom of the file, all expected to be run with `set local role anon`.
*/

begin;

-- ── 1. the public site reads an allow-list, not "everything not flagged" ────────
drop policy if exists "public_read_settings" on public.settings;

create policy "public_read_settings"
  on public.settings
  for select
  to anon
  using (
    is_sensitive = false
    and key in (
      'site_name',
      'site_tagline',
      'site_url',
      'site_description',
      'logo_url',
      'favicon_url',
      'primary_color',
      'telegram_channel',
      'whatsapp_group',
      'youtube_channel',
      'twitter_handle',
      'ga_id',
      'gsc_verify',
      'adsense_publisher_id',
      'adsense_enabled',
      'direct_ads_enabled'
    )
  );
-- rollback: drop policy "public_read_settings" on public.settings;
--           create policy "public_read_settings" on public.settings
--             for select using (is_sensitive = false);

-- ── 2. staff read non-sensitive rows; only admins read everything ───────────────
drop policy if exists "admin_read_all_settings" on public.settings;

create policy "staff_read_nonsensitive_settings"
  on public.settings
  for select
  to authenticated
  using (is_sensitive = false);

create policy "admin_read_all_settings"
  on public.settings
  for select
  to authenticated
  using (current_user_role() = any (array['super-admin', 'admin']));
-- rollback: drop policy "staff_read_nonsensitive_settings" on public.settings;
--           create policy "admin_read_all_settings" on public.settings
--             for select using (auth.uid() is not null);

-- ── 3. flag every secret-shaped key ────────────────────────────────────────────
update public.settings
   set is_sensitive = true
 where is_sensitive = false
   and (
     key ~* '(^|_)(api_?key|token|secret|password|credential)s?($|_)'
     or key ~* '_(key|token|secret|password|credential)$'
     or value #>> '{}' ~ '^(gsk_|sk-|AIza[0-9A-Za-z_-]|eyJ[A-Za-z0-9_.-])'
   );
-- Deliberately narrow: a key NAME that says it is a credential, or a VALUE with a
-- known provider/JWT prefix. Model names, colours, URLs and sentences never match,
-- and no length heuristic is used (an earlier draft of this file had one and it was
-- removed - it could quietly flag site_name).
-- Measured effect today: ai_fallback_key flips to is_sensitive = true.
-- rollback: update public.settings set is_sensitive = false where key = 'ai_fallback_key';

-- ── 4. remove key material from the database ───────────────────────────────────
delete from public.settings
 where key in (
   'ai_fallback_key',
   'gemini_api_key',
   'ai_key_3',
   'ai_key_4',
   'openai_api_key',
   'anthropic_api_key',
   'mistral_api_key',
   'revalidate_token'
 );
-- Measured effect today: 3 rows deleted (ai_fallback_key, gemini_api_key,
-- revalidate_token). The revalidate token MOVES OUT of settings entirely per the
-- S0-1 follow-up: it lives only as the revalidate-frontend Edge Function secret
-- REVALIDATE_TOKEN (Deno.env) and the frontend's env.REVALIDATE_TOKEN. The CMS
-- no longer reads, writes or displays it (see SettingsPage / settingsService /
-- types/settings).
-- rollback: none - these values become edge-function secrets, which is the point.
-- The owner re-enters nothing in the CMS: ai-fill and revalidate-frontend read
-- secrets.

-- ai_providers keeps its job as the registry the function walks (provider, model,
-- enabled, priority) and as the health board (usage_count, last_error,
-- last_used_at). The key columns are removed: they were plaintext and readable by
-- every signed-in user. api_key is NOT NULL DEFAULT '' before the drop, so CMS
-- inserts that omit it are unaffected.
alter table public.ai_providers drop column if exists api_key;
alter table public.ai_providers drop column if exists api_key_encrypted;
-- rollback: alter table public.ai_providers add column api_key text
--             not null default '';  (values are not recoverable from here)

-- Its read policy was "any signed-in user", which was only ever tolerable because
-- the table is admin UI; with the key column gone it no longer carries a secret,
-- but the screen itself is an admin screen, so tighten it to match the delete
-- policy that already exists.
drop policy if exists "staff_read_ai_providers" on public.ai_providers;
create policy "staff_read_ai_providers"
  on public.ai_providers
  for select
  to authenticated
  using (current_user_role() = any (array['super-admin', 'admin']));

drop policy if exists "staff_write_ai_providers" on public.ai_providers;
create policy "staff_write_ai_providers"
  on public.ai_providers
  for insert
  to authenticated
  with check (current_user_role() = any (array['super-admin', 'admin']));

drop policy if exists "staff_update_ai_providers" on public.ai_providers;
create policy "staff_update_ai_providers"
  on public.ai_providers
  for update
  to authenticated
  using (current_user_role() = any (array['super-admin', 'admin']))
  with check (current_user_role() = any (array['super-admin', 'admin']));
-- rollback: recreate the three policies with using (auth.uid() is not null) and no
--           role restriction.

-- ── 5. per-user rate limiting for the ai-fill function ─────────────────────────
alter table public.ai_request_logs add column if not exists user_id uuid;
create index if not exists ai_request_logs_user_recent_idx
  on public.ai_request_logs (user_id, created_at desc)
  where user_id is not null;
-- rollback: drop index if exists ai_request_logs_user_recent_idx;
--           alter table public.ai_request_logs drop column if exists user_id;

-- ── 6. settings grants: anon gets no DML, RLS still guards the rest ────────────
-- TRUNCATE, TRIGGER and REFERENCES are never covered by RLS, so no role but the
-- owner may do them here.
revoke truncate, references, trigger
  on public.settings from anon, authenticated;

-- The public site only ever reads. The CMS writes through PostgREST as an
-- authenticated admin, which admin_write_settings already restricts, so those
-- grants stay for authenticated and are removed for anon only.
revoke insert, update, delete on public.settings from anon;
-- rollback: grant truncate, references, trigger
--             on public.settings to anon, authenticated;
--           grant insert, update, delete on public.settings to anon;

-- ── proof (re-run 2026-09-28 inside a rolled-back transaction after the
--    S0-1 follow-up added revalidate_token to the delete list) ──────────────────
-- Steps 1-4 + 6 applied, then `set local role anon`, then measured, then rollback:
--
--   rows visible to anon        : 6
--   which ones                  : adsense_enabled, direct_ads_enabled, primary_color,
--                                 site_name, site_tagline, site_url
--   anon can see revalidate_token : false
--   anon sees any *_key/_token name : false
--
-- Steps 1-4 + 6 applied, then reset role, then measured, then rollback:
--
--   total rows after the deletes  : 22 (was 25; ai_fallback_key, gemini_api_key and
--                                   revalidate_token all gone)
--   revalidate_token rows present : 0   (the token is no longer in settings at all)
--   provider-key rows present     : 0
--
-- Not exercised: reading a sensitive row AS A REAL ADMIN. It cannot regress -
-- admin_write_settings (cmd = ALL, admin roles only) already acts as a SELECT
-- policy today and is left untouched, and the new admin_read_all_settings grants
-- the same visibility again. Verified by reading the policy definitions
-- (pg_policies) rather than by a live admin session, since SET ROLE does not
-- produce the auth.uid() those helpers read.
--
-- To re-run after any edit, wrap the steps above in:
--   begin; <steps>; set local role anon; select count(*) from public.settings;
--   rollback;

commit;
