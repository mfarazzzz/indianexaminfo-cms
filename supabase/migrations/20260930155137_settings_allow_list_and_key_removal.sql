/*
  APPLIED 2026-09-30 via Supabase MCP apply_migration (A1, owner-approved 28 Sep).

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
  2  Staff read non-sensitive rows; the manage_settings permission reads
     sensitive rows. The blanket "any uid" read policy and the role-name read
     policy are dropped. Every new or replaced policy checks
     current_user_has_permission('manage_settings') - never current_user_role()
     and never a role name, so one rule (the permission grant) decides access.
  2b admin_write_settings (cmd ALL, role names) is replaced by four explicit
     SELECT / INSERT / UPDATE / DELETE policies, all gated on manage_settings.
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
  NOTE: this file carries no BEGIN/COMMIT of its own - the migration runner
  wraps each file in its own transaction.
*/

-- â”€â”€ 1. the public site reads an allow-list, not "everything not flagged" â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ 2. staff read non-sensitive rows; manage_settings reads everything â”€â”€â”€â”€â”€â”€â”€â”€â”€
drop policy if exists "admin_read_all_settings" on public.settings;

drop policy if exists "admin_write_settings" on public.settings;  -- cmd ALL, role names
drop policy if exists "settings_select_manage" on public.settings;
drop policy if exists "settings_insert_manage" on public.settings;
drop policy if exists "settings_update_manage" on public.settings;
drop policy if exists "settings_delete_manage" on public.settings;

create policy "staff_read_nonsensitive_settings"
  on public.settings
  for select
  to authenticated
  using (is_sensitive = false);

create policy "admin_read_all_settings"
  on public.settings
  for select
  to authenticated
  using (current_user_has_permission('manage_settings'));

-- The old admin_write_settings was FOR ALL with role names baked in; it also
-- acted as a SELECT policy. Replaced by four explicit command policies, each
-- gated on the manage_settings PERMISSION (the grant table is the single source
-- of truth - renaming or adding a role can no longer silently widen or break
-- access).
create policy "settings_insert_manage"
  on public.settings
  for insert
  to authenticated
  with check (current_user_has_permission('manage_settings'));

create policy "settings_update_manage"
  on public.settings
  for update
  to authenticated
  using (current_user_has_permission('manage_settings'))
  with check (current_user_has_permission('manage_settings'));

create policy "settings_delete_manage"
  on public.settings
  for delete
  to authenticated
  using (current_user_has_permission('manage_settings'));
-- rollback: drop policy "staff_read_nonsensitive_settings" on public.settings;
--           drop policy "admin_read_all_settings" on public.settings;
--           drop policy "settings_insert_manage" on public.settings;
--           drop policy "settings_update_manage" on public.settings;
--           drop policy "settings_delete_manage" on public.settings;
--           create policy "admin_read_all_settings" on public.settings
--             for select using (auth.uid() is not null);
--           create policy "admin_write_settings" on public.settings
--             for all using (current_user_role() in ('super-admin','admin'));

-- â”€â”€ 3. flag every secret-shaped key â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ 4. remove key material from the database â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
-- every signed-in user. api_key was NOT NULL DEFAULT '' before the drop - no CMS
-- code reads or writes it any more (aiProviderService/AIProviderManager/types were
-- cleaned in S0-1), so the drop cannot break a save.
alter table public.ai_providers drop column if exists api_key;
alter table public.ai_providers drop column if exists api_key_encrypted;
-- rollback: alter table public.ai_providers add column api_key text
--             not null default '';  (values are not recoverable from here)

-- Its read policy was "any signed-in user", which was only ever tolerable because
-- the table is admin UI; with the key column gone it no longer carries a secret,
-- but the screen itself is an admin screen, so every policy here is gated on the
-- same manage_settings permission the settings screen uses.
drop policy if exists "staff_read_ai_providers" on public.ai_providers;
create policy "staff_read_ai_providers"
  on public.ai_providers
  for select
  to authenticated
  using (current_user_has_permission('manage_settings'));

