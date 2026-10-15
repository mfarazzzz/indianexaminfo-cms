# ai-fill low-yield provider fallback (v10)

Status: **approved by the owner (reliability report Part B) for a SEPARATE later deploy,
after the CMS client change is pushed.** Provenance: written fresh on 2026-10-15 — the file
did not exist in the repo, so the thresholds below are re-derived from measurements taken in
this session (quoted `ai_request_logs` rows, the two golden fixtures, and the live-run
classifier output in `live-updeled*.log`), not recalled from the previous report.

Formalises the item already parked in `docs/PROGRAMME_BACKLOG.md` ("S2.13(c): valid-JSON-but-
wrong-shape answers do NOT trigger provider fallback"), which was deliberately not built in
S2.13. This is a TRANSPORT-level gate: it counts rows, it never judges whether a date is
correct.

---

## 1. The gap, with the evidence

On the template path `ai-fill` calls a provider, parses the JSON, runs `validateAnswer` and
returns 200. `validateAnswer` checks SHAPE (a row needs `label` + `dateText`; an unknown
`type` becomes `other`). A structurally valid but materially EMPTY answer therefore sails
through: no error is raised, so the provider loop never tries the next provider, and the
reviewer gets a half-extraction that looks like a complete one.

Measured on the UP D.El.Ed 2026 Phase-3 notice through the deployed v8, 14 Oct 2026 — the
runs that DID get an answer back (Groq `openai/gpt-oss-120b`, after Gemini 503'd):

| run (local time) | classifier result in `live-updeled*.log` |
|---|---|
| 22:10 | 2 of 4 expected kinds missing (`document_verification`, `institute_lock`) |
| 22:13 | 4 of 4 expected kinds missing |
| 22:16 | 3 of 4 expected kinds missing (`allotment`, `document_verification`, `institute_lock`) |
| 22:20 | no answer at all — Groq 413 (`Requested 8208` against `Limit 8000`) |

Honest boundary on that evidence: the raw JSON of those three answered runs was not retained
(`model.responses.live.json` in the tree is the older 7-row recording from commit `72accb2`),
so we can say the CLIENT pipeline ended up with no row of those kinds, but not whether the
model omitted the events or kinded them differently. The gate below is deliberately built so
that distinction does not matter: it only refuses answers with too few rows.

## 2. Definitions

**N — yield.** The number of date rows the answer actually carries after `validateAnswer`
(`content.dates.length`; rows dropped by the shape check for a missing `label`/`dateText`
are already gone). Computed server-side, inside the function.

**M — yardstick.** The number of DISTINCT calendar days the pasted notice text mentions.
Deterministic counter over `sourceText`, no model involved:

- Devanagari digits are folded to ASCII first (`०१२३४५६७८९`), so pure-Hindi notices count;
- `DD.MM.YYYY`, `DD/MM/YYYY`, `DD.MM.YY` (2-digit years become 20YY) with month `<= 12`, day `<= 31`;
- `YYYY-MM-DD`;
- `D <month name> YYYY` in English (full name and 3-letter abbreviation) and Hindi
  (जनवरी…दिसंबर, both the `-म्बर` and `-ंबर` spellings);
- matches are de-duplicated by the resolved `YYYY-MM-DD` key, so `05.10.2026 afternoon to
  07.10.2026` contributes two days and a date repeated five times contributes one.

M is intentionally an UPPER bound on the rows a good answer can have: a notice text may
mention days that are not events of this notice (the D.El.Ed fixture names the earlier
advertisement `07.08.2026` and an earlier phase's completion `25.09.2026`, both of which
belong in `references`, not `dates`). That is why the threshold is a fraction, not equality.

Measured M for the real inputs:

| notice text | M | rows a good answer produced | verdict under §3 |
|---|---|---|---|
| UP D.El.Ed 2026 Phase-3 (`pasted.txt`) | 9 | 7 (recorded live run, split windows) | ok |
| UP D.El.Ed 2026 Phase-3 | 9 | 5 (recorded golden answer) | ok |
| UP D.El.Ed 2026 Phase-3 | 9 | 4 (the acceptance table's four rows) | ok |
| UP D.El.Ed 2026 Phase-3 | 9 | 1, 2 or 3 (the sparse class observed on 14 Oct) | LOW_YIELD |
| RRB NTPC 2026 (`pasted.txt`) | 2 | 3 (two-row registration + fee on the same day) | ok |
| synthetic window text (2 lines) | 3 | 2 (`registration_start` + `registration_end`) | ok |
| one-deadline letter | 1 | 1 | ok |
| undated notice | 0 | 0 | ok |

## 3. Thresholds (exact)

Let `N` be the rows returned and `M` the distinct days in the source. An answer is
**low-yield** if and only if:

```
  T1  M >= 3  and  N == 0                      // a dated notice produced no timeline at all
  T2  M >= 6  and  N <= floor(M / 3)           // a date-rich notice covered under a third of its days
  otherwise                                     ok (accepted, unchanged behaviour)
```

Explicitly, so no reader has to recompute: `M <= 2` never triggers at any N; `M` of 3-5 only
triggers at `N == 0`; the fraction rule starts at `M == 6` (`N <= 2`), then `M == 9`
(`N <= 3`), `M == 12` (`N <= 4`).

The two properties the owner asked for:

- **A notice with genuinely few dates must NOT trigger.** With `M <= 2` the gate is inert —
  the RRB golden (M=2, N=3) and any one- or two-date letter pass untouched, and even
  `M == 3` only fails at `N == 0`.
- **A materially sparse answer must trigger.** The D.El.Ed class (`M == 9`, `N` of 1-3)
  fails T2.

## 4. Behaviour once an answer is low-yield

1. The answer is REFUSED to the caller and the loop **falls through to the next provider**,
   exactly like the existing 413/404/429 fall-through. The refused answer is remembered as
   `bestLow` if it has more rows than any refused answer so far.
2. Each refused answer logs one `ai_request_logs` row, `status='error'`,
   `error_message='low_yield: got N of ~M'` (the exact format the owner specified — `N` of
   the answer, `~M` as the estimate marker).
3. When no provider is left, the **best answer found is returned**: HTTP 200,
   `{ content, issues, provider, model, template }`, with one extra issue appended:

   ```json
   { "field": "dates", "reason": "low_yield",
     "detail": "only N of ~M dated events in the notice came back - some events were dropped; check the timeline before saving" }
   ```

   and one final `ai_request_logs` row, `status='success'`, carrying the same
   `low_yield: got N of ~M` text so the audit shows a success that was flagged.
4. **Low yield alone never produces a 502, 504 or an empty body.** A 502 still means only
   what it means today: no provider returned parseable JSON (or every call failed at the
   transport). With a single enabled provider row the gate cannot change the outcome — the
   one answer is accepted with the issue.
5. The provider health columns (`last_used_at`, `last_error`) keep their existing meaning: a
   low-yield answer is not an outage, so it does not write `ai_providers.last_error`; it is
   only in `ai_request_logs`.

Why refuse-and-refall-through instead of just flagging: Gemini is the first row in the chain
and Groq second, so a thin Groq answer gets one Gemini retry for free. Why never 502: the
editor's alternative to a half-extraction is a hand-typed one, and the drawer already exists
to show what is missing.

## 5. What this gate deliberately does NOT catch

The three wrong shapes recorded in the backlog item, against this design:

| shape | does T1/T2 fire? | handled where |
|---|---|---|
| **dropped rows** (a dated event missing from `dates`) | **yes** — that is the whole point | v10 gate + `low_yield` issue |
| **split window** (one window emitted as two rows) | no — it ADDS rows | client pairing net (`pairWindowRows`, S2.9) |
| **wrong kind / invented type** (e.g. `choice_filling` answered as `registration_start`) | no — every day still has a row | `validateAnswer` `not_an_option` issue for out-of-vocabulary types; the S2.14b prompt rule for the registration-vs-counselling class; the reviewer's own decision in the drawer |

A count-based gate cannot see a mislabelled row, and pretending otherwise would buy false
positives on legitimate short notices. Content correctness stays the reviewer's call — which
is why the issue must be VISIBLE, not just logged (see §6).

## 6. Required CMS client change (this is why v10 waits for a push)

Verified in code, not assumed: `summarizeFill()` in
`src/components/entrance-exams/noticeReview.ts` routes only three reasons into the report —
`low_confidence`, `not_an_option`, `no_value` — and `NoticeReviewDrawer.tsx` renders only
`report.lowConfidence` and `report.missingOptions`. Any other reason (including today's
`bad_shape`) adds to the `flagged` count via `issues.length` and is otherwise **invisible**.
So a new `low_yield` issue would not be shown, and §4.3's "surface it to the editor" promise
would be a lie without a client change.

Client work, small and additive:

- tolerate the reason: `ExtractionIssue["reason"]` (in `src/lib/ai/aiFillClient.ts`, mirrored
  by `Issue` in the function's `templates.ts`) gains `"low_yield"`;
- `FillReport` gains `yieldWarning: string | null`, filled from a `low_yield` issue detail;
- the drawer's flagged-summary block renders it as its own line (with its existing
  `data-testid` family) so it is visible and testable;
- `buildNoticeAiMetadata` already stores the whole `issues` array in `exams.ai_metadata`, so
  the provenance side needs nothing.

Order of operations, per the owner: client commit -> pushed by the owner -> "CMS pushed" ->
then, and only then, deploy the function. Deploying the gate before the client can display
it would put an invisible signal in production.

## 7. Tests

Offline, deterministic, no network:

- **truth table** for every `(M, N)` pair in §3 including the boundaries `(M=2,N=0)`,
  `(M=3,N=0)`, `(M=3,N=1)`, `(M=5,N=0)`, `(M=6,N=2)`, `(M=6,N=3)`, `(M=9,N=3)`, `(M=9,N=4)`,
  `(M=12,N=4)`, `(M=12,N=5)`;
- **counter** cases: ASCII `dd.mm.yyyy`, `dd/mm/yyyy`, 2-digit year, `yyyy-mm-dd`, English
  full + abbreviated month, Devanagari month names in both spellings, Devanagari digits,
  de-duplication of a repeated day, non-dates ignored (`2026-27`, roll numbers, `₹5,000`),
  and `M == 0` on undated text;
- **the three wrong shapes** as answers built from the real fixtures: dropped rows must
  trigger, split window must NOT, wrong kind must NOT (each with the reason asserted);
- **the sparse D.El.Ed shapes** (N = 0, 1, 2, 3 against the real fixture text) trigger; the
  recorded golden (5) and recorded live (7) answers do not;
- **a notice with genuinely few dates must NOT trigger**: the RRB fixture (M=2, N=3), the
  synthetic two-line window (M=3, N=2), a one-deadline letter (M=1, N=1);
- **structural guard on `index.ts`** (repo convention, like `aiFillLegacyBranch.test.ts`):
  the template loop consults the yield verdict before returning, logs `low_yield: got ${n}
  of ~${m}`, keeps a best-so-far, and that the low-yield exit returns 200 — no 502 is
  reachable on the low-yield path;
- **client display**: `summarizeFill` maps a `low_yield` issue to `report.yieldWarning`, and
  an unknown/extra reason still cannot break the report.

## 8. Non-goals

No change to `ai_providers` rows, models, priorities or vendors (owner's job in the panel).
No new secret needed (the gate is code, not config); no migration, no DB write beyond the
`ai_request_logs` rows the function already owns. `verify_jwt` stays `true`. The legacy
raw-prompt path is not gated. Deploy follows the same integrity protocol as v9: both files
in one call, read back and compared by markers, sizes, line counts, absence of removed code,
plus the auth/preflight probes.

## 9. Known gap, measured 2026-10-15 (owner decision, NOT implemented)

The v9 live verification run took the RRB NTPC notice through the deployed function and the
answer came back with **one** date row: `application_start 2026-10-08` survived, the closing
`application_end` (06.11.2026) did not, and none of `vacancy` / `important_links` / `notes`
were returned at all. The v8 run of the same input on 14 Oct had produced three rows plus all
three optional fields.

Under these thresholds that answer is **accepted**: the RRB text mentions M=2 distinct days,
and `M <= 2` is inert by design (§3) precisely so a genuinely short notice is never punished.
So the gate is correct as designed and still did not catch this case.

What closing it would take, and why it is out of scope: with M=2 the only signal that a row is
missing is the notice's own event structure (an opening date with a stated last date implies
TWO rows under the two-row registration contract). Reading that implication is a CONTENT
judgement — the class this design explicitly refuses to make (§5), because it is the same road
that produces false rejections on legitimate short notices. The honest options for the owner
are therefore:

1. leave it: the two-row contract is enforced by the prompt and the client pairing net, and
   the reviewer still sees one row plus the drawer;
2. accept a narrow, contract-specific rule for the application window only (an
   `application_start` row with no `application_end` row becomes its own issue — reported, not
   refused), which stays content-agnostic about everything except that one pair;
3. widen T1/T2 downward (e.g. trigger at M=2 when N<=1), which trades the guarantee in §3
   ("a notice with genuinely few dates must NOT trigger") for coverage — not recommended.

Recorded here rather than in code, because the thresholds above are the approved ones and this
session's job was to implement exactly them.
