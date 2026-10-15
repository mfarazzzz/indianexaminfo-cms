# ai-fill prompt compaction + output cap (v9)

Status: **approved by the owner (reliability report Part C) and implemented as v9.**
Provenance: this file was written fresh on 2026-10-15. The Part C design existed only
in the previous session's report, not on disk (`docs/design/ai-fill-prompt-compact-proposal.md`
was absent from the repo), so every number below was re-measured in this session rather
than copied from that report. Measurement method is quoted so each figure can be re-taken.

Scope: `supabase/functions/ai-fill/templates.ts` (prompt text only) and the template-path
output-token constant in `supabase/functions/ai-fill/index.ts`. Nothing in `src/` moves:
the browser side, the validator contract and the review drawer are untouched.

---

## 1. Baseline actually measured on v8

Method: `supabase/functions/ai-fill/templates.ts` was bundled with the repo's own esbuild
and `buildPrompt()` was called with the live option vocabulary read from
`cwbhhcqsrbuoybeaondk` (10 active `entrance-exam` categories, 37 regions) and the real
fixture text (CRLF normalised the way the editor sends it).

| Quantity | v8 measured |
|---|---|
| Static prompt skeleton (entrance-exam options, empty source) | 10,546 chars |
| Static prompt skeleton (government-exam options, empty source) | 10,274 chars |
| UP D.El.Ed 2026 Phase-3 notice text | 9,784 chars |
| UP D.El.Ed full prompt | 20,330 chars |
| RRB NTPC 2026 notice text | 910 chars |
| v8 addition block: JSON schema for vacancy / important_links / notes | 922 chars |
| v8 addition block: VACANCY / IMPORTANT-LINKS / NOTES RULES | 1,415 chars |
| v8 addition block: SOURCE HYGIENE | 590 chars |
| **v8 additions total (the part v9 compacts)** | **2,927 chars** |

The v8 commit (`f44d83c`) added 108 lines to the file; only the prompt-text part of that
counts against a provider budget — the rest is TypeScript validator code that never crosses
the wire.

## 2. Why the size matters (provider arithmetic, quoted from `ai_request_logs`)

Groq bills the request against its 8,000 tokens-per-minute ceiling using the prompt AND the
completion budget it is asked to reserve (`max_completion_tokens`), so a large prompt plus a
large cap can exceed 8,000 before a single token is generated. The failure is HTTP 413, and
the number we need for the audit trail is in the provider body that `ai-fill` already logs
(redacted). Verbatim rows from `ai_request_logs`, 14 Oct 2026:

- `2026-10-14 16:50:26.682697+00` / `golden-live` / 42 ms /
  `groq returned 413: {"error":{"message":"Request too large for model `openai/gpt-oss-120b`
  in organization `[redacted]` service tier `on_demand` on tokens per minute (TPM): Limit
  8000, Requested 8208, please reduce your m`
- `2026-10-14 16:46:59.378291+00` / `golden-live-synth` / 29 ms /
  `groq returned 429: ... TPM: Limit 8000, Used 6793, Requested 5874. Please t`
- `2026-10-14 16:39:18.15873+00` / `golden-live` / 36 ms /
  `groq returned 429: ... TPM: Limit 8000, Used 2178, Requested 7535. Please t`
- the same notices' Gemini attempts logged `gemini returned 503: This model is currently
  experiencing high demand` and fell through, which is why Groq answers at all.

What follows from those lines and what does not:

- The 413 is unambiguous: `Requested 8208` with a 3,000-token completion cap implies a prompt
  of roughly 5,208 tokens for a 20,330-char prompt (about 3.9 chars/token on this mixed
  Hindi/English text). That is the calibration used below.
- **Not explained yet:** the Groq 429 bodies do not all fit `prompt + cap` arithmetic
  (`Requested 7535` at 16:39:18 and `Requested 3293` for the 118-char synthetic source at
  16:40:36, against `Requested 8208` for the same D.El.Ed notice later). Groq's limiter
  accounts for a rolling minute window ("Used"/"Requested"), and this session did not
  reproduce why individual `Requested` values differ. The compaction benefit is therefore
  stated as an estimate on the one 413 we have, not as a model of Groq's limiter.
- Lowering the cap and the prompt both move the same number, which is why the owner paired
  them in one change.

## 3. The change (v9)

### 3.1 Compact the v8 additions: 2,927 to 1,475 chars (measured after the edit)

Same instructions, fewer words. The three rule blocks become ONE block, and the JSON schema
lines lose their repeated prose (the rule block carries the meaning once). The text below IS
the shipped text; the sizes after it were measured by re-bundling the edited file.

Schema lines (inside the required JSON shape):

```
  "vacancy": { "total": "posts total ONLY if the notice PRINTS it, integer, else null", "sourceQuote": "verbatim line", "posts": [ { "name": "post name as printed", "count": "integer, else null" } ] },
  "important_links": [ { "label": "link text as printed", "url": "the address EXACTLY as printed — ONLY if it really appears; NEVER invent one", "kind": "one of: official, apply, notification, short_notice, result, admit_card, answer_key, other" } ],
  "notes": [ { "text": "exam-stage line with NO absolute date", "sourceQuote": "verbatim line" } ]
