# Raw measurement evidence — product & UX investigation (2026-09-28)

Companion to [`../product-ux-investigation.md`](../product-ux-investigation.md).
Nothing in this folder is prose for the owner; it exists so **every number in the
report can be re-taken**. All measurements were read-only. No query here writes;
the `set role anon` probe ran inside a transaction that was not used for any DDL.

Two notes on method, because they affect how the numbers should be read:

1. **Screenshots were impossible this session.** `take_screenshot` returned
   `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE … viewport=500x591, visible=false,
   visibilityState=hidden` on every attempt. All page evidence below is therefore
   DOM measurement (`getBoundingClientRect`, `innerText`, `transferSize`, parsed
   JSON-LD), which is re-takeable and does not depend on pixels.
2. **The live viewport was 500 × 591, not 360 × 800.** The site's first Tailwind
   breakpoint is `sm` = 640px, so 500px already renders the mobile single-column
   layout; vertical positions are the mobile layout's. Font-size and target-size
   numbers are in CSS px and therefore viewport-independent for this purpose.

---

## 1. GSC page export (`docs/seo/gsc-pages-2026-09-27.csv`, 315 rows)

Reproduce with PowerShell (the repo has no Node CSV helper for this):

```powershell
$p = Import-Csv docs/seo/gsc-pages-2026-09-27.csv
$p | Measure-Object -Property Clicks -Sum      # 315 pages, 712 clicks, 27,302 impressions
$fam = $p | Group-Object { ($_.'Page' -split '/')[1] }
$fam | Sort-Object { ($_.Group | Measure-Object Clicks -Sum).Sum } -Descending
```

Family totals reported in §1.1: `/sarkari-naukri` 81 pages · 686 clicks · 20,716 imp ·
pos 15.9; homepage 15 · 1,666; `/entrance-exam` 200 · 10 · 3,648 · 36.8;
`/board-exam` 14 · 1 · 626; `/government-exam` 9 · 0 · 460; `/university-exam` 7 · 0 · 156.
Single top page: `up-swasthya-vibhag-ambulance-driver-2026` = 186 clicks / 2,786 imp / pos 4.98.
Zero-click pages with ≥100 imp: 16 pages, 2,945 imp total.

**The queries file the brief cites does not exist.** `docs/seo/` contains only
`gsc-crawl-2026-09-27.csv` (315 rows), `gsc-pages-2026-09-27.csv` (315 rows),
`vacancy-date-candidates.csv`. The 869-row `seo-keywords-1000.csv` at the repo root is a
generated template (columns `keyword,pattern_category,stream,city_state,intent,priority`;
first rows `top engineering colleges in delhi 2027` …) and was **not** used for any naming claim.

---

## 2. Live DOM probes (verbatim JSON returns)

### 2.1 Vacancy page — `/sarkari-naukri/up-swasthya-vibhag-ambulance-driver-2026`

Element y-offsets at viewport 500 × 591 (`getBoundingClientRect().top + scrollY`):

```
header strip 0–117 · breadcrumb 117 · H1 279 · Hindi line 351 ·
unverified notice 427 · H2 "Quick Information" 540 · H2 "Important Dates" 727 (empty) ·
H2 "Important Links" 790 (empty) · H2 "Details" 885 · H2 "Related" 1374
```

Payload / structure (§2.5 table, §10.8 O1):

```
HTML 185 KB uncompressed · total resources 430 KB over 19 requests ·
<script src> 6 · inline <script> 19 (25 script elements; an earlier probe on the same page counted 24 <script> elements — the difference is one inline block, not a change in payload)
`<img>` 1 (favicon.svg only)
cold TTFB 1,573 ms · warm TTFB 185 ms
main.innerText word count 132
hasJobPosting: false (both vacancy pages sampled) — breadcrumb/contact/entrypoint/image/
listitem/organization/searchaction/website emitted (6 blocks); CAT page 8 incl. FAQPage
```

