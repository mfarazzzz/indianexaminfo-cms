# Filling the 361 vacancy rows — the owner's workflow

Owner batch 7, Phase C2. Written 2026-11-06 against the live database and the code as it
stands in the CMS working tree.

## Why this document exists

`docs/status/backlog-refresh-2026-11.md` already recorded that the 361 `sarkari_naukri` rows
carry no structured dates and no official links. Re-measured today, with the exact numbers
that decide what the public pages can and cannot show:

| what the page needs | rows that have it (of 361) |
|---|---|
| `notification_date` | 0 |
| `application_start_date` | 0 |
| `application_end_date` (the "last date") | 0 |
| `official_notification_url` | 0 |
| `application_url` | 0 |
| `verified_at` | 0 |
| `vacancy_count` | 0 |
| title / organisation / state / description | 361 |
| published (`workflow_status`) | 361 |

Consequences, all measured rather than inferred:

- The reader's **Important Dates** table (`SarkariNaukriDetailView.tsx:121-131`) renders one
  row per date that exists. With no dates it renders none of them, and the status badge says
  **"Dates Awaited"** (`lib/sarkari/deriveStatus.ts:38`).
- **JobPosting** markup is emitted by `buildSarkariJobPostingSchema`
  (`lib/seo/structured-data.ts:210-227`) only when five conditions hold — window open today,
  `notification_date`, `application_end_date`, `verified_at`, `official_notification_url`.
  `jobposting_ready_today = 0` rows qualify. This is the code path behind the owner's
  observation that the "Job listing / Job details" search appearance disappeared.
- Verification cannot be granted first and dates added later: `trg_sarkari_verify` refuses
  verification without an `application_end_date` **and** an http(s)
  `official_notification_url`, and it **voids** `verified_at` automatically when any of those
  four gated fields later changes. So the order is always **fill, then verify** — and a bulk
  import that moves a gated date on a verified row silently un-verifies it (the importer
  warns about exactly that, per row).

## The workflow, in three steps

### 1 · Export (CMS → "Vacancy listings" → *Bulk fill dates and links* → Export sheet)

You get `sarkari-naukri-fill-<date>.xlsx`, one row per vacancy, with:

- `id` — **do not touch**; the import matches on it and on nothing else;
- `slug`, `title`, `organization`, `state`, `recruitment_type`, `workflow_status`,
  `verified_at` — context only, never written back;
- the seven writable columns: `notification_date`, `application_start_date`,
  `application_end_date`, `official_notification_url`, `application_url`, `vacancy_count`,
  `exam_date` — prefilled with whatever the row already holds (today: all blank).

The twenty slugs that carry ~84% of the vacancy impressions in the owner's GSC export are at
the **top of the sheet, in that order**, so the highest-value work is the first screen full.
That list lives in one place — `TOP_VACANCY_SLUGS` in `src/lib/utils/vacancyBulkOps.ts` —
and is pinned by a test at length 20.

### 2 · Fill it in the sheet

One row = one vacancy, from that row's official notice. Rules the importer enforces, so it
is quicker to know them than to be told:

- **Dates**: `YYYY-MM-DD` is what we ask for. `5/11/2026` and a real Excel date cell are
  accepted and *reported* — the preview shows the ISO day it resolved to, so a
  day/month-vs-month/day mistake is visible before anything is written.
- `application_end_date` must be on or after `application_start_date`. A reversed window is a
  **row error**, not a silent fix. (The database also refuses it:
  `sarkari_naukri_app_date_order`.)
- **URLs**: `https://` on a `gov.in` / `nic.in` / `ac.in` style host is accepted silently.
  Any other https host is **allowed but flagged** in the preview — you decide whether it is
  really the notice. Non-URL text, `ftp:` and `javascript:` are row errors.
- **Leave a cell empty to leave the value alone.** An empty cell never clears anything.
- Extra columns in your sheet are ignored, not written.

### 3 · Import (same card → *Choose filled sheet*)

Nothing is written until you press **Apply**, and Apply only exists after a preview:

- the preview lists every row with what it **will write**, what it **skipped and why**
  ("already set — tick \"overwrite\" to replace it", "cell empty — the current value stays"),
  its **warnings** (past last date, non-official host, verification about to be voided) and
  its **errors** (unknown id, unparseable date, reversed window);
- `rows read · N will be written · N blocked with errors · N nothing to change` is shown up
  front, and **Apply is disabled when nothing is writable**;
- the file goes through the same gate as the exam importer —
  `src/lib/utils/spreadsheetUpload.ts` — extension, size (≤ 5 MB), container-vs-name and the
  5,000-row cap are checked before any parsing;
- the write is one `UPDATE ... WHERE id = ?` per row against
  `sarkari_naukri`, only whitelisted columns. **No path in this feature can insert or delete
  a vacancy row**;
- the report after applying separates `updated / refused / nothing to change / database
  failures`, so a partially-failed import cannot read as success.

**Tick "Overwrite values that are already set" only when you mean it.** With it off, the
import can only fill blanks — which is the right default for this corpus, because every
value in it is blank today.

## Then verify, row by row, on the vacancy screen

Verification is a human statement that the data matches the notice, so it is deliberately not
part of the import. On each row's screen the **Vacancy window** card now shows all five
fields plus a live checklist (C2a), and the *Verify against official notification* button is
enabled once the notice link and the last date are present. Verification needs the
`publish_post` permission and stamps `verified_at` with the server clock.

A row becomes eligible for the Google job listing only when it is **verified**, its window is
open on the day the page is rendered, and it has a notification date, a last date and an
official link. Filling dates without verifying therefore restores the reader-facing "last
date" immediately and the search appearance only after verification.

## Where the rules live (so a change is deliberate)

| rule | file |
|---|---|
| the writable column list, the 20 priority slugs, the gate list | `src/lib/utils/vacancyBulkOps.ts` |
| every normalisation, refusal and skip reason | same file, `planVacancyRows()` |
| the write itself (update-by-id only) | same file, `applyVacancyPlans()` |
| preview-before-write, overwrite switch, the report | `src/components/shared/VacancyBulkFill.tsx` |
| file type / size / row caps | `src/lib/utils/spreadsheetUpload.ts` (shared with the exam importer) |
| the five fields and the checklist on the row screen | `src/pages/sarkari-naukri/SarkariNaukriEditPage.tsx` |
| the reader page's dates table and the JobPosting decision | frontend `SarkariNaukriDetailView.tsx`, `lib/seo/structured-data.ts` |
| verification bar and auto-void | database `trg_sarkari_verify` (migration `20260927140000`) |

Tests: `vacancyBulkOps.test.ts` (40), `VacancyBulkFill.test.tsx` (8),
`SarkariNaukriEditPage.window.test.tsx` (6) in this repo;
`SarkariNaukriDetailView.jobposting.test.tsx` (5) in the frontend.

## What is NOT in this feature

- No bulk create, no bulk delete, no bulk archive. Archiving is
  `supabase/proposed/20261201_archive_expired_vacancies_PROPOSAL.sql` and waits for the
  owner's word, because with today's data nothing can be *proven* expired.
- No scraping of official notices and no AI fill in this path. The sheet is filled by a
  human from the notice; the reasons are in `docs/design/verify-mode.md` (Phase B0).
- No change to the JobPosting gate. The gate is what keeps unverified dates away from
  Google; the gap is data, not the rule.
