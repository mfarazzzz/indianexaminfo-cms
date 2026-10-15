# ai-fill yield measurement — 3-day plan (read-only SQL)

Purpose: after v10 (the low-yield provider fallback) is live, answer four
questions from real editor use rather than from test fixtures —

1. how often does the gate fire, and does the retry actually rescue the call?
2. is the gate ever the reason an editor got nothing (it must never be)?
3. what is the provider health around these calls (503 / 429 / 413 / 400)?
4. what is the per-model yield, so the `ai_providers` rows and priorities can be
   re-decided on evidence?

All queries are SELECT-only against `public.ai_request_logs` (plus a read-only
join to `ai_providers`). No writes, no DDL, no CLI command that touches the
remote DB. Run them in the SQL editor of project `cwbhhcqsrbuoybeaondk`, or via
the Supabase MCP `execute_sql` tool, and paste the JSON back.

Window: the owner asked for 3 days, so every query below uses
`now() - interval '3 days'`. Change that one literal to widen or narrow it.

---

## 0. What is actually recorded (read this before interpreting anything)

`ai_request_logs` columns: `id, provider_id, prompt_hash, status, error_message,
latency_ms, consumer_name, created_at, user_id`.

Consequences that shape these queries:

- **One row per provider ATTEMPT, not per call.** A call that tried Gemini and
  then Groq writes two rows (v10 writes one more when it accepts a thin best
  answer). There is **no request/correlation id**, so a "call" is reconstructed
  as `(user_id, prompt_hash, minute bucket)`. `prompt_hash` is the first 16 hex
  chars of SHA-256 over the prompt, so two editors running the *same* notice
  text in the *same* minute merge into one call. Acceptable for rates; do not
  read the absolute counts as a headcount.
- **`low_yield` rows.** The gate writes the marker string
  `low_yield: got N of ~M` twice by design: `status='error'` for each refused
  attempt, and `status='success'` once when the chain is spent and the best thin
  answer is returned as HTTP 200. Never confuse the success row with a failure.
- **The model is not stored per row.** `provider_id` joins to `ai_providers`,
  which carries the row's **current** model. If a row's model was edited during
  the window, older log rows are attributed to the new model. "Per-model yield"
  below is therefore an approximation; the exact fix is a migration (see §6) —
  deliberately not done here.
- **N (the row count the server returned) is only visible when the gate fired.**
  A healthy answer logs no N. §6 lists the one-column migration that would make
  N observable for every call; until then, use the marker text.
- `consumer_name` separates real editor use from tests: AI Fill from the notice
  dialog is `update-from-notice`; the golden/live tests are `golden-live`,
  `golden-live-synth`, `s214b-live`; the panel's health checks are
  `provider-test` and `provider-models`. Rate-limit arithmetic counts every row,
  so keep tests out of the "real use" queries.

---

## 1. Headline roll: gate activity per day (real editor use only)

```sql
with calls as (
  select
    date_trunc('day', l.created_at at time zone 'Asia/Kolkata')          as day_ist,
    l.user_id,
    l.prompt_hash,
    date_trunc('minute', l.created_at)                                   as call_minute,
    bool_or(l.status = 'success' and coalesce(l.error_message,'') not like 'low_yield%') as clean_200,
    bool_or(l.status = 'success' and l.error_message like 'low_yield%')   as thin_200,
    bool_or(l.status = 'error'   and l.error_message like 'low_yield%')   as gate_fired,
    bool_or(l.status = 'error'   and coalesce(l.error_message,'') not like 'low_yield%') as transport_error,
    count(*)                                                              as attempts
  from ai_request_logs l
  where l.created_at > now() - interval '3 days'
    and l.consumer_name = 'update-from-notice'
  group by 1,2,3,4
)
select day_ist,
       count(*)                                            as calls,
       count(*) filter (where gate_fired)                  as gate_fired,
       count(*) filter (where clean_200)                   as answered_clean,
       count(*) filter (where thin_200 and not clean_200)  as answered_thin_with_issue,
       count(*) filter (where not clean_200 and not thin_200) as no_answer_502,
       count(*) filter (where transport_error)             as calls_with_transport_error,
       round(100.0 * count(*) filter (where gate_fired) / nullif(count(*),0), 1) as pct_of_calls_refused_at_least_once,
       round(100.0 * count(*) filter (where thin_200 and not clean_200) / nullif(count(*),0), 1) as pct_answered_thin,
       round(100.0 * count(*) filter (where not clean_200 and not thin_200) / nullif(count(*),0), 1) as pct_no_answer
from calls
group by 1
order by 1;
```

How to read it:

