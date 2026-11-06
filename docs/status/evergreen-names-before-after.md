# Evergreen names — before / after, and what is provably unchanged

**Owner batch 6, Phase Z4.** Companion to
[`supabase/proposed/20261201_evergreen_names_PROPOSAL.sql`](../../supabase/proposed/20261201_evergreen_names_PROPOSAL.sql),
which is **NOT applied**. Every number here came from a read-only query against the live database
on 2026-11-06. Nothing was written.

---

## 1. The change in one sentence

`exams.name` currently carries the year (`… Entrance 2026`); the proposal moves it to
`exam_editions.year`, where it already lives, so the identity stops needing a rename every cycle.
Because the reader-facing H1 is composed as `nameWithYear(name, edition.year)` — which appends the
edition year **only when the name does not already end in one** (`indianexaminfo-frontend`
`lib/seo/keywords.ts:922-927`) — the visible heading is the same string before and after.

## 2. The population, refreshed today

| measure | 2026-10-23 (the old dry-run) | 2026-11-06 (this refresh) |
|---|---:|---:|
| rows whose name ends in a year | 126 | **126** |
| by pillar: entrance-exam | 122 | **122** |
| by pillar: government-exam | 3 | **3** |
| by pillar: govt-vacancy | 1 | **1** |
| by pillar: board-exam / university-exam | 0 / 0 | **0 / 0** |
| rows with no current edition | 0 | **0** |
| `name_year = edition_year` (H1 unchanged) | 126 | **126** |
| `name_year ≠ edition_year` (H1 would change) | 0 | **0** |
| proposed-name collisions in a pillar | 0 | **0** |
| rows with a stored `seo_title` | 124 | **124** |
| rows whose slug carries a year | 2 | **2** |

**What the refresh adds, and why the number the proposal acts on is smaller.** The September
dry-run counted 126 and said "nothing to look at". Three of those 126 are **retire-loser records**
(`cds`, `nda`, `upsc-cms-examination-2026`) — pages that 308 to a winner and that the owner has
frozen. And two of them (`up-ecce-educator`, `utet`) have **no stored `seo_title`**, so their
`<title>` is generated from the name and is the one thing a human should eyeball. So:

| population | rows |
|---|---:|
| match the trailing-year pattern | 126 |
| minus the 3 retire-loser records | 123 |
| minus the 2 rows with no `seo_title` (held back for separate approval) | **121 — what the proposal updates** |

The pre-flight SELECT in the proposal file was run today and returns exactly
`rows_to_change = 121, collisions = 0, edition_missing = 0, reassembly_mismatch = 0`.

## 3. The invariance proof, row by row

The decisive test is not "the year is equal" but "putting it back produces the same bytes":

```
count(*) filter (where proposed_name || ' ' || edition_year <> name)  →  0   (of 126)
count(*) filter (where name !~ ' 20[0-9]{2}$')                        →  0   (the year is always space-separated)
```

So for every row, `after_name || ' ' || edition_year` **is** the current name. Sample (first five
per pillar, alphabetically):

| pillar | slug | name before | name after | edition year | H1 after = H1 before? | seo_title stored? |
|---|---|---|---|---:|:---:|:---:|
| entrance-exam | `aiapget` | All India AYUSH Post Graduate Entrance Test 2026 | All India AYUSH Post Graduate Entrance Test | 2026 | yes | yes |
| entrance-exam | `afcat` | Air Force Common Admission Test 2026 | Air Force Common Admission Test | 2026 | yes | yes |
| entrance-exam | `aiims-nursing` | AIIMS B.Sc and M.Sc Nursing Entrance 2026 | AIIMS B.Sc and M.Sc Nursing Entrance | 2026 | yes | yes |
| entrance-exam | `amu-entrance` | Aligarh Muslim University Entrance 2026 | Aligarh Muslim University Entrance | 2026 | yes | yes |
| entrance-exam | `atma` | AIMS Test for Management Admissions 2026 | AIMS Test for Management Admissions | 2026 | yes | yes |
| government-exam | `aiims-norcet-11th-nursing-officier-recruitment-2026` | AIIMS NORCET 11th Nursing Officer Recruitment 2026 | AIIMS NORCET 11th Nursing Officer Recruitment | 2026 | yes | yes |
| government-exam | `utet` | Uttarakhand Teacher Eligibility Test (UTET) 2026 | Uttarakhand Teacher Eligibility Test (UTET) | 2026 | yes | **no — held back** |
| govt-vacancy | `up-ecce-educator` | UP ECCE Educator Vacancy 2026 | UP ECCE Educator Vacancy | 2026 | yes | **no — held back** |

## 4. What does not change, stated per surface

| surface | changes? | why |
|---|---|---|
| URL / slug | **no** | the proposal never touches `slug`; `redirect_needed` is 'no' for every row |
| H1 on the exam page | **no** | `nameWithYear` reassembly is byte-identical (proved above) |
| `<title>` | **no** for 121 of 123; the 2 rows without `seo_title` are held back | a stored `seo_title` is used literally and is not rewritten |
| `seo_description` | **no** | not in the UPDATE |
| edition list / year chips | **no** | `exam_editions.year`, `edition_label`, `important_dates` untouched |
| sitemap | **no** | URLs unchanged; `lastmod` comes from content dates, and `updated_at` does move — see the honest note below |
| structured data | **no** | built from the same composed name |
| CMS search / breadcrumb text | **cosmetically** | the rail and lists show the identity without the year, which is the point |

**The honest caveat:** the UPDATE moves `exams.updated_at` (and `updated_by`) on 121 rows. Where a
`lastmod` or a "last updated" signal is derived from `updated_at`, that date will move even though
no fact changed. `app/sitemap.ts` uses the trustworthy-date rule (`examTrustworthyIso`), so the
sitemap is not affected, but the on-page freshness signal in some templates may show the new date.
If that matters, apply the change in one batch and accept the stamp, rather than spreading it over
weeks.

## 5. Records that must be left alone

| slug | why it is excluded |
|---|---|
| `upsssc-pet-notification` | the live PET record — owner standing rule, excluded by name in the WHERE clause |
| `cds`, `nda`, `nta-ugc-net`, `rpf-constable-si-recruitment`, `upsc-cms-examination-2026` | the five retire-loser records; three of them match the year pattern and would otherwise be swept up |
| any `slug like 'zz-test%'` | reference rows |
| `up-ecce-educator`, `utet` | no stored `seo_title` → their `<title>` is generated from the name; listed for a human look, excluded from this proposal until approved separately |

## 6. Verifying it after applying

```bash
node scripts/evergreen-names-verify.mjs            # against the live database, read-only
node scripts/evergreen-names-verify.mjs --base https://www.indianexaminfo.com   # also checks 6 real H1s
```

It re-runs the invariance arithmetic, counts the rows still carrying a year, confirms the excluded
records are untouched, and — when a base URL is given — fetches a sample of exam pages and checks
the H1 text still ends with the edition year it had before.

## 7. What the owner has to say

`APPLY EVERGREEN` to run the proposal as written (121 rows). Say "include the two" if you also
want `up-ecce-educator` and `utet` (123 rows). Until then this stays a file in
`supabase/proposed/`, and the December target you set is unmet by design, not by omission.
