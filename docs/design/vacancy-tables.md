# Vacancy tables — the merge question

Status: design only, nothing built. Numbers are from live queries on
project `cwbhhcqsrbuoybeaondk`, run 2026-09-28. GSC from
`docs/seo/gsc-pages-2026-09-27.csv`. Owner reviews before anything is coded.

## 1. The two sets, what each is

Government vacancy content lives in two tables that share one URL namespace.

| | `sarkari_naukri` | `exams` where `pillar = 'govt-vacancy'` |
|---|---|---|
| Rows | 361 | 100 |
| Composition | direct 301 + exam 60; **all** `source_table = 'cms_results'` (seeded) | **all** `entity_type = 'recruitment'`, **all** `is_published` |
| Columns | 64 | 41 |
| Employer field | `organization` (+ `organization_hindi`) | `conducting_body` |
| Name field | `title` (+ `title_hindi`) | `name` / `short_name` |
| Geography | `state` + `district` + `department` | `region` (21 distinct values, all 100 set) |
| Taxonomy | free-text `category` | `category_id` / `subcategory_id` (FKs, all 100 set) |
| Dates | 11 explicit date columns (see §4) | none on the row; live in `exam_editions.important_dates` (jsonb) |
| Links | per-stage URL columns (`application_url`, `result_url`, …) | none on the row; `official_website`, `canonical_url` |
| Cycle machinery | none | `current_edition_id`, `cycle_frequency`, editions, content-type sub-pages |

Both render under `/sarkari-naukri/…`. Which one answers a URL is decided by
segment depth and precedence in the catch-all
`app/(public)/sarkari-naukri/[...segments]/page.tsx`:

- **depth 1** `/sarkari-naukri/{slug}` → `sarkari_naukri` row first
  (`SarkariNaukriDetailView`). Only if no such row: falls back to `exams`
  (301 to `{category}/{slug}` when a category exists) or a category listing.
- **depth 2** `/sarkari-naukri/{category}/{slug}` → `exams` entity
  (`EntityDetailPage`), served pillars `{sarkari-naukri, government-exam, govt-vacancy}`.
- **depth 3** `/{category}/{slug}/{contentType|year}` → `exams` content-type or edition page.

So today `sarkari_naukri` owns the flat one-pager; `exams govt-vacancy` owns the
category-scoped multi-page entity.

## 2. Overlap

Normalised comparisons across the two sets (slug exact; title/`name` folded to
`[a-z0-9]`; `organization` vs `conducting_body` folded):

| Key | Matches |
|---|---|
| slug | **0** |
| normalised title = normalised name | **0** |
| normalised title + state/region + org | **0** |
| distinct employers appearing in both tables | 5 |

The two sets describe **different vacancies**. They only share a handful of
employers (e.g. the same board posts a recurring exam drive in `exams` and a
one-off Group-D recruitment in `sarkari_naukri`). There is no duplicate-row
dedup problem to solve — "merge" here is a modelling decision, not a cleanup.

## 3. URL shapes and GSC clicks

From `gsc-pages-2026-09-27.csv`, attributed by final path segment against each
table's slug set:

| Set | URL shape | Pages in export | With clicks | Clicks | Impressions | Top page |
|---|---|---|---|---|---|---|
| `sarkari_naukri` | `/sarkari-naukri/{slug}` | 58 | 36 | **678** | 19,435 | `up-swasthya-vibhag-ambulance-driver-2026` — 186 |
| `exams govt-vacancy` | `/sarkari-naukri/{category}/{slug}` (flat fallback) | 1 | 1 | **1** | 1 | `up-swasthya-vibhag-2026` — 1 |
| other `/sarkari-naukri/*` | hubs, tabs, unmatched | 22 | — | 7 | — | — |

`/sarkari-naukri/{slug}` carries essentially all vacancy search demand
(678 clicks); the `exams`-backed vacancy pages are traffic-negligible today
(1 click). The hard constraint below exists because of this asymmetry.

## 4. Fields each has that the other lacks

`sarkari_naukri` only (concrete, single-shot vacancy facts):
`vacancy_count`, `total_candidates`, `pay_scale`, `age_limit`, `application_fee`,
`eligibility`, `cutoff_marks`, `pass_percentage`, `joining_details`, `exam_mode`,
`recruitment_type`, `walk_in_venue`; explicit dates
`notification_date`, `application_start_date`, `application_end_date`,
`admit_card_date`, `exam_date`, `result_date`, `merit_list_date`,
`answer_key_date`, `interview_date`, `document_verification_date`, `walk_in_date`;
per-stage URLs `application_url`, `official_notification_url`, `admit_card_url`,
`result_url`, `merit_list_url`, `answer_key_url`, `alternate_links`;
`state`, `district`, `department`; Hindi fields `title_hindi`,
`description_hindi`, `organization_hindi`; flags `is_new`, `is_urgent`, `status`;
provenance `source_id`, `source_table`.

`exams` only (cycle + editorial machinery):
`pillar`, `entity_type`, `current_edition_id`, `cycle_frequency`,
`academic_year`, `semester`, `admission_to`, `category_id`, `subcategory_id`,
`selection_model`, `selection_process`, `syllabus_weightage_type`, `faqs`,
`ai_metadata`, `canonical_url`, `official_website`, `name`, `short_name`,
`conducting_body`, `region`, `is_published`, `scheduled_at`,
`locked_at`/`locked_by` (edit lock). Dates and per-stage content hang off
`exam_editions` (typed `important_dates`) and `content_post`, not the row.