- `gate_fired` = calls where at least one provider's answer was refused. High is
  expected while Gemini 503s and Groq thin-answers; the number that matters is
  the next two columns.
- `answered_clean` > 0 alongside `gate_fired` is the **rescue**: a refusal
  happened and a later attempt still produced a normal 200. That is the whole
  point of v10.
- `answered_thin_with_issue` = the editor got a partial extraction plus the
  visible Low yield line (HTTP 200, by design).
- `no_answer_502` must stay explainable by transport failures only. If it climbs
  **after** v10 while `transport_error` does not, that is a bug in the gate — it
  is designed so low yield alone can never produce a 502 (`noticeYield.test.ts`
  asserts the ordering that guarantees it).

## 2. Did the retry rescue anything? (per fired call, which provider answered)

```sql
with marked as (
  select l.id, l.created_at, l.user_id, l.prompt_hash,
         date_trunc('minute', l.created_at) as call_minute,
         p.provider, p.model, l.status, l.error_message, l.latency_ms
  from ai_request_logs l
  left join ai_providers p on p.id = l.provider_id
  where l.created_at > now() - interval '3 days'
    and l.consumer_name = 'update-from-notice'
),
fired as (
  select user_id, prompt_hash, call_minute
  from marked
  where error_message like 'low_yield%' and status = 'error'
  group by 1,2,3
)
select m.provider, m.model, m.status,
       case when m.error_message like 'low_yield%' then 'low_yield'
            when m.error_message ~ 'returned (4[0-9]{2}|5[0-9]{2})'
              then (substring(m.error_message from 'returned ([0-9]{3})'))
            when m.error_message = 'timed out' then 'timeout'
            else 'other/none' end as outcome,
       count(*) as rows,
       round(avg(m.latency_ms)) as avg_latency_ms,
       percentile_cont(0.95) within group (order by m.latency_ms)::int as p95_latency_ms
from marked m
join fired f using (user_id, prompt_hash, call_minute)
group by 1,2,3,4
order by 1,2,rows desc;
```

Read: within calls where the gate fired, this shows the attempt sequence by
provider — e.g. groq `error/low_yield` followed by gemini `success` is a rescue
in the other direction (chain order is `priority` ascending, so normally
gemini is attempted first).

## 3. Provider health (the numbers that decide whether to change vendors)

```sql
select date_trunc('day', l.created_at at time zone 'Asia/Kolkata') as day_ist,
       coalesce(p.provider, '(no provider row / fallback secret)') as provider,
       count(*) as attempts,
       count(*) filter (where l.status = 'success')                as ok,
       count(*) filter (where l.error_message like '%returned 503%') as e503,
       count(*) filter (where l.error_message like '%returned 429%') as e429,
       count(*) filter (where l.error_message like '%returned 413%') as e413,
       count(*) filter (where l.error_message like '%returned 400%') as e400,
       count(*) filter (where l.error_message like '%returned 404%') as e404,
       count(*) filter (where l.error_message = 'timed out')          as timeouts,
       count(*) filter (where l.error_message like 'low_yield%')      as low_yield_rows,
       round(100.0 * count(*) filter (where l.error_message like '%returned 503%') / nullif(count(*),0), 1) as pct_503,
       round(100.0 * count(*) filter (where l.error_message like '%returned 429%') / nullif(count(*),0), 1) as pct_429,
       percentile_cont(0.95) within group (order by l.latency_ms) ::int as p95_ms
from ai_request_logs l
left join ai_providers p on p.id = l.provider_id
where l.created_at > now() - interval '3 days'
group by 1,2
order by 1,2;
```

`e400` deserves a note: on 15 Oct Groq returned
`400 ... "code":"json_validate_failed" ... "failed_generation":""` — the model
emitted **zero** tokens against the JSON response format. That is a provider-side
empty generation, and it is the reason one v10 verification call never reached
the gate. If `e400` with an empty `failed_generation` becomes a habit, that is a
model/router complaint, not a prompt complaint.

## 4. Per-model yield: the N and M the gate saw

```sql
select coalesce(p.provider,'?') as provider,
       coalesce(p.model,'?')    as model,
       substring(l.error_message from 'low_yield: got (\d+) of ~(\d+)')::int as n_rows,
       substring(l.error_message from 'low_yield: got \d+ of ~(\d+)')::int   as m_days,
       count(*) as times,
       min(l.created_at) as first_seen,
       max(l.created_at) as last_seen
from ai_request_logs l
left join ai_providers p on p.id = l.provider_id
where l.created_at > now() - interval '3 days'
  and l.status = 'error'
  and l.error_message like 'low_yield%'
group by 1,2,3,4
order by 3 asc, 5 desc;
```

Read:

