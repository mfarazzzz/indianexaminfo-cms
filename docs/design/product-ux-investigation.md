# Product & UX Investigation — IndianExamInfo

**Date:** 2026-09-28 (as-of date for every figure below)
**Scope:** public site `https://www.indianexaminfo.com`, CMS `indianexaminfo-cms`, live Supabase project `cwbhhcqsrbuoybeaondk`.
**Mode:** read-only. No code edits, no migrations, no pushes, no AI calls that write to the database.
**Judged through:** the reader (job seeker / student), the content intern, the owner.

---

## 0. Method, and what is missing from the brief

### 0.1 R0 gate (run first, because the push had already landed)

Re-checked live rather than trusting last round's result:

| Check | Required | Measured | Pass |
|---|---|---|---|
| P1d NULL `result_url` | 87 | `broken_result_urls_backup_20260928` = 87 rows; 0 backed-up ids still holding a `result_url` | ✅ |
| Backup table RLS | on, no policies | `relrowsecurity = true`, 0 policies | ✅ |
| `schema_migrations` holds `20260927204352` | yes | present | ✅ |
| `page_traffic` applied as `20260928042556` | yes | present; table exists, RLS on, 3 policies, 0 DELETE policies | ✅ |
| Migration parity | remote = local | 174 remote = 174 local files, 0 asymmetric | ✅ |

No apply failed. `bulletin_signals` and `bulletin_editor_state` are still absent — correct, they remain in `supabase/proposed/`.

### 0.2 The queries file named in the brief does not exist

The brief asks for naming evidence from `docs/seo/gsc-queries-2026-09-27.csv` ("1,000 real queries"). **That file is not in the repository.** `docs/seo/` contains only:

```
gsc-crawl-2026-09-27.csv      80,596 B   315 rows  (redirect/crawl audit)
gsc-pages-2026-09-27.csv      43,985 B   315 rows  (landing pages + clicks/impressions/position)
vacancy-date-candidates.csv   43,761 B
```

The only 1,000-row-ish keyword artefact is `seo-keywords-1000.csv` (869 rows) at the repo root. It is **not** real query data: its first rows are `top engineering colleges in delhi 2027`, `top engineering colleges in mumbai 2027` … a generated matrix with columns `pattern_category,stream,city_state,intent,priority`. Using it as "what readers type" would be using our own template as evidence of our own template. **I did not use it for naming claims.**

Substitutes used, all of which are real:

1. `gsc-pages-2026-09-27.csv` — 315 real landing pages, 712 clicks, 27,302 impressions. Page slugs carry the reader's own words (see §1.1).
2. Live rendered DOM of the site (structure, order, weights, JSON-LD).
3. Live DB fill rates (what actually exists to be shown).
4. Cited external research (§2.6).

**Consequence for the owner:** query-level evidence (what people actually typed) is a gap. It is the one artefact that would settle several naming questions in §2.1 without inference. Getting it is item **#4** in the top-15.

### 0.3 Screenshots could not be captured, and why

Every `take_screenshot` call in this session returned:

```
NATIVE_BROWSER_VIEWPORT_UNAVAILABLE: Native Browser did not become visible with a positive
viewport within 1000ms (viewport=500x591, visible=false, attached=false, cdpAttached=true,
visibilityState=hidden)
```

The IDE's Browser pane is not in the foreground and no tool in the available set can resize or reveal a window. Playwright/Puppeteer are not installed and were not installed (no network install without your say-so).

So this report carries **measured DOM evidence instead of pixels** — element `y`-offsets against a known viewport height, `innerText` word counts, `transferSize` byte sums, cold/warm fetch timings, parsed JSON-LD compared against visible text. For the question "what does the reader see first on a phone", a `y`-offset list is a stronger instrument than a screenshot, because it is a number you can re-take. Where a claim depends on visual appearance rather than position (colour, density, perceived clutter), this report **does not** make that claim.

The live viewport used was **500 × 591**. That matters and is handled honestly: the site is Tailwind, and its first breakpoint is `sm` = 640px, so at 500px the layout is already the single-column mobile layout. Vertical positions are therefore the mobile layout's. The fold is treated at both 591 (measured) and 800 (the brief's target) and the text says which.

Every raw return behind this report — the DOM probes as JSON, the SQL, the status sweep, the repo greps, and the source list — is committed next to it in [`ux-evidence/MEASUREMENTS.md`](ux-evidence/MEASUREMENTS.md), so any number here can be re-taken rather than re-argued.

### 0.4 How to read every number here

- "measured" = taken live this session, reproducible with the query or script quoted.
- "as-of 2026-09-28" = date-sensitive (`current_date` in UTC drives several buckets).
- **inferred** = my reasoning, not a measurement. Used sparingly and always labelled.
- Claims from the earlier rounds of this engagement that I did not re-measure this session are marked *(carried forward, not re-verified)*.

---

## 1. The reader

### 1.1 Who is actually arriving, from the real page data

315 pages, 712 clicks, 27,302 impressions (30-day GSC export, as-of 2026-09-27):

| URL family | pages | clicks | impressions | avg position | share of clicks |
|---|---|---|---|---|---|
| `/sarkari-naukri/*` | 81 | **686** | 20,716 | 15.9 | **96.3%** |
| `/` (homepage) | 2 | 15 | 1,666 | 19.5 | 2.1% |
| `/entrance-exam/*` | 200 | 10 | 3,648 | 36.8 | 1.4% |
| `/board-exam/*` | 14 | 1 | 626 | 35.7 | 0.1% |
| `/government-exam/*` | 9 | 0 | 460 | 42.0 | 0% |
| `/university-exam/*` | 7 | 0 | 156 | 50.7 | 0% |
| `/admit-card`, `/news` | 2 | 0 | 30 | 10–59 | 0% |

The brief says "about 90% of clicks land on vacancy pages". Measured, it is **96.3%**.

Two more numbers that shape everything:

- **One page is 26% of the entire site.** `/sarkari-naukri/up-swasthya-vibhag-ambulance-driver-2026` = 186 clicks, 2,786 impressions, position 4.98.
- **200 entrance-exam pages earn 200× the page count for 1.4% of the clicks** (3,648 impressions, 10 clicks, average position 36.8). Those pages are indexing and not converting.
- 16 pages have ≥100 impressions and **zero** clicks, together 2,945 impressions (10.8% of all impressions). Worst offenders: `/entrance-exam/law/mh-cet-law` (568 imp, 0 clicks, pos 24), its `/answer-key` (238) and `/admit-card` (226) children, `/board-exam/state/cbse/cbse-class-12` (249 imp, 0 clicks), `/government-exam/teaching/ctet` (213 imp on a pillar that is being retired).

The top-15 click pages are, verbatim from the slugs:

```
up-swasthya-vibhag-ambulance-driver-2026      bihar-mgnrega-rozgar-sewak-2026
rajasthan-health-dept-radiographer-2026       west-bengal-gram-panchayat-sahayak-2026
gujarat-anganwadi-worker-helper-bharti-2026   up-nagar-nigam-safai-karmi-2026-kanpur
up-nagar-nigam-safai-karmi-2026-lucknow       uttarakhand-anganwadi-bharti-2026-haridwar
jharkhand-forest-guard-2026                   chhattisgarh-mitanin-asha-bharti-2026-raipur
up-district-hospital-ward-boy-2026-gorakhpur  up-asha-bharti-2026-gorakhpur-division
up-swasthya-vibhag-pharmacist-2026            tamil-nadu-anganwadi-worker-2026-chennai
mp-gds-bharti-2026-jabalpur-division
```

Read that list as the reader's vocabulary: **post names in Hindi-English (`safai karmi`, `gram panchayat sahayak`, `mitanin asha`, `ward boy`, `rozgar sewak`, `GDS`), a state, a district, and the year.** Not "SSC CGL", not "entrance exam", not "career opportunities". 93 of the 361 vacancy slugs contain `bharti` (भर्ती) — measured, §4.

Top states on the traffic table: uttar-pradesh 87, rajasthan 45, bihar 33, madhya-pradesh 31, maharashtra 22, all-india 71 (measured, `sarkari_naukri.state`).

### 1.2 Reader needs, ranked

Ranked by (a) how often the need appears in the traffic mix and (b) how urgent it is when it appears — urgency here meaning "miss it and you lose the application".

| # | Need (reader's own words) | How often | Urgency | Do we serve it today? |
|---|---|---|---|---|
| N1 | **"Is this job still open? What is the last date?"** | Every vacancy visit = 96.3% of clicks | Highest — miss it, lose the year | **No.** `application_end_date` is NULL on all 361 rows (measured §4) |
| N2 | **"Where exactly do I apply?"** | Every open vacancy | Highest | **No.** `application_url` filled on **0 of 361** |
| N3 | **"Is this real? Is it the official site?"** | Every visit; scam-wary reader (brief) | Highest | **Actively failing.** `is_verified = false` on **361/361**; every vacancy page shows the Hindi+English "not yet verified" notice |
| N4 | "Am I eligible — age, qualification, domicile?" | Every vacancy + every admission | High | **No fields.** `eligibility`, `age_limit` NULL on 361/361 |
| N5 | "How many posts? In my district?" | Every vacancy | High | Post count exists only **inside the title string** (281/361 titles contain a post/vacancy number; `vacancy_count` NULL on 361/361). `district` NULL on 361/361 |
| N6 | "How much is the fee?" | Every application | Medium-high | **No.** `application_fee` NULL on 361/361 |
| N7 | "When is the admit card / exam / result, and where do I download it?" | Every exam-cycle follower | High | 12 of ~396 editions carry an `admit_card` date, 44 a `result` date, 5 an `answer_key` date (measured §4) |
| N8 | "Tell me when it changes" | Every repeat visitor | High | **Partly.** A WhatsApp channel + Telegram link exist in the header and footer on every page, but nothing subscribes you to *this* job |
| N9 | "Let me share it on WhatsApp" | Very high in this audience (brief + research §2.6) | Medium-high | **No.** No share action anywhere; measured `shareSignal=false` inside `<main>` on the top page |
| N10 | "Let me read it in Hindi" | Every Hindi/Hinglish reader (the slugs in §1.1 prove they are typing post names in Hindi) | Medium-high | **Title only.** `title_hindi`/`organization_hindi` = 361/361; `description_hindi` = **0/361** |
| N11 | "Show me all jobs for my state / my qualification" | 2nd journey in the brief | Medium | **Yes, and it is the best part of the site** — `/sarkari-naukri/state/bihar` renders "17 exams · 33 vacancies in Bihar" with dates |
| N12 | "What comes after this stage?" (counselling, merit list, joining) | Result-stage readers | Medium | Mostly no: `merit_list_date`, `document_verification_date`, `interview_date` NULL on 361/361 |
| N13 | "Is this page current?" | Trust, every visit | Medium | Yes — "Last Updated: 28/9/2026" renders on hubs, `updated_at` on detail pages |
| N14 | "I don't know what this site is for" | Homepage arrivals (15 clicks / 1,666 imp) | Low-medium | **Fails.** See journey 7 |

N1–N6 are the whole first journey in the brief and **all six currently fail.** That is the finding of this investigation; everything else is arrangement.

### 1.3 Journey 1 — "108 ambulance driver vacancy up" (26% of the site's traffic)

Landed on the real top page, measured at 500 × 591:

| y (px) | What the reader sees | Note |
|---|---|---|
| 0–117 | site header + dark strip with WhatsApp / Telegram links | |
| 117 | Breadcrumb: Home › … | |
| 279 | **H1** "UP Health Department 108 Ambulance Driver 2026 – 1,200 Posts" | the post count is in the *title*, not a field |
| 351 | Hindi line: यूपी स्वास्थ्य विभाग 108 एम्बुलेंस ड्राइवर 2026 | only Hindi on the page |
| 427 | Unverified notice (Hindi, then English) | "आधिकारिक अधिसूचना से सत्यापित नहीं है" |
| 540 | **H2 "Quick Information"** — first row of the table is at the fold edge | |
| 727 | H2 "Important Dates" | **empty** |
| 790 | H2 "Important Links" | **empty — this is where "Apply" should be** |
| 885 | H2 "Details" → 3 short paragraphs | |
| 1374 | H2 "Related" → 3 links | |

Full visible text of the page, verbatim (`main.innerText`, **132 words total**):

```
UP Health Department 108 Ambulance Driver 2026 – 1,200 Posts
Government Vacancies  DATES AWAITED  NEW
यूपी स्वास्थ्य विभाग 108 एम्बुलेंस ड्राइवर 2026
108 Ambulance Service UP · Uttar Pradesh · Driver
यह जानकारी अभी आधिकारिक अधिसूचना से सत्यापित नहीं है…
This information has not yet been verified against the official notification…
Quick Information
  Organization        108 Ambulance Service UP
  Department          108 Ambulance Service UP     ← duplicate of Organization
  Total Candidates    35,000                        ← a result-era number on a vacancy page
Important Dates       (nothing)
Important Links       (nothing)
Details
  1,200 Ambulance Driver posts for 108 Emergency Service across all districts.
  Eligibility: 10th + LMV/HMV + 3yr driving, Age 21-40
  Salary: ₹15,000-22,000/month
RELATED: More jobs in uttar pradesh · More Driver Recruitment · All Government Jobs
```

Counts for this journey today: **0 taps** reach an apply link (there is none), **3 scroll-screens** to discover there is no last date, **1 badge** ("DATES AWAITED") that is honestly telling the truth, and **1 dead end** — the reader must leave and Google again.

Two things on that page are actively misleading rather than merely missing:
- "Total Candidates 35,000" appears on a page whose application has not started. `total_candidates` is filled on **361/361** rows while every application field is empty — a seeded *result* column surfacing on a *vacancy* page.
- "Eligibility: 10th + LMV/HMV + 3yr driving, Age 21-40" is inside the `description` prose, not the `eligibility` field (which is NULL on 361/361). So it is invisible to the listing page, to structured data, to AI Fill's diff, and to any future eligibility filter.

**Proposed (target state, same journey):**

```
land → H1 + post count as a FIELD → "Open · closes in 6 days" chip →
fee / eligibility / posts as a 4-line key-facts table ABOVE the fold →
[Apply Online] primary button + [Official Notification] secondary, both in the first screen →
verified-by line ("Checked by IndianExamInfo on 28 Sep against upswasthya.gov.in") →
[Notify me] for this one job → WhatsApp share → related by district/state.
Steps to the answer: 1 tap, 0 scrolls.
```

### 1.4 Journey 2 — "bihar govt job" (state + qualification)

