# Social queue — owner runbook (S7.1b, Telegram only)

**Status since 29 Oct (owner batch 5):** the schema is applied (migration
`20261028171123_social_queue.sql`, version `20261028171123`); BOTH functions are redeployed as
**version 2** with `verify_jwt: true` (their `../_shared/social.ts` sibling is bundled — the
deploy bundler resolves it, see `supabase/functions/bundleLayout.test.ts`); the CMS feature flag
`FEATURE_FLAGS.SOCIAL_QUEUE` is **true**, so `/social` and the candidate hooks exist once the CMS
is rebuilt; and a super-admin can add the channel from the page itself.

**Status since 8 Nov 2026 (owner batch 8, Phase H3):** both functions are redeployed as
**version 3** with `verify_jwt: true`, adding the **vacancy branch** — a verified + published
vacancy (`source_type = 'sarkari_naukri'`) creates a Telegram **draft** candidate, with the
caption built from structured fields only and the zz-test guard in all three layers. See §4a for
the digests and the 8/8 401 probes.

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

### 1a. What the CMS now refuses (owner batch 9, P2)

The owner added a **bot handle** and a **positive number** as "channels"; the form accepted both.
`validateTelegramChatId` now accepts exactly two shapes and refuses everything else with a plain
reason:

| value | verdict |
|---|---|
| `@indianexaminfo` (5–32 letters/digits/underscore) | **accepted** |
| `-1001234567890` (starts `-100`) | **accepted** |
| `@IndianExamInfobot`, or any handle ending in `bot` | **refused** — "That is a bot, not a channel." |
| `8747371610` (a positive number) | **refused** — "Channel ids start with -100; a positive number is a person or a bot." |

Activation now also **re-validates the chat id already stored on the row**, so an old bad row
cannot be switched on until it is corrected — and nothing is deleted.

**Exactly one active Telegram channel.** Setting a channel active deactivates the other active
`telegram` rows in the same write, so the publish worker's `is_active = true` lookup is never
ambiguous. The amber warning in the page stays as a second warning. Since the owner has already set
two of his three rows inactive, the database currently holds exactly one active row.

**"Check channel"** (super-admin only, one button per row) calls `social-publish` with
`{action:"check_channel", channel_id}` and answers in plain language: whether Telegram can see the
chat, whether it is a channel at all, and whether the bot is an administrator that may post. It is
read-only: it is allowed with the kill switch **on**, it never posts, and it never returns or logs
the token.

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

## 4. Deploy the functions — DONE, redeployed 29 Oct as version 2, then 8 Nov 2026 as version 3, then 8 Nov 2026 as version 4 (by the agent, with your approval)

### 4a. Version 4 — 8 Nov 2026, owner batch 9 Phase P (CORS + `check_channel`)

**The bug the owner reported.** At ~11:40 IST (06:10 UTC) on 8 Nov the `/social` page showed a red
toast **"Failed to send a request to the Edge Function"** when he pressed **Run due queue**. That
message is supabase-js reporting that it never got a *readable* response — it is not what a normal
4xx/5xx JSON body produces. The cause was CORS, proven three ways:

1. **Source.** Both functions answered through a helper that set only `content-type`, and neither
   had an `OPTIONS` branch. A cross-origin browser call therefore sent a preflight that fell
   through to the bearer-token check.
2. **Live logs** (Supabase `function_edge_logs`, 05:55–06:20 UTC):

   ```
   OPTIONS | 401 | …/social-publish    2026-11-08T06:10:03.711  ← the owner's click
   OPTIONS | 401 | …/social-publish    2026-11-08T06:10:57.230  ← the owner's click
   ```

   Those were the ONLY edge-log rows in the window — there was no function boot error, so the
   shared `_shared/social.ts` import was never the problem.
3. **Preflight probe, before the fix:**

   ```
   OPTIONS social-publish  → HTTP 401  body {"ok":false,"error":"unauthorized"}  (no Access-Control-*)
   OPTIONS social-candidate→ HTTP 401  body {"ok":false,"error":"unauthorized"}  (no Access-Control-*)
   OPTIONS ai-fill         → HTTP 200  Access-Control-Allow-Origin: https://admincms1.indianexaminfo.com
   ```

   The 401 body was the **function's own JSON**, which proved the Supabase gateway forwards
   `OPTIONS` to the function rather than blocking it — so the fix had to live inside the function.

**Which button calls which function.** `src/services/social/socialQueueService.ts`:

| CMS action | function |
|---|---|
| **Run due queue** (`runDueQueue`) | `social-publish` |
| publish / verify hooks (`createCandidate`) | `social-candidate` |

The log evidence points at `social-publish`, so the owner pressed **Run due queue**.