- rows with `n_rows = 0` are T1 (a dated notice, no timeline at all) — the most
  severe shape, exactly what the 15 Oct D.El.Ed run produced (N=0, M=9).
- `n_rows` small against a large `m_days` is T2.
- if the same `model` shows almost all `n_rows = 0` while another model shows
  `n_rows` near `m_days`, the priority order is doing its job and the weaker row
  should be demoted — that is an owner decision in the panel, not a code change.
- `m_days` above ~25 in a short notice would mean the counter is reading
  non-dates out of a pasted page; if you see that, send me the sample text.

## 5. Latency cost of the retry (the honest price of v10)

```sql
with calls as (
  select user_id, prompt_hash, date_trunc('minute', created_at) as call_minute,
         bool_or(error_message like 'low_yield%' and status='error') as gate_fired,
         sum(latency_ms) as total_ms,
         count(*)        as attempts,
         -- wall clock from the first attempt to a success, in SECONDS:
         -- percentile_cont needs a numeric, and (timestamptz - timestamptz) is an
         -- interval, which it cannot order over.
         extract(epoch from (max(case when status='success' then created_at end) - min(created_at))) as wall_s
  from ai_request_logs
  where created_at > now() - interval '3 days'
    and consumer_name = 'update-from-notice'
  group by 1,2,3
)
select gate_fired,
       count(*) as calls,
       round(percentile_cont(0.50) within group (order by wall_s)) as p50_wall_s,
       round(percentile_cont(0.95) within group (order by wall_s)) as p95_wall_s,
       round(avg(attempts), 2) as avg_attempts
from calls
group by 1
order by 1;
```

`p50_wall_s` / `p95_wall_s` are seconds; a null in both means that group has no
call that ever reached a 200 (all-502 calls), which §1 already counts.

`wall_s` is the span from the first attempt to a success, in seconds; compare the
two rows. The overall guard (`sum of per-provider budgets + backoffs + 5 s`) is
unchanged by v10, and the refuse path no longer disarms it, so a longer
`p95_wall_s` should still be bounded by that guard rather than by a new timeout.

## 5b. First run of these queries (2026-10-15, minutes after the v10 deploy)

All five ran clean against live `cwbhhcqsrbuoybeaondk`; this is the shape of the
answer, not yet a signal (v10 had served no real editor call at this point):

- **1** (real editor use, consumer `update-from-notice`): 12 Oct 5 calls,
  3 answered clean, 2 no-answer, 0 gate firings; 13 Oct 2 calls, 2 clean.
  Nothing on 14–15 Oct, which is why every `low_yield` count below is 0.
- **3** (health, all consumers): gemini 503 rate 41.7% / 100% / 88.9% / 100% on
  12→15 Oct with a p95 of 21.7 s on 12 Oct; groq carried 3×429 and 1×413 on
  14 Oct and 1×400 (`json_validate_failed`) on 15 Oct. `low_yield_rows` = 0
  everywhere because the gate went live minutes earlier.
- **4** and **2**: empty result sets (no gate firing yet) — they execute, which
  is what was being checked.
- **5**: 7 calls, none with the gate fired, p50 5 s / p95 9 s, avg 1.57 attempts.

Note one cast the first draft of **5** got wrong: `percentile_cont` cannot order
over an `interval`, so the wall clock is taken in epoch seconds. The version
above is the one that ran.

## 6. Optional follow-up that would make this much sharper (NOT applied)

Two things the log cannot tell you today, both fixable only by a migration the
owner has not approved:

1. **N for every call, not only for refused ones.** Add
   `date_rows smallint, distinct_dates smallint` to `ai_request_logs` and have
   `logCall` fill them on the template path. Then §4 becomes a real distribution
   per model instead of a tail of refusals.
2. **The model at log time.** Add `model text` to the log row, so a later edit of
   an `ai_providers` row cannot re-attribute history (see §0).

Both are additive columns with defaults, no data change, no policy change. If you
want them, say so and I will write the migration to `supabase/proposed/` first.

## 7. What to paste back after 3 days

Run §1, §3, §4 and §5 and paste the results (the JSON or a screenshot). Decisions
they support, in order of what I would look at first:

- §1 `no_answer_502` up without `transport_error` up → gate bug, I fix it.
- §1 `answered_thin_with_issue` high while §4 shows the second provider has
  better `n_rows` → priority order is wrong (panel change, owner's).
- §3 one provider dominating 503/429/400 → the chain is effectively one vendor;
  that is the third-vendor conversation, owner's to make.
- §5 `p95_wall` on fired calls near the overall guard → consider a smaller
  per-provider `AI_TIMEOUT_MS_groq` instead of a second full-chain attempt.
