# Bulletin — Layer 1 and the CMS home

Status: build steps 1–3 are written as **PROPOSED** files
(`supabase/proposed/page_traffic.sql`, `content_has_data_fn.sql`,
`bulletin_rules_and_signals.sql`) and each was **compiled and run inside a
rolled-back transaction** against live project `cwbhhcqsrbuoybeaondk` (run
2026-09-28) to prove it works and return the counts below. **Nothing applied,
nothing promoted** — owner reviews before any promotion. `content_has_data()`
is pinned by a CI parity test (`src/lib/contentHasData.parity.test.ts`,
PGlite): the same fixtures give identical booleans in SQL and TS.

**Layer 1 rule (from the 26 Sep living doc):** the bulletin fires on **database
signals only** — no AI, no editorial guesswork. It is the editor's daily work
queue: the pages whose *moment has just arrived*. Without a recency window it
would fire on nearly every record, so the window is load-bearing. Older gaps go
to a separate **backlog** view, not the daily queue.

## a. Signals

Two date sources, because vacancy content lives in two tables (see
`vacancy-tables.md`). A signal is a **triple `(event, offset window, target)`**
— NOT the event date alone: an event lights up a target over a *window* around
its date, and the window differs per event (see the offsets table in a.3).

### a.1 `exam_editions.important_dates` (typed jsonb array)

Each element is `{date, type, label, state, isUrgent, verified, stage_label}`.
Distinct `type` values in live data with their event counts, and the page /
content type that must hold data **once that date passes**:

| Event type | Events | Date passes → this must have content |
|---|---|---|
| `exam_written` | 246 | exam-info / admit-card issued; `answer-key` after |
| `result` | 44 | `result` section — declarationDate + checkLink (`result_url`) |
| `application_end` | 43 | `application-process` shows closing; eligibility/fee frozen |
| `notification` | 41 | `overview`/notification — official notice excerpt + link |
| `application_start` | 40 | `application-process` live with apply link |
| `counselling` | 17 | `seat-allotment` / counselling rounds |
| `exam_physical` | 12 | exam-info; skill-test schedule |
| `admit_card` | 11 | `admit-card` — releaseDate + download link |
| `walkin` | 6 | vacancy one-pager marked walk-in/closed |
| `answer_key` | 5 | `answer-key` — releaseDate + link |
| `interview` | 2 | `interview-schedule` — callLetterUrl/rounds |
| `exam_practical` | 2 | exam-info practical schedule |
| `merit_list` | 2 | `merit-list` — meritListUrl |
| `application_correction` | 1 | `application-process` correction window |
| `exam_city_intimation` | 1 | exam-city / admit-card intimations |
| *(blank type)* | 5 | untyped — flag for editor, never auto-route |

### a.2 `sarkari_naukri` date columns

Live state today: **only `result_date` is populated (361/361);
`notification_date`, `application_start_date`, `application_end_date`,
`exam_date`, `admit_card_date`, `merit_list_date`, `answer_key_date`,
`interview_date`, `document_verification_date`, `walk_in_date` are all NULL.**
So the 361 seeded vacancies carry **no bulletin-fireable dates yet** — the only
populated date column is `result_date`, and since the Q2 rule (owner, 28 Sep)
`sarkari_naukri` rows enter `bulletin_signals` **only when `verified_at IS NOT
NULL`**, all 361 contribute nothing until they are verified. Unverified vacancies
surface **only in the Verification queue** — the bulletin never promotes scraped,
unconfirmed dates to editor work. The other date columns are dormant until editors
backfill them. Each column, when set, maps to the paired URL/content field:

| Date column | Passing implies this field should exist |
|---|---|
| `notification_date` | `official_notification_url` |
| `application_start_date` | `application_url` |
| `application_end_date` | (closes applications; required to Verify — M3) |
| `admit_card_date` | `admit_card_url` |
| `exam_date` | exam-mode/details complete |
| `answer_key_date` | `answer_key_url` |
| `result_date` | `result_url` (and `verified_at` for the button to render) |
| `merit_list_date` | `merit_list_url` |
| `interview_date` | interview schedule in `description`/`alternate_links` |
| `document_verification_date` | document-verification details |
| `walk_in_date` | `walk_in_venue` + closed marker |