`/sarkari-naukri/state/bihar` → 200, 286 KB HTML, 41 links, renders in 1,122 ms (measured). Real content: "17 exams · 33 vacancies in Bihar", then *Exams in Bihar* and *Vacancies in Bihar* with status and dates. This is the best-executed page type on the site and it is the pattern to copy.

Gaps found: no qualification filter (matric / 12th / graduate), no "closed" vs "open" toggle, and — because `application_end_date` is NULL on every row — the vacancy list cannot show "last date" at all, so it sorts by nothing meaningful. Also `/sarkari-naukri/driver` (a post-type page) exists and is reachable only from a Related link; it is not in any menu.

### 1.5 Journey 3 — "ssc cgl admit card"

Two dead ends, both measured:

1. `/admit-card` returns **200** but its main content is: `Admit Card 2026 — Download Hall Ticket for All Exams` / `Last Updated: 28/9/2026 · **0 exams with admit cards**`. It is `index, follow`, self-canonical, and **linked from the homepage's "Quick access" strip** and the footer of every page.
2. `/sarkari-naukri/ssc/ssc-cgl` gets 131 impressions at position 70.6 and **0 clicks** — so even the exam that readers search for by name is not converting.

A reader who types "ssc cgl admit card" and finds us gets an empty page saying we have nothing. **The feature exists; the data does not** (12 of ~396 editions have an admit-card date).

### 1.6 Journey 4 — "[exam] result"

`/results` → 200, `**0 exams with results**`, `index, follow`, linked from every footer. Meanwhile 60 of the 361 `sarkari_naukri` rows *are* result pages by their own slug (`%-result`) and 361/361 have a `result_date`. The site therefore has a lot of result information and no place to put it: results are stored inside the vacancy table, and the results hub reads from a different shape and finds nothing.

The reader's actual question at result time is not "what is the result" but **"what do I do now"** (counselling date, merit list, document verification). `merit_list_date`, `interview_date`, `document_verification_date`: NULL on 361/361.

### 1.7 Journey 5 — "cuet ug admission du"

