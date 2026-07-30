# University & Board Content Discovery Audit

**Date:** 2026-07-30  
**Scope:** Read-only investigation of existing data, schema, UI, and routes related to universities, boards, results, and admissions.  
**Status:** AUDIT COMPLETE — No data created or modified.

---

## 1. EXISTING CONTENT TYPES & TABLES

### 1.1 Primary Production Tables

| Table | Rows | Purpose | Used by Frontend |
|-------|------|---------|-----------------|
| `exams` | 402 | Master entity table for ALL pillars | ✅ Primary data source |
| `exam_editions` | 402 | Temporal cycle data (dates, status, fees per year/session) | ✅ Via `current_edition_id` FK |
| `categories` | 56 | Hierarchical taxonomy (pillar, parent_id, exam_count) | ✅ Navigation & filtering |
| `content_posts` | 0 | Typed content (result, admit-card, etc.) linked to exams | ✅ (empty) |
| `sarkari_naukri` | 361 | Standalone recruitment/job listings (separate system) | ✅ |
| `cms_education_news` | 100 | News articles (board-results, university-admissions, etc.) | Separate system |

### 1.2 `exams` Table Schema (51 columns)

```
id                  uuid NOT NULL (PK, gen_random_uuid())
slug                text NOT NULL (UNIQUE)
name                text NOT NULL
short_name          text NOT NULL
pillar              enum: 'sarkari-naukri' | 'entrance-exam' | 'board-university'
category_id         uuid → categories.id
subcategory_id      uuid → categories.id
entity_type         enum: 'exam' | 'board' | 'university' | 'recruitment'
conducting_body     text NOT NULL
official_website    text
status              enum: upcoming|active|registration-open|registration-closed|result-declared|completed|ongoing
has_admit_card      boolean (+ has_result, has_answer_key, has_syllabus, has_date_sheet, has_mock_test, has_previous_papers, has_study_material, has_application, has_notification, has_cutoff)
vacancy             integer
academic_year       text
semester            text
admission_to        text
eligibility         jsonb DEFAULT '{}'
application_fee     jsonb DEFAULT '{}'
important_dates     jsonb DEFAULT '[]'
faqs                jsonb DEFAULT '[]'
selection_process   text[]
syllabus_highlights text[]
tags                text[]
search_keywords     text[]
seo_title           text
seo_description     text
is_featured         boolean DEFAULT false
is_published        boolean DEFAULT false
last_updated        date DEFAULT CURRENT_DATE
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
created_by          uuid
fts                 tsvector (full-text search index)
type_fields         jsonb DEFAULT '{}' (entity-type-specific extensions)
cycle_frequency     text DEFAULT 'annual'
current_edition_id  uuid → exam_editions.id
canonical_url       text
ai_metadata         jsonb DEFAULT '{}'
scheduled_at        timestamptz
locked_by/locked_at uuid/timestamptz (collaborative editing)
```

### 1.3 `exam_editions` Table (temporal per-year data)

Each exam has one or more editions (year + session). Fields: year, session, edition_label, is_current, status, notification_date, important_dates (jsonb), eligibility (jsonb), vacancy, application_fee (jsonb), age_limit, has_* flags, seo_title/description, result_summary, counselling_data, content_modules (jsonb), faqs (jsonb).

### 1.4 `sarkari_naukri` Table (separate system, 361 rows)

Fields: slug, recruitment_type, title, title_hindi, organization, organization_hindi, department, state, district, category, vacancy_count, eligibility, age_limit, pay_scale, application_fee (jsonb), description, notification_date, application_start_date, etc.

---

## 2. UNIVERSITY/BOARD-SPECIFIC DATA

### 2.1 Distribution in `exams` Table (pillar = 'board-university')

| entity_type | Category | Count |
|-------------|----------|-------|
| **board** | other-state-boards | 18 |
| board | cbse | 4 |
| board | bihar-board | 2 |
| board | icse-board | 2 |
| board | rajasthan-board | 2 |
| board | wb-board | 2 |
| board | mp-board | 2 |
| board | maharashtra-board | 2 |
| board | haryana-board | 2 |
| board | up-board | 2 |
| **university** | state-university | 21 |
| university | central-university | 5 |
| university | deemed-university | 5 |
| university | professional-university | 3 |
| university | open-university | 3 |
| **TOTAL board** | | **38** |
| **TOTAL university** | | **37** |
| **GRAND TOTAL** | | **76 (+ 1 exam)** |