Each signal resolves to exactly one **target** section/field. The recency
window is **offsets applied to the event date**, held as tunable rows in
`bulletin_rules` (§d) — never a hard-coded CASE — so editors can retune without
a deploy.

### a.3 Offsets (`bulletin_rules`)

A signal is active while `today ∈ [event_date + offset_from_days, event_date +
offset_to_days]`. `arrived` = active **and** `today ≥ event_date`; `upcoming` =
active **and** `today < event_date`. Base self-date events use `[-7, +3]`, which
reproduces the prior "arrived = last 3 days / upcoming = next 7 days" behaviour
exactly. The exam events each fan out to **two** targets:

| event_type | target_section | offset_from_days | offset_to_days | meaning |
|---|---|---|---|---|
| notification | overview | -7 | 3 | as now |
| application_start | application-process | -7 | 3 | as now |
| application_end | application-process | -7 | 3 | as now |
| admit_card | admit-card | -7 | 3 | as now |
| answer_key | answer-key | -7 | 3 | as now |
| result | result | -7 | 3 | as now |
| merit_list | merit-list | -7 | 3 | as now |
| counselling | seat-allotment | -7 | 3 | as now |
| interview | interview-schedule | -7 | 3 | as now |
| **exam_written / exam_physical / exam_practical** | **admit-card** | **-10** | **0** | lead-up: admit card must exist by exam day |
| **exam_written / exam_physical / exam_practical** | **answer-key** | **+1** | **+10** | follow-up: answer key expected after the exam |

(These are the seed rows inserted into `bulletin_rules`; editors tune them with
plain UPDATEs, gated by `edit_any_post` — §d.)

## b. The existence rule — one implementation

The rule that "a page has content" is `hasData(exam, slug)` /
`contentTypeHasData(exam, contentType)` in the frontend
`lib/sectionRegistry.ts`. It reads a `HasDataView`: typed columns
(`vacancy`, `eligibility`, `applicationFee`, `selectionProcess`, `dates`,
`academicInfo`, `faqs`), the jsonb `contentModules` store (per-section shape,
including the `_config.enabledModules` opt-out), and `hasStructuredSyllabus`
which needs a DB read (`exam_syllabus_subjects` ≥1 row). The bulletin **must ask
this same rule, not a copy**, or the queue and the site will disagree about what
counts as "done".

Where one implementation can live:

| Option | How both use it | Trade-offs |
|---|---|---|
| **SQL function** `content_has_data(exam_id, section_slug) → bool` | CMS bulletin scans it in bulk (SQL join over hundreds of editions); frontend keeps its TS evaluator for a single already-loaded exam and a **shared parity test** asserts they match | Only form that scales to the queue (set-based, indexable). Must re-encode the jsonb module shapes + the `enabledModules` opt-out + the syllabus-subjects read in SQL — that re-encoding is the drift risk the parity test guards. |
| **Shared package** (publish `sectionRegistry.ts`) | Both repos `import`; zero logic duplication, TS types preserved | Cannot run inside SQL, so the queue would have to load every candidate into app memory and call the fn per row — impractical for the daily scan across all pillars. Needs a build/publish pipeline both repos pin. |
| **Generated DB columns** (`has_result`, `has_admit_card`, … maintained by trigger) | Bulletin filters columns directly; frontend can still use TS for single view | Fastest bulk reads, but a trigger must re-implement the same rule on every `content_modules`/syllabus write and be backfilled + maintained on each rule change — highest drift surface, most code to keep honest. |

**Recommendation:** make the **SQL function** the canonical bulk evaluator the
bulletin uses, keep the frontend's `contentTypeHasData` as the single-exam
view, and bind them with one **parity test** (same fixtures in, same booleans
out) so "one fact, one place" holds under test rather than hope. The generated-
column variant is the fallback only if the function proves slow at queue scale.

