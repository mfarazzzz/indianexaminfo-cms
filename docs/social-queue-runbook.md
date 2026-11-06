# Social queue — owner runbook (S7.1b, Telegram only)

**Status since 29 Oct (owner batch 5):** the schema is applied (migration
`20261028171123_social_queue.sql`, version `20261028171123`); BOTH functions are redeployed as
**version 2** with `verify_jwt: true` (their `../_shared/social.ts` sibling is bundled — the
deploy bundler resolves it, see `supabase/functions/bundleLayout.test.ts`); the CMS feature flag
`FEATURE_FLAGS.SOCIAL_QUEUE` is **true**, so `/social` and the candidate hooks exist once the CMS
is rebuilt; and a super-admin can add the channel from the page itself.

Still three independent safeties, all still on: `kill_switch = true`, `dry_run = true`, and the
page shows a banner saying so. Nothing sends until you change those deliberately. The agent never
handles the bot token — you set it yourself in the dashboard.

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

## 4. Deploy the functions — DONE, redeployed 29 Oct as version 2 (by the agent, with your approval)
Both deployed with `verify_jwt = true`; each returns **401** to an unauthenticated `POST` and
`GET` and to a bogus bearer token. Probed from outside on 29 Oct, verbatim:

```
social-candidate   POST  auth=none  → 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}
social-candidate   GET   auth=none  → 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER",...}
social-candidate   POST  bogus JWT  → 401 {"code":"UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM","message":"Unsupported JWT algorithm none"}
social-publish     POST/GET/bogus    → same three shapes
```

`import_map: false`, `version: 2`, `ezbr_sha256` recorded in the commit message for each.
Redeploy after any code change (the agent can do it through the dashboard MCP, or you can:
`supabase functions deploy social-candidate social-publish`). Note the deploy needs the sibling
file too — upload `source/index.ts` **and** `_shared/social.ts`, entrypoint `source/index.ts`;
if the sibling is missing the bundler refuses the deploy with `Module not found` rather than
publishing a broken function.

## 5. The feature flag — ON since 29 Oct, and it is NOT an environment variable
`src/config/featureFlags.ts` → `FEATURE_FLAGS.SOCIAL_QUEUE: true`. Vite inlines the value at
**build** time, so the deployed CMS only shows `/social` after the commit reaches `main`:
**push to main; the host builds it; confirm the admin build stamp.** There is no pm2 step and no
`deploy-cms.sh` — Hostinger builds the CMS itself from the connected repo (see
`docs/DEPLOYMENT_GUIDE.md` §1b; its §4 pm2/rsync procedure is legacy and is not what runs).
Confirming the stamp is one request, no login:

```powershell
Invoke-WebRequest https://admincms1.indianexaminfo.com/ -UseBasicParsing | Select-Object -ExpandProperty Content | Select-String -Pattern 'name="build" content="([^"]+)"'
```

The sha in that string must be the commit that turned the flag on (`7fec9e6` or any later
commit). Verified live for this batch on 6 Nov: `0369f92 dirty 2026-11-06T03:02:14.419Z`.

A local `npm run dev` picks the flag up on reload, so a dev box can be ahead of the host — that
is the one situation where "it works locally but /social is missing in production" means the
build stamp is older than the commit.

When it is on, the nav item **Social queue** appears in the sidebar and the `/social` route
exists — both only for a role holding `manage_social` (today: super-admin), which is the same
check the RLS policies make. To turn the whole feature back off without touching the database,
set the constant to `false`, push to main, and confirm the build stamp again: `kill_switch` and
`dry_run` are the safer levers.

## 6. First dry run, click by click

The labels below are the ones the page actually renders (from
`src/pages/social/SocialQueuePage.tsx`). Each step says what you should SEE. If a step does not
behave as described, send the reviewer the step number, what you saw, and any error text or SQL
result — **never** the bot token or a JWT; the token is not needed to diagnose any of this.

1. **Sign in** to the CMS as **super-admin** (the only role with `manage_social`).
   *Expect:* the sidebar contains **Social queue**.
   If it is missing: you are not signed in as super-admin, or the deployed build is older than
   the commit that turned the flag on — check the build stamp (§5) and, if it is old, push to
   main and let the host build. Check the role with:
   `select r.slug from user_profiles up join roles r on r.id = up.role_id where up.id = auth.uid();`

2. **Open** **Social queue**. *Expect:* an amber banner at the top reading
   **"KILL SWITCH ON: nothing is posted to any channel."**, the heading
   **Social queue — Telegram**, a button **Run due queue (dry run)**, and below it the
   **Telegram channels** panel. An editor without `manage_social` never sees the page at all.
   If instead you see the "Disabled by `FEATURE_FLAGS.SOCIAL_QUEUE`" panel, the running bundle
   is older than the commit that turned the flag on — compare the build stamp (§5).

