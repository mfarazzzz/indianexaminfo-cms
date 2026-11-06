# Verification mode — design (Phase B0)

Owner batch 7, Phase B0. Design only: **B1 was not built in this batch** (see "Build order"
at the bottom for why and what the first slice is). Nothing in this file changes behaviour.

## The problem, measured rather than asserted

- Verification is the gate everything else hangs on: `setExamVerification`
  (`src/services/examService.ts:349`) asserts `publish_exam` at `:350`, requires the
  signed-in id at `:351`, and it is the event that queues a social candidate at
  `:365-370`. So an unverified exam cannot reach the queue at all.
- **No real exam has ever been verified.** The five rows with `verified_at` set are all
  `zz-test-` fixtures (batch 6, `docs/status/verify-next-25.md`). There is therefore no
  stopwatch baseline in history, and any "we save N minutes" claim would be invented. The
  baseline below is counted from the data and the screens instead.
- The facts a verifier must compare, per exam, taken from the current editions of the five
  pages that Phase R just consolidated:

  | exam | date rows | fee keys | eligibility keys | selection steps | vacancy | values to compare |
  |---|---|---|---|---|---|---|
  | cds-exam | 1 | 3 | 3 | 2 | 457 | ~10 |
  | nda-exam | 6 | 1 | 3 | 3 | 400 | ~14 |
  | rpf-constable | 1 | 4 | 3 | 4 | 9500 | ~13 |
  | ugc-net | 7 | 4 | 3 | 0 | null | ~14 |
  | upsc-cms | 2 | 5 | 3 | 2 | 827 | ~13 |

  Today those five groups are read from a notice in one tab and written in up to four
  different places, so the human does the diffing in their head and re-types it.

## What the editor needs on ONE screen (B1's requirement)

Everything a verification decision depends on, reachable without scrolling past unrelated
content, in the order the decision is actually made:

1. **the source** — the stored official link as one "Open official source" button (new tab);
2. **the stored facts the reader sees**, each with a "matches the official notice" checkbox:
   dates, vacancy, fee, eligibility, selection — the same five groups as the table above;
3. **a paste box** that runs the existing deterministic extractors over pasted notice lines
   and shows stored-vs-found per field, with Accept / Keep per field;
4. **Save + Verify + Next** — save the form, then the existing verify call, then jump to the
   next row in the same queue order;
5. **"Verified today: N"** — the signed-in user's own `verified_at` count for today;
6. **Create update** — opens the existing exam-update form pre-filled only from structured
   fields (exam link, kind provisional/final, the one date found), never auto-published.

Hard rules carried over from the owner's standing decisions, restated because they constrain
the design more than any feature list:

- **Accept writes to the FORM, never the database** — the AI Fill preview-before-overwrite
  contract (`src/lib/exams/updateFromNotice.ts`, 72 lines: it returns a patch the caller
  applies to the form and a human saves).
- **Never auto-verify, never write without a human click.** Verification stays a
  `setExamVerification` call behind one explicit button, with `verifyBlockReasons` and the
  DB trigger as the authorities.
- The copy rules do not change: the public page keeps saying "Verified by IndianExamInfo
  editorial team" — no personal name, ever.
- Unticking any "matches" checkbox, or any existing block reason, refuses the verify step
  with the reason in plain words.

## What is explicitly OUT of scope

- **No server-side fetching of official sites** and no new network surface in this phase.
  The editor pastes the notice text; nothing reaches out to a government domain from our
  servers (that also keeps the CSP work frozen as the owner instructed).
- No OCR, no PDF parsing, no AI generated facts. The deterministic extractors already exist;
  anything they cannot find stays a human edit.
- No change to the verification schema, the `publish_exam` permission, the DB triggers or the
  public wording.
- No bulk verify. A mode that marks many rows verified without reading them is exactly the
  failure this gate exists to prevent.

## Components to reuse (all of these already exist and are tested)

| need | reuse | where |
|---|---|---|
| the ordered queue the "Next" step walks | `buildQueueRow` / `sortQueueRows` / `RECHECK_AFTER_DAYS` | `src/lib/exams/verification.ts:146`, used by `src/pages/verification/NeedsVerificationPage.tsx` (177 lines) |
| the refusal list | `verifyBlockReasons(i: VerifyStateInput)` | `src/lib/exams/verification.ts:81` |
| pasted-lines → dates | `noticeDateLines` (280 lines, its own 153-line test) | `src/lib/ai/noticeDateLines.ts` |
| pasted-lines → steps/vacancy/fee | `noticeSteps` (143 lines + 65-line test, wired by `noticeStepsWire.test.ts`) | `src/lib/ai/noticeSteps.ts` |
| preview-before-overwrite patch shape | `updateFromNotice` | `src/lib/exams/updateFromNotice.ts` |
| the verify call itself | `setExamVerification` | `src/services/examService.ts:349` |
| one-screen checklist pattern | the "Vacancy window" card shipped in Phase C2a (5 fields + live ✓/○ checklist) | `src/pages/sarkari-naukri/SarkariNaukriEditPage.tsx` |
| flag with a per-role default | `FEATURE_FLAGS` + `flagOn` | `src/config/featureFlags.ts` (VERIFY_MODE would default true for super-admin/admin only) |
| the update form to pre-fill | `examUpdatesService` create (`:123-129`, `published_at` only when status is published) | `src/services/examUpdatesService.ts` |

Because the checklist pattern already exists for vacancies, the exam-side win is mostly
**placement + the paste-diff**, not new machinery.

## Measurable target (the only honest way to state it without a stopwatch baseline)

- **clicks**: today the path is list → open row → switch tab per fact group (up to 4) →
  Save → Verify → navigate back → find the next row. The target is list → open row →
  **Save + Verify + Next** → the next row is already open: **no tab switches, one button,
  no navigation back**.
- **keystrokes**: the six "matches the official notice" ticks are the only mandatory
  keyboard/mouse work on a row whose data is already right, and they replace reading five
  fact groups off the notice and re-checking them across four tabs.
- **values retyped**: 0. Anything the extractors found is offered as a form patch, so the
  editor types only what the notice contradicts and no extractor found.
- **facts visible without scrolling**: all five groups plus the official link, per exam.
- The 1-2 minute claim in the brief is a *goal*, and it can only be confirmed by the owner
  timing one real verification after B1 ships. That measurement is the acceptance test; this
  document does not claim it is achieved.

## Build order and the first slice (what B1 should be when it is built)

Phase C came first by the owner's instruction, and C2a already delivered the one-screen
checklist idea for the corpus that carries 91% of the traffic. Phase B's remaining value is
concentrated in two pieces, and they are separable:

1. **Slice 1 (small, no new read/write paths)**: a "Verify" panel inside the exam editor that
   shows the official link button, the five stored fact groups with the ✓/○ checklist, and
   routes the existing Save → `setExamVerification` through one button, refusing with
   `verifyBlockReasons` and requiring every box ticked. Next-in-queue from `sortQueueRows`.
2. **Slice 2**: the paste box + stored-vs-found diff table (extractors already exist), Accept
   writing into the form only.

Slice 1 is the part that removes the tab-switching and the double navigation; Slice 2 is the
part that removes re-typing. They are listed separately on purpose: the batch was long, B1
was not started, and shipping Slice 1 alone is a legitimate first increment rather than a
half-finished version of both.