**How the binding works today (Q1c, built 28 Sep):** the **site's rule is the
truth**. `contract/content-has-data.fixtures.json` (52 cases) is vendored
byte-identical in both repos; `content-has-data.expected.json` is GENERATED
from the frontend implementation (REGEN mode of
`indianexaminfo-frontend/lib/contract/contentHasData.contract.test.ts`) and
vendored the same way. The frontend test asserts frontend TS == expected; the
CMS test (`src/lib/contentHasData.parity.test.ts`) runs the SQL mirror under
PGlite and asserts SQL == CMS TS == expected. sha256 of both contract files is
embedded in BOTH repos' test files (and `contract/*.json` is pinned to `eol=lf`
via .gitattributes), so any drift — or a silent re-bake — fails CI in both
repos until deliberately re-locked. The always-false `faqs` quirk is pinned as
expected-false on purpose (faithful mirror; fixing it is a site-side decision).

## c. Buckets (offsets applied) — recomputed live

The recency column is named **`bucket`**, not `window` (`window` is a reserved
word). A signal's active span is `[event_date + offset_from_days, event_date +
offset_to_days]` from `bulletin_rules` (a.3):

- **arrived** — active **and** `today ≥ event_date`
- **upcoming** — active **and** `today < event_date`
- **backlog** — `today > event_date + offset_to_days` (past the window)
- **future** — `today < event_date + offset_from_days` (before the window)

Recomputed live from the rolled-back run **after the Q2 verified-only change**
(both date sources, offsets applied, project `cwbhhcqsrbuoybeaondk`,
2026-09-28). "open" = `bucket ∈ (arrived, upcoming)` AND `NOT has_content`:

- **Post-change (real state, 0 of 361 vacancies verified): Arrived 7 (7 open) ·
  Upcoming 10 (9 open) · Backlog 595 (548 without content) · Future 113 (100
  without content)** — all from `exam_editions`; `sarkari_naukri` contributes 0.
- **Post-change + post-M4 (M4 simulated inside the rolled-back txn): identical**
  — with the bulletin empty of unverified rows, nulling 87 broken `result_url`s
  changes nothing **today**. The M4 target set re-resolved to exactly **87 rows
  (74 dead-host + 13 confirmed-404)** and the UPDATE ran clean with the verify
  trigger ENABLED — a faithful dry-run of the pending migration.
- **After M4 + M5 (all 361 verified) — hypothetical, measured in the same txn
  (trigger disabled inside the rolled-back txn): Arrived 17 (9 open) · Upcoming
  25 (11 open) · Backlog 800 (594 without content) · Future 244 (137 without
  content).** The extra open work is precisely M4's footprint: the 87 nulled
  `result_url`s flip `has_content` false — 2 arrived / 2 upcoming / 46 backlog /
  37 future — so verifying rows after M4 creates **real gaps to fill with live
  links** instead of shipping broken buttons.

Before the Q2 change the same run reported Arrived 14 (5 open) · Upcoming 21
(11 open) · Backlog 800 (548) · Future 251 (100) — including the 361 unverified
result signals the owner ruled out of the board. (Exam-branch splits drift with
live edits; per-pillar cuts are `GROUP BY pillar` on the same query rather than
numbers frozen in this doc.)

Read: with the verified-only rule the **daily queue is pure exam-edition work —
7 open arrived, 9 open upcoming today**. Layer 1 surfaces what is live *now*;
the ~548 older open gaps sit behind the backlog link rather than the editor's
first screen, and no scraped, unverified vacancy can pollute either.

## d. Data model

Three pieces: the tunable `bulletin_rules` offset table (seeded rows, no CASE),
a computed `bulletin_signals` view (no stored rows to drift), and a tiny
editor-state table (the only mutable state). `supabase/proposed/bulletin_rules_and_signals.sql`
is the source of truth; the shape is:

```sql
-- 1) bulletin_rules — the editor-tunable OFFSETS table (§a.3), NOT a hard CASE.
--    Rows, so editors retune windows with plain UPDATEs (gated by edit_any_post).
create table public.bulletin_rules (
  event_type       text    not null,
  target_section   text    not null,
  offset_from_days integer not null default -7,
  offset_to_days   integer not null default 3,
  primary key (event_type, target_section)
);
-- seeded: base events [-7,+3] (reproduces arrived=last-3d / upcoming=next-7d),
-- and exam_written|physical|practical → admit-card [-10,0] + answer-key [+1,+10].