3. **Add the channel** in the **Telegram channels** panel: type a label in
   *"Label (e.g. Main channel)"*, the public chat id in *"@channelname or -1001234567890"*,
   click **Add channel**. *Expect:* a toast **Channel added** and the row appears with
   `active`, e.g. `Main channel  @indianexaminfo  active`.
   A bad id is refused before anything is written: *"Not a Telegram chat id. Use @channelname
   (5–32 characters, letters, digits and underscores) or a numeric id like -1001234567890."*
   There is **no token field anywhere on this page** — by design (§2).
   If the insert fails, send the toast text plus the output of
   `select channel, label, external_id, is_active from social_channels order by label;`

4. **Confirm the config row** in the panel under the banner: **Kill switch** ticked,
   **Dry run** ticked, **Daily cap** `20`. *Expect:* all three editable (you are super-admin);
   a non-super-admin sees the same values greyed with
   *"config editable by super-admin only"*. Or read it in SQL:
   `select kill_switch, dry_run, telegram_daily_cap from social_config where id = 1;`

5. **Un-tick Kill switch.** Leave **Dry run** ticked. *Expect:* the banner changes to
   **"DRY RUN: nothing is posted — the exact message is written to the log and the item
   returns to Approved."** If the banner disappears entirely, `dry_run` got unticked too —
   re-tick it before continuing; that is the difference between a dry run and a real post.

6. **Publish (or verify) ONE real exam** from the exam editor. *Expect:* the publish succeeds
   normally, and the queue gains a row within a second or two: its title, a `draft` chip, the
   caption built from structured fields, and the landing link under it.
   *Check the link is a reader page:* it must read `https://www.indianexaminfo.com/...`, never
   `...supabase.co`. If no row appears: publish something already-verified and un-published
   again, then check `select caption, landing_url, status from social_posts order by created_at
   desc limit 5;` — an empty table means the edge call failed, and the browser console will show
   the line `[social] candidate refused (non-blocking): …` or
   `[social] candidate hook failed (non-blocking): …`. Send that line (it contains no secret).
   A `zz-test-` record is refused at three layers and never appears: the client hook skips it,
   `social-candidate` answers 422 `"reference test content is never queued"`, and `social-publish`
   fails any such row before sending.

7. **Approve** that row (**Approve** button) and confirm the chip becomes `approved`.
   Then click **Edit caption**, change a word, **Save caption**.
   *Expect:* the row goes back to **`draft`** and the approval is cleared — that is the
   J2-3 guard: an approved caption cannot be edited and then spent. **Approve** it again.
   If the chip stays `approved` after the edit, say so — that would mean the DB trigger is not
   firing, and this query shows it: `select status, approved_by, approved_at from social_posts
   where id = '<the row id>';`

8. Click **Run due queue (dry run)**. *Expect:* a toast **"Dry run complete (nothing
   posted)"**, and every approved row still `approved` (the worker returns it there).
   One `social_publish_log` row per claimed post with `status='skipped'`,
   `provider_code='dry_run'`. **Nothing is posted.**
   If the toast says **Kill switch on — nothing sent**, step 5 did not stick.
   If it reports `reason: "cap_reached"` with `headroom: 0`, the day's capacity is already spent
   (`sent + queued ≥ daily cap`) — raise **Daily cap** or wait for the next Asia/Kolkata day.

9. **Read the audit.**
   `select status, provider_code, error_message, created_at from social_publish_log order by created_at desc limit 10;`
   `select caption, landing_url, status, attempts, error from social_posts order by created_at desc limit 10;`
   *Expect:* `skipped` / `dry_run` rows in the log, no `sent` row anywhere, and the caption text
   you approved. Check the caption for a wrong date or a missing link before you ever turn
   `dry_run` off.

10. **Put the kill switch back on** (tick **Kill switch**) when you are done reviewing. The
    queue is then inert again even if a scheduled call reaches it.

## 7. One real test post (only after §6 looks right)
1. Confirm the caption + link in the log look right.
2. Set `TG_BOT_TOKEN` (§2) and redeploy `social-publish` if you set it after deploying.
3. Un-tick **Kill switch**, then un-tick **Dry run**. *Expect:* the banner disappears — that is
   the visual confirmation that a real send is now possible.
4. Approve ONE row, click **Run due queue** (no "(dry run)" in the label any more) → one message
   appears in the channel; the row goes `sent` (`external_id` = the Telegram message id,
   `payload` = the exact body sent) or `failed` with a **REDACTED** error. `telegram_daily_cap`
   bounds volume, counted on the Asia/Kolkata day, and rows sitting in `queued` count as spent.
   A `config_missing` result means the token or the channel row is absent — check §2 and §3.
5. Tick **Kill switch** again to stop until you are satisfied.

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

End: SCHEMA APPLIED (20261028171123) · BOTH FUNCTIONS DEPLOYED v2 (verify_jwt true, 401 to
unauthenticated calls, shared module bundled) · CMS FLAG ON and LIVE on the host (build stamp
`0369f92` confirmed 6 Nov — push to main, the host builds it, confirm the admin build stamp) ·
`kill_switch` and `dry_run` are ON, so nothing can post until you change those deliberately.
Channel management exists in the UI (super-admin only) — §6 step 3.