`/admission/management/cat` measured: 231 KB, 492 words, tabs Notification / Application / Admit Card / Result / Syllabus, an "Applications closed" chip, and a good countdown line "Exam Date: 29 Nov 2026 · in 62 days". Structured dates exist here (CAT's edition has real `important_dates`).

Two defects, both measurable and both on this one page:
- **"Registration Opens 3 Aug 2026" and "Registration Closes 3 Aug 2026."** A one-day window. Either wrong or un-edited; either way the reader cannot act on it. (No DB constraint catches it: `start <= end` is satisfied.)
- **`FAQPage` JSON-LD with 15 questions, 0 of which appear in the visible text.** Measured: `faqCount: 15, withVisibleText: 0`, e.g. "What is the application fee for CAT 2026?" is in the schema and not on the page. Google's rule is explicit — *"Don't mark up content that is not visible to readers of the page"* ([Structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)). This is a policy violation on 134 pages, not an optimisation opportunity.

What CUET→DU admission *actually* needs, and the site does not have: the **route** — CUET score → which DU colleges accept it → cutoff → last date to apply → fee. That is what "university admission routes (CUET-based, merit-based, own entrance)" in the decided list is for; nothing on the page implements it yet, and `selection_model` is set on 127/127 entrance-exam rows but shows the reader nothing about *this* university's route.

### 1.8 Journey 6 — "up board result" and a university semester result

`/board-exam/state/cbse/cbse-class-12` → 206 KB, **163 words**, dates Practical 5 Jan / Theory 18 Feb / Result 20 May, "Conducted by: Central Board of Secondary Education", an *Official Website* link, and a genuine alerts block: "Get instant alerts — Join our channel for results, admit cards & exam updates · Telegram · WhatsApp". Good shape, thin body. 249 impressions, 0 clicks.

University: `/university-exam` hub is populated (real universities grouped as open / professional / state) but `/university-exam/*` detail pages drew 156 impressions and **0 clicks**, and 7/7 university editions have empty `faqs` and no semester/back-paper dates — the thing the decided list says University Exams are *for*.

### 1.9 Journey 7 — homepage in 5 seconds

Measured at 500 × 591; the mobile single-column layout applies (500 < `sm` 640):

| y | section |
|---|---|
| 203 | **Application closing soon** (carousel) |
| 346 | **Exams next 7 days** (carousel) |
| 394 | pillar tabs: Sarkari Naukri / Admissions / Board Exams / University Exams |
| 597–756 | Admissions, Board Exams tab panels |
| **1063** | **"Quick access": Admit card · Result · Answer key · Syllabus · Date sheet** |
| 1244–3117 | Government jobs / Admissions / Board exams / Universities blocks (each with a 12-tab category list) |
| 3712 | Blog & news |
| 4303 | Important dates |
| 4953 | Popular right now |
| — | total document height **6,138 px ≈ 10.4 screens** |

Within the first 800 px of a phone the reader sees two carousels and a row of pillar tabs. The one-stop links they came for (Admit card, Result) sit **1.8 screens down**, and every one of those links opens a page that says "0 exams".

Identity in the first screen: H1 is **"IndianExamInfo — India's Most Trusted Exam Information Portal"** — an assertion about us, not an offer to you. The `title` tag is better (`Indian Exam Info: Sarkari Naukri, Result, Admit Card 2026`).

Also measured on the homepage: the two carousels are each present **twice in the HTML** (`hidden sm:block` desktop twin) — 616 KB of HTML, of which the visible mobile text is 5,246 characters.

---

## 2. Frontend proposals

### 2.1 Navigation and names

**Today (measured from the rendered header):** `Sarkari Naukri · Admissions · Board Exams · University · News`, plus a search icon; the footer adds `Admit Card · Results · Syllabus · Previous Papers · Mock Tests · Study Material · Blog` and two link clusters whose labels differ from the nav's.

Three problems, each with evidence:

1. **The nav is organised by our DB pillar, not by the reader's task.** "Admissions" is what *we* call the `entrance-exam` pillar; the reader is looking for a form, an admit card or a result. "University" is a pillar; the reader wants their own college's semester result.
2. **The nav and the footer disagree, and the footer is the only place the task-words appear.** A reader hunting "Admit Card" finds it only in the footer, 10 screens down on mobile.
3. **Half the task-words lead to empty pages** (§2.2), so the most reader-shaped part of the information architecture is currently a set of doors into empty rooms.

**Proposed top nav (mobile: 5 items, no hamburger for the first four):**

| Position | Label | Why this word |
|---|---|---|
| 1 | **Sarkari Naukri** | It is the reader's word (93/361 of our own slugs use `bharti`; every competitor uses it — [FreeJobAlert](https://www.freejobalert.com/) calls itself a "Sarkari Naukri portal"). Keep it. |
| 2 | **Admit Card** | Reader word, urgent, currently footer-only |
| 3 | **Result** | Reader word, currently footer-only and currently empty |
| 4 | **Exams & Admissions** | One item, not two. Merges "Admissions" + "Board Exams" + "University" — the reader does not distinguish a board from a university from an entrance body; the *conducting body* on the page does that. |
| 5 | **Today** *(or "Latest")* | The daily-update page: new notifications, closing this week, results declared today. This is the page the 15 homepage clicks and all repeat visits need, and it does not exist. |

Rename / merge / remove, item by item:

| Action | From | To | Evidence |
|---|---|---|---|
| **rename** | `/entrance-exam/*` (still in 200 of 315 GSC pages) | `/admission/*` everywhere | Already decided and already redirected (308 observed on `/entrance-exam/agriculture/hau-entrance` → `/admission/…`, from `gsc-crawl-2026-09-27.csv`) — but 200 pages of *traffic data* and the internal links still use the old root. Finish the rename in-app. |
| **merge** | footer "Blog" + "News & Blog" (`/blog` and `/news`, both 200, both ~4,300 chars, H1s "Blog & News" / "News & Blog") | one `/news` | Measured duplicate content |
| **remove** | "Mock Tests", "Study Material", "Previous Papers", "Syllabus", "Answer Key", "Date Sheet" from the footer **while they are empty** | re-add when a real corpus exists | Each is a live `index, follow` page whose body says "0+ exams" (§2.2) |
| **rename** | pillar tab labels inside `/sarkari-naukri` — "All (361) / Government Exams (60) / Government Vacancies (301)" | "Open now" / "Closed" / "By department", or drop | These numbers are exactly `recruitment_type` = `exam` 60 / `direct` 301 (measured). It is a DB enum shown to readers as a taxonomy, and neither value helps a reader find a job |
| **rename** | "361 active listings" on `/sarkari-naukri` | count of rows actually open | `status = application-open` on **5** of 361 rows (measured). "Active" today means "not deleted" |
| **add** | a state strip or "Jobs near me" entry | | `/sarkari-naukri/state/bihar` is the strongest page type we have (§1.4) and is reachable only via one Related link |

### 2.2 The empty-hub problem (the single worst thing on the site)

Measured, verbatim, from the live HTML of seven footer-linked, `index, follow` pages:

| URL | What its `<main>` says | `li` | links in main | main text |
|---|---|---|---|---|
| `/results` | "Last Updated: 28/9/2026 · **0 exams with results**" | 4 | 2 | 414 chars |
| `/admit-card` | "Last Updated: 28/9/2026 · **0 exams with admit cards**" | 11 | 9 | 576 chars |
| `/answer-key` | "Practice… for **0+ exams**" | 4 | 2 | 419 |
| `/date-sheet` | "**0+ exams**" | 4 | 2 | 412 |
| `/syllabus` | "**0+ exams**" | 4 | 2 | 406 |
| `/previous-papers` | (no count, no content) | 4 | 2 | 426 |
| `/study-material` | "**0+ exams**" | 4 | 2 | 445 |
| `/mock-test` | "Practice free online mock tests for **0+ exams**" | 4 | 2 | 402 |
| `/search` | "Type at least 2 characters to search" + 4 category links | 4 | 6 | 362 |

The two "links in main" on the empty pages are both "Home". These are pages that answer the reader's N1–N7 with "we have nothing", are crawlable, are linked from the homepage's own Quick access strip, and are exactly the queries the site ranks for.

This is also the one place where I have to flag a **real conflict with a decided item** (the brief asks me to flag these): *"answer key and previous papers exist as features and show only where content exists"* is enforced per-entity by `sectionRegistry.hasData()`, but the **static hub routes bypass that gate**. The gate is not the whole rule; a hub route is a second emitter of the same promise. (Frontend code path: `hasData()` → `contentTypeHasData()` drives tabs/sitemap/detail-routes, but `/answer-key` etc. are separate static routes under `app/(public)/` and never consult it. *(carried forward, not re-verified)* for the registry internals; the live 200-with-zero-content result above is measured this session.)

**Fix, in order:** (1) `robots: noindex` on every hub whose count is 0 — one line each, no data change; (2) remove the four dead ones from the footer; (3) make the homepage Quick access strip render only the hubs with data, i.e. run it through the same gate; (4) when the strip would be empty, replace it with the "closing this week" list, which has data.

### 2.3 Information order per page type (mobile first)

The rule applied to all of them: **the answer to the query that brought them, in the first screen, as a field and not as prose.**

**Vacancy page (96.3% of clicks).** Today: H1 → Hindi line → unverified notice → Quick Information → *empty* dates → *empty* links → Details → Related. Proposed first screen:

```
Chip row:  [Open · closes 12 Oct 2026]  [Verified 28 Sep]  [1,200 posts]
H1  Ambulance Driver Bharti 2026 — UP Health Department
Hindi title (same screen, one line below)
KEY FACTS (4 rows, left label / right value):  Posts 1,200 · Eligibility 10th+LMV/HMV ·
       Age 21–40 (relaxation as notified) · Fee ₹500 / SC-ST ₹300 · Last date 12 Oct 2026
[  Apply Online  ]   [  Official Notification  ]        ← two buttons, first screen
Notify me about this job   ·   Share on WhatsApp
─── hairline ───
Vacancy breakdown by district (table) → Important dates → How to apply (5 steps)
→ What happens next (admit card / exam / result, each with a date or "not announced")
→ 5 FAQs, visible text AND schema → Related: same district, same post type, same department
```

What moves: `eligibility`, `age_limit`, `pay_scale`, `application_fee` out of the `description` prose into the key-facts table (they are already columns; they are simply unfilled and unrenderable — see §4). `total_candidates` stops appearing until a result stage exists for the row.

**Exam / admission page.** Keep what works (tabs, countdown, dates table). Fix: one day-window bug class (§1.7), duplicate `About This Exam` H2 (measured twice on both CAT and CBSE), and render the FAQ text so schema matches page.

**Board page.** Same, plus the result-stage block: "Result: 20 May 2026 · **Check your result** → · What next: practicals/compartment, revaluation last date". 163 words today.

**University page.** Semester result is the promise: "Your semester exam dates, result date, back-paper / supplementary window, practical schedule" per university per cycle. Nothing of that exists yet (7/7 university editions have no FAQ, no admit-card/result-typed dates).

**State page.** `/sarkari-naukri/state/bihar` is the template to copy. Add: qualification filter, "closing within 7 days" toggle, district grouping.

**Listing (`/sarkari-naukri`).** Add "Open now (5)" as the default tab, because "361 active" is not what a reader means by active.

**Search (`/search`).** 362 characters of nothing. It is reachable from the header on every page. Make it a real results page with grouped hits (jobs / exams / results), or remove it from the header. Its canonical is also pointing at `/` while `noindex` is set — harmless, but it shows the page was never finished.

### 2.4 Trust signals (N3) — the reason the site is not yet believable

Measured: `is_verified` = **false on 361/361** rows, `official_notification_url` **NULL on 361/361**, `verified_at` **NULL on 361/361**. So every vacancy page carries the unverified notice, including the 26%-of-traffic page. A reader wary of fake-job scams (the brief's premise) is being told, correctly, that nothing here is checked.

The design of the gate is right (official link + end date + `publish_post`, enforced by the DB trigger). The problem is supply: **there is nothing to verify, because the URLs were never entered** — and the editor cannot enter Hindi/district/fee/age at all (§3.4), which is how a "verification" workflow ends up with zero verified rows.

Ordered trust proposals:

1. **Put the verification status where the decision happens**, i.e. beside the Apply button, not 200px above it in a paragraph. Chip text: `Verified against upswasthya.gov.in · 28 Sep` / `Not verified — check the department site`.
2. **Show "who wrote this" and "when it changed"**: an editor display name and an edit history link on the page. Competitor sites do not do this; a first-in-family applicant needs it. (Low cost: `updated_by` exists as a column — but is NULL on every row, §3.5.)
3. **Never show a bare official-looking domain we have not checked.** Today "Official Website" appears on exam pages (`/admission/management/cat` shows a *Notification* tab link) with no reachability proof; 53 dead domains in a prior seeding is the owner's own recorded evidence that this class of error is real for this site.
4. **Disclaimer already exists and is right** ("Not affiliated with any government…") — keep it in the footer, do not bury the *positive* signal under it.
5. Add an `/editorial-policy` and a `/corrections` page. The footer has Disclaimer/Privacy/Contact/About but no corrections path, which is the trust page a YMYL site is expected to have. *(inferred from the measured footer link set + Google's YMYL framing in the E1 code comments that already cite it.)*

### 2.5 Hindi, sharing, alerts, speed

**Hindi (N10).** `title_hindi` and `organization_hindi` are filled on 361/361 — someone made a real effort — but `description_hindi` is filled on **0/361**, and **the Vacancy editor contains the string "hindi" zero times** (measured by grep, §3.4). So Hindi is structurally impossible to add for body content today. The site is a Hindi-titled, English-bodied site for readers whose slugs are Hindi post names.
Proposal: title + key-facts labels + the four primary buttons in Hindi, body in either. That is the cheap 80%: `Eligibility → योग्यता`, `Last Date → अंतिम तिथि`, `Apply Online → ऑनलाइन आवेदन करें`, `Download → डाउनलोड करें`. Research supports partial localisation over machine-translated bodies: mixing untranslated machine Hindi into YMYL content is a trust risk, and Google's own spam policy treats misleading auto-generated content as spam ([search central: spam policies](https://developers.google.com/search/docs/essentials/spam-policies)). *(inferred as the right balance; measured as the current gap.)*

**Sharing (N9).** No share affordance in `<main>` on any measured page. This audience travels through WhatsApp: WhatsApp is India's leading social network by active penetration ([Statista topic page](https://www.statista.com/topics/5113/social-media-usage-in-india/)), and the platform's own forward-limit change (5 chats, [BBC](https://www.bbc.com/news/technology-46945642)) exists because forwarding *is* how information moves here. Proposal: a **per-page share card** — a pre-composed, 3-line text block ("UP 108 Ambulance Driver · 1,200 posts · Last date 12 Oct · indianexaminfo.com/…") that copies cleanly, plus `wa.me` deep link. Copyable text beats an image on a 4G handset, and beats a link that a group will not open. Design it so the message carries the last date *in the text*: the recipient who forwards it three days later needs the expiry in the artefact, not in a page view.

**Alerts (N8).** Real, working, generic (WhatsApp channel + Telegram, `aria-label`ed, header + footer — measured). What's missing is the *per-record* alert. Note this is a **product decision, not a feature**: a channel post is broadcast; the reader's question is "tell me when *this* job's admit card drops". A per-job subscription needs a store and a sender (§5, and the honest one-line cost estimate in §8 #7).

**Speed.** Measured this session:

| Page | cold TTFB | warm TTFB | HTML | JS | total resources |
|---|---|---|---|---|---|
| vacancy detail | 1,573 ms | 185 ms | 185 KB (uncompressed) | 165 KB (transferSize) | 430 KB over 19 requests; script elements 24–25 across two probes (later probe: 6 with `src` + 19 inline); 1 `<img>` (the favicon) |
| homepage | 8.4 s *(observed once)* | 89 ms | **616 KB uncompressed** | — | — |
| state page | 1,122 ms | — | 286 KB | — | — |

Two things follow. First, the earlier 8.4 s was a one-shot observation on a route that was then warm; **I did not verify the cause** (cold ISR vs. a slow render path) and will not claim it. What is reproducible is the payload: **a 132-word page shipping 620 KB and two dozen script requests.** That is the number that hurts on a mid-range Android handset, where parse/exec cost, not bandwidth, dominates — and India's median mobile download speed *rose 36.7%* in the year to Aug 2025 ([DataReportal Digital 2026: India](https://datareportal.com/reports/digital-2026-india)), so the honest diagnosis is **JS weight, not network**, plus a duplicated-carousel tax on the homepage (both variants in the HTML, §1.9). Concretely: no images on a page whose content is text and numbers; one `favicon.svg`; so almost all of that 620 KB is framework.
Proposals: put vacancy detail pages on a light route (no client components below the fold), drop the desktop carousel variant on mobile (`hidden sm:block` should be a separate render, not a duplicate DOM), and lazy-load the below-the-fold blocks.

### 2.6 Research notes that changed my mind (cited)

- **What readers expect by habit.** FreeJobAlert describes itself as "India's most trusted Sarkari Naukri portal since 2011, providing free daily job alerts", and its Play Store listing promises "recruitment notifications, exam dates, admit cards" ([freejobalert.com](https://www.freejobalert.com/), [Google Play](https://play.google.com/store/apps/details?id=com.freejobalert)) — i.e. the four words our footer treats as secondary are the *primary* organising words of the category. Readers arrive with that habit already installed; matching it is not copying a layout, it is meeting an expectation.
- **What those sites do badly** *(inferred from using them, not measured here)*: no verification state, no eligibility in structured form, ad-stuffed pages. Google's JobPosting guidance explicitly disallows "content that spams the page with obstructive text and images, excessive and distracting ads" ([JobPosting](https://developers.google.com/search/docs/appearance/structured-data/job-posting)) — our clean-page constraint is therefore also a Jobs-eligibility constraint.
- **Low-literacy mobile design.** Peer-reviewed guidelines for smartphone UIs used by low-literate populations call for minimal, uncluttered screens, recognition over recall, and short literal labels ([Srivastava & Kapania, CSCW 2021, ACM](https://dl.acm.org/doi/10.1145/3449210); [Microsoft Research India, novice/low-literacy mobile interfaces](https://www.microsoft.com/en-us/research/publication/designing-mobile-interfaces-for-novice-and-low-literacy-users/); literature review: [Interface design guidelines for low-literacy users](https://www.researchgate.net/publication/370383746_Interface_design_guidelines_for_low_literate_users_a_literature_review) — guideline 1 is "keep a minimalistic and simple design"). Our homepage at 10.4 screens with two carousels and eight H2 blocks is the opposite of that. Our own CMS code already invokes the same concern from the other direction: *"Google YMYL policy: never publish unverified exam dates"* (`src/lib/gemini/entranceExamAI.ts:195`).
- **Google Jobs requires things we do not have.** Required `JobPosting` properties are `datePosted`, `description`, `hiringOrganization`, `jobLocation`, `title` ([docs](https://developers.google.com/search/docs/appearance/structured-data/job-posting)); expired postings and postings with no way to apply are disallowed. Measured: the site emits **zero `JobPosting`** on all sampled pages (`hasJobPosting: false` × 2 vacancy pages), while `notification_date` (→`datePosted`), `application_end_date` (→`validThrough`) and `application_url` are NULL on 361/361. So the 96%-of-clicks corpus is categorically ineligible for Google Jobs today, and our `title` values break the stated best practice ("Don't include job codes, addresses, dates, salaries, or company names in the title"): **281 of 361 titles contain a post count, 361/361 contain a year, 57 contain the organisation name.**
- **Being cited by answer engines.** The same visibility rule as §2.4/§2.6 applies twice over: markup must mirror the page. Vendor studies claim FAQ/schema markup raises AI Overview citation rates ([Wellows](https://wellows.com/blog/google-ai-overviews-ranking-factors/), [Stackmatix](https://www.stackmatix.com/blog/optimizing-faq-schema-google-ai-overviews), [Frase](https://www.frase.io/blog/faq-schema-ai-search-geo-aeo)) — treat those percentages as **vendor research, not independent**; the load-bearing fact is Google's own: don't mark up what isn't visible. Answer engines also prefer a short direct answer before the detail, which is what the "answer-first summary block" in E3 is for.

---

## 3. CMS proposals

### 3.1 The measured shape of the CMS

| Metric | Count | Source |
|---|---|---|
| Sidebar items | **23**, in 5 groups | `src/components/layout/Sidebar.tsx` |
| Router paths | **60** | `src/router/index.tsx` |
| Modules in the registry | **28** (5 entity profiles + 23 content/lifecycle modules), 288 field labels, 74 KB | `src/config/moduleRegistry.ts` |
| Vacancy editor | 442 lines, **7 sections, 27 labels, 29 input controls** | `src/pages/sarkari-naukri/SarkariNaukriEditPage.tsx` |
| Mega-editor (serves 4 nav entries) | **2,297 lines / 134 KB**, 7 tabs | `src/pages/entrance-exams/EntranceExamEditorPage.tsx` |
| Human-attributed edits ever, all tables | **5** (`exams` 2 + `exam_editions` 3; `sarkari_naukri` 0; `content_posts` 0) | live DB `count(updated_by)` |

That last row is the most important number in §3. The site carries ~1,000 published records and a 60-route CMS, and **five edits in the whole life of the database were made by a signed-in human**. Everything else came from bulk imports (273 rows on one day: 2026-07-31) or migrations (87 rows on 2026-09-28 with `updated_by` NULL — that was the P1d `result_url` NULLing, cause verified by the count matching the backup table exactly, not assumed).

So the intern journey is not *hard* today; it is **unused**. The proposals below are therefore about making the daily job exist, not about polishing a workflow that is running.

### 3.2 Nav and naming (intern's view)

Today's content section, verbatim from the sidebar:

```
Entrance Exams · Govt Exams · Vacancy Pages · Govt Vacancy Exams · Board Exams · University Exams
```

Six entries, four of which open **the same** editor (`EntranceExamEditorPage` serves `/entrance-exams`, `/govt-vacancy`, `/sarkari-bharti`, `/board-exams`, `/university-exams` — verified from the router: `/govt-vacancy/:id` and `/university-exams/:id` both render `<EntranceExamEditorPage />`). Three near-homonyms differ only in a word: *Govt Exams* vs *Govt Vacancy Exams* vs *Vacancy Pages*. A new intern cannot pick correctly, and there is no correct choice — the difference is a DB pillar, not a task.

Also verified:
- `/govt-vacancy` **and** `/sarkari-bharti` both render `SarkariBhartiListPage` → two live URLs, two names, one table.
- `/exams` (`ExamEditorPage`, 85 KB) and `/entities/:pillar/:id` (`EntityEditorPage`) are both reachable and both edit `exams`, and **neither is in the sidebar**. Two more editors nobody navigates to but a bookmark can reach.
- `/pages/PageEditPage`, `/content/ContentEditPage` and `/blog/BlogEditPage` exist on disk alongside the wired `unified-content` editor; `BoardExamListPage.tsx` and `UniversityExamListPage.tsx` (singular) are not imported by the router — dead files.
- Three separate places manage how things are grouped and named: **Categories** (`/categories`), **Taxonomy** (`/navigation` → `NavigationSettingsPage`), **Menu Manager** (`/menus`).

**Proposed sidebar (content area), one entry per *task*:**

```
BULLETIN  (home)            what changed today, what is due
ADD                         ↓ the five things an intern creates
  · Job notification        → sarkari_naukri
  · Exam / admission        → exams + edition (any pillar; pillar chosen in a step)
  · Result                  → the result-stage record for an exam or a job
  · News / blog             → content_posts
LIBRARY                     existing records, one searchable list
  All records (filter by pillar, status, conducting body, state, owner)
REVIEWS                     drafts awaiting my review      (owner only)
STRUCTURE                   categories · nav & menus · conducting bodies · regions
QUALITY                     missing data, broken links, stale dates, unverified rows
ADMIN                       users · settings · audit · ads
```

"Govt Exams / Govt Vacancy Exams / Vacancy Pages" collapse into *Job notification* + a pillar step. `/exams`, `/entities/*`, `/vacancies` vs `/sarkari-naukri`, `/sarkari-bharti` vs `/govt-vacancy`, `/content` vs `/blog` vs `/education-news` collapse into **All records** + one editor per entity type.

The **QUALITY** entry does not exist in any form today and is the entry the owner needs most: with 0/361 application URLs, 12/396 admit-card dates and 5 human edits, the operator's real job is finding what is missing, not finding records.

### 3.3 Journeys: screens and clicks, today → proposed

Traced from the router and the components (no live session exists — the CMS has no dev auto-login and `/bulletin` requires a signed-in staff account, established last round).

| Journey | Today | Evidence | Proposed |
|---|---|---|---|
| J1 New notification → publish | **3 screens + 1 long scroll, ~27 fields, then 0 confirmation steps.** Nav → list → New → 7 sections → Save. | `SarkariNaukriEditPage.tsx` (442 lines, 27 labels) | **2 screens.** A one-line "paste notification" first screen (AI Fill) → reviewed record → publish. Fields in work order (§3.4). Mandatory: title, state, category, org, last date, apply URL. |
| J2 Admit card released | **4 screens, 2 of them hunting.** List → search "SSC CGL" → open → *Dates & Status* tab → add row → Save → **go back to the list to press "View on Site"** | "View on Site" exists only on `EntranceExamListPage`/`GovtExamListPage`, not inside either editor | **2 screens.** From Bulletin, the row *is* the task: "SSC CGL admit card due" → open → date + URL → save → **"See it on the site" in the editor header** |
| J3 Result declared + confirm | **5 screens** (same as J2 plus list → detail → hub to check it shows) | same | **2.** Editor header gets a live preview link + a "shown on: /results, /admit-card" line listing where this record surfaces |
| J4 Verify a vacancy | **6 controls, 1 unclear reason for failure.** Open → scroll to *Links* → paste official URL → scroll to Key Dates → set end date → press *Verify against official notification* | `SarkariNaukriEditPage.tsx:282-303` + the trigger's 3 preconditions | **2.** One "Verify" block: the two required fields inline, the missing one highlighted, then the button. Error text already humanised *(carried forward)* |
| J5 Next year's edition | **Unknown — and that is the finding.** `startNewEdition`/`promoteEdition` exist in `entranceExamService.ts`, and **`cycle_frequency` exists on `exams`**, but **there is no route in the router containing "edition"** and no sidebar item for it | grep of `src/router/index.tsx` (60 paths, none mention edition) | A visible "Start next edition" action on the exam, with last year's modules copied forward as blanks |
| J6 Date changed / link broke | **No path.** No bulk edit, no link checker, no "find by slug" across pillars. `page_traffic` and the crawl CSV exist; nothing in the CMS shows them | 60 routes; `Audit Log` is the only diagnostic surface | **1.** A "Fix" list in QUALITY: stale dates, unreachable links, empty required fields, each deep-linking into the editor |
| J7 Intern → owner review → publish | **Exists but is invisible.** `workflow_status` is enforced, `publish_post` gates, yet **no review queue appears in the sidebar** and `/audit` is a log, not a queue | `Sidebar.tsx` (23 items, none is a review queue) | REVIEWS entry = drafts by owner, with diff and one-click publish |
| J8 Find any record fast | **Per-table only.** `Search jobs...` / `Search exams...` in the two list pages; nothing cross-pillar, no global shortcut | grep of list-page placeholders | One global ⌘K search over all records |

### 3.4 Editor layout: in the order the work happens

The vacancy editor's current section order is: **Key Dates → (recruitment type) → Basic Details → Other Dates → Links → Content & Eligibility → Details → Publishing.** An intern who has just read a notification does not know the dates first; they know *who is hiring and for what post*. "Details" and "Content & Eligibility" are two buckets whose difference is not guessable, and dates are split across two sections ("Key Dates", "Other Dates") so the same mental act is done twice in two places.

**Proposed, one column, in work order** (and this is the same order the AI Fill diff in §5 will use):

```
1  WHAT & WHO   title · post name · organisation (picker) · department (picker) · conducting body (picker)
2  WHERE        state (picker) · district (picker) · "All India" checkbox · work locations
3  HOW MANY     total posts (number) · vacancy-by-district table · category-wise reservation
4  WHO CAN APPLY eligibility · age limit (with relaxation) · fee by category
5  WHEN         notification date · application start · LAST DATE · exam · admit card ·
                 result · counselling · merit list          ← one section, chronological, all dates
6  LINKS        official notification · apply online · result · admit card   ← each validated + tested
7  WORDS        description (Hindi) · description (English) · FAQ (from the fields above, not typed)
8  PUBLISH      slug · status · verification block · preview link
```

**Fields to add / remove / merge / rename** — every "add" below is a column that **already exists in the DB but cannot be reached from the editor** (verified by grepping the editor source for the term and getting zero hits: `hindi` 0, `district` 0, `applicationFee` 0, `ageLimit` 0, `payScale` 0, `seo` 0, `tags` 0, `cutoff` 0, `passPercentage` 0, `walkIn` 0, `examMode` 0, `image` 0):

| Change | Field | Why |
|---|---|---|
| **add** | `title_hindi`, `description_hindi`, `organization_hindi` | filled 361/0/361 today; the Hindi body cannot be authored at all |
| **add** | `district`, `pay_scale`, `application_fee`, `age_limit`, `eligibility`, `exam_mode`, `walk_in_date/venue`, `vacancy_count`, `total_candidates`, `cutoff_marks`, `pass_percentage`, `merit_list_*`, `document_verification_date`, `interview_date`, `seo_title`, `seo_description`, `tags`, `image_id`, `is_urgent` | 34 of the table's 60 columns are unreachable; their 0% fill is therefore **not** a usage signal, it is an absence of UI |
| **merge** | "Key Dates" + "Other Dates" → one chronological **When** | same act, two places |
| **merge** | "Content & Eligibility" + "Details" → one **Words** | two vague buckets, one real one |
| **rename** | "Recruitment Type" (`exam`/`direct`) | reader-facing label today as "Government Exams (60) / Government Vacancies (301)"; call it **"Does it have an exam?"** |
| **rename** | H1 "Edit Entry" | every other editor says the entity's name |
| **rename** | "Vacancies" (number field) → "Total posts" | "Vacancies" is the DB word; readers say posts |
| **remove** | "Description (HTML)" free-HTML field | one fact, one place; HTML invites exactly the layout drift we just removed elsewhere. Use the modules |
| **turn into a picker** | Organization · Department · State · Category | today they are text/`<select>` with hard-coded options — measured in the editor: `<option value="Education">Education</option>`, `India`, `Science`, `Technology`, `Business`; and `state_not_in_regions = 0` proves the region table is authoritative and available |
| **fix** | `Status` (reader badge) vs `Workflow Status` (draft/published) side by side in one section | two "status" words meaning different things; one is a derivation the site computes anyway |
| **add (validation)** | `application_start ≤ application_end`, `notification_date ≤ application_start`, real ISO dates, http(s) link shape | CAT's "Registration Opens 3 Aug / Closes 3 Aug" (§1.7) proves same-or-worse windows pass today |

### 3.5 Roles, and what is missing from them

Verified policy facts: `assertPermission`/`hasPermission` in the app layer, `current_user_has_permission(slug)` in the DB, `assertAffected`/`NoEffectError` so a zero-row write is reported as a refusal, and the permission slugs `edit_own_post`, `edit_any_post`, `publish_post`, `manage_settings`.

The gap is not permissions, it is **attribution**: `updated_by` is NULL on **all 361** `sarkari_naukri` rows and on 391/396 `exams`. So `edit_own_post` — the rule that lets an intern touch only their own work — has no data to work with for existing content: nobody owns anything. Fix the write path to set `created_by`/`updated_by` (a trigger defaulting to `auth.uid()`), and the ownership model becomes real rather than nominal.

| Role | Should be able to | Today |
|---|---|---|
| Intern | create + edit own drafts, run AI Fill, **not** verify, **not** publish | `edit_own_post` exists; ownership unresolvable (0 `updated_by`) |
| Senior editor / reviewer | verify against notification, queue for publish | verify works (trigger-proven), **no queue UI** |
| Owner | publish, structure, quality, settings, ads, users | all in the sidebar, but **no quality/coverage surface at all** |
| *(missing)* | **Viewer / analytics role** — `page_traffic` exists with 3 policies and 0 DELETE, and no screen shows it | ads `Reports` is the only "reports" surface |

### 3.6 Functions to add or remove (CMS)

| Add | Remove or hide |
|---|---|
| **AI Fill** as the first action on every create (§5) | `/exams`, `/entities/*`, `/sarkari-bharti` (duplicate live URL for `govt-vacancy`), `/blog`, `/education-news` (redirects exist for some, dead editors remain on disk) |
| **Reviews queue** (drafts by owner, diff, publish) | Sidebar `Taxonomy` vs `Menu Manager` vs `Categories` → one **Structure** area |
| **Quality** (missing required fields, unreachable links, dates in the past marked open, unverified live rows) | The five ads entries → two (Ads overview, Campaigns); 0 ads rows measured? *(not measured this session — verify before deleting)* |
| **"See it on the site" + a where-does-this-show line in every editor header** | |
| **Start next edition** (the `cycle_frequency` + `startNewEdition` capability, made reachable) | |
| **Global record search (⌘K)** across pillars | |
| `updated_by` / `created_by` set automatically; an audit-visible field diff | |

---

## 4. The bridge: reader need → CMS field → filled? → shown where?

All "filled" figures measured live against `sarkari_naukri` (361 rows, 361 published) and the 396 current `exam_editions`, as-of 2026-09-28.

| # | Reader need | Which field / action produces it | Filled today | Shown where the reader looks? | Verdict |
|---|---|---|---|---|---|
| N1 | Still open? Last date? | `sarkari_naukri.application_end_date` (+ edition `important_dates[type=application_end]`) | **0 / 361** · 42 / ~396 editions | Vacancy page has an **empty** "Important Dates" section; the derived badge shows `DATES AWAITED` | **absent** |
| N2 | Where do I apply? | `application_url` | **0 / 361** | "Important Links" section renders **no links**; the green Apply button in `SarkariNaukriDetailView.tsx:129` is gated on the field existing | **absent** |
| N3 | Is it real? | `is_verified` + `verified_at` + `official_notification_url`, set by the Verify action (trigger-gated) | **0 / 361** on all three | A bilingual *unverified* notice on every vacancy page | **present and failing** |
| N4 | Am I eligible (age / qualification / domicile)? | `eligibility`, `age_limit`; editions have `eligibility` (123/123 entrance) but `age_limit` **0 / 396** | vacancy 0/361; exam eligibility 123/123 text | Vacancy: buried inside `description` prose. Exam: an Eligibility table exists (CAT/CBSE show one) | **wrong place (vacancy)** |
| N5 | How many posts? My district? | `vacancy_count`, `district` | **0 / 361** both; post count lives in the *title string* on **281 / 361** | Number appears only because the title says so; no district UI anywhere | **absent / unstructured** |
| N6 | How much is the fee? | `application_fee` (jsonb); editions `application_fee` filled 123/123 | **0 / 361** vacancy | Exam pages show fee; vacancy pages do not | **absent (vacancy)** |
| N7 | Admit card / exam / result — when, and download where? | `admit_card_date/_url`, `exam_date`, `result_date/_url`, `answer_key_*`; edition `important_dates` types | **0 / 361** for admit card & answer key fields · edition types: `exam_written` 224, `result` 44, `application_end` 42, `admit_card` **12**, `answer_key` **5** | Exam pages do show a dates table (good); `/admit-card` and `/results` hubs say **0 exams**; **0 JobPosting emitted anywhere** | **exists for exams, empty for jobs, hubs promise nothing** |
| N8 | Tell me when it changes | *(no field, no action)* | — | Generic WhatsApp/Telegram channel links, header + footer, on every page | **broadcast only** |
| N9 | Let me share on WhatsApp | *(no field, no action)* | — | Nothing in `<main>`; measured `shareSignal = false` | **missing** |
| N10 | Let me read it in Hindi | `title_hindi`, `organization_hindi`, `description_hindi` + a Hindi UI label set | **361 · 361 · 0** | Hindi title + Hindi unverified notice; the entire body and every label is English | **half-built** |
| N11 | All jobs for my state / qualification | `state` (100% filled, 21 distinct, all valid against `regions`), `category` (361), qualification *(no column)* | state ✓ category ✓ | `/sarkari-naukri/state/[slug]` — the strongest page type we have; no qualification axis exists | **good (state), absent (qualification)** |
| N12 | What comes after this stage? | `merit_list_*`, `document_verification_date`, `interview_date`, `counselling` | **0 / 361**; `counselling` date on 17 / ~396 editions | Not on vacancy pages; exam pages have a counselling date sometimes | **absent** |
| N13 | Is this page current? | `updated_at`, `published_at`, and (should be) `updated_by` | `updated_at` ✓ · `updated_by` **0 / 361** | "Last Updated: 28/9/2026"; nobody is credited | **partial** |
| N14 | What is this site for | `seo_title`/`seo_description`, homepage copy | `seo_*` **0 / 361** (auto-generated per the `ai_auto_seo` setting, not stored) | Homepage H1 is "India's Most Trusted Exam Information Portal" | **assertion, not offer** |

**Two structural conclusions.**
1. The reader's top six needs map onto **columns that exist but have never been filled, in an editor that cannot reach them, for content that arrived by bulk import.** The gap is not schema design. It is 91% reachability of the vacancy form + 5 human edits ever.
2. **The bridge runs one direction today.** Fields exist that the reader never sees (`total_candidates` 361/361 → shown as a meaningless "Total Candidates" on a pre-application page; `pass_percentage`, `cutoff_marks` 60/361 → no vacancy-page slot) and needs exist with no field at all (N8, N9, qualification). A `hasData`-style gate on the *vacancy* side does not exist; the page renders whatever column it recognises, in a fixed order.

---

## 5. AI Fill — E1 today, E4 design

### E1. What AI Fill is today (all of it read from code this session; nothing executed)

| Question | Answer | Evidence |
|---|---|---|
| Which editors have it | **Entrance-exam mega-editor** (7 tabs: Identity, Resources, Syllabus, Dates & Status, Modules, News, SEO) with an `AIFillButton` on Identity, Dates & Status, Modules (+ News/SEO handlers); **unified content** and **blog** editors have "AI Auto-Fill" dialogs | `EntranceExamEditorPage.tsx:1012-1020, 1147-1149`; `src/lib/ai/autofill.ts` ("AI Auto-Fill Blog Post" / "AI Auto-Fill Content Post") |
| Which editors **don't** | **The Vacancy editor** — the page type carrying 96.3% of traffic. Zero AI in `SarkariNaukriEditPage.tsx` | grep: no `AIFill`, no `AI ` strings in that file |
| Input it accepts | **Paste only.** A textarea whose placeholder is "Paste notification text, website content, PDF text, dates, or any raw data here… Example: CAT 2026 Notification Released / Registration: 1 Aug - 15 Sep 2026 / …" | `src/components/shared/AIFillButton.tsx` (102 lines, 4.4 KB); no `type="file"`, no URL fetch anywhere in the AI path |
| Provider actually called | `generateWithGemini()` first tries the provider table: `getEnabledProviders()` returns **2 rows, both `groq`, both enabled** → `generateWithFallback(prompt, "legacy-consumer")`. **Priority 1 = `openai/gpt-oss-120b`, priority 2 = `llama-3.3-70b-versatile`**, both labelled "(migrated)". So today's model is **Groq gpt-oss-120b**, not Gemini | live `ai_providers`; `src/lib/gemini/client.ts:48-53` |
| The `gemini_api_key` in Settings | Read by the exam editor (`getSetting("gemini_api_key")`) but **never used while the provider table has rows** — it is the legacy path at `client.ts:64-73`. Two key stores, one live | `settings.gemini_api_key` (sensitive, 58 chars) + `ai_providers` |
| Where the key lives | **In the browser.** `OpenAICompatibleAdapter` POSTs `Authorization: Bearer <key>` straight to `https://api.groq.com/openai/v1/chat/completions` from the SPA; `GeminiAdapter` sends `x-goog-api-key` to `generativelanguage.googleapis.com`. There are only **two edge functions — `admin-set-temp-password` and `revalidate-frontend`; no AI proxy** | `src/lib/ai/adapters/openai-compatible.ts:28-39`, `gemini.ts:9-19`, `supabase/functions/` |
| Which fields it fills | Exam path: `shortName`, `conductingBody`, `officialWebsite`, `importantDates[]`, `vacancy`, `editionStatus`, the 8 `has*` module flags, SEO title/description, tags, FAQs, content modules. Blog/content path: title + body + meta | `EntranceExamEditorPage.tsx:615-700` |
| What it does to existing values | **Nothing — by an explicit rule.** "EMPTY-ONLY FILL … AI must NEVER replace a value that already exists", added after a recorded incident: *"it returned Short Name 'CAT' on a Bihar Board record from junk input"* and a non-empty hallucination passed the old `gotAnything` gate and overwrote a correct value. Dates: fills blank rows or appends; never overwrites a dated row. Flags: false→true only. Status: only if still the `upcoming` default. Then **auto-saves exactly the fields it wrote** | lines 637-700 + comments 617-631 |
| How it sets pillar / entity type | **It doesn't.** Pillar is chosen by which nav entry the intern clicked; `entity_type` follows from the pillar in the DB. AI Fill has no pillar/entity proposal step | router (5 nav entries → one editor) + `entity_type` per pillar measured: entrance-exam→exam 123, government-exam→recruitment 104, govt-vacancy→recruitment 100, board→board 38, university-exam→university-exam 27 |
| Failure modes | (a) model hallucination into blank fields (documented above); (b) fragile date matching — a label match on an 8-character letters-only prefix, so "Registration Closes" and "Fee Payment Last Date" can both normalise to the same key (lines 665-668); (c) silent empty: mitigated by "AI found nothing to fill — no changes were made"; (d) 30 s hard timeout, 45 s in the legacy wrapper; (e) **`temperature 0.7` for what is an extraction task**; (f) no source-quote capture at all, so nothing can be audited after the fact; (g) no link reachability check; (h) no duplicate-record check before create | `openai-compatible.ts:37`, `client.ts:32`, editor lines 651-681 |
| Cost per call | **Unknown and unknowable today.** `ai_request_logs` (provider_id, prompt_hash, status, error_message, latency_ms, consumer_name) has **0 rows**; `usage_count = 0` and `last_used_at = NULL` on **both** providers. Response cap 4,096 tokens / 8,192 on the Gemini path | live DB |
| Has it ever run? | **No trace of it ever running.** 0 log rows, 0 usage counts, and only **5 human-attributed edits** exist across `exams` + `exam_editions` + `sarkari_naukri` + `content_posts` | live DB |

**The three live tests the brief asks for could not be run, and here is the honest reason.** (1) The CMS has no dev auto-login and I have no staff credentials — `/bulletin` and every editor redirect to `/login`. (2) Using the Groq/Gemini keys I *can* see in the database would spend the owner's quota and would mean reading a credential, which I will not do. (3) The brief itself requires the runs to write nothing to the database, and today's AI Fill **auto-saves whatever it fills** — so a live run in a real session is a write by design. What I did instead: read the whole code path, and use it to produce the three worked examples in §5.3, whose *inputs* are real (one is a live row's own text) and whose *outputs* are what E4's schema would produce — **authored against the spec, not captured from a model.** The fastest real evidence is one paste by you in one session; §9 asks for that.

### E2. The non-negotiable rules, mapped to what exists

| Rule (brief) | Today | Gap to close |
|---|---|---|
| Extract only; every value carries its source quote; no quote ⇒ empty + "not in source" | **Absent.** No quote is captured anywhere | Add `quote` to every extracted field in the schema; reject on miss |
| Links only if present in source and http(s); reachability check before accept | **Absent.** `officialWebsite` is written from model output | HEAD check in an edge function; store `checked_at` |
| Real ISO dates, start ≤ end, notification ≤ application start | **Partly.** "Convert extracted date texts to YYYY-MM-DD using deterministic code" (editor line 210) is the right instinct; no ordering validation | Same validator the editor form needs (§3.4) |
| Region from `regions`; conducting body matched or proposed; pillar proposed | **Absent.** Region/body are free text today (and the editor has hard-coded `<option>`s) | Picker-first fields, `proposed_new_body` as a review item |
| Field-by-field diff, accept per field, never silently overwrite | **Half.** Never overwrites (empty-only) — but there is **no diff and no per-field accept**; it writes and auto-saves | The review UI in §5.2 |
| Never sets `verified_at`, never publishes | **Honoured** — verification is trigger-gated and AI never touches it | keep as-is |
| Duplicate check before create | **Absent** | `organisation + post + year` + slug similarity, offer update |
| Record what was filled, from which source, when | **Partly.** `ai_metadata` exists on `exams`; `exams.ai_metadata` is `{}` on all 134 FAQ-bearing rows (measured last round) — so the column exists and is never written | write it on every accept |

### E4. Proposed design

**Inputs (three, in this order of preference for the intern):**
1. **URL** — paste the official notification page; an edge function fetches it, strips to text, records `sha256(text)` + `fetched_at`. Same-origin allow-list is *not* applied to the content, only to the trust mark.
2. **PDF** — upload to a Supabase storage bucket; the function extracts text (`pdf-parse` equivalent in Deno, or `pdftotext` in a Rust/edge shim) *and* keeps the file as the permanent source artefact. This matters: the quote is only auditable if the source is retained.
3. **Paste** — today's path, kept, because most notifications arrive in a WhatsApp group as text.

All three end up as the same `{ source_text, source_ref, source_hash }`. The extraction call is made **server-side only** — which also fixes the key exposure (§10 S1).

**Extraction schema — generated from `moduleRegistry`, one place.** The registry already declares every field, its type and its label for 28 modules; the same definition becomes the JSON Schema the model must satisfy (`{field, value, quote}` triples), so a new module needs no AI code change. This is the registry's stated purpose ("Adding a new module = add config here. No component changes needed") applied to AI.

```
For each field in the record's module set:
  { "value": <typed value | null>,
    "quote": <verbatim substring of source_text | null>,
    "span":  [startChar, endChar] }
REJECT the field if quote == null, or if quote is not found in source_text
       (substring test, not trust-the-model).
```

**Validation, in this order:** type → real date + ISO → ordering constraints → region ∈ `regions` → body ∈ `conducting_bodies` (else propose) → URL scheme http(s) + HEAD 2xx/3xx → duplicate-record probe → numeric sanity (posts > 0, fee ≥ 0).

**Cost controls:** `temperature 0` (extraction, not composition), one call per stage with a token budget from the field count, `max_tokens` sized to the schema, daily per-user call cap, and — the missing half — **actually write `ai_request_logs`** (it has the columns already: `latency_ms`, `status`, `prompt_hash`, `consumer_name`). Owner then sees calls/week and failures in the QUALITY screen.

**Review UI (this is the change that makes the whole thing safe):**

```
┌─ AI Fill · from: upswasthya.gov.in/notification-108-2026 (fetched 28 Sep 10:14) ─┐
│                                                                                   │
│ FIELD                 CURRENT        PROPOSED          SOURCE           [ ✓ / ✗ ] │
│ ─────────────────────────────────────────────────────────────────────────────────│
│ Post title            (blank)        Ambulance Driver  "…108 Ambulance Driver…   │
│                                       108 Ambulance    21 posts…"        [✓]      │
│ Total posts           (blank)        1,200             "…total 1200 posts…"  [✓]  │
│ State                 uttar-pradesh  uttar-pradesh     (unchanged)         [–]    │
│ District              (blank)        —                 NOT IN SOURCE       [✗]    │
│ Last date             (blank)        12 Oct 2026       "…w.e.f. … up to    [✓]    │
│                                       (Fri)             12.10.2026…"               │
│ Application fee       (blank)        ₹500 / ₹300       "…Rs.500/- general, [✓]    │
│                                                        Rs.300/- SC/ST…"            │
│ Apply URL             (blank)        upnurse…          [recheck: 200 OK]  [✓]     │
│ ─────────────────────────────────────────────────────────────────────────────────│
│ ⚠ Proposed 2 new records: district "Gorakhpur", body "UPPRPB" — confirm           │
│ ⚠ Possible duplicate: "UP Health Dept 108 Ambulance 2026" (97% slug match) →       │
│      [Update existing] [Create anyway]                                             │
│                                                                                   │
│  Accepted 6 / 9 · 1 not in source · 2 need confirmation                           │
│                        [ Save accepted (draft) ]      [ Discard ]                 │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Never auto-save from this screen. `Save accepted` writes only ticked fields, sets `content_source='ai_assisted'`, `ai_metadata={fields, source_hash, model, at}`, and leaves `workflow_status='draft'`.

### 5.3 Three worked examples (raw in → proposed fields with quotes → what the reader sees)

**Authored against the E4 spec from real inputs. Not model outputs.** Example 1's input is a live row's own `description` (measured); 2 and 3 use the shapes of real notices for those record types.

**① Vacancy — UP 108 Ambulance Driver (the site's top page, 186 clicks)**

```
RAW (the row's own description field, verbatim):
  1,200 Ambulance Driver posts for 108 Emergency Service across all districts.
  Eligibility: 10th + LMV/HMV + 3yr driving, Age 21-40
  Salary: ₹15,000-22,000/month
```

| Field | value | quote | today |
|---|---|---|---|
| post_title | Ambulance Driver | "1,200 **Ambulance Driver** posts" | in the H1 only |
| vacancy_count | 1200 | "**1,200** Ambulance Driver posts" | NULL |
| eligibility | 10th + LMV/HMV licence + 3 yr driving | "**Eligibility: 10th + LMV/HMV + 3yr driving**" | NULL |
| age_limit | 21–40 | "**Age 21-40**" | NULL |
| pay_scale | ₹15,000–22,000 / month | "**Salary: ₹15,000-22,000/month**" | NULL |
| district | — | *not in source* ("all districts" is not a district) | NULL, correctly |
| last date · apply URL · fee · notification date | — | *not in source* → **left empty and marked "not in source"** | NULL |

Reader then sees: `1,200 posts · Eligibility 10th+LMV/HMV · Age 21–40 · ₹15,000–22,000` as a four-line table in the first screen, and — crucially — **`Last date: not announced · [Notify me]` instead of an empty "Important Dates" heading.** Same text, three more answers, zero invented facts.

**② Admit card notice — "SSC has released the CGL 2026 admit card for CBTE Tier-1…"**

| Field | value | quote |
|---|---|---|
| target record | SSC CGL 2026 edition | (matched by slug, not created) |
| `important_dates[type=admit_card]` | 2026-10-09 | "**from 09 October 2026**" |
| state | — | not in source |
| admit_card_url | ssc.gov.uk… → **HEAD 200** → accept | "**https://ssc.gov.in/…**" |
| what the reader gets | /admit-card stops saying "0 exams with admit cards" | |

Rules applied: no new record (update existing), link only from source and only after a reachability check, no invented exam date.

**③ University admission — "DU UG admission 2026: CUET-UG score, 13 rounds of CSAS counselling…"**

| Field | value | quote |
|---|---|---|
| pillar | `entrance-exam`, entity_type `university-admission` | proposed, editor confirms |
| selection_model | `CUET-UG score → CSAS counselling rounds` | "**admission based on CUET-UG score through CSAS counselling**" |
| application window | 2026-06-26 … 2026-07-10 | "**apply from 26 June to 10 July 2026**" |
| route (per college) | — *not in source* → **do not generate a cutoff table** | |
| what the reader gets | the CUET→DU explanation that journey 5 asked for and cannot find today | |

The instructive part: example ③ is exactly where today's AI Fill would have invented a college-cutoff table, because the prompt asks for content and the merge rule only protects non-empty fields. Quote-required extraction is what makes "don't invent" *enforceable* rather than aspirational.

### 5.4 Risks of the AI Fill design, named

1. **Quote-giving is not truth-giving.** A model can attach a real quote to a wrong value. Mitigation: the substring test (rejects quotes not in the source), the two-source rule for dates (date text + its label must both appear), and the editor diff.
2. **Extraction quality is bounded by the model.** `gpt-oss-120b` at temperature 0 is adequate for tabular facts; for scanned PDFs it is not. Mitigation: PDF text-layer detection — if the layer is empty, refuse and say "this PDF has no text layer; paste the text".
3. **Cost surprise.** Today: no logging, no cap, one call per tab up to 8,192 output tokens. Mitigation: the daily cap + real logs before any volume use.
4. **Automation pressure.** An AI that fills blanks makes a *bad* record look complete (a page with 8 filled fields and no last date reads authoritative). Mitigation: "not in source" is a visible state in the editor and a required-field gate on publish, so completeness is measured against the reader's needs, not field count.
5. **Bulk re-seeding.** This site's own history (bulk-seeded vacancies, 53 non-existent domains, per the brief) is a story about exactly this tool. Mitigation: AI Fill is per-record and human-accepted; no batch mode; `content_source='ai_assisted'` is queryable so an audit can find every AI-touched row.

---

## 6. One glossary for both sides

Reader labels are what the site should show. CMS labels are what the intern sees. Right-hand column flags where the two currently disagree.

| Term | Meaning | Reader label (EN) | Reader label (HI) | CMS label | Now |
|---|---|---|---|---|---|
| Vacancy page | One recruitment notification | **Job** / "Vacancy" | नौकरी / पद | Vacancy Pages | Site says "Government Vacancies"; CMS says "Vacancy Pages"; DB says `sarkari_naukri` — three names, one thing |
| Bharti | A recruitment drive | **Bharti** (keep it; 93/361 slugs use it) | भर्ती | — | missing as a concept |
| Application end date | The deadline | **Last date** | अंतिम तिथि | Application End (Last Date) | ✓ CMS is right, the field is empty |
| Application URL | Where to apply | **Apply Online** | ऑनलाइन आवेदन करें | Application URL | ✓ naming, 0/361 filled |
| Official notification URL | The source document | **Official Notification** | आधिकारिक अधिसूचना | Official Notification URL | ✓ naming, 0/361 filled |
| Admit card | Hall ticket | **Admit Card** | प्रवेश पत्र / हॉल टिकट | Admit Card | ✓ |
| Result | Score/selectivity | **Result** | परिणाम / रिजल्ट | Result | ✓ |
| Answer key | Question paper responses | **Answer Key** | उत्तर कुंजी | Answer Key | ✓ (5 editions have one; hub says 0) |
| Counselling | Seat allocation process | **Counselling** | काउंसलिंग /_seat वरण_ | Counselling | 17 editions |
| Merit list | Selected candidates | **Merit List** | चयन सूची | Merit List Date | ✓ |
| Cut off | Minimum score | **Cut Off** | कट ऑफ | Cut Off | jargon; readers do search "cut off", keep |
| District | Where the posts are | **District** | जिला | — | **no CMS field in the form**; `district` column unreachable |
| Eligibility | Who may apply | **Eligibility** | योग्यता | Eligibility | ✓ |
| Age limit | | **Age limit** | आयु सीमा | — | unreachable from the vacancy form |
| Application fee | | **Fee** | आवेदन शुल्क | — | unreachable |
| Pay scale | | **Salary** | वेतन | Pay Scale | "Pay Scale" is a gazette word; readers say salary |
| Verification | Human checked it against the source | **Verified** | सत्यापित | Verify against official notification | ✓ both sides |
| Pillar | Content domain | *(never show)* | | Entrance Exams / Govt Exams / … | **leaks** into reader labels "Government Exams (60)" |
| Edition | One year's cycle | *(never show; "2026")* | | — no UI | `cycle_frequency` exists, no "start next edition" |
| Module | A block on the page | *(never show)* | | Modules | 23 of them in one tab |
| Workflow status | Draft/published/archived | *(never show)* | | Workflow Status + Status | two "status" words in one form |

---

## 7. Target structure (ASCII)

### 7.1 Public nav + mobile vacancy page

```
PUBLIC NAV (mobile: 5 items, no hamburger for the first four)
┌───────────────────────────────────────────────────────────┐
│ ☰  IndianExamInfo                     🔍                    │
│ Sarkari Naukri · Admit Card · Result · Exams · Today       │
├───────────────────────────────────────────────────────────┤
│ Official-source strip · WhatsApp / Telegram (existing)      │
└───────────────────────────────────────────────────────────┘

MOBILE VACANCY PAGE — first screen (360×800)
┌──────────────────────────────────────────┐
│ ← Sarkari Naukri / Uttar Pradesh         │  breadcrumb
│ UP 108 Ambulance Driver Bharti 2026      │  H1  (post name in readers' words)
│ यूपी 108 एम्बुलेंस ड्राइवर भर्ती 2026    │  Hindi title
│ ● Verified 28 Sep · upswasthya.gov.in    │  trust chip (green) or
│ ○ Not verified — check the department    │  (amber) — one, always
│ ┌──────────────────────────────────┐     │
│ │ ⏳ LAST DATE  12 Oct 2026 · 6 d   │     │  ← the answer, biggest thing on screen
│ └──────────────────────────────────┘     │
│ Posts 1,200 · Eligibility 10th+LMV/HMV    │  key facts, 4 short rows
│ Age 21–40 · Fee ₹500 (SC/ST ₹300)         │
│ [   Apply Online  →   ]                   │  primary, one button
│ [ Official Notification ]  [ Share ⤴ ]    │  secondary + WhatsApp
│ 🔔 Notify me when this changes            │
└───────────────────────────────────────────┘
rest of page, one column, hairline between blocks:
  District-wise posts → Important dates (all stages, incl. "not announced")
  → How to apply (5 numbered steps) → What happens next → Eligibility detail
  → Selection & medical → FAQ (visible text, same as schema) → Related
  (same district · same post type · closing soon)
```

### 7.2 CMS nav + one editor + AI Fill review

```
CMS NAV
BULLETIN (home)     due today · new from source · unverified · stale dates
ADD            ▸ Job notification · Exam/admission · Result · News
LIBRARY        ▸ All records (search anything) · By owner · By conducting body · By state
REVIEWS        ▸ Awaiting my review (diff · publish)          [owner/senior]
QUALITY        ▸ Missing required fields · unreachable links · 0-hub pages · AI audit
STRUCTURE      ▸ Categories & taxonomy · Nav & menus · Conducting bodies · Regions
ADMIN          ▸ Users · Settings (AI, ads, site) · Audit log
  (23 sidebar items → 7 groups; 60 routes → ~24)

VACANCY EDITOR (one column, work order)
┌───────────────────────────────────────────────────────────────┐
│ Job notification · draft        [ See it on the site ↗ ]      │
│ [ AI Fill ▸ paste / PDF / URL ]                               │
│ 1 WHAT & WHO  title*| post*| org▾ (picker)| dept▾| body▾      │
│ 2 WHERE       state▾* | district▾ | ☐ All India | locations   │
│ 3 HOW MANY    total posts | district-wise table               │
│ 4 WHO CAN     eligibility | age± | fee by category            │
│ 5 WHEN        notified → start → LAST DATE* → exam → admit    │
│               → result → counselling → merit  (chronological)  │
│ 6 LINKS       notification↦checked | apply↦checked | result    │
│ 7 WORDS       description (HI) | description (EN) | FAQ(auto)  │
│ 8 PUBLISH     slug | status | VERIFY block | Save as draft     │
└───────────────────────────────────────────────────────────────┘

AI FILL REVIEW  → the screen in §5.2 (field · current · proposed · quote · ✓/✗)
```

---

## 8. The 15 changes I would make first

Ranked on one rule: **how much reader-facing wrongness does it remove per unit of work.** Effort = engineering days for one person familiar with the codebase (S ≤ 1 day, M = 2–5, L = 1–3 weeks). "Evidence" points back to the section that measured it.

| # | Change | User served | Impact | Effort | Dependencies | Evidence |
|---|---|---|---|---|---|---|
| **1** | **Make the five decision facts enterable and stored** — `application_end_date`, `application_url`, `vacancy_count`, `eligibility` + `age_limit`, `application_fee` — by finishing the Vacancy editor (34 of 60 columns are currently unreachable from it), then back-filling the ~20 highest-traffic live rows by hand from their official notification. No schema change: every column already exists. | Reader (N1–N6) and owner (traffic → usable traffic) | **High** — this is 96.3% of clicks and the first six questions | **M** | none (columns exist; editor work is UI-only) | §4 N1–N6, §3.4, §1.3 |
| **2** | **Close the credential leak.** Set `is_sensitive = true` on `settings.ai_fallback_key` (it is `false` today and the anon-readable policy therefore serves it to anonymous visitors — verified by `set role anon`), then move every provider call behind one edge function so no key crosses the browser. Rotate both keys afterwards. | Owner (security, cost, legal) | **High** — a live key readable by an anonymous visitor is the worst single finding in this report; ranked #2 on severity, not on reader value | **S–M** | one edge function (the repo already has two, so the pattern exists) | §E1 "Where the key lives", §5.4 |
| **3** | **Stop the site promising pages it does not have.** `noindex` every hub whose count is 0, pull Mock Tests / Study Material / Previous Papers / Syllabus / Answer Key / Date Sheet out of the footer, and run the homepage "Quick access" strip through the same `hasData` gate that entity pages already use. 8 measured URLs currently render "0 exams" while `index, follow`. | Reader and owner | **High** — the cheapest high-impact fix on the list; one line per route | **S** | none | §2.2, §1.5, §1.6 |
| **4** | **Export the Search Console *query* file and commit it** (`docs/seo/gsc-queries-YYYY-MM-DD.csv`, 400–1,000 rows, same period as the pages export we already have). The brief treats it as primary evidence for naming; it does not exist in the repo, and the only 869-row keyword artefact is our own generated template. | Owner, and every future naming decision | **High** — it settles §2.1 and §6 without inference | **S** (you have GSC access; nobody walking this report does) | owner action | §0.2 |
| **5** | **Re-order the mobile vacancy first screen** to: status chip → H1 + Hindi title → **Last date, as the largest element** → 4-row key-facts table → `[Apply Online]` + `[Official Notification]` → notify/share. Today the fold is breadcrumb, H1, one Hindi line, an unverified notice and a table whose first two rows duplicate each other; "Important Links" — where Apply belongs — is empty at y=790. | Reader | **High** | **S–M** | #1 for the values; the Apply button already exists and is field-gated (`SarkariNaukriDetailView.tsx:129`) | §1.3, §2.3, §7.1 |
| **6** | **Build the daily return page: `/today`** — new notifications today, closing within 7 days, results declared today, admit cards released today — as rows, one screen, and point the nav's fifth item and every share link at it. It does not exist; `/sarkari-naukri` today is a 361-row list whose header says "active" while only 5 rows are open. | Reader (repeat visits), owner (direct traffic, brand) | **High** | **M** | #1 (a "closing this week" page without end dates would lie). Derived from `status` + `application_end_date` + `result_date`, all existing columns | §1.1, §2.1, §4 |
| **7** | **Per-page WhatsApp share card**: pre-composed 3-line text carrying the post name, post count and **last date**, plus a `wa.me` deep link. No share affordance exists inside `<main>` on any measured page. | Reader (N9) | **High** — this audience travels through WhatsApp forwards, and the forwarded artefact must carry the expiry date because it is read three days later | **S** | #1 for the date; otherwise share the state + posts | §2.5, research §2.6 |
| **8** | **Structured data that matches the page.** Emit `JobPosting` only for rows that are verified, open, and have `application_url` + `validThrough` + a location; and stop emitting `FAQPage` where the questions are not visible (measured: CAT page has `faqCount: 15, withVisibleText: 0`; the pattern repeats across ~134 FAQ-bearing pages, which is a policy violation, not a missed opportunity). | Owner (SEO), reader (accurate SERP) | **High** for the FAQ fix, **medium** for Jobs until #1 lands | **S–M** | #1 for the JobPosting required properties (`datePosted`, `jobLocation`, `validThrough`) | §2.6, §1.7 |
| **9** | **Hindi where the decisions are**: key-fact labels, the four action verbs (`अंतिम तिथि`, `ऑनलाइन आवेदन करें`, `योग्यता`, `डाउनलोड करें`), the unverified notice (already Hindi) — and make `description_hindi` reachable in the editor, which today cannot express it (0 occurrences of "hindi" in the file). Do **not** machine-translate bodies: misleading auto-generated content is a spam policy, and a wrong Hindi "last date" is worse than none. | Reader (N10) | **Medium-high** | **M** | #1/editor work; a human who writes Hindi (owner decision, §9 Q3) | §2.5, §4 N10 |
| **10** | **Accessibility minimums, all measured:** 22 of 28 footer tap targets are **15–16 CSS px tall** against WCAG 2.2 SC 2.5.8's 24×24 minimum ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)); 4 text nodes render below 13 px (9/10/12 px); Devanagari text is on the page with **`lang="hi"` on zero elements**, so a screen reader reads Hindi with an English voice; the two "Quick Information" tables have **0 `<th>` cells** (unlabelled columns to assistive tech); the page has **2 `<main>` landmarks**. | Reader, incl. the low-literacy and screen-reader user | **Medium-high** — cheap, and it is the audience the brief describes | **S–M** | none | §10 A1 table, §1.3 |
| **11** | **AI Fill v2, in the Vacancy editor first** (it is absent there today), with: server-side calls only, schema generated from `moduleRegistry`, `{value, quote}` per field and **reject when the quote is not a substring of the source**, per-field diff before save, no auto-save, `temperature 0`, duplicate probe before create, and real rows written to `ai_request_logs`. | Intern (daily workload), owner (quality, cost) | **High** — it is the only plausible way one intern keeps 361+ rows current | **L** | #2 (the edge function), registry as the single field source | §E1, §E2, §E4 |
| **12** | **Title and slug pattern in readers' words**, generated from fields instead of carrying them: `Ambulance Driver Bharti 2026 — UP Health Department`, with post count out of the title. Google's JobPosting guidance says not to put dates, company names or job codes in the title; today **361/361 titles contain a year, 281/361 a post count, 57/361 the organisation**. Keep existing slugs (they hold the traffic); change the rendered `<h1>`/`<title>` and the pattern for new records. | Reader and owner | **Medium-high** | **M** | #1 (a post-count-free title needs `vacancy_count` to exist to still show the number), and a canonical decision in §9.2 Q8 | §2.6, §4 N5 |
| **13** | **Cut the CMS to the work.** 23 sidebar items and 60 routes → 7 groups and ~24 routes: retire the 4 duplicate editors (`/entrance-exams`, `/govt-vacancy`, `/sarkari-bharti`, `/board-exams`, `/university-exams` all render the *same* 2,297-line `EntranceExamEditorPage`), merge `Taxonomy`/`Menu Manager`/`Categories`, put "Add" as one action group at the top, and add `[ See it on the site ↗ ]` plus a "shown on: /results, /admit-card" line to every editor header. | Intern, owner | **Medium-high** | **M** | none | §3.1, §3.2, §3.3, §7.2 |
| **14** | **A review queue and a quality screen.** REVIEWS = drafts by owner with a field diff and one-click publish (`workflow_status` is already enforced, no queue UI exists). QUALITY = missing required fields, unreachable links, rows marked open with a past date, 0-content hubs, AI-touched rows — each row deep-linking into the editor. And set `updated_by` automatically, because attribution today is **5 human edits ever** and every `sarkari_naukri` row is NULL. | Owner (oversight), intern (a to-do list instead of memory) | **High** for the owner | **M** | #13 for the surface; #11 for the AI audit rows; `audit_log` exists with 0 rows | §3.3 J7, §3.5, §3.6 |
| **15** | **Per-record alerts ("Notify me when this changes")** — the reader's N8 — starting as a state + post-type digest rather than 361 individual subscriptions, so the sender cost and the consent store are introduced at a survivable size. Needs: a subscriber table, a sender (the existing Telegram bot / a WhatsApp channel or Business API), and a scheduler. | Reader (the single biggest retention lever), owner (owned audience, not Google-dependent) | **High** but slowest | **L** | a sender decision (§9 Q4); **`pg_cron` is not installed** (measured 0 rows in `pg_extension`), so scheduling is new infrastructure; #6 as the content of the message | §4 N8, §2.5, §10 S5 |

**Honest notes on this ranking.**

- #2 and #4 are not reader-experience changes; they are in the top 15 because leaving a live key anonymous-readable and throwing away the one dataset that would settle naming are both things nobody downstream will fix by accident.
- #15 outranks nothing above it and still costs more than everything above it combined. If you only have capacity for two weeks of work, do #1–#7 and #10; #15 is the one to park with a written reason rather than half-build.
- **What is ranked 16th, i.e. first out:** §10 T1 — the contact form does not save anything, so the corrections channel is dead. It is a two-hour fix and I would do it in the same PR as #3, but only the small minority of readers ever try to contact a site, so on the rule above it does not beat #15. If you weight owner liability over reader volume, promote it.
- §10 items that earned a place in this list: **A1 → #10**, **S1 + S2 → #2**, **C1/C2 have #1 as their precondition**, **AN1 + AN3 → #14**, **AL4 = #15**, and #3 (empty hubs) came from §2.2. The rest of §10 is deliberately below these 15 with its impact and effort stated there.

---

## 9. Questions only the owner can answer

Each has the evidence that prompted it. I have not acted on any of them.

### 9.1 The one decided rule I have to flag as not implemented (the brief asks for real conflicts)

**Decision as written:** *"Answer key and previous papers exist as features and show only where content exists."*
**Measured:** the per-entity gate works; the **static hub routes do not consult it**. `/answer-key`, `/previous-papers`, `/results`, `/admit-card`, `/date-sheet`, `/syllabus`, `/study-material`, `/mock-test` all return **200**, all `index, follow`, all self-canonical, and their `<main>` says "**0 exams**" / "**0+ exams**" — while the homepage's own "Quick access" strip and every footer link to them.

So the rule is enforced where we control the route through the registry, and broken where we wrote a page by hand. **Question:** do you want those hubs (a) hidden until populated — `noindex` + removed from the strip, my #3; or (b) **fed from `sarkari_naukri`**, which already holds 361 `result_date` values and 60 slugs ending `-result`, i.e. the results corpus exists but lives in the vacancy table and the `/results` hub reads the other shape? (b) is the bigger build and touches "one fact one place": results would then have two legitimate homes.

### 9.2 Questions

| # | Question | Why only you can answer it | Evidence |
|---|---|---|---|
| Q1 | **May I run the three AI Fill live tests** (paste a real UP notification, an SSC admit-card notice, a DU/CUET notice) in a real staff session? Today's AI Fill **auto-saves whatever it fills**, so a live run is a database write — which this brief forbids — and it spends your Groq quota. I need a yes plus either a scratch row I may write to, or your own paste in a shared screen. | quota + a write permission | §E1 auto-save line; `ai_request_logs` 0 rows |
| Q2 | **Where should the AI key live, and who pays?** Move it to an edge function (the only way it stops being browser-visible) implies a per-day call cap. Acceptable cap for the intern? | money and risk appetite | §E1 "Where the key lives", §8 #2 |
| Q3 | **How far does Hindi go?** Chrome + key-fact labels + buttons only, or real Hindi body copy per vacancy? `title_hindi` is 361/361 — someone already did the hard half — but `description_hindi` is 0/361 and the editor cannot express it. If bodies: who writes them, you, the intern, or a paid contributor? | editorial capacity | §4 N10, §2.5 |
| Q4 | **Do we build per-record alerts?** A sender is a recurring cost and a phone number you must keep verified (WhatsApp Business API) or a bot token (Telegram). Alternative: keep the broadcast channel and add email only. Which? | cost, and a legal/consent surface | §4 N8, §2.5 |
| Q5 | **Which pillar dies, and what happens to its 100 records?** `govt-vacancy` (100 `exams` rows) and `government-exam` (104) are both `recruitment`; the brief says govt-vacancy is pending retirement. `/government-exam/*` drew 460 impressions / **0 clicks**, `/ctet` alone 213 — and `/ctet` is arguably a real *exam*, not a vacancy. Retire to where: `/sarkari-naukri` for both, or `government-exam` absorbs `govt-vacancy`? | URL equity is yours to spend | §1.1, `exams` counts by pillar |
| Q6 | **Is `status` allowed to contradict the dates?** 5 rows are `application-open`; two of them are result pages by their own slug (`delhi-police-constable-2026-result`, `ssc-gd-constable-2027-result`), one's title is a different organisation from its slug (`karnataka-anganwadi-2026-mysore` = "Karnataka High Court Group D Recruitment"), and all five have NULL end date and NULL apply URL. Fix by hand, or make `status` a derived value so it cannot lie? (My view, marked as a disagreement not a fact: a stored status that no rule recomputes will drift forever. The column is derivable from `notification_date`/`application_end_date`/`result_date`.) | it may be deliberate workflow, not data | §1.1, live `sarkari_naukri` where clause |
| Q7 | **Should `total_candidates` appear on a page whose applications have not opened?** It is filled 361/361 and renders as the second row of "Quick Information" ("Total Candidates 35,000") on a vacancy page. Suppress until a result stage exists, or is the number meaningful to readers earlier? | you know what the column is meant to mean | §1.3 |
| Q8 | **Titles: change them or not?** Google's JobPosting guidance says keep dates/company/post-counts out of the title, and 361/361 of our titles carry a year. Changing the `<h1>`/`<title>` pattern for the 81 pages earning 686 clicks is a traffic risk on a site 26% dependent on one page. | risk tolerance on live traffic | §2.6, §8 #12 |
| Q9 | **Is the CMS actually used day to day?** Across the whole database there are **5 human-attributed edits ever** (`exams` 2, `exam_editions` 3, everything else 0), while `sarkari_naukri` has 273 rows created on 2026-07-31 and 87 updated on 2026-09-28 by a migration. Either the work happens outside the CMS (SQL/CSV/imports) or it is not happening. Everything in §3 assumes the CMS is where the daily work should live. | only you know the real workflow | §3.1 live `count(updated_by)` |
| Q10 | **The bulletin becomes CMS home (decided) — but who imports the traffic CSV?** `page_traffic` is applied and **has 0 rows**; there is no writer in either repo (grep across `indianexaminfo-frontend`: 0 matches) and **`pg_cron` is not installed**. The bulletin's own copy says "Import one in Settings → SEO", and the only settings screen in the router is `SettingsPage.tsx`. So the ranking the decided home depends on needs a monthly human step. Is that you, and do we build the upload now? | it is an operations commitment, not code | live `page_traffic` count; grep 0; `pg_extension` |
| Q11 | **Monetisation intent.** `ad_zones` has 6 rows, `ad_campaigns`/`ad_creatives`/`advertisers`/`ad_reports` all 0, and no ad tag was measured on any page. If display ads are the plan, Google's JobPosting policy excludes pages that "spam the page with obstructive text and images, excessive and distracting ads" — so ads above the vacancy fold and Jobs rich results are mutually exclusive. Which do you want first? | business model | live table counts; §2.6 |
| Q12 | **`/admission` vs `/entrance-exam` for the 200 pages still reporting under the old root.** The 308s work; the GSC export still shows 200 pages of `/entrance-exam/*` earning 3,648 impressions. Do we (a) leave the old URLs in sitemaps/internal links until GSC catches up, or (b) finish the rename inside the app now? I have assumed (b) in §2.1. | how long you'll wait for GSC | §1.1, `gsc-pages-2026-09-27.csv` |
| Q13 | **Do you want the four orphan editors deleted or revived?** `/exams` (ExamEditorPage, 85 KB) and `/entities/:pillar/:id` are reachable by URL but absent from the sidebar; `BoardExamListPage.tsx`/`UniversityExamListPage.tsx` are dead files on disk. They are the seed of a "one editor per entity type" design, which is a different decision from the mega-editor. | it's a design direction, not a bug | §3.1, router imports |
| Q14 | **What is the acceptance bar for "verified"?** The trigger requires an official URL + end date + publish. My walk found nothing to verify because the URLs were never entered. Is verification a gate you will personally check, or is it the intern's ordinary step? The answer changes whether the unverified notice stays on 361/361 pages or clears within two weeks. | it is a staffing decision | §2.4, §4 N3 |

### 9.3 Two things I think are wrong that you have already decided — said plainly, not acted on

1. **"The bulletin becomes CMS home."** Agreed as a direction, but it depends on `bulletin_signals` (not applied), `bulletin_editor_state` (not applied) and `page_traffic` (**applied and empty, no writer, no scheduler**). As built, the decided home opens with every traffic count reading 0 — the code says so on screen. My honest read: ship it, but ship the GSC import step *with* it, or the intern's first look at the new home is a board of zeroes. (Evidence: §9.2 Q10.)
2. **Pillar-as-nav-item in the CMS.** "Pillar decides entity type" is right in the database. In the sidebar it produced the measured outcome: **five nav entries pointing at one 2,297-line component**, and the intern cannot tell which one is "a job". I would keep the pillar rule and change only the entry point (one "Add" group, four record types) — flagging it because "do not re-propose decided items" would otherwise leave the five-entry nav in place. (Evidence: §3.1, §3.2.)

---

## 10. Beyond the brief

Not asked for. Found while walking. Same evidence standard; anything I did not measure is marked **inferred**. Impact is always relative to the three people: reader, intern, owner. IDs in **bold** are the ones I ranked into §8.

### 10.1 Content strategy — page types the reader searches for that we do not have

| ID | Missing page type | User served | Impact | Effort | Dependencies | Evidence |
|---|---|---|---|---|---|---|
| **C1** | **District pages** `/sarkari-naukri/district/gorakhpur` (and division: "up-asha-bharti-2026-gorakhpur-division" is a live top-15 slug) | Reader | High — the reader's second question after "is it open" is "is it near me" | M | `district` column exists and is NULL on **361/361**; needs #1 to fill it, then the state-page template renders it | §1.1 slugs, §4 N5 |
| **C2** | **Qualification pages** — "12th pass government jobs", "10th pass bharti", "graduate jobs in UP". The single most common self-description a first-in-family applicant uses. | Reader | High | M | there is **no qualification column at all** on `sarkari_naukri` (60 columns checked) — this is the only place in the report where a new column is genuinely required, and it should be `eligibility` parsed into a code list, not free text | §4 N4/N5, live column list |
| **C3** | **Department / conducting-body pages** — every vacancy names an organisation that is a free-text string today | Reader, owner | Medium-high — it is the "trusted source" page and the internal-link hub | M | already decided ("conducting body as a real entity with profile and filters"); **`conducting_bodies` does not exist yet** (queried: relation does not exist), bodies are text | §9.2 Q5, live schema |
| **C4** | **Post-type pages are built and orphaned.** `/sarkari-naukri/driver` exists and renders; it appears in no menu, sitemap strip or hub — only in one Related link. | Reader | Medium | S | none — this is a linking job, not a build | measured on the top vacancy page |
| **C5** | **"Closing within 7 days" as a saved link / RSS feed**, not just a homepage carousel — that carousel is the only place urgency is expressed and it cannot be followed | Reader | High | S–M | #1 (dates), C6 (feed) | §1.9 |
| **C6** | **The RSS feed excludes the corpus.** `/api/feed` (RSS and Atom, announced in the `<head>` alternates) is built from `getAllBlogPosts()` and `getLatestContentPosts()` — **never from `sarkari_naukri`**. So the one subscription surface that already works, with 12 blog posts and 112 content posts behind it, cannot deliver job notifications, which is the entire product. | Reader (low-data users, feed readers), owner | **High, near-free** | S | none — add a `type=vacancies` branch to the existing route | read `app/api/feed/route.ts`; live counts measured |
| C7 | Answer-key / previous-paper / syllabus **corpora** are the empty hubs' missing half. Before re-adding those nav items, the content plan should say what one page of each actually contains (a link to the official PDF + a date is a legitimate page; a stub is not). | reader | Medium | M | owner's editorial decision; §9.1 | §2.2 |

### 10.2 Internal linking

| ID | Finding / proposal | User served | Impact | Effort | Dependencies | Evidence |
|---|---|---|---|---|---|---|
| **L1** | **Related blocks are 3 generic links** on the top page: "More jobs in uttar pradesh · More Driver Recruitment · All Government Jobs". No link to the state page's vacancy list, no department page, no other openings for the same post in a different district, no result page for the same recruitment (which already exists as a `-result` row!). The site has 361 vacancy pages and each one links to three generic buckets. | Reader, owner (crawl depth) | High | M | C3 (bodies) and `state`/`category` (already filled) for real related-ness | verbatim `main.innerText` §1.3 |
| L2 | **The footer is the same 28 links on every page** (measured), so it carries no contextual signal, and 22 of its targets are 15–16 px tall (A1). A "Jobs by state · by post · by qualification" block that changes with the page would do both navigation and long-tail capture. | Reader | Medium | M | C1–C3 | footer link rects, measured |
| L3 | The homepage's 12-tab category lists per pillar (4 blocks, y 1244–3117) are index-page links to hub pages; the strip that is closest to the fold ("Quick access", y=1063) points at empty hubs. Replace with state links, which have data. | Reader | Medium | S | #3 | §1.9, §2.2 |

### 10.3 Alerts and subscriptions (measured surface, honest cost)

| ID | Proposal | User served | Impact | Effort | Dependencies | Evidence |
|---|---|---|---|---|---|---|
| AL1 | **Segment the existing channels instead of building a new system.** The WhatsApp channel and Telegram channel are live in the header of every page. A Telegram **bot with `/subscribe up driver`** gives per-topic alerts with no new store, no phone number, no money, and readers already have the app. WhatsApp channel posts cannot be personalised — that is its ceiling. | Reader | High for the cost | M | a bot token (§9.2 Q4) | measured links: `https://t.me/indianexaminfo`, `whatsapp.com/channel/0029Vb…` with `aria-label="Join WhatsApp Channel"` |
| AL2 | **Email digest** (state + post-type weekly) — lowest trust cost, needs a sender and a consent store; second choice after AL1 because this audience is on WhatsApp, not email. | Reader | Medium | M | sender + `subscribers` table | **inferred** from the audience profile in the brief; not measured |
| AL3 | **Web push is not available today**: there is **no service worker** in the frontend repo (searched `app/`, `public/` for `sw.js` — none) even though `app/manifest.ts` makes the site installable (`display: standalone`, SVG-only icons, `lang: en-IN`, no `shortcuts`). Install → no offline, no push. | Reader | Medium | M | a service worker; #5/#6 give it something worth caching | both files measured |
| AL4 | **Per-record notify** = §8 #15. Kept out of this list's detail because it is already ranked. | Reader | High | L | §9.2 Q4 | §4 N8 |

### 10.4 Accessibility and low-literacy reading — all measured on the top vacancy page

| ID | Measured | Standard / why it matters | Impact | Effort |
|---|---|---|---|---|
| **A1** | **35 of 35** tappable elements in header/main/footer are shorter than 44 px; the smallest are **15 px** (footer "SSC Jobs", "Banking Jobs", "Railway Jobs", "State Jobs"…). 22 of 28 footer links measure 15–16 px. Header logo 36×36, search 34×34. | WCAG 2.2 **SC 2.5.8 Target Size (Minimum), Level AA: "at least 24 by 24 CSS pixels"** ([W3C Understanding](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)); Google's mobile guidance and Apple HIG both say 44 px. On a cheap Android handset with a cracked screen and a thumb, a 15 px target is a mis-tap, and a mis-tap on "Apply Online" is a lost application. | Medium-high | S–M |
| A2 | Devanagari visible on the page with **`lang="hi"` on 0 elements**; `html lang="en-IN"`. | A screen reader set to `en-IN` reads Hindi words with English phonemes — the reader who needs assistive tech gets the least comprehensible version of the one part of the page that is in their language. | Medium | S |
| A3 | **2 tables, 0 `<th>` cells**, 0 `scope` attributes — the "Quick Information" table is a 2-column label/value list marked up as a data table with no header cells. | Assistive tech announces "row 2, column 2, 35,000" with no idea that column 1 was the label. Either use `<th scope="row">` or make it a definition list. | Medium | S |
| A4 | **2 `<main>` landmarks** on one page. | Skip-links and screen-reader navigation assume one `main`. Two makes the "jump to content" command ambiguous. | Low-medium | S |
| A5 | 4 text nodes render **below 13 px** (9, 10, 12, 12); body is 16 px / line-height 24 px. | Sub-12 px is unreadable on a small low-DPI screen at arm's length, which is how this audience reads. | Medium | S |
| A6 | The four "corrections / advertise / partner / feedback" cards on `/contact` are `<div>`s with no link and no button (`app/(public)/contact/page.tsx:30–35`) — **inferred** as a problem, measured as markup. | Low-literacy guidance is recognition over recall: a box that looks like a control must be one ([ACM CSCW 2021](https://dl.acm.org/doi/10.1145/3449210), [MSR India](https://www.microsoft.com/en-us/research/publication/designing-mobile-interfaces-for-novice-and-low-literacy-users/)). | Low-medium | S |
| A7 | Rules worth adopting whole: never colour-only status (the site already pairs chips with words), one primary verb per screen, every number with a unit and a date ("35,000 candidates · 2024"), never an icon without a word. | The brief's reader is "often first in family to apply" — each of these is a comprehension failure, not a preference. **inferred**; the violations it targets are measured (A1, A3, §2.2 icon-only footer links). | Medium | S |

### 10.5 Analytics — what readers actually do is currently unmeasurable

| ID | Finding / proposal | User served | Impact | Effort | Dependencies | Evidence |
|---|---|---|---|---|---|---|
| **AN1** | **There is no analytics of any kind on the public site.** Measured on the top page: 6 `<script src>`, 19 inline scripts, **0 third-party origins** and no `gtag`/`dataLayer`/`ga`/`plausible`/`umami`/`clarity`/`hotjar` global on `window`. So the whole product decision base is one monthly manual GSC CSV (which is why §1.1 is page-level and §0.2 has no queries). | Owner, intern | **High** | M | choose: a first-party counter (`page_traffic` already models url/period/clicks/impressions) fed by GSC import, or a privacy-light self-hosted counter. The "0 third-party scripts" state is an asset — keep it. | measured `window` keys + script srcs |
| AN2 | `entity_download` exists with **0 rows** — a download-tracking table that nothing writes. Admit-card and result-page downloads are the reader's actual action (N7); measuring it is a wiring job, not a build. | Owner | Medium | S | nothing | live table count |
| AN3 | `audit_log` exists with **0 rows**, so even staff behaviour is unmeasured — which is how "5 human edits ever" stayed invisible until this walk. | Owner | Medium | S | §8 #14 | live table count |
| AN4 | Add one number to the CMS every day: **"records published yesterday / verified this week / with a last date in the next 7 days"** — the bulletin already computes the last bucket. A product with no analytics still has a database, and it is currently the unused instrument. | Intern, owner | Medium | S | §9.2 Q10 | §10.5 AN1 |

### 10.6 Trust and editorial transparency — one finding here is the most damaging in §10

| ID | Finding / proposal | User served | Impact | Effort | Dependencies | Evidence |
|---|---|---|---|---|---|---|
| **T1** | **The contact form does not work.** `/contact` (42 words of visible copy) renders `<form aria-label="Contact form">` with `name`, `email`, `subject`, `message` and a `type="submit"` button — and **no `action`, no `method`, no submit handler**, on a server component with `revalidate = 604800`. `app/api/` contains only `ads/[position]`, `feed`, `feed/atom`, `revalidate`, `search` — **there is no contact endpoint**. Submitting does a GET to `/contact?name=…&email=…`, the page reloads identically, and the reader's correction — including "your last date is wrong" — goes nowhere. The subject dropdown's first option is literally **"Editorial Correction"**. | Reader (scam-wary, wants to ask), owner (corrections, liability) | **High — ranked 16th overall, first item outside §8 (see the note there)** | S–M | none (one edge function; a `mailto:`/WhatsApp fallback works today) | `page.tsx:40–66` read + DOM probe: `formAction: "(none)"`, inputs enumerated, `mailtos: []` site-wide |
| T2 | **No email address exists anywhere on the public site** — 0 `mailto:` links across `/about`, `/disclaimer`, `/privacy-policy`, `/contact` (measured). With a dead form, there is exactly one reachable channel and it is a Telegram link. | Reader, owner | High | S | T1 | measured `a[href^="mailto:"]` = 0 on 4 pages |
| T3 | **No editorial policy, no corrections page, no named human.** `/about` = 175 words and does not name a single person; `app/(public)/` contains `about`, `contact`, `disclaimer`, `privacy-policy` and **no `editorial-policy`, no `corrections`, no `team`**. For a YMYL site whose whole product is "is this deadline real", E-E-A-T is currently carried by a 195-word disclaimer and a self-awarded H1 ("India's Most Trusted Exam Information Portal"). | Reader, owner (and Google's quality rater) | High | S–M | a real person's name and a real address for correction reports (T1) | word counts measured with `<script>` removed; route directory listing |
| T4 | Add a **"Report an error on this page"** link in every vacancy/exam footer block, pre-filled with the record id. It is the cheapest possible quality signal to a scam-wary reader and the only realistic way the intern learns that a date moved. | Reader, intern | Medium-high | S | T1 | inferred from T1+T3 (the mechanism does not exist today) |
| T5 | **A scam warning the reader actually needs**: "We never ask for money. Any site asking you to pay for this form is not us." Today the page says the opposite-ish thing (a *bilingual unverified notice*) in a paragraph above the fold, and the notice is on **361/361** rows. Rebalance: one short "we never collect fees" line permanently, plus the per-record verified/amber chip (§2.4). | Reader | High for this audience | S | none | §2.4 measured `is_verified` 0/361 |
| T6 | Data-protection basics: `/privacy-policy` is 218 words with **no contact route** (see T2). If per-record alerts or a counter are added (§8 #15, AN1), the policy must state what is stored, for how long, and how to delete it — India's DPDP Act 2023 is the frame a reader's parent will be told about on TV. | Owner (legal), reader | Medium-high | S | T2 | measured word count; **inferred** legal framing — get a real opinion, I am not a lawyer |

### 10.7 Monetisation that does not hurt trust

| ID | Proposal | User served | Impact | Effort | Dependencies | Evidence |
|---|---|---|---|---|---|---|
| M1 | The ad system is **built and entirely unused**: `ad_zones` 6 rows, `ad_campaigns`/`ad_creatives`/`advertisers`/`ad_reports` all 0, and no ad tag on the measured page (0 third-party scripts). Before any ad ships, write the placement rule down: nothing above the fold on a vacancy page, nothing beside the Apply button, one unit after "Related". Google's JobPosting policy disallows pages that "spam the page with obstructive text and images, excessive and distracting ads" — so §8 #8 and an ad-heavy vacancy page are mutually exclusive. | owner (revenue), reader (trust) | High for the trade-off | S (a policy) | §9.2 Q11 | live table counts + measured scripts |
| M2 | Monetise the **partnership** path first (`/contact` already lists "Colleges, coaching institutes, publishers" and `/api/ads/[position]` exists): a labelled, clearly-marked "Sponsored" block on the *listing* pages, never the detail page. Trust is the only asset a free-info site has against a scam; sell adjacency, not authority. | owner, reader | Medium | M | T3 (an editorial policy that says what will never be sold) | `app/api/ads/[position]/route.ts` exists; `/contact` copy |
| M3 | Do **not** put ads on the 5 empty hubs; they'd be the only content, which is the exact pattern Google's policy names. | owner | Low-medium | S | #3 | §2.2 |

### 10.8 Offline and low-data use

| ID | Proposal | User served | Impact | Effort | Evidence |
|---|---|---|---|---|---|
| O1 | A vacancy page is **132 words** of text shipping **430 KB over 19 requests** (6 `<script src>` + 19 inline = 25 script elements, 1 `<img>`). The cheapest wins are ours already: no images to strip, no fonts, no third parties. Cut the duplicate desktop carousel DOM on the homepage (616 KB HTML), and defer below-the-fold blocks. | Reader (paid data) | Medium-high | M | §2.5 tables |
| O2 | **Print / "Save this"**: a print stylesheet that emits a one-page checklist (post, last date, fee, documents required, apply URL as text) — the reader who has no data for an hour still has the paper, and this audience prints at cyber cafés. Near-zero engineering. | Reader | Medium | S | **inferred** from the audience description; the print path itself is not measured |
| O3 | Add `"shortcuts"` to `app/manifest.ts` (Sarkari Naukri, Result, Admit Card, Today) so an installed PWA gives one-tap entry; today the manifest is installable with SVG icons and no shortcuts, and there is no service worker (AL3). | Reader | Low-medium | S | `app/manifest.ts` read |

### 10.9 Content operations — one intern is not a plan

| ID | Proposal | User served | Impact | Effort | Dependencies | Evidence |
|---|---|---|---|---|---|---|
| OPS1 | **Name the daily unit of work.** Today the corpus grew by bulk import (273 rows on 2026-07-31) and has had 5 human edits ever, so there is no observable "daily quota" to plan around. Propose the number the design should support: **12 verified records/day** (≈ 2–3 min each with AI Fill + the verify gate), i.e. ~40 pages/week of genuinely new, complete, dated content. | intern, owner | High | S (a decision) | #11, #14 | §3.1 activity counts |
| OPS2 | **A `sources` watchlist table** (department/regulator URLs the intern checks every morning, with `last_checked_at`). Nothing like it exists — `grep conducting_bodies` → relation does not exist, and there is no source table in the schema. Without it, "new notification today" is discovered by accident, and the bulletin's "new from source" bucket has no feeder. | intern, owner | High | M | §9.2 Q5, C3 | live schema query |
| OPS3 | **Split the roles before hiring the second intern**: sourcer (finds the PDF, pastes it) → verifier (checks dates + links, presses Verify) → language (Hindi key facts). Each is a distinct permission and a distinct screen in §3.5; today one role does all three with no review path, and `updated_by` is NULL so you cannot even audit who did what. | owner | Medium-high | M | #14 (attribution), §3.5 | §3.5, live `updated_by` |
| OPS4 | **Freshness decay rules, written down**: a vacancy with a past `application_end_date` and no result → auto-move to "Closed" and re-link its Related block; an exam edition 30 days past its last date → prompt "start next edition" (the capability exists, `cycle_frequency` + `startNewEdition`, and **no route mentions edition**). Otherwise the corpus rots the way the current 300 "completed" rows rotted. | reader, owner | High | M | #1 | §4 N1, §3.3 J5, live status counts |

### 10.10 Security and data-quality risks noticed on the way

| ID | Risk | User served | Impact | Effort to fix | Evidence |
|---|---|---|---|---|---|
| **S1** | **A live AI key is readable by anonymous visitors.** `settings` has `ai_fallback_key` with `is_sensitive = false` (58 chars, value not printed here) and the read policy `public_read_settings` matches `is_sensitive = false`. Verified as the anon role: 23 rows visible, `fallback_key_visible: true`, `primary_key_hidden: true`. Anyone with a browser can read it. | owner | **High** | S | live `set role anon` probe |
| **S2** | **Keys are used from the browser and stored in plaintext.** `OpenAICompatibleAdapter` sends `Authorization: Bearer <key>` to Groq from the SPA; `ai_providers.api_key` is `text` (56 chars) and `api_key_encrypted` is filled on **0/2** rows; `staff_read_ai_providers` grants SELECT to any authenticated user (`auth.uid() IS NOT NULL`) — so an intern's DevTools shows the provider key, and a future staff account with a leaked session does too. | owner | High | M | adapter code, live column lengths + policy def |
| S3 | **No proxy, no cap, no log.** Only 2 edge functions exist (`admin-set-temp-password`, `revalidate-frontend`); `ai_request_logs` has 0 rows. A browser-driven AI path with no rate limit is the owner's quota on the internet. | owner | Medium-high | M | §E1 |
| S4 | **Data that contradicts itself in public.** 5 rows are `application-open` while being result slugs; one row's title is a different organisation from its slug; `total_candidates` 361/361 on pre-application pages; CAT's registration window is the same day; `important_dates` carries **two different shapes** (typed `{date,type,label,state,isUrgent,verified,stage_label}` in 292 editions vs untyped `{date,label,isUrgent}` in 104) so "admit card" is findable in one and not the other. | reader | High | M | live counts, §1.7, §9.2 Q6–Q7 |
| S5 | **No scheduler and no writer** for anything operational: `pg_cron` is **not installed** (0 rows in `pg_extension` for it), `page_traffic`/`entity_download`/`audit_log`/`ai_request_logs` all have 0 rows, and no public-site code references `page_traffic` (0 grep matches). Every "automatic" promise in this report needs either a human step or a new piece of infrastructure — say so before committing to one. | owner | High (planning honesty) | M | live queries |
| S6 | **Redirect and orphan-URL hygiene**: `/sarkari-result`, `/sarkari-results`, `/latest-jobs` are unreachable (404-class, verified against a control URL that does not exist), while `/government-exam` and `/govt-vacancy` 307 and `/entrance-exam` 308. Any of those could be a live link in someone's browser history or a WhatsApp forward from 2024. A `url_redirects`-style table does **not** exist in the DB (relation not found) — redirects live only in `next.config`, so they are invisible to the CMS and un-auditable. | reader | Medium | M | HTTP status sweep with control; live schema |

### 10.11 Things neither of us asked about, found anyway

- **`hreflang` is `en-IN` only while the page is half Hindi** (`app/layout.tsx:80` read; `lang="hi"` on 0 elements measured). If Hindi ever gets its own URL, this becomes a real SEO bug; today it is an accessibility bug (A2).
- **The site is a single page of truth for 26% of its traffic, and that page is a `sarkari_naukri` row that has never been opened by a human in the CMS** (`updated_by` NULL on 361/361, 87 rows last touched by migration P1d). The most-visited object in the product is also the least-governed one.
- **"DATES AWAITED" is honest.** The badge on the top page is correct — dates really are awaited. The failure is not the UI telling the truth; it is that nothing in the workflow turns that honest state into a to-do for the intern. §8 #1 + OPS2 fix that; the badge should then disappear from the site within a fortnight. *(inferred as intent, measured as behaviour.)*
- **The homepage H1 claims the trust the pages disclaim.** "India's Most Trusted Exam Information Portal" (measured H1) next to "This information has not yet been verified against the official notification" on every vacancy (measured 361/361). One of the two should change, and it cannot be the notice.
- **Nothing in this investigation cost money except S1/S2.** The top 15 is a content-and-arrangement programme with one security fix at the front, which is the good news the owner did not ask for.