-- 2) bulletin_signals — one row per (entity, event, target) with its bucket and
--    whether the target already has content. WITH (security_invoker = true): the
--    view reads the base tables under the QUERYING user's privileges + RLS, not
--    the owner's. Two date sources UNION'd:
--      • exam_editions.important_dates → registry section, content via the
--        canonical content_has_data(<HasDataView jsonb>, target) (§b) — the SAME
--        rule the site uses, evaluated in SQL.
--      • sarkari_naukri date columns → paired url/field (§a.2), so vacancy
--        signals light up as editors enter dates (only result_date set today).
create view public.bulletin_signals
with (security_invoker = true) as
select
  raw.source_table, raw.exam_id, raw.edition_id, raw.naukri_id, raw.slug, raw.title,
  raw.pillar, raw.region, raw.event_type, raw.target_section, raw.event_date,
  raw.has_content,
  case   -- column is "bucket", NOT "window" (window is a reserved word)
    when current_date between raw.event_date + raw.offset_from_days
                          and raw.event_date + raw.offset_to_days
         and current_date >= raw.event_date then 'arrived'
    when current_date between raw.event_date + raw.offset_from_days
                          and raw.event_date + raw.offset_to_days
         and current_date <  raw.event_date then 'upcoming'
    when current_date >  raw.event_date + raw.offset_to_days then 'backlog'
    else 'future'
  end as bucket,
  (raw.source_table || ':' || coalesce(raw.edition_id::text, raw.naukri_id::text)
     || ':' || raw.event_type || ':' || raw.event_date::text || ':' || raw.target_section
  ) as signal_key
from ( /* exam_editions ⋈ exams ⋈ bulletin_rules  UNION ALL  sarkari_naukri
         WHERE sn.verified_at IS NOT NULL   -- Q2: verified rows only */ ) raw;
-- A signal is OPEN work when: bucket in ('arrived','upcoming') AND NOT has_content.
-- It AUTO-RESOLVES the instant has_content flips true — no state to clear.
```

```sql
-- Editor state only. Content lives elsewhere; this is who is on it.
create table public.bulletin_editor_state (
  signal_key   text primary key,   -- bulletin_signals.signal_key, 5-part (see §c view)
  assignee     uuid references auth.users(id),
  status       text not null default 'open'
               check (status in ('open','snoozed','done-by-hand')),
  snooze_until date,
  note         text,
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now()
);
```

A signal shows in a queue when its bucket is `arrived`/`upcoming`, `has_content`
is false, and it is not currently snoozed
(`status<>'snoozed' or snooze_until < current_date`). `done-by-hand` suppresses
it even if `has_content` is still false (editor judged it not needed).
**Auto-resolution is by `has_content`, not by editor action** — the moment the
page gains content the signal leaves the queue on its own.

**RLS (permission-based — never the JWT role claim, never role names):**

```sql
alter table public.bulletin_editor_state enable row level security;
-- read: any editor (holder of edit_own_post OR edit_any_post)
create policy editor_state_read on public.bulletin_editor_state
  for select to authenticated using (
    current_user_has_permission('edit_own_post')
    or current_user_has_permission('edit_any_post'));
-- write (assign / snooze / note / done-by-hand): edit_any_post ONLY
create policy editor_state_insert on public.bulletin_editor_state
  for insert to authenticated with check (current_user_has_permission('edit_any_post'));
create policy editor_state_update on public.bulletin_editor_state
  for update to authenticated
  using (current_user_has_permission('edit_any_post'))
  with check (current_user_has_permission('edit_any_post'));
