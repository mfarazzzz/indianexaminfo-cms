# Bulletin — Layer 1 and the CMS home

Status: design only, nothing built. Live numbers from project
`cwbhhcqsrbuoybeaondk`, run 2026-09-28. Owner reviews before anything is coded.

**Layer 1 rule (from the 26 Sep living doc):** the bulletin fires on **database
signals only** — no AI, no editorial guesswork. It is the editor's daily work
queue: the pages whose *moment has just arrived*. Without a recency window it
would fire on nearly every record, so the window is load-bearing. Older gaps go
to a separate **backlog** view, not the daily queue.

## a. Signals

Two date sources, because vacancy content lives in two tables (see
`vacancy-tables.md`).

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
So the 361 seeded vacancies carry **no typed dates the bulletin can fire on yet**
— the recency signal for that table is dormant until editors backfill the date
columns. Each column, when set, maps to the paired URL/content field:

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

A signal is therefore `(entity, event_type, event_date)` from either source,
keyed to exactly one **target** section/field.

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

## c. Windows

Definitions (defaults, editor-tunable): **Just arrived** = date passed in the
last N=3 days (`date ∈ [today-3, today]`); **Coming up** = date in the next M=7
days (`date ∈ (today, today+7]`); **Backlog** = older than N days. A fourth
bucket, **Future** (beyond +7), is out of every queue.

Live counts today across the 478 dated `important_dates` events
(`exam_editions ⋈ exams`):

- Just arrived (3d): **1** — a govt-vacancy `exam_written` in Chhattisgarh.
- Coming up (7d): **8** — 6 exam_written, 1 result, 1 application_end.
- Backlog (older): **405**.
- Future (beyond 7d): 64.

Per pillar (arrived / upcoming / backlog / future):

| Pillar | Arrived 3d | Upcoming 7d | Backlog | Future | Total |
|---|---|---|---|---|---|
| government-exam | 0 | 3 | 119 | 26 | 148 |
| entrance-exam | 0 | 1 | 114 | 9 | 124 |
| govt-vacancy | 1 | 3 | 82 | 25 | 111 |
| board-exam | 0 | 1 | 63 | 2 | 66 |
| university-exam | 0 | 0 | 27 | 2 | 29 |

Per region (nonzero arrived/upcoming shown; `all-india` is the national pool):

| Region | Arrived 3d | Upcoming 7d | Backlog |
|---|---|---|---|
| chhattisgarh | 1 | 0 | 7 |
| all-india | 0 | 5 | 219 |
| uttar-pradesh | 0 | 2 | 28 |
| tamil-nadu | 0 | 1 | 8 |
| *(all other states)* | 0 | 0 | 135 (sum of ≤19 each) |

Read: with a 3-day window the **daily queue is genuinely short (1 arrived, 8
coming up)**, which is the point — layer 1 surfaces what is live *now*, and the
405 older gaps sit behind the backlog link rather than the editor's first
screen.

## d. Data model

Two pieces: a computed signal (no stored rows to drift) and a tiny editor-state
table (the only mutable state).

```sql
-- Computed view: one row per (entity, event) with window + whether content exists yet
create view public.bulletin_signals as
select
  e.id            as edition_id,
  ex.id           as exam_id,
  ex.slug         as exam_slug,
  ex.pillar::text as pillar,
  ex.region::text as region,
  lower(d->>'type')          as event_type,
  (d->>'date')::date         as event_date,
  case
    when (d->>'date')::date between current_date - 3 and current_date then 'arrived'
    when (d->>'date')::date >  current_date
     and (d->>'date')::date <= current_date + 7                        then 'upcoming'
    else 'backlog'
  end                        as window,
  s.section_slug             as target_section,          -- event_type -> section map
  content_has_data(ex.id, s.section_slug) as has_content  -- §b canonical rule
from exam_editions e
join exams ex on ex.id = e.exam_id
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(e.important_dates)='array'
       then e.important_dates else '[]'::jsonb end) as d
join lateral (select case lower(d->>'type')     -- event_type -> target section
     when 'admit_card' then 'admit-card' when 'result' then 'result'
     when 'answer_key' then 'answer-key' when 'merit_list' then 'merit-list'
     when 'notification' then 'overview'
     when 'application_start' then 'application-process'
     when 'application_end'    then 'application-process'
     when 'interview' then 'interview-schedule'
     when 'counselling' then 'seat-allotment'
     else null end as section_slug) s on true
where (d->>'date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
  and s.section_slug is not null;
-- A signal is OPEN work when: window in ('arrived','upcoming') AND NOT has_content.
-- It AUTO-RESOLVES the instant has_content flips true — no state to clear.
```

```sql
-- Editor state only. Content lives elsewhere; this is who is on it.
create table public.bulletin_editor_state (
  signal_key   text primary key,   -- edition_id || ':' || event_type || ':' || event_date
  assignee     uuid references auth.users(id),
  status       text not null default 'open'
               check (status in ('open','snoozed','done-by-hand')),
  snooze_until date,
  note         text,
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now()
);
```