### 2.2 Sample University Entries (first 10 of 37)

| Slug | Name | Conducting Body | Category |
|------|------|-----------------|----------|
| aktu-exam | AKTU (Dr. APJ Abdul Kalam Technical University) | AKTU Lucknow | state-university |
| amity-entrance | Amity University Entrance (Amity JEE) | Amity University | deemed-university |
| amu-admission | AMU Admission Test (AMUEEE) | Aligarh Muslim University | central-university |
| anna-university-exam | Anna University Exams | Anna University | state-university |
| bangalore-university-exam | Bangalore University Exams | Bangalore University | state-university |
| bhu-uet | BHU UET/PET Entrance Exam | Banaras Hindu University | central-university |
| bits-pilani-exam | BITS Pilani (BITSAT) | BITS Pilani | deemed-university |
| braou-exam | BRAOU (Dr. BR Ambedkar Open University) | BRAOU | open-university |
| calutta-university-exam | Calcutta University Exams | University of Calcutta | state-university |
| ccs-university-meerut | CCS University Meerut Exams | Chaudhary Charan Singh University | state-university |

### 2.3 Sample Board Entries (first 10 of 38)

| Slug | Name | Conducting Body | Category |
|------|------|-----------------|----------|
| cbse-class-10 | CBSE Class 10 Board Exam | CBSE | cbse |
| cbse-class-12 | CBSE Class 12 Board Exam | CBSE | cbse |
| bihar-board-inter | Bihar Board Inter (Class 12) | BSEB | bihar-board |
| bihar-board-matric | Bihar Board Matric (Class 10) | BSEB | bihar-board |
| ap-board-class-10 | AP Board SSC (Class 10) | AP Board of Secondary Education | other-state-boards |
| icse-class-10 | ICSE Class 10 Board Exam | CISCE | icse-board |
| isc-class-12 | ISC Class 12 Board Exam | CISCE | icse-board |
| gujarat-board-class-10 | Gujarat Board SSC (Class 10) | GSEB | other-state-boards |
| haryana-board-class-10 | Haryana Board Class 10 (BSEH) | BSEH | haryana-board |
| up-board-class-10 | UP Board Class 10 | UP Board | up-board |

### 2.4 IGNOU & NIOS (Special Bodies)

| Slug | Name | Type | Category |
|------|------|------|----------|
| ignou-exam | IGNOU Term End Examination | university | open-university |
| nios-class-10 | NIOS Class 10 (Open Schooling) | board | cbse |
| nios-class-12 | NIOS Class 12 (Open Schooling) | board | cbse |