```

**551 chars** (v8: 922)

Rules block (replaces VACANCY RULES + IMPORTANT-LINKS RULES + NOTES RULES):

```
VACANCY / LINKS / NOTES RULES (all three OPTIONAL — omit or send [] when the notice has none):
- vacancy.total: ONLY a total the notice PRINTS; NEVER add the posts up. vacancy.posts: the breakdown ONLY when the notice lists individual posts; copy every name/count, invent nothing.
- important_links: return a link ONLY when its address literally appears in the text; a label with no address is omitted, and an invented URL is a serious failure. Copy the URL exactly as printed.
- notes: an exam-stage line with NO absolute date ("Exam Date: To be notified", "Admit Card: 4 Days Before Exam") belongs here, NEVER in "dates".
```

**625 chars** (v8 rules blocks: 1,415)

Source-hygiene block:

```
SOURCE HYGIENE (aggregator pages are the expected input):
- IGNORE page CHROME — nav menus, "Trending Now", "Related Posts", comment forms, "Download App"/"Follow us", footer. Extract ONLY notice facts.
- Every field is a FACT with a short verbatim "sourceQuote"; never reproduce the page's prose.
```

**299 chars** (v8: 590) — the three blocks together **1,475** vs v8's 2,927, i.e. 1,452 chars
of prompt removed

The untouched parts of the prompt are deliberately untouched: the allowed-options block, the
JSON shape for `fields` / `dates` / `references`, the whole DATE RULES section (two-row
registration contract, counselling kinds, window merging, references-vs-events) and the
NON-CONTENT line. Those carry the S2.2 / S2.9 / S2.10 behaviour that the golden tests pin.

### 3.2 Output cap: 3,000 to 2,500, env-overridable

`TEMPLATE_MAX_OUTPUT_TOKENS` becomes a constant computed from the environment, default 2,500:

- secret name `AI_TEMPLATE_MAX_OUTPUT_TOKENS` (same convention as `AI_TIMEOUT_MS` and
  `AI_GEMINI_THINKING_BUDGET`);
- blank, non-numeric or `<= 0` falls back to 2,500 — never silently to 8,192;
- the LEGACY raw-prompt path keeps its own `jsonMode ? 8192 : 4096` default untouched;
- 2,500 is still about 2.1x the largest answer ever recorded on this template (~1,199 output
  tokens on a Devanagari-inflated live run; the recorded golden answer is ~1,075), so no
  real notice we have measured is truncated by the new cap.

## 4. What "same behaviour" means, and how it is guarded

`buildPrompt` output is text; nothing in the request/response contract changes. The rules
that must survive the compaction are asserted as literal tokens by a structural test
(`src/lib/ai/noticePromptCompact.test.ts`, added with v9), which reads `templates.ts` the way
`noticeTemplateParity.test.ts` does and fails if any of them disappears:

printed-total-only / never-add-posts-up / breakdown-only-when-listed / invent-nothing /
optional-omitted / address-literally-appears / label-without-address-omitted /
invented-URL-is-a-serious-failure / copy-exactly / no-absolute-date-goes-in-notes /
never-in-dates / ignore-page-chrome / extract-only-notice-facts / never-reproduce-prose /
the full `kind` vocabulary.

All sixteen tokens are present in the shipped text (checked by the same probe that measured
the sizes), and six probes confirm the sections v9 must NOT touch are still verbatim: the
DATE RULES two-row registration exception, the opening "ONE official Indian exam/admission
notice" line, NON-CONTENT, `suggestedNewOption`, `rank_batch` and the Devanagari
reference-date example.

The test also asserts the v8 additions stay inside the size budget (<= 1,600 chars), so a
future edit that re-inflates the prompt fails CI instead of quietly reintroducing the 413.

## 5. Verification plan (this is what "verified" is allowed to mean here)

Offline, before deploy: `tsc --noEmit` clean; `eslint` with 0 errors; `templates.ts`
type-checked on its own (it is a standalone Deno bundle, `src/` cannot reach its Deno
imports); the full vitest suite, with `noticeTemplateParity` and both golden tests green.
The goldens are client-side: they replay recorded answers, so they do not move when the
prompt text moves — that is a fact about the test, not an assumption.

Deploy: both files (`index.ts`, `templates.ts`) uploaded in one `deploy_edge_function`
call, `verify_jwt` stays `true`, then read back with `get_edge_function` and compared by
markers (unique strings per version), byte sizes, line counts, absence of the removed code,
and two probes: an unauthenticated POST must still be refused, and an OPTIONS preflight from
an allowed origin must still answer.

Live, after deploy: exactly two calls, at least 90 s apart — the RRB NTPC notice through the
deployed function (`LIVE=1` block in `src/lib/ai/rrbNtpc.golden.test.ts`, which hard-asserts
the two-row registration contract, no merged window, no un-attested URL surviving, no TBN
line becoming a dated row and reports vacancy/links/notes capture) and the UP D.El.Ed live
golden. `ai_request_logs` is read for the preceding 10 minutes first; if that window already
contains 429/503 the run waits. Provider, latency and rows-vs-`expected.json` are reported
from the actual response, and any 413/429 is reported with the provider's `Requested` token
number quoted from the log.

## 6. Estimated effect on the case that failed

On the UP D.El.Ed prompt (20,330 chars, the one that 413'd):
- compaction removes 1,452 chars (2,927 to 1,475 measured on the shipped text), taking the
  full prompt from 20,330 to 18,878 chars;
- at the 413's own calibration (5,208 tokens / 20,330 chars, i.e. 0.2562 tok/char) that is
  about 372 prompt tokens;
- the cap drops 500 tokens;
- the request that asked for 8,208 would therefore ask for roughly 7,336 against an 8,000
  ceiling: about 660 tokens (roughly 2,500 chars of Hindi text) of headroom instead of a
  hard failure. An estimate, derived from one measured 413 line — see §2 for the limits.

## 7. Out of scope (owner's work in the panel)

`ai_providers` rows, model ids, priorities and any third vendor are the owner's job; this
change does not read, write or recommend changes to that table beyond the health columns the
function already maintains (`last_used_at`, `last_error`). No migration, no DB write except
the existing `ai_request_logs` inserts. The low-yield provider fallback (Part B) is a
separate deploy — see `ai-fill-low-yield-fallback.md`.
