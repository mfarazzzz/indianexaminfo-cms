# Social queue — owner runbook (S7.1b, Telegram only)

**Status since 28 Oct (owner batch 4):** the schema IS applied (migration
`20261028171123_social_queue.sql`, version `20261028171123`) and BOTH functions ARE deployed
(`social-candidate`, `social-publish`, each `verify_jwt: true`, version 1). The queue is
still inert in three independent ways: `kill_switch = true`, `dry_run = true`, and the CMS
feature flag is off, so the `/social` page and the candidate hooks do not exist in the UI.
Nothing sends until you change those deliberately. The agent never handles the bot token —
you set it yourself in the dashboard.

## 0. Prerequisites
- A Telegram **channel** (e.g. `@indianexaminfo`) and a **bot** created via @BotFather.
- Add the bot to the channel as an **admin** with "Post messages" permission.

## 1. Read the chat id (NOT a secret)
Preferred: forward any post from the channel to **@userinfobot** (no token involved) or open
your channel in a browser — a public channel's id is simply its `@username`. The channel id is
either the public `@indianexaminfo` or a negative number like `-100xxxxxxxxxx`. This value goes
in `social_channels.external_id` (it is public — never the token).

Alternative if you need `getUpdates`: `https://api.telegram.org/bot<TOKEN>/getUpdates`. Be aware
that putting the token in a browser address bar leaves it in browser history, so use the
@userinfobot route above instead when it is enough. The agent never performs this step and never
sees the token.

## 2. Set the secrets (dashboard only)
Supabase Dashboard → **Project Settings → Edge Functions → Secrets** (or `secrets` tab):
- `TG_BOT_TOKEN` = the bot token from @BotFather. **You set this; never paste it in chat.**
- `PUBLIC_SITE_URL` = `https://www.indianexaminfo.com` (not a secret — it is the public
  reader origin `social-candidate` uses to build `landing_url`). Without it the candidate
  hook refuses to write (502) rather than store a wrong link.