**Note:** NIOS is categorized under "cbse" which is semantically incorrect (it's open schooling, not CBSE). Should be under a dedicated "nios" or "open-schooling" category.

### 2.5 Data Population Quality

All 37 university entries have:
- ✅ `has_dates` (important_dates populated)
- ✅ `has_eligibility` (eligibility jsonb filled)
- ✅ `has_seo` (seo_title present)
- ✅ `has_tags` (tags array populated)
- ❌ `has_faqs` (faqs array empty on ALL entries)
- ❌ `has_vacancy` (null on ALL entries)

All 38 board entries have editions with:
- ✅ `ed_has_dates` (important_dates in edition)
- ✅ `ed_has_modules` (content_modules populated)
- ❌ `ed_has_faqs` (empty on ALL)

**Assessment:** Entries are structurally sound (dates, eligibility, SEO filled) but lack FAQs and deep content. They appear to be AI-generated shells with correct metadata but no editorial depth yet.

---

## 3. CMS ADMIN UI

### 3.1 Router Configuration (Active Routes)

```
/board-exams           → BoardExamsListPage (filters pillar=board-university)
/board-exams/new       → EntranceExamEditorPage (auto-detects pillar from URL)
/board-exams/:id       → EntranceExamEditorPage

/university-exams      → UniversityExamsListPage (filters pillar=university-exam)
/university-exams/new  → EntranceExamEditorPage
/university-exams/:id  → EntranceExamEditorPage
```

### 3.2 Sidebar Navigation

Both "Board Exams" and "University Exams" appear in the CMS sidebar under the CONTENT section. They are LIVE and functional — not hidden or stubbed.

### 3.3 Editor Architecture

ALL pillar editors (entrance-exams, govt-exam, sarkari-bharti, board-exams, university-exams) use the **same** `EntranceExamEditorPage` component. Pillar is auto-detected from the URL path. This means any new board/university entries can be created through the existing UI with no code changes.

### 3.4 Bulk Import/Export

Newly added (this session): Excel import/export is available on all list pages including Board Exams and University Exams.

---

## 4. FRONTEND ROUTES (Next.js App Router)

### 4.1 Active Board/University Routes

```
/board-exam                                    → Hub page (LIVE, renders all board-university pillar)
/board-exam/cbse/[class]                       → CBSE class-specific pages
/board-exam/state/[stateSlug]                  → State board landing
/board-exam/state/[stateSlug]/[slug]           → State board exam detail
/board-exam/state/[stateSlug]/[slug]/[contentType] → Content type page (result, date-sheet, etc.)
/board-exam/university/[slug]                  → University detail page (LIVE)
/board-exam/university/[slug]/[contentType]    → University content type (result, admit-card, etc.)
```

### 4.2 Results Hub

```
/results                                       → Results hub (LIVE, aggregates all content_posts with type=result)
```

This page pulls from `content_posts` table (currently 0 rows) AND lists exams with `hasResult=true`. It's functional but shows no content_posts yet.

### 4.3 Content Type Hubs

```
/admit-card     → Admits hub (LIVE)
/answer-key     → Answer key hub (LIVE)
/date-sheet     → Date sheet hub (LIVE)
/syllabus       → Syllabus hub (LIVE)
```

### 4.4 Missing Routes (NOT YET BUILT)

- ❌ `/admission` — No dedicated admission hub exists
- ❌ `/university` — No top-level university listing (universities live under `/board-exam/university/`)
- ❌ `/board` — No standalone board listing (boards live under `/board-exam/state/`)

### 4.5 Route Status Assessment

| Route | Status | Data Source |
|-------|--------|-------------|
| /board-exam | ✅ LIVE | `exams` where pillar=board-university |
| /board-exam/university/[slug] | ✅ LIVE | `exams` where entityType=university |
| /board-exam/state/[stateSlug]/[slug] | ✅ LIVE | `exams` where entityType=board |
| /results | ✅ LIVE (empty content) | `content_posts` (0 rows) + `exams` |
| /admission | ❌ NOT BUILT | — |

---

## 5. CATEGORY/TAXONOMY SYSTEM

### 5.1 Board-University Categories (17 active)

| Slug | Name | exam_count |
|------|------|------------|
| state-university | State Universities | 21 |
| other-state-boards | Other State Boards | 18 |
| central-university | Central Universities | 5 |
| deemed-university | Deemed & Private Universities | 5 |
| cbse | CBSE Board | 4 |
| open-university | Open/Distance Universities | 3 |
| professional-university | Professional/Technical Universities | 3 |
| bihar-board | Bihar Board (BSEB) | 2 |
| haryana-board | Haryana Board (BSEH) | 2 |
| icse-board | ICSE/ISC Board | 2 |
| maharashtra-board | Maharashtra Board (MSBSHSE) | 2 |
| mp-board | MP Board (MPBSE) | 2 |
| rajasthan-board | Rajasthan Board (RBSE) | 2 |
| up-board | UP Board | 2 |
| wb-board | West Bengal Board (WBBSE) | 2 |
| university-exams | University Exams | 1 |
| state-boards | State Boards | 0 ⚠️ |

**Issues Found:**
1. `state-boards` category has exam_count=0 — it's an umbrella category with no entries (entries go directly to individual state board categories).
2. NIOS entries are miscategorized under `cbse` instead of having their own category.
3. No `ignou` or `nios` dedicated category exists — they're folded into `open-university` and `cbse` respectively.
4. `university-exams` (exam_count=1) overlaps with `state-university`, `central-university`, etc. — appears to be an unused catch-all.

### 5.2 Entrance-Exam Category Relevant to Universities

| Slug | Name | exam_count |
|------|------|------------|
| university-entrance | University Entrance | 20 |

This contains exams like CUET-UG, CUET-PG, AMU Entrance, Christ CUET, etc. — entrance exams TO universities, not university result/admission pages.

---

## 6. OVERLAP CHECK

### 6.1 Cross-Pillar Duplicates Found

Several university-specific entries exist in BOTH pillars:

| entrance-exam pillar | board-university pillar | Overlap |
|---------------------|------------------------|---------|
| `amu-entrance` (AMU Entrance Exam) | `amu-admission` (AMU Admission Test) | **DUPLICATE** — same university, similar content |
| `bitsat` (BITS Admission Test) | `bits-pilani-exam` (BITS Pilani BITSAT) | **DUPLICATE** — identical exam |
| `bhu-uet` does NOT appear in entrance-exam | `bhu-uet` (BHU UET/PET) | Only in board-university ✓ |
| `cuet-ug` / `cuet-pg` (entrance-exam) | `du-admission` (board-university) | **Partial overlap** — CUET is the entrance test, DU Admission is the process |

### 6.2 University Entrance Exams in entrance-exam Pillar (20 entries)

These are correctly placed — they are national entrance tests (CUET, AMU, Christ, etc.) that lead to university admission. However, some like AMU and BITSAT are duplicated across pillars.

### 6.3 Recommendation Flags

- **AMU:** Merge `amu-entrance` (entrance-exam) and `amu-admission` (board-university) into one entity
- **BITSAT:** Merge `bitsat` (entrance-exam) and `bits-pilani-exam` (board-university) into one entity
- **CUET ↔ DU:** Keep separate — CUET is a multi-university test, DU Admission is institution-specific

---

## 7. SEO/URL STRUCTURE

### 7.1 Current URL Patterns

| Content Type | URL Pattern | Example |
|-------------|-------------|---------|
| University detail | `/board-exam/university/{slug}` | `/board-exam/university/ignou-exam` |
| University result | `/board-exam/university/{slug}/result` | `/board-exam/university/aktu-exam/result` |
| Board detail | `/board-exam/state/{category}/{slug}` | `/board-exam/state/cbse/cbse-class-10` |
| Board result | `/board-exam/state/{category}/{slug}/result` | `/board-exam/state/cbse/cbse-class-12/result` |
| Entrance exam | `/entrance-exam/{category}/{slug}` | `/entrance-exam/management/cat` |
| Results hub | `/results` | — |
| Sarkari naukri | `/sarkari-naukri/{category}/{slug}` | — |

### 7.2 Slug Conventions

- Slugs are lowercase, hyphen-separated, max 60 chars
- Prefer short_name for slug generation (e.g., "CAT" → `cat`, "CBSE 10th" → `cbse-class-10`)
- Year is stripped from slugs (editions handle temporal data)
- No trailing slashes

### 7.3 SEO Implications for New Content

Any new schema for 500+ universities/boards MUST:
1. Keep `/board-exam/university/{slug}` pattern (37 existing indexed URLs)
2. Keep `/board-exam/state/{category}/{slug}` pattern (38 existing indexed URLs)
3. If adding `/admission` hub, it should be NEW (no redirect needed)
4. If changing NIOS from `cbse` category to new category, 301 redirect needed for `/board-exam/state/cbse/nios-class-10` → new path
5. Content type sub-pages (`/result`, `/admit-card`, `/date-sheet`) are already wired and functional

### 7.4 Existing Redirects (next.config.ts)

```
/exam/:slug      → /sarkari-naukri/:slug (permanent)
/result          → /results (permanent)
```

---

## SUMMARY & KEY FINDINGS

### What Already Exists
- **76 board/university entities** in production `exams` table (38 boards + 37 universities + 1 exam)
- **17 board-university categories** properly structured
- **Full CMS editor** functional for boards/universities (shared `EntranceExamEditorPage`)
- **Frontend routes** live for `/board-exam/university/[slug]` and `/board-exam/state/[category]/[slug]`
- **Edition system** active — all 76 entries have 2026 editions
- **IGNOU and NIOS** both exist as entries

### What's Missing for 500+ Scale
- **~425+ more university entries** needed (currently 37)
- **FAQs** empty on ALL board/university entries
- **Content posts** = 0 rows (no actual result/admission content published)
- **No `/admission` hub** exists
- **No dedicated NIOS category** (miscategorized under CBSE)
- **No state-wise university filtering** — all state universities are in one flat `state-university` category
- **Overlap/duplicates** between entrance-exam and board-university pillars (AMU, BITSAT)

### Schema Readiness Assessment

The existing schema (`exams` + `exam_editions` + `categories` + `content_posts`) CAN support 500+ entities without structural changes:
- `entity_type` distinguishes boards from universities
- `category_id` provides taxonomy
- `content_posts` (currently empty) supports typed content (result, admission, date-sheet)
- `exam_editions` handles annual cycles
- `content_modules` (in editions) supports rich modular content

**The gap is DATA, not SCHEMA.** The architecture supports the initiative — it needs category refinement (more granular state-wise categories) and bulk content creation.