-- NO delete policy -> deletes are denied to every API role (deny-all).
-- editor_state carries NO content and grants NO publish right; the only publish
-- path stays the gated verify/publish trigger from M3 (publish_post).
```

`bulletin_rules` uses the same shape: read for `edit_own_post`/`edit_any_post`,
insert/update/delete for `edit_any_post` (senior editors tune the offsets).

**Written and verified (Q4).** The proposal now exists as
`supabase/proposed/bulletin_editor_state.sql` (proposed only — NOT in
`migrations/`, so the CLI never runs it). It adds two things beyond the sketch
above: a `check (status <> 'snoozed' or snooze_until is not null)` guard and a
`before update` trigger that owns `updated_at`. Verified by compiling the whole
file inside a rolled-back transaction on the live DB (2026-09-28), then probing
it as the `authenticated` role with no permissions granted:

| check | result |
| --- | --- |
| table + RLS enabled, exactly 3 policies (`SELECT`/`INSERT`/`UPDATE`) | ✅ |
| **no `DELETE` policy exists**; a DELETE as `authenticated` removes **0 rows**; seeded rows survive every attempted write | ✅ |
| read policy = `edit_own_post` OR `edit_any_post`; insert/update = `edit_any_post` only (no `edit_own_post` path) | ✅ |
| all policies `to authenticated`; every clause uses `current_user_has_permission()` — no `auth.jwt`/`auth.role`/claim sniffing | ✅ |
| `status='resolved'` rejected by CHECK; `snoozed` with NULL `snooze_until` rejected by CHECK | ✅ |
| trigger rewrites a forced `updated_at='2020-01-01'` back to now() | ✅ |
| as `authenticated` without permissions: SELECT sees 0 rows, UPDATE touches 0 rows, INSERT raises 42501 | ✅ |

Nothing was left applied: a follow-up query confirms 0 tables / 0 policies /
0 functions for `bulletin_editor_state` in the live database.

## e. Priority — `page_traffic`

Queues sort by what readers actually open, so a traffic table keyed by URL:

```sql
create table public.page_traffic (
  url          text not null,
  clicks       integer not null default 0,
  impressions  integer not null default 0,
  period_start date not null,
  period_end   date not null,
  source       text not null default 'search-console',
  loaded_at    timestamptz not null default now(),
  primary key (url, period_start, period_end)
);

-- RLS — permission-based, never the JWT role claim / role names:
--   read  = any editor (edit_own_post OR edit_any_post)
--   write = manage_settings ONLY (the CMS "Import GSC CSV" upload runs as a USER,
--           not the service role, so the writer must hold a real permission)
--   delete = NO policy (deny-all; traffic is only ever upserted)
alter table public.page_traffic enable row level security;
create policy page_traffic_read on public.page_traffic
  for select to authenticated using (
    current_user_has_permission('edit_own_post')
    or current_user_has_permission('edit_any_post'));
create policy page_traffic_insert on public.page_traffic
  for insert to authenticated with check (current_user_has_permission('manage_settings'));
create policy page_traffic_update on public.page_traffic
  for update to authenticated
  using (current_user_has_permission('manage_settings'))
  with check (current_user_has_permission('manage_settings'));
```

Signals join to it on their canonical URL (`/sarkari-naukri/{slug}` or
`/{pillar}/{category}/{slug}`) for the **latest period**, so "Coming up" ranks
the admit-card date on a 186-click page above one on a 0-click page.

Refresh (monthly, owner action, no cron secret needed): the owner exports the
Search Console pages CSV (the same file already in the repo,
`docs/seo/gsc-pages-YYYY-MM-DD.csv`) and runs a loader that upserts those rows
into `page_traffic` with the export's period. Because proposed migrations never
auto-apply (AGENTS.md), the load is a data step, not a migration — a small CMS
"Import GSC CSV" upload or a `supabase/proposed/`-adjacent one-off script the
owner runs. Stale traffic is acceptable: it only orders the queue, never gates
it.

## f. CMS home — the bulletin replaces the dashboard

`src/pages/dashboard/DashboardPage.tsx` stops being the landing screen; the
bulletin becomes the first thing an editor sees.

**Navigation structure**

```
IndianExamInfo CMS
├─ Bulletin            (home; default route)
│    ├─ Just arrived        (open work)  [7]
│    ├─ Coming up           (open work)  [9]
│    ├─ Verification queue  (unverified vacancies, by traffic)   [361 ▲]
│    └─ Backlog             (older gaps) [548 →]
├─ Vacancies        → sarkari_naukri list/editor
├─ Exams            → exam manager (all pillars)
├─ Content          → posts / news
├─ Media  · Taxonomy · Navigation · Users · Settings · Audit
```

**Home wireframe**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Bulletin                                   Mon 28 Sep 2026      [Faraz ▾] │
├──────────────────────────────────────────────────────────────────────────┤
│ JUST ARRIVED  (open work now)                                  7 items     │
│  ─────────────────────────────────────────────────────────────────────── │
│  Exam date 26 Sep · Chhattisgarh govt-vacancy   admit-card    ○ empty  ▸  │
│                                                                            │
│ COMING UP  (open work next)                                    9 items     │
│  ─────────────────────────────────────────────────────────────────────── │
│  04 Oct  Result declared   SSC CGL 2026            result     ● live   ▸  │
│  02 Oct  App closes        UP Police Constable     applic…    ● live   ▸  │
│  01 Oct  Admit card out    IBPS PO Prelims         admit-card  ○ empty  ▸  │
│   …                                                            (by traffic)│
│                                                                            │
│ VERIFICATION QUEUE  (unverified vacancies, by traffic)     361  ▲ top-5    │
│  ─────────────────────────────────────────────────────────────────────── │
│  up-swasthya-vibhag-ambulance-driver   186 clicks   end-date? no  [open] │
│  bihar-mgnrega-rozgar-sewak              72 clicks   end-date? no  [open] │
│   …  (none verifiable yet: application_end_date is empty — fill to Verify)│
│                                                                            │
│ BACKLOG  (older gaps)                                         548   → all  │
└──────────────────────────────────────────────────────────────────────────┘
```