`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the
platform for Edge Functions. After changing secrets, redeploy the function that uses them
(`supabase functions deploy <name>`) — secrets are read at cold start.

## 3. Apply the schema — DONE 28 Oct, do not repeat
`supabase/migrations/20261028171123_social_queue.sql` created `social_channels`,
`social_posts`, `social_config`, `social_post_events`, `social_publish_log`, the
`claim_due_social_posts` / `social_sent_today` / `social_queued_count` functions, the
staff-write guard trigger, and granted `manage_social` to super-admin. Kill switch and dry
run defaulted to **true** and still read true:
`select kill_switch, dry_run, telegram_daily_cap from social_config where id = 1;`

## 4. Deploy the functions — DONE 28 Oct (by the agent, with your approval)
Both were deployed with `verify_jwt = true` and each returns **401** to an unauthenticated
`POST` and to a bogus bearer token (probed from outside: `UNAUTHORIZED_NO_AUTH_HEADER`,
`UNAUTHORIZED_INVALID_JWT_FORMAT`). `import_map: false`, `version: 1`.
Re-deploy after any code change: `supabase functions deploy social-candidate` and
`supabase functions deploy social-publish`.

## 5. Turn the feature on in the CMS — there is NO env variable for it
The flag is a **source constant**, not an environment variable:
`src/config/featureFlags.ts` → `FEATURE_FLAGS.SOCIAL_QUEUE: false` → set it to `true`,
**then rebuild and redeploy the CMS** — the value is inlined into the bundle at build time,
so a running CMS will not pick it up without a rebuild. When it is on, the `/social` route
and its nav item appear (they stay hidden from users without `manage_social` by RLS + the
page's own permission check).

## 6. First dry run, click by click
1. Sign in to the CMS as **super-admin** (the only role with `manage_social`).
2. Add the channel if it is not there: `/social` → *Channels* → channel `telegram`,
   label `main`, `external_id` = the public chat id from step 1, `is_active` on.
   (Or insert the row yourself in SQL: `insert into social_channels (channel,label,external_id)
   values ('telegram','main','@indianexaminfo');`)
3. Verify the config row reads `kill_switch = true`, `dry_run = true`, `telegram_daily_cap = 20`.
4. Flip **kill_switch OFF** in the config panel (super-admin only — staff cannot).
5. Leave **dry_run ON**.
6. Publish or verify ONE exam (the hooks only fire for exams today). It appears in the queue
   as `draft`, with the caption built from structured fields and `landing_url` resolved
   through `/go/{slug}` to the real reader page. Reference `zz-test-` records are refused
   (422) and can never be queued.
7. Click **Approve** on that row. Now edit its caption and save: the row goes back to `draft`
   and the approval is cleared — that is the guard, and it is what you want to see working.
   Re-approve it.
8. Click **Run due queue**. Expect: each approved row is claimed, one
   `social_publish_log` row per post with `status='skipped'`, `provider_code='dry_run'`, and
   every row returned to `approved`. **Nothing is posted.**
9. Read the audit: `select status, provider_code, error_message, created_at
   from social_publish_log order by created_at desc limit 10;` and
   `select caption, landing_url, status, attempts from social_posts order by created_at desc limit 10;`
   — check the caption text and that `landing_url` is an `indianexaminfo.com` page.
10. If the run reports `killed`, kill_switch is still on. If it reports
    `reason: "cap_reached"` with `headroom: 0`, today's cap is already spent
    (sent + queued ≥ cap) and nothing was claimed.

## 7. One real test post
1. Confirm the caption + link in the log look right.
2. Set `TG_BOT_TOKEN` (step 2) and redeploy `social-publish` if you set it after deploying.
3. Flip **dry_run OFF**.
4. Approve ONE row, Run due queue → it sends one message to the channel; the row goes
   `sent` (with `external_id` = the Telegram message id and `payload` = the exact body sent)
   or `failed` with a REDACTED error. The daily cap (`telegram_daily_cap`, computed on the
   Asia/Kolkata day, and counting rows already `queued` as spent) bounds volume.
5. Flip **kill_switch ON** again to stop until you're satisfied.

## Safety notes
- Two "Run due queue" clicks can't double-post: `claim_due_social_posts` uses
  `FOR UPDATE SKIP LOCKED`.
- A row abandoned in `queued` for more than 15 minutes (a worker that died mid-send) is
  moved to `failed` with `error = 'stale-queued: verify in the channel before
  re-approving'` — never back to `approved`, because the message may already be in the
  channel. Look before re-approving it.
- Staff cannot hand-set `status='sent'` (a trigger blocks it, on the `authenticated` JWT
  role); only the worker does. Editing an approved row's caption or payload drops it back to
  `draft` with the approval cleared, so an approval cannot be spent on different text.
- The token is never in a caption, payload, or log line (`redactError` guards errors).
- Candidates are built from STRUCTURED fields only (name, derived status, the one date,
  official host, page URL) — never free text from a notice.
- `claim_due_social_posts` / `social_sent_today` / `social_queued_count` are not callable by
  `anon` or `authenticated` over `/rest/v1/rpc/…` (revoked; only `service_role` has EXECUTE).
- **landing_url (fixed 28 Oct, owner batch 3 H-3a):** it used to fall back to the Supabase
  project host because both CMS callers pass `page_url: ""`. It now always resolves to a real
  reader page: the candidate calls the frontend's own `/go/{slug}` resolver (the single place
  the pillar → URL-segment fact lives), follows its 308, and stores the FINAL URL — e.g.
  `/go/ssc-cgl` → `https://www.indianexaminfo.com/sarkari-naukri/ssc/ssc-cgl`. If
  `PUBLIC_SITE_URL` is missing the candidate is refused (502) instead of storing a bad link,
  and a caller-supplied URL is only honoured when it is on the public site's own host.
  Proven by `supabase/functions/_shared/social.test.ts` ("landing url — the reader page,
  never the project host").

End: SCHEMA APPLIED (20261028171123) AND BOTH FUNCTIONS DEPLOYED (verify_jwt true, v1,
401 to unauthenticated calls) — kill_switch and dry_run are ON and the CMS flag is OFF, so
nothing can post until you change those deliberately.