`main.innerText`, verbatim (the full visible text of the site's most-visited page):

```
UP Health Department 108 Ambulance Driver 2026 – 1,200 Posts
Government Vacancies  DATES AWAITED  NEW
यूपी स्वास्थ्य विभाग 108 एम्बुलेंस ड्राइवर 2026
108 Ambulance Service UP · Uttar Pradesh · Driver
यह जानकारी अभी आधिकारिक अधिसूचना से सत्यापित नहीं है…
This information has not yet been verified against the official notification…
Quick Information
  Organization        108 Ambulance Service UP
  Department          108 Ambulance Service UP
  Total Candidates    35,000
Important Dates
Important Links
Details
  1,200 Ambulance Driver posts for 108 Emergency Service across all districts.
  Eligibility: 10th + LMV/HMV + 3yr driving, Age 21-40
  Salary: ₹15,000-22,000/month
RELATED: More jobs in uttar pradesh · More Driver Recruitment · All Government Jobs
```

### 2.2 Accessibility probe (same page)

Static parse (`DOMParser`, then **all `script`/`style`/`noscript`/`template` removed before counting**):

```json
{"lang":"en-IN","h1count":1,"hasSkipLink":true,
 "headings":["H1:UP Health Department 108 Ambulance…","H2:Quick Information","H2:Important Dates",
             "H2:Important Links","H2:Details","H3:Eligibility: 10th + LMV/HMV…","H3:Salary: ₹15,000-22,000/month",
             "H2:Related","H3:Government Jobs","H3:Entrance & Board","H3:Resources","H3:Company"],
 "tables":2,"thCount":0,"thsWithScope":0,
 "buttons":1,"btnLabels":["Toggle menu"],
 "linksCount":46,"linksNoText":0,"targetBlankNoRel":0,
 "imgsCount":1,"imgsNoAlt":0,
 "mainLandmarks":2,"navLandmarks":2,"ariaLive":1,
 "devanagariVisible":true,"hindiLangMarks":0}
```

Live layout probe (viewport 500 × 591):

```json
{"bodyFont":"16px","bodyLineHeight":"24px",
 "textNodeSizes":{"9":1,"10":1,"12":2,"14":26,"16":2},"nodesUnder13px":4,
 "tapablesMeasured":35,"tapablesUnder44px":35,
 "smallestTapables":[{"t":"SSC Jobs","h":15,"w":55},{"t":"Banking Jobs","h":15,"w":77},
                     {"t":"Railway Jobs","h":15,"w":74},{"t":"Defence Jobs","h":15,"w":79},
                     {"t":"State Jobs","h":15,"w":60},{"t":"All Govt Jobs","h":15,"w":75}],
 "footerCount":28,"footerHeights":[32,32,32,32,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,16,16,16,16],
 "headerLinks":[{"t":"IndianExamInfo","h":36,"w":36},{"t":"Search","h":34,"w":34}]}
```

Not claimed: whether the footer cluster also fails SC 2.5.8's *Spacing* exception. My
gap arithmetic mixed links from different footer columns, so the negative gaps it printed
are an artefact of that grouping, not a measurement. The **height** finding stands on its own.

Third-party / analytics probe:

```json
{"totalScripts":6,"thirdParty":[],"analyticsGlobals":[]}
```
(searched `window` for `gtag|dataLayer|ga|umami|plausible|clarity|hotjar|fbq|msclk|adsbygoogle`)

### 2.3 Empty hubs — `<main>` verbatim, all `index, follow`, all self-canonical, all footer-linked

```
/results          "Last Updated: 28/9/2026 · 0 exams with results"        414 chars · 2 links in main (both "Home")
/admit-card       "0 exams with admit cards"                               576 chars · 9 links
/answer-key       "Practice … for 0+ exams"                                419 · 2
/date-sheet       "0+ exams"                                               412 · 2
/syllabus         "0+ exams"                                               406 · 2
/previous-papers  (no count, no content)                                   426 · 2
/study-material   "0+ exams"                                               445 · 2
/mock-test        "Practice free online mock tests for 0+ exams"            402 · 2
/search           "Type at least 2 characters to search" + 4 cat links     362 · 6 · canonical → "/" · noindex
```

### 2.4 HTTP status sweep (22 nav/footer targets)

```
200  every nav + footer destination, incl. /blog /news /about /contact /disclaimer /privacy-policy
307  /government-exam , /govt-vacancy
308  /entrance-exam  →  /admission/…
404-class  /sarkari-result , /sarkari-results , /latest-jobs
         proof: identical "connection closed unexpectedly" as the control
         /totally-fake-page-xyz, so these are not 3xx, they are unreachable
```

### 2.5 Other pages measured

```
/                       616 KB HTML · visible mobile text 5,246 chars · document height 6,138 px ≈ 10.4 screens
                        fold(800px) = 2 carousels + pillar tabs · "Quick access" at y=1063 · both carousels
                        present twice in HTML (hidden sm:block desktop twins) · H1 "IndianExamInfo — India's
                        Most Trusted Exam Information Portal"
/sarkari-naukri         "361 active listings" · tabs All(361) / Government Exams(60) / Government Vacancies(301)
/sarkari-naukri/state/bihar   200 · 286 KB · 1,122 ms · "17 exams · 33 vacancies in Bihar"
/admission/management/cat     231 KB · 492 words · "Registration Opens 3 Aug 2026" + "Registration Closes 3 Aug 2026"
                              FAQPage: {faqCount:15, withVisibleText:0}
/board-exam/state/cbse/cbse-class-12  206 KB · 163 words · alerts block "Get instant alerts — … Telegram · WhatsApp"
/about 175 words · /disclaimer 195 · /privacy-policy 218 · /contact 42 words (scripts removed, then counted)
/about verbatim, its "Editorial Policy" section (the claim that contradicts is_verified 0/361):
  "All information on IndianExamInfo is sourced directly from official exam body websites.
   We verify dates and notifications before publishing."
/about also: "operated by IndianExamInfo Media Pvt Ltd, based in New Delhi" (no person named),
  "helping millions of students" (vs 712 clicks measured in the GSC period)
/contact form: action="(none)" · inputs [name, email, subject, message, BUTTON] · mailto: links on 4 pages = 0
Alert links present: header ×2 (aria-label "Join WhatsApp Channel", y=10) + footer ×2 on every page —
  t.me/indianexaminfo and whatsapp.com/channel/0029Vb… ; per-record alerts do not exist
```

---

## 3. Live SQL (read-only, project `cwbhhcqsrbuoybeaondk`)

### 3.1 Fill rates, `sarkari_naukri` (60 columns, 361 rows, 361 published)

```sql
select count(*) total,
       count(title) t, count(title_hindi) th, count(org_hindi) oh, count(state) st,
       count(category) cat, count(description) descr, count(tags) tg,
       count(result_date) rd, count(result_url) ru, count(total_candidates) tc,
       count(cutoff_marks) cm, count(pass_percentage) pp,
       count(vacancy_count) vc, count(eligibility) el, count(age_limit) al,
       count(pay_scale) ps, count(application_fee) fee, count(notification_date) nd,
       count(application_start_date) as_, count(application_end_date) ae,
       count(application_url) au, count(official_notification_url) onu,
       count(exam_date) xd, count(district) dist, count(description_hindi) dh,
       count(seo_title) seot, count(is_verified) iv, count(created_by) cb
from sarkari_naukri;
```

Filled: title 361 · title_hindi 361 · org_hindi 361 · department 361 · state 361 · category 361 ·
description 361 · tags 361 · content_source 361 · result_date 361 · result_url 274 ·
total_candidates 361 · cutoff 60 · pass% 60.
**NULL on 361/361:** vacancy_count, eligibility, age_limit, pay_scale, application_fee,
notification_date, application_start/end_date, application_url, official_notification_url,
exam_date, admit_card_*, answer_key_*, exam_mode, district, description_hindi, seo_title,
seo_description, search_keywords, is_verified, verified_at, created_by, alternate_links,
image_id, merit/interview/doc-verification/walk-in.

```sql
select status, count(*) from sarkari_naukri group by 1;
-- completed 300 · result-declared 56 · application-open 5
select recruitment_type, count(*) from sarkari_naukri group by 1;   -- direct 301 · exam 60
select count(*) from sarkari_naukri where slug like '%-result';      -- 60
select count(*) from sarkari_naukri where slug like '%bharti%';      -- 93
-- titles containing a post count 281/361 · a year 361/361 · the org name 57/361
select state, count(*) from sarkari_naukri group by 1 order by 2 desc;
-- uttar-pradesh 87 · (all-india) 71 · rajasthan 45 · bihar 33 · madhya-pradesh 31 · maharashtra 22 · 21 distinct
-- every state value valid against regions (37 rows: national / state / ut)
```

The 5 `application-open` rows, verbatim findings:
`delhi-police-constable-2026-result` and `ssc-gd-constable-2027-result` are result slugs marked open;
`karnataka-anganwadi-2026-mysore` has title "Karnataka High Court Group D Recruitment";
all five have NULL `application_end_date`, NULL `application_url`, NULL `vacancy_count`.

### 3.2 Attribution and activity

```sql
select table_name, updated_by, count(*) from (
  select 'sarkari_naukri' table_name, updated_by, updated_at from sarkari_naukri union all
  select 'exams', updated_by, updated_at from exams union all
  select 'exam_editions', updated_by, updated_at from exam_editions union all
  select 'content_posts', updated_by, updated_at from content_posts union all
  select 'blog_posts', updated_by, updated_at from blog_posts) x
group by 1,2 having updated_by is not null;
-- exams 2 · exam_editions 3 · everything else 0  → 5 human-attributed edits ever
select date(updated_at) d, count(*) from sarkari_naukri group by 1 order by 1 desc;
-- 2026-09-28 ×87 (all updated_by NULL = migration P1d, count matches the backup table exactly)
-- 2026-09-19 ×1 · 2026-07-31 ×273 (the bulk import)
```

### 3.3 Exams, editions, dates

```sql
select pillar, entity_type, count(*) from exams group by 1,2;
-- entrance-exam/exam 123 · government-exam/recruitment 104 · govt-vacancy/recruitment 100
-- board-exam/board 38 · university-exam/university-exam 27 · entrance-exam/university-admission 4  (= 396)
select count(*) from exams where verified;        -- 0 on every pillar
-- editions: eligibility 100% · application_fee 100% (CAT = {}) · age_limit 0%
-- faqs 4/4/2/1/0 per pillar · content_modules 9/100/100/38/27
select coalesce(d->>'type','(no type key)') t, count(*)
from exam_editions e, jsonb_array_elements(e.important_dates) d group by 1 order by 2 desc;
-- exam_written 224 · result 44 · application_end 42 · notification 40 · application_start 39
-- counselling 17 · admit_card 12 · walkin 6 · answer_key 5 · merit_list 2 · interview 2 · exam_correction 1
-- verified_true 0
-- two shapes coexist: typed {date,type,label,state,isUrgent,verified,stage_label} 292 editions
--                   untyped  {date,label,isUrgent}                                 104 editions
```

### 3.4 AI path and settings (values never printed — only lengths and prefixes)

```sql
select provider, model, priority, enabled, usage_count, last_used_at,
       octet_length(api_key) klen, left(api_key,4) kpre, octet_length(api_key_encrypted) elen
from ai_providers;
-- groq openai/gpt-oss-120b p1 enabled usage 0 last_used NULL  len 56 "gsk_" enc 0
-- groq llama-3.3-70b-versatile p2 enabled usage 0 …           enc 0
select count(*) from ai_request_logs;                 -- 0
select name, is_sensitive, octet_length(value) from settings
 where name in ('gemini_api_key','ai_fallback_key');
-- gemini_api_key  sensitive=true  58
-- ai_fallback_key sensitive=false 58      ← readable by the anon policy
```

Anon-role proof (single transaction, read-only):

```sql
set local role anon;
select count(*) rows_visible_to_anon,
       bool_or(case when name='ai_fallback_key' then true else false end) fallback_key_visible,
       bool_or(case when name='gemini_api_key'  then true else false end) primary_key_hidden
from settings;
-- {"rows_visible_to_anon":23,"fallback_key_visible":true,"primary_key_hidden":true}
```

### 3.5 R0 gate re-check (all pass)

```
broken_result_urls_backup_20260928 rows 87 · of those ids still holding a result_url 0
backup table relrowsecurity true · policies 0
page_traffic exists (migration 20260928042556) · RLS on · policies 3 · DELETE policies 0 · rows 0
schema_migrations holds 20260927204352
remote migrations 174 = local files 174 · asymmetric 0
bulletin_signals / bulletin_editor_state absent (correct — still in supabase/proposed/)
```

### 3.6 Table / feature inventory used in §10

```sql
select (select count(*) from blog_posts)      -- 12
      ,(select count(*) from content_posts)   -- 112
      ,(select count(*) from ad_zones)        -- 6
      ,(select count(*) from ad_campaigns)    -- 0
      ,(select count(*) from ad_creatives)    -- 0
      ,(select count(*) from advertisers)     -- 0
      ,(select count(*) from ad_reports)      -- 0
      ,(select count(*) from entity_download) -- 0
      ,(select count(*) from audit_log)       -- 0
      ,(select count(*) from page_traffic)    -- 0
      ,(select count(*) from pg_extension where extname='pg_cron');  -- 0  (not installed)
select count(*) from information_schema.tables
 where table_schema='public' and table_name='conducting_bodies';     -- 0  (relation does not exist)
-- regions 37 rows
```

Repo-side greps behind §10:

| Claim | Command | Result |
|---|---|---|
| No writer for `page_traffic` on the public site | `grep -r page_traffic indianexaminfo-frontend` | 0 matches |
| RSS excludes jobs | read `app/api/feed/route.ts` | sources = `getAllBlogPosts()`, `getLatestContentPosts()` only |
| No contact endpoint | `Glob app/api/**/route.ts` | `ads/[position]`, `feed`, `feed/atom`, `revalidate`, `search` |
| Contact form is inert | read `app/(public)/contact/page.tsx:17,40–66` | server component, `<form>` with no action/method/handler |
| No service worker | `Get-ChildItem -Include sw.js,*.webmanifest -Recurse app,public` | none |
| Manifest shape | read `app/manifest.ts` | `display: standalone`, SVG-only icons, `lang: en-IN`, no `shortcuts` |
| Vacancy editor cannot reach 34 columns | case-insensitive search for hindi, district, applicationFee, ageLimit, payScale, seo, tags, cutoff, passPercentage, walkIn, examMode, image inside `SarkariNaukriEditPage.tsx` | 0 occurrences |
| No AI in the vacancy editor | search for `AIFill` and `AI ` in `SarkariNaukriEditPage.tsx` | 0 |
| Five nav entries, one editor | read `src/router/index.tsx` | `/entrance-exams`, `/govt-vacancy`, `/sarkari-bharti`, `/board-exams`, `/university-exams` → `EntranceExamEditorPage` |
| No edition UI | `grep edition src/router/index.tsx` (60 paths) | 0 |
| CMS surface size | counts of `Sidebar.tsx` items / router paths / `moduleRegistry.ts` modules | 23 / 60 / 28 modules, 288 labels |

---

## 4. Sources cited by the report

| Source | Used for |
|---|---|
| [Google — JobPosting structured data](https://developers.google.com/search/docs/appearance/structured-data/job-posting) | required properties (`datePosted`, `description`, `hiringOrganization`, `jobLocation`, `title`), `validThrough`, disallowance of expired postings / postings with no way to apply / pages that "spam the page with obstructive text and images, excessive and distracting ads", and "don't put dates, company names, job codes in the title" |
| [Google — structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) | "Don't mark up content that is not visible to readers" → the FAQPage finding |
| [Google — spam policies](https://developers.google.com/search/docs/essentials/spam-policies) | misleading auto-generated content → the "do not machine-translate bodies" recommendation |
| [W3C — Understanding SC 2.5.8 Target Size (Minimum), WCAG 2.2, Level AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | the 24×24 CSS px minimum against which the measured 15–16 px footer targets were judged |
| [DataReportal — Digital 2026: India](https://datareportal.com/reports/digital-2026-india) | 1.03 B internet users / ~70% penetration; Ookla median mobile +35.39 Mbps (+36.7%) to Aug 2025 → why the diagnosis is JS weight, not network |
| [FreeJobAlert](https://www.freejobalert.com/) + [Google Play listing](https://play.google.com/store/apps/details?id=com.freejobalert) | category-installed naming ("most trusted Sarkari Naukri portal since 2011", daily alerts, admit cards) |
| [Srivastava & Kapania, CSCW 2021 (ACM 10.1145/3449210)](https://dl.acm.org/doi/10.1145/3449210), [Microsoft Research India](https://www.microsoft.com/en-us/research/publication/designing-mobile-interfaces-for-novice-and-low-literacy-users/), [interface-design guidelines literature review](https://www.researchgate.net/publication/370383746_Interface_design_guidelines_for_low_literate_users_a_literature_review) | low-literacy mobile UI: minimal screens, recognition over recall, literal short labels |
| [BBC — WhatsApp forwards limited to five chats](https://www.bbc.com/news/technology-46945642), [DW on WhatsApp misinformation](https://www.dw.com/) | forwarding is the distribution channel, and the reason a share card must carry the expiry date |
| [Statista — social media usage in India](https://www.statista.com/topics/5113/social-media-usage-in-india/) | WhatsApp's position in the Indian stack |
| [Wellows](https://wellows.com/blog/google-ai-overviews-ranking-factors/) / [Stackmatix](https://www.stackmatix.com/blog/optimizing-faq-schema-google-ai-overviews) / [Frase](https://www.frase.io/blog/faq-schema-ai-search-geo-aeo) | AI-Overview citation-rate claims — **marked vendor research in §2.6, not used as load-bearing evidence** |

**inferred**, never measured, and flagged where used: low-literacy *benefit* of each proposed
simplification; the cyber-café/print behaviour behind §10 O2; email-vs-WhatsApp preference in §10 AL2;
the legal frame in §10 T6; "competitor sites have no verification state" in §2.6.