**List-page pattern** (every queue and the vacancy/exam lists): a stack of
bordered **rows** separated by a single hairline — never cards, never tiles.
Each row, left to right: the **date** (or age), the entity name, the target
section, a **completeness signal** (`● live` when `has_content`, `○ empty`
when not), a traffic number where relevant, and a chevron. Rows are **sortable**
by date and by traffic, and the bucket/pillar/region are filters above the list.

```
Vacancies                                          filter: ▾pillar ▾region ▾bucket
──────────────────────────────────────────────────────────────────────────────
Date        Entity                         Section        State     Traffic   ▸
──────────────────────────────────────────────────────────────────────────────
26 Sep      Chhattisgarh vacancy 2026      admit-card     ○ empty        —    ▸
04 Oct      SSC CGL 2026                   result         ● live       1.2k   ▸
02 Oct      UP Police Constable            application    ● live       900    ▸
01 Oct      IBPS PO Prelims                admit-card     ○ empty      640    ▸
──────────────────────────────────────────────────────────────────────────────
   (one hairline between rows; sortable headers; no icons, no emoji)
```

**Editor top block** (the first thing in a vacancy/exam editor — the moment
that made this row appear, and what is still missing):

```
┌──────────────────────────────────────────────────────────────────────────┐
│ UP Police Constable Recruitment 2026                     [Edit] [Verify ▸] │
│ govt-vacancy · uttar-pradesh · signal: application closes 02 Oct (in 4d)   │
├──────────────────────────────────────────────────────────────────────────┤
│ Completeness   ● application  ● eligibility  ● fees  ○ admit-card ○ result │
│ Blocking Verify: application_end_date is set ✓ · official_notification_url│
│                  missing ✗  → add the notification link to enable Verify   │
│ Traffic: 900 clicks / 28d                                    [open history]│
└──────────────────────────────────────────────────────────────────────────┘
```

**Visual rules (binding):**
- No decorative icons, no emoji anywhere in the UI. Status is a word + a shape.
- Rows, not cards/tiles; one hairline (`1px` border) between rows, none around.
- **One status-chip hierarchy** used identically on home, lists and editors:
  `● live` (has content) · `○ empty` (signal open, no content) ·
  `◐ snoozed` · `✓ done-by-hand` · `▲ attention` (verification blocked).
  Nothing else may use a chip; pillar/region are plain text.
- Sort is by date or traffic; never by insertion order.

## g. Build plan — each step ships alone

Named as **PROPOSED** files under `supabase/proposed/` (per AGENTS.md; never
auto-applied). The owner promotes to `supabase/migrations/` only after approval,
because a push applies the whole `migrations/` directory. **Promotion rule (h):
the `migrations/` version prefix is the UTC time of the promotion, assigned the
moment the file is moved — never a placeholder or a future date.** So the
proposed files carry descriptive names, not fake timestamps.