Net: the vacancy-specific columns the reader actually wants (count, pay,
application link, result link) exist **only** in `sarkari_naukri`; the
edition/stage framework exists **only** in `exams`. Neither can absorb the
other's columns without schema work.

## 5. Every surface reading each table

`sarkari_naukri`:
- Frontend: `/sarkari-naukri/[...segments]` depth-1 detail
  (`SarkariNaukriDetailView`, `SarkariNaukriContentTypeView`);
  `SarkariNaukriList` + `sortRecruitmentsOpenFirst` in category listings and the
  homepage "latest jobs" blocks; `/sarkari-naukri/bharti`, `/state/[state]`,
  `/department/[dept]`, `/exam` hub routes.
- CMS: `src/pages/sarkari-naukri/SarkariNaukriListPage.tsx`,
  `SarkariNaukriEditPage.tsx` (the Verify action from M3);
  `src/pages/sarkari-bharti/SarkariBhartiListPage.tsx`.
- Service: `sarkariNaukriService` (both repos).

`exams govt-vacancy`:
- Frontend: `/sarkari-naukri/[...segments]` depth-2/3 → `EntityDetailPage`,
  `ExamListRow`, edition dispatch, content-type pages.
- CMS: `src/pages/govt-exam/GovtExamListPage.tsx`, `GovtExamEditorPage.tsx`;
  the generic Exam Manager `exams/ExamsListPage.tsx` / `ExamEditorPage.tsx`;
  `entities/EntityEditorPage.tsx`.
- Service: `examService` (`getExamBySlug`, `getRelatedExams`, …).

## 6. Options

Hard constraint (applies to every option): **every
`/sarkari-naukri/{slug}` URL with clicks keeps working in one hop** — i.e. the
678-click flat pages must resolve with at most a single 301, never a 404 and
never a redirect chain.

### A. Merge into `exams` (vacancies become exam entities)
- What: move the 361 `sarkari_naukri` rows into `exams` as `govt-vacancy`.
- Migration cost: **high**. Every vacancy column (§4) needs a home — either ~40
  new `exams` columns (defeats the pillar abstraction) or a `vacancy_edition`
  side table keyed by edition. Seeded rows have no `category` FK, so all 361
  need taxonomy backfill. Rebuild detail/content-type renderers to read the side
  table.
- URL risk: **high**. `exams` render at `{category}/{slug}`, but the traffic is
  on flat `{slug}`. Must keep a permanent flat-slug route or ship 301
  `{slug} → {category}/{slug}` for 58+ pages while preserving the depth-1
  precedence that currently *prefers* `sarkari_naukri`. Regression surface is the
  entire 678-click set.
- Upside: one model, vacancies gain editions + staged content pages.

### B. Merge into `sarkari_naukri` (exams vacancies become job rows)
- What: move the 100 `govt-vacancy` exams into `sarkari_naukri`.
- Migration cost: **medium**. Map `name→title`, `conducting_body→organization`,
  `region→state`; drop/leave-behind edition machinery. Losing editions/content-
  type pages for those 100 is the design tax.
- URL risk: **low**. Only 1 indexed `exams` vacancy page; a single 301 to the
  flat slug covers it. The 678-click flat pages never move.
- Upside: one table, cheapest data move; downside: discards `exams` power for
  recurring drives.

### C. Keep both, distinct roles (recommended)
- Boundary: `sarkari_naukri` = **one-shot vacancy notice** — a single
  recruitment with a start/end and a result; the reader wants one page with the
  apply/result links (what all 678 clicks are). `exams govt-vacancy` =
  **recurring drive** — a multi-edition recruitment/exam programme (SSC, Railways
  cycle) that earns per-year editions and admit-card/result/answer-key
  sub-pages. Decide by: has editions / repeats on a cycle → `exams`; a lone
  notification with a closing date → `sarkari_naukri`.
- Work is not a data move: it is (1) codifying that rule so new content lands in
  the right table, (2) a **shared read view** so listings/homepage can show both
  without UNION-ing in app code, (3) keeping the two depth-based routes as the
  contract.
- Migration cost: **low** (a view + a creation rule; optionally a `pillar`
  guard). URL risk: **none** — every URL stays put.

## 7. Recommendation

**Option C.** The data does not support a merge: 0 slug and 0 title overlap
means these are different vacancies, and all the search demand (678 clicks) sits
on `sarkari_naukri`'s flat one-pagers while the `exams`-backed vacancy pages are
traffic-negligible (1 click). Merging either way spends the URL budget (§6 A/B)
to unify two shapes that serve different jobs. Instead:

1. Document and enforce the boundary rule (editions/cycle → `exams`; single
   notice → `sarkari_naukri`) at creation time in the CMS.
2. Add one `vacancy` read view (or a thin service) that unions the public
   fields both need for listings, so no surface hand-stitches two tables.
3. Revisit Option A only if product decides vacancies must gain editions and
   staged content pages — at which point the migration and URL plan in §6 A is
   the starting cost.

Do nothing to the 678-click URLs in any option; the one-hop constraint is
satisfied trivially by C and must be explicitly engineered in A.