drop policy if exists "staff_write_ai_providers" on public.ai_providers;
create policy "staff_write_ai_providers"
  on public.ai_providers
  for insert
  to authenticated
  with check (current_user_has_permission('manage_settings'));

drop policy if exists "staff_update_ai_providers" on public.ai_providers;
create policy "staff_update_ai_providers"
  on public.ai_providers
  for update
  to authenticated
  using (current_user_has_permission('manage_settings'))
  with check (current_user_has_permission('manage_settings'));
-- rollback: recreate the policies with using (auth.uid() is not null) and no
--           permission restriction.

-- â”€â”€ 5. per-user rate limiting for the ai-fill function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.ai_request_logs add column if not exists user_id uuid;
create index if not exists ai_request_logs_user_recent_idx
  on public.ai_request_logs (user_id, created_at desc)
  where user_id is not null;
-- rollback: drop index if exists ai_request_logs_user_recent_idx;
--           alter table public.ai_request_logs drop column if exists user_id;

-- â”€â”€ 6. settings grants: anon gets no DML, RLS still guards the rest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- TRUNCATE, TRIGGER and REFERENCES are never covered by RLS, so no role but the
-- owner may do them here.
revoke truncate, references, trigger
  on public.settings from anon, authenticated;

-- The public site only ever reads. The CMS writes through PostgREST as an
-- authenticated manage_settings holder, which the new settings_update_manage /
-- settings_insert_manage policies restrict, so those grants stay for
-- authenticated and are removed for anon only.
revoke insert, update, delete on public.settings from anon;
-- rollback: grant truncate, references, trigger
--             on public.settings to anon, authenticated;
--           grant insert, update, delete on public.settings to anon;
--
-- The file deliberately ends without a COMMIT statement: the migration runner
-- wraps every file in its own transaction.

-- â”€â”€ proof (re-run 2026-09-28 inside a rolled-back transaction after the
--    S0-1 follow-up added revalidate_token to the delete list) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
-- Not exercised here: the live-admin session â€” that is the rolled-back test
-- below. A plain SET ROLE does not produce the auth.uid() the permission
-- helpers read, so the F1b proof simulated two users the same way S0-5 did:
-- real rows in auth.users + user_profiles (the signup trigger auto-creates the
-- profile; the test UPDATEs role_id/is_active), then set local role authenticated
-- + set local request.jwt.claims to each user's uuid, then measured.
-- Measured 2026-09-28 with steps 1-4 + 6 applied inside begin; â€¦ rollback;  (2
-- fixture rows seeded: zz_test_sensitive is_sensitive=true, zz_test_public):
--   1. holder_helper                 = true
--   2. holder_reads_sensitive        = 1
--   3. holder_update_sensitive_rows  = 1
--   4. holder_insert_rows            = 1
--   5. holder_visible_total          = 25 (22 live after deletes + 2 fixtures + 1 insert)
--   6. holder_ai_providers_visible   = 2
--   7. writer_helper                 = false
--   8. writer_sensitive_visible      = 0
--   9. writer_public_visible         = 1
--  10. writer_visible_all            = 23 (non-sensitive only)
--  11. writer_update_sensitive_rows  = 0   (USING filters the row out)
--  12. writer_update_public_rows     = 0   (no UPDATE policy for writers at all)
--  13. writer_insert_result          = 42501 denied (raised; caught in DO block)
--  14. writer_ai_providers_visible   = 0
--  15. writer_ai_provider_update_rows= 0
--  16. anon_visible_keys             = adsense_enabled, direct_ads_enabled,
--      primary_color, site_name, site_tagline, site_url   (allow-list unchanged)
-- After every run the DB was re-checked: no test users, no test rows, no
-- policies beyond the live set.
--
-- To re-run after any edit, wrap the steps above in:
--   begin; <steps>; set local role anon; select count(*) from public.settings;
--   rollback;
--   (the runner itself wraps the file; the begin/rollback here are for the
--    manual proof only)
