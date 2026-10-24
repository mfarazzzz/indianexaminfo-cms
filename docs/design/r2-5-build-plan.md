# R2.5 — One-Save Editor: build plan

Owner batch 2, Phase D3. **Plan only — nothing built this batch.** Locked decisions
from `r2-s3-s4-plan.md` (L119–122): one page-level Save with per-section dirty
markers; no section silently publishes; verify reuses `publish_exam`; counselling
stays JSONB; file ownership (update PDF in `content_posts.attachment_urls`,
browsable papers in `exam_resources`).

## 1. Current write paths the editor uses (today)
Each of these autosaves independently — the thing R2.5 must unify.

**`exams`** — `createExam`, `updateExam`, `updateExamIdentity`, `setExamVerification`
(is_verified/verified_*), `setExamWorkflowStatus` + `publishExam` (publish state),
`setWeightageType`; entrance/board/university via `createEntranceExam` /
`entityService.createEntity` / `updateEntity`.
**`exam_editions`** — `updateEdition`, `createCurrentEdition`, and the module store:
`saveModuleConfig`, `saveModuleContent`, `toggleModuleEnabled`, `saveAllContentModules`
(all write `exam_editions.content_modules`); ColumnBackedCards write
`eligibility` / `application_fee` / `selection_process` / `faqs`.
**`content_posts`** — `createContentPost`, `updateContentPost`, `createExamUpdate`,
`updateExamUpdate`.
**`exam_resources`** — `createResource`, `updateResource`.

## 2. What one Save batches
The dirty sections collected by the rail's per-section dirty markers → a single
`save_exam_page(examId, baseEditionUpdatedAt, payload)` call (see
`supabase/proposed/20261024_save_exam_page_PROPOSAL.sql`). Payload carries only the
changed sections (identity / edition facts / content_modules / posts / resources).
Publish and Verify stay SEPARATE actions (never part of Save) — the RPC rejects
`is_verified/verified_*/workflow_status/is_published`.

## 3. Atomicity & ordering — RECOMMENDATION
Use the **single SECURITY INVOKER RPC** (not client-side ordered writes): it runs in
one transaction, so the page is all-saved or all-unchanged, and RLS + the verify/
publish triggers apply per row (no bypass). Ordering inside: exams → exam_editions
(→ content_modules) → content_posts → exam_resources. A failure anywhere aborts the
whole call; the CMS surfaces which section failed.
*Alternative (rejected for v1):* client-side ordered writes with manual rollback —
more code, no transactional guarantee, harder to keep RLS semantics identical.

## 4. Conflict handling
Optimistic concurrency on `exam_editions.updated_at`: the editor sends the value it
loaded; a mismatch → SQLSTATE 40001 `conflict:stale_edition` → CMS shows "someone
else changed this record — reload / merge". Two editors on the same section: last
writer wins only after an explicit reload, never a silent overwrite.

## 5. Autosave interaction — DECISION (needs owner sign-off)
**Remove the per-section DB autosave.** Keep a **browser-only** draft backup in
`localStorage` (try/catch) with a "Restore unsaved changes?" prompt on reopen; the DB
is written ONLY on Save. This is the behaviour change that makes "one Save" real —
today the debounced autosave writes to the DB on every edit, which contradicts a
single Save and defeats the dirty markers.

## 6. Increments (each independently shippable)
| # | Increment | Risk | Migration? |
|---|---|---|---|
| 1 | Per-section dirty registry feeding one Save button (UI only; still calls existing services) | Low | No |
| 2 | localStorage draft backup + restore prompt (browser-only) | Low | No |
| 3 | `save_exam_page` RPC (proposal) reviewed + applied; forbidden-field + stale guards | **Med** | **Yes** (the RPC) |
| 4 | Route Save through the RPC; disable DB autosave (keep draft backup) | Med | No |
| 5 | Conflict UI (reload/merge on 40001) | Low | No |
| 6 | Retire the per-section autosave services once Save covers them | Med | No |

## 7. Test strategy
- **RPC (forced-rollback txn, like D1/D2):** a non-privileged editor is blocked by
  RLS; a payload with `is_verified`/`workflow_status` raises `insufficient_privilege`;
  a stale `p_base_updated_at` raises 40001; a valid Save writes only dirty sections
  and leaves `verified_*` untouched.
- **CMS unit:** dirty-registry → exact payload; Save calls the RPC once; autosave off;
  draft backup round-trips in localStorage; restore prompt on reopen.
- **Regression:** publish/verify still work through their own actions; no section
  silently publishes.

## 8. NEEDS A DECISION (owner)
1. Autosave: confirm "remove DB autosave, keep browser-only draft backup" (Section 5).
2. RPC vs client-ordered-writes for v1 (recommend RPC — Section 3).
3. Conflict UX on stale edition: reload-and-reapply vs side-by-side merge.
Do NOT start building R2.5 until these are answered.
