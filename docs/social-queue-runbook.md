# Social queue — owner runbook (S7.1b, Telegram only)

Nothing here is applied or deployed. Do these in order, on your own. The agent never
handles the bot token — you set it yourself in the dashboard.

## 0. Prerequisites
- A Telegram **channel** (e.g. `@indianexaminfo`) and a **bot** created via @BotFather.
- Add the bot to the channel as an **admin** with "Post messages" permission.

## 1. Read the chat id (NOT a secret)
Open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser after posting
in the channel, or forward a channel post to @userinfobot. The channel id is either the
public `@indianexaminfo` or a negative number like `-100xxxxxxxxxx`. This value goes in
`social_channels.external_id` (it is public — never the token).

## 2. Set the secret (dashboard only)
Supabase Dashboard → **Project Settings → Edge Functions → Secrets** (or `secrets` tab):
- `TG_BOT_TOKEN` = the bot token from @BotFather. **You set this; never paste it in chat.**
The functions also use the platform-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` — already present for Edge Functions.

## 3. Apply the schema
Only after review, apply `supabase/proposed/20261012140000_social_queue.sql` (creates
`social_channels`, `social_posts`, `social_config`, `social_post_events`,
`social_publish_log`, the `claim_due_social_posts` + `social_sent_today` functions, the
staff-write guard trigger, and grants `manage_social` to super-admin). Kill switch and
dry-run default to **true** (safe).

## 4. Deploy the functions (NOT done by the agent)
```
supabase functions deploy social-candidate   # verify_jwt ON (default)
supabase functions deploy social-publish     # verify_jwt ON (default)
```
Both read `TG_BOT_TOKEN` / service role from Edge Function env.

## 5. Turn the feature on in the CMS
Set `FEATURE_FLAGS.SOCIAL_QUEUE = true` in `src/config/featureFlags.ts` and add the
`social_channels` row (channel `telegram`, `external_id` = the chat id, label, is_active).
The `/social` route + nav now appear.

## 6. First dry run
With `kill_switch=true` the "Run due queue" button does nothing. To exercise safely:
1. Flip **kill_switch off** (super-admin, in the config panel).
2. Leave **dry_run ON**.
3. Publish or verify an exam → a `draft` candidate appears in the queue.
4. Approve it → status `approved`.
5. Click **Run due queue** → it claims approved rows, writes the EXACT payload to
   `social_publish_log` with status `skipped`, posts NOTHING, and returns rows to
   `approved`. Inspect `select * from social_publish_log order by created_at desc;`.

## 7. One real test post
1. Confirm the caption + link in the log look right.
2. Flip **dry_run OFF**.
3. Approve ONE row, Run due queue → it sends one message to the channel; the row goes
   `sent` (or `failed` with a redacted error). The daily cap (`telegram_daily_cap`,
   computed on the Asia/Kolkata day) bounds volume.
4. Flip **kill_switch ON** again to stop until you're satisfied.

## Safety notes
- Two "Run due queue" clicks can't double-post: `claim_due_social_posts` uses
  `FOR UPDATE SKIP LOCKED`.
- Staff cannot hand-set `status='sent'` (a trigger blocks it); only the worker does.
- The token is never in a caption, payload, or log line (`redactError` guards errors).
- Candidates are built from STRUCTURED fields only (name, derived status, the one date,
  official host, page URL) — never free text from a notice.
- **Known follow-up:** the candidate `landing_url` is currently passed by the caller;
  wire it to the real reader URL (`pillarToUrlSegment(category/slug)`) before live use.

End: SOCIAL QUEUE CODE READY (NOT APPLIED, NOT DEPLOYED)