**The fix.** One allow-list CORS implementation in `_shared/social.ts` — `corsFor`, `preflightFor`,
`jsonWith` — the same rule `ai-fill` and `revalidate-frontend` already use: echo the exact origin,
`Vary: Origin`, never `"*"`; an absent `Origin` (curl, pg_net, a probe) is not a browser and passes;
a foreign browser origin gets no allow header. `preflightFor` runs **before** any auth check, and a
handler-scoped `const json = (o, status) => jsonWith(o, status, cors.headers)` is the single exit for
**every** path — 400, 401, 403, 404, 405, 422, 500, 502 and success — so no branch can forget the
header and turn a readable error into an opaque network failure.

**P3 — `{action:"check_channel"}`** was added to `social-publish` in the same deploy: a READ-ONLY
`getChat` → `getMe` → `getChatMember` look at one configured channel, handled **before** the
`kill_switch` read (a check posts nothing, and the moment an operator needs it is while the switch is
still on). Super-admin only, re-checked inside the function through `current_user_role()` with the
caller's own token, so hiding the button in the CMS is not the only enforcement. No posting method
is reachable from it; the token appears only inside the request URL and every error description goes
through `redactError`; the one log line carries the chat id, its type and the bot's status — never a
title, never a message, never the token.

| function | version | `ezbr_sha256` (read-back) |
|---|---|---|
| `social-candidate` | **4** (was 3) | `dad3e333de0d70a0b39322a58144cda493ff48ab4cbddd3cccf4ddcc7b023852` |
| `social-publish` | **4** (was 3) | `84319072b20ef4a0c39e7801493a294f104b8a324ac6069bc847cddf92d6e046` |

`verify_jwt: true`, `import_map: false`, entrypoint `source/index.ts`, sibling `_shared/social.ts`
bundled — all confirmed on the read-back. Local sources uploaded:

| file | bytes | lines | sha256 |
|---|---:|---:|---|
| `supabase/functions/_shared/social.ts` | 16695 | 347 | `f86d863213aa65b77d01f21eb85061ee1a711f958707b723bdbf15d0b8b54b6d` |
| `supabase/functions/social-candidate/index.ts` | 12302 | 231 | `679fe2a1a7062ca3d3f0de9dd84f02836b7f81f7ba836faa305f440ba3ec2af2` |
| `supabase/functions/social-publish/index.ts` | 18261 | 316 | `2043085dcaa1f91924ea45aba29b6e1920fed8d14eca48f9a5497098669a0413` |

**The proof, after the deploy** (8 Nov 2026, 06:32 UTC):

```
OPTIONS social-candidate  → HTTP/1.1 200 OK
                            Access-Control-Allow-Origin: https://admincms1.indianexaminfo.com
                            Vary: Accept-Encoding, Origin
                            access-control-allow-headers: authorization, x-client-info, apikey, content-type
                            access-control-allow-methods: POST, OPTIONS

POST   social-publish {action:check_channel, channel_id:""}    → 400 {"ok":false,"reason":"Pick a channel to check."}
                            Access-Control-Allow-Origin: https://admincms1.indianexaminfo.com
POST   social-publish {action:check_channel, channel_id:…}     → 403 {"ok":false,"reason":"Only a super-admin can check a channel."}
                            Access-Control-Allow-Origin: https://admincms1.indianexaminfo.com
POST   social-publish  no Authorization                        → 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER",…}
                            Access-Control-Allow-Origin: *      ← the platform's own 401, always was readable
```

The 400 and the 403 are **our** code answering, and both carry the origin — that is the property that
was missing. The platform-level 401 comes from `verify_jwt` before the function runs and always carried
`*`, which is why it was never the cause.

**A note on the two 401 paths.** Our own `401 {"ok":false,"error":"unauthorized"}` is only reachable
when `SUPABASE_SERVICE_ROLE_KEY` is unset, so it cannot be probed while the secret is present; it is
covered by the unit tests for `jsonWith` plus the source-level guard in `corsWiring.test.ts`.

**Tests added** — `supabase/functions/_shared/social.test.ts` (8 CORS cases: allowed origin echoed,
absent origin passes without an allow header, foreign origin refused, `Vary: Origin`, OPTIONS → 200,
non-OPTIONS → null, foreign preflight → bare 403, `jsonWith` on 200/401/500 all carrying CORS),
`supabase/functions/corsWiring.test.ts` (14 source-level guards: the preflight precedes the bearer
check, the `json` alias exists, no module-level `json(`, no bare `new Response(JSON.stringify`, and the
P3 rules — check before `kill_switch`, no `send*`/`copyMessage` reachable from `checkChannel`,
`redactError` on every error string, the token only in the URL, the super-admin re-check),
`src/services/social/socialQueueService.test.ts` and `src/pages/social/SocialQueuePage.mount.test.tsx`.