**Steps 1–4 are written and verified** — each compiled and run inside a
rolled-back transaction against live `cwbhhcqsrbuoybeaondk` (counts in §c,
editor-state probes in §d). **Step 1 has since been PROMOTED (Q3)** —
`supabase/migrations/20260928042556_page_traffic.sql`, the version being the UTC
minute of the move — so the owner's next push applies it. Steps 2–4 are still
proposals only: nothing else applied.

1. **Traffic substrate.** `supabase/migrations/20260928042556_page_traffic.sql`
   (promoted from `proposed/page_traffic.sql` in Q3) — the `page_traffic` table +
   **permission-based RLS** (read = `edit_own_post`/
   `edit_any_post`; write = `manage_settings` only, since the CMS "Import GSC
   CSV" upload runs as a *user*, not the service role; **no delete policy**).
   Ships a table with no behaviour change; enables the CSV loader.
   Frontend-independent. ✅ built + verified + **PROMOTED**; the loader ships as
   Settings → SEO → "Import Search Console pages CSV" (`GscTrafficImportCard`,
   `src/lib/gscCsv.ts`, `pageTrafficService.importPageTraffic`).
2. **Canonical existence rule.** `supabase/proposed/content_has_data_fn.sql` —
   the SQL `content_has_data(view jsonb, section text)` function: a **pure jsonb**
   mirror of `sectionRegistry` (the same `HasDataView` the TS uses), so ONE
   evaluator serves both the bulk queue and the single-page site. Acceptance: the
   **parity test** (`src/lib/contentHasData.parity.test.ts`, PGlite in CI) —
   fixtures → identical booleans in SQL and TS. ✅ built, 68 parity assertions
   pass in CI.
3. **Offsets + signal view.** `supabase/proposed/bulletin_rules_and_signals.sql`
   — the `bulletin_rules` offset table (§a.3) and the `bulletin_signals` view:
   **bucket** (not `window`), `WITH (security_invoker = true)`, both date sources
   UNION'd (exam editions + sarkari_naukri), `has_content` via step 2. Read-only;
   a CMS query against it is the first live use. ✅ built + verified (§c counts).
4. **Editor state + RLS.** `supabase/proposed/bulletin_editor_state.sql` —
   `bulletin_editor_state` table + permission-based policies (§d): read =
   `edit_own_post`/`edit_any_post`; write (insert/update) = `edit_any_post`;
   **no delete**. ✅ written + compiled/probed in a rolled-back transaction
   (§d). Independent.
5. **Bulletin home.** CMS: replace the default route with the bulletin
   (Just arrived / Coming up / Verification queue / Backlog) reading
   `bulletin_signals ⋈ page_traffic`, wired to `bulletin_editor_state`. The
   dashboard stays reachable at `/dashboard`. Ships the queue with no public
   surface change. Not yet built.
6. **Shared row-list component.** CMS: the bordered **row** list (§f list-page
   pattern) as ONE component reused by bulletin / vacancies / exams. (The
   sarkari_naukri editor **already** has the typed date fields of §a.2, so the
   earlier "add the date fields" item was stale and is removed — there is no
   backfill step here.) Frontend untouched.
7. **Traffic refresh path.** CMS "Import GSC CSV" upload (owner-driven, monthly)
   upserting `page_traffic`; reuses the existing export format so no new schema.
   ✅ built in Q3 (parser unit-tested against the real export
   `docs/seo/gsc-pages-2026-09-27.csv`: 315 rows, 0 skipped).
8. **Optional column cache.** Only if step 3's bulk read is slow at scale:
   generated `has_result`/`has_admit_card`/… columns maintained from step 2's
   function so the queue scans an index instead of a jsonb eval. Kept as a
   proposal, justified by a measured number, not assumed.

Steps 1–3 are pure data-layer and land in any order after 1; 5 is the first
user-visible screen; 6–8 refine. No step changes a public URL, so the
`vacancy-tables.md` one-hop constraint is never threatened.