A signal shows in a queue when its window is `arrived`/`upcoming`, `has_content`
is false, and it is not currently snoozed
(`status<>'snoozed' or snooze_until < current_date`). `done-by-hand` suppresses
it even if `has_content` is still false (editor judged it not needed).
**Auto-resolution is by `has_content`, not by editor action** — the moment the
page gains content the signal leaves the queue on its own.

**RLS (the intern acts; publishing stays gated):**

```sql
alter table public.bulletin_editor_state enable row level security;
-- any authenticated editor reads the board
create policy bulletin_read on public.bulletin_editor_state
  for select to authenticated using (true);
-- an intern/editor may insert+update state (assign, snooze, note, mark done-by-hand)
create policy bulletin_write_state on public.bulletin_editor_state
  for all to authenticated
  using (true) with check (auth.jwt() ->> 'role' in ('intern','editor','admin'));
-- editor_state carries NO content and grants NO publish right;
-- the only publish path stays the gated verify/publish trigger from M3
-- (publish_post permission). The bulletin moves work, never ships it.
```

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
│    ├─ Just arrived        (3d)         [1]
│    ├─ Coming up           (7d)         [8]
│    ├─ Verification queue  (unverified vacancies, by traffic)   [361 ▲]
│    └─ Backlog             (older gaps) [405 →]
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
│ JUST ARRIVED  (last 3 days)                                     1 item     │
│  ─────────────────────────────────────────────────────────────────────── │
│  Exam date 26 Sep · Chhattisgarh govt-vacancy   admit-card    ○ empty  ▸  │
│                                                                            │
│ COMING UP  (next 7 days)                                       8 items     │
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
│ BACKLOG  (older gaps)                                         405   → all  │
└──────────────────────────────────────────────────────────────────────────┘
```

**List-page pattern** (every queue and the vacancy/exam lists): a stack of
bordered **rows** separated by a single hairline — never cards, never tiles.
Each row, left to right: the **date** (or age), the entity name, the target
section, a **completeness signal** (`● live` when `has_content`, `○ empty`
when not), a traffic number where relevant, and a chevron. Rows are **sortable**
by date and by traffic, and the window/pillar/region are filters above the list.

```
Vacancies                                          filter: ▾pillar ▾region ▾window
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

Named as proposed files (`supabase/proposed/`, per AGENTS.md; never auto-applied;
owner promotes to `migrations/` only after approval because a push applies the
whole `migrations/` directory).

1. **Traffic substrate.** `20261001120000_create_page_traffic.sql` — the
   `page_traffic` table + RLS (read for all editors, write via a service role).
   Ships a table with no behaviour change; enables the CSV loader.
   Frontend-independent.
2. **Canonical existence rule.** `20261002120000_content_has_data_fn.sql` — the
   SQL `content_has_data(exam_id, section)` function mirroring `sectionRegistry`.
   Acceptance: the **parity test** (fixtures → identical booleans in SQL and TS).
   Nothing consumes it yet.
3. **Signal view.** `20261003120000_bulletin_signals_view.sql` —
   `bulletin_signals` view (windows + target-section map + `has_content` via
   step 2). Read-only; a CMS query against it is the first live use.
4. **Editor state + RLS.** `20261004120000_bulletin_editor_state.sql` —
   `bulletin_editor_state` table + the assign/snooze/done-by-hand policies
   (intern acts, publishing stays gated by the M3 trigger). Independent.
5. **Bulletin home.** CMS: replace the default route with the bulletin
   (Just arrived / Coming up / Verification queue / Backlog) reading
   `bulletin_signals ⋈ page_traffic`, wired to `bulletin_editor_state`. The
   dashboard stays reachable at `/dashboard`. Ships the queue with no public
   surface change.
6. **Vacancy date backfill + list pattern.** CMS: shared bordered-row list
   component reused by bulletin/vacancies/exams; and the sarkari_naukri editor
   gains the typed date fields (§a.2) so the dormant vacancy signals light up and
   unblock Verify (application_end_date). Frontend untouched.
7. **Traffic refresh path.** CMS "Import GSC CSV" upload (owner-driven, monthly)
   upserting `page_traffic`; reuses the existing export format so no new schema.
8. **Optional column cache.** Only if step 3's bulk read is slow at scale:
   `20261008120000_has_content_generated_columns.sql` — generated
   `has_result`/`has_admit_card`/… columns maintained from step 2's function so
   the queue scans an index instead of a jsonb eval. Kept as a proposal,
   justified by a measured number, not assumed.

Steps 1–4 are pure data-layer and can land in any order after 1; 5 is the first
user-visible screen; 6–8 refine. No step changes a public URL, so the
`vacancy-tables.md` one-hop constraint is never threatened.