**The safety levers were not touched:** `kill_switch = true`, `dry_run = true` throughout. Nothing was
posted, and `check_channel` cannot post by construction.

### 4b. Version 3 — 8 Nov 2026, owner batch 8 Phase H3 (the vacancy branch)

Both functions were redeployed as **version 3** with `verify_jwt = true`, `import_map: false`,
and the sibling `_shared/social.ts` bundled. The change is the **vacancy branch**: a vacancy
that is `workflow_status = 'published'` **and** carries a `verified_at` now creates a
Telegram **draft** candidate with `source_type = 'sarkari_naukri'` (the schema already
allowed it — `social_posts.source_type` is free text with no CHECK).

| function | `ezbr_sha256` (read-back) |
|---|---|
| `social-candidate` | `9180c6962d3362bc406f1211d97633e6f6648215c9864269a2590a50e133b8cf` |
| `social-publish` | `5c6e6a77dfa95f758a6dcd1a650a6d21f1b1bd555b07c0bd7488a514c142be1e` |

Local sources that were uploaded (byte-identical to the read-back):

| file | bytes | sha256 |
|---|---:|---|
| `supabase/functions/_shared/social.ts` | 12600 | `e3e72b3500d5e9cb8e535861450c3d22a336a36536139ee10d11e7fdddfe8733` |
| `supabase/functions/social-candidate/index.ts` | 11104 | `788be7e769f33bc634e3fdeb77f2402614933ebe109337cf9fc04e9e6451292b` |
| `supabase/functions/social-publish/index.ts` | 9238 | `8b082392185ece408ab60b08a7fadef961309afcc9ca164f47cb7aa09aa043ee` |

The 401 probes were re-run against version 3 — **8 of 8 returned 401**, with the expected
bodies:

```
social-candidate   POST  auth=none  → 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}
social-candidate   GET   auth=none  → 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER",...}
social-candidate   POST  bogus JWT  → 401 {"code":"UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM","message":"Unsupported JWT algorithm none"}
social-publish     POST  auth=none  → 401 UNAUTHORIZED_NO_AUTH_HEADER
social-publish     GET   auth=none  → 401 UNAUTHORIZED_NO_AUTH_HEADER
social-publish     POST  bogus JWT  → 401 UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM
```

**The safety levers were not touched.** After the deploy, read-only:
`kill_switch = true`, `dry_run = true`, `telegram_daily_cap = 20`, `social_posts` = 0 rows,
`verified vacancies` = 0 of 361. Nothing can post, and nothing was posted.

**The vacancy caption** is built from structured fields only — title, organisation, state
label, the last date, the post count when it is known, and the reader URL resolved through
the same `/go/{slug}` resolver the exam branch uses. A **missing last date is omitted, never
invented**. No free text from the notice ever reaches a caption.

**The zz-test guard is now in three layers** for vacancies as well as exams: the client
hook skips it, `social-candidate` refuses it (422), and `social-publish` re-checks it
before sending (the shared `testContentRefusal` helper).

**The idempotency key** is `channel|source_type|source_id|event` — so a vacancy that is
verified and published twice produces **one** candidate row, not two.

### 4c. Version 2 — 29 Oct 2026 (the original deploy)

Both deployed with `verify_jwt = true`; each returns **401** to an unauthenticated `POST` and
`GET` and to a bogus bearer token. Probed from outside on 29 Oct, verbatim:

```
social-candidate   POST  auth=none  → 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}
social-candidate   GET   auth=none  → 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER",...}
social-candidate   POST  bogus JWT  → 401 {"code":"UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM","message":"Unsupported JWT algorithm none"}
social-publish     POST/GET/bogus    → same three shapes
```

`import_map: false`, `version: 3` (2 on 29 Oct), `ezbr_sha256` recorded in the commit message for each.
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

End: SCHEMA APPLIED (20261028171123) · BOTH FUNCTIONS DEPLOYED **v4** on 8 Nov 2026 (verify_jwt
true; v3 added the sarkari_naukri vacancy branch, v4 adds the allow-list CORS on every response
path and P3 `check_channel` — see §4a for the version/`ezbr_sha256` read-back and the
after-fix `OPTIONS` probe, which now returns the same headers as `ai-fill`) · CMS FLAG ON and
LIVE on the host (build stamp `1657a20` confirmed 8 Nov — push to main, the host builds it,
confirm the admin build stamp) ·
`kill_switch` and `dry_run` are ON, so nothing can post until you change those deliberately.
Channel management exists in the UI (super-admin only) — §6 step 3.
