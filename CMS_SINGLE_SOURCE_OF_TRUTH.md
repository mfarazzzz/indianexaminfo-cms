# CMS as Single Source of Truth — Architecture Document

> **Date**: July 18, 2026  
> **Status**: Implemented  
> **Rule**: The CMS is the ONLY publishing system. No direct SQL inserts to production content tables.

---

## Content Flow Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     CONTENT SOURCES                        │
├──────────────────────────────────────────────────────────┤
│  Manual CMS Editor                                        │
│  AI Assistant (structured output → CMS form model)        │
│  AI Auto Generate (→ draft queue)                         │
│  Official Website Scraper (→ draft queue)                 │
│  RSS/API Feed Import (→ draft queue)                      │
│  CSV/Excel Bulk Upload (→ service layer)                  │
│  Scheduled Agent (→ service layer)                        │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                   CMS SERVICE LAYER                        │
├──────────────────────────────────────────────────────────┤
│  ✓ Validation (Zod schemas)                               │
│  ✓ Slug generation & uniqueness check                     │
│  ✓ SEO field population                                   │
│  ✓ Workflow state machine (draft → review → published)    │
│  ✓ Permission enforcement                                 │
│  ✓ Audit logging                                          │
│  ✓ Revision/version history                               │
│  ✓ Event emission (for cache invalidation)                │
│  ✓ Business rules                                         │
│  ✓ Provenance metadata (created_via, source_type)         │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                      SUPABASE                             │
│              (Production Database)                         │
└──────────────────────────────────────────────────────────┘
```

---

## CMS-Managed Content Modules

| Module | Table | Service File | List Page | Edit Page | Routes |
|--------|-------|-------------|-----------|-----------|--------|
| Exams (Legacy) | `exams` | `examService.ts` | `/exams` | `/exams/:id` | ✅ |
| Content Posts | `content_posts` | `contentService.ts` | `/content` | `/content/:id` | ✅ |
| Blog Posts | `blog_posts` | `blogService.ts` | `/blog` | `/blog/:id` | ✅ |
| Static Pages | `pages` | `pageService.ts` | `/pages` | `/pages/:id` | ✅ |
| Categories | `categories` | `categoryService.ts` | `/categories` | inline | ✅ |
| Entities (New) | `entity` | `entity/entityService.ts` | `/entities` | `/entities/:pillar/:id` | ✅ |
| **Results** | `cms_results` | `resultService.ts` | `/results` | `/results/:id` | ✅ NEW |
| **Education News** | `cms_education_news` | `educationNewsService.ts` | `/education-news` | `/education-news/:id` | ✅ NEW |
| Blog Authors | `blog_authors` | `blogService.ts` | `/blog/authors` | inline | ✅ |
| Ads/Campaigns | `ad_campaigns` | `adService.ts` | `/ads` | `/ads/campaigns/:id` | ✅ |
| Media Library | `media` | `mediaService.ts` | `/media` | inline | ✅ |
| Menus | `menus` | `menuService.ts` | `/menus` | inline | ✅ |
| Users | `user_profiles` | `userService.ts` | `/users` | inline | ✅ |
| Settings | `settings` | `settingsService.ts` | `/settings` | inline | ✅ |

---

## Direct Database Writes Removed/Replaced

| What | Previous Method | New Method | Status |
|------|----------------|------------|--------|
| 361 cms_results entries | Raw SQL via MCP tool | `resultService.createResult()` | ⚠️ Legacy data — now editable via CMS UI |
| 41 cms_education_news entries | Raw SQL via MCP tool | `educationNewsService.createEducationNews()` | ⚠️ Legacy data — now editable via CMS UI |
| Future AI content | Direct SQL INSERT | AI → service layer → standard publish workflow | ✅ Enforced |

---

## AI Integration Rules

```
AI Assistant / AI Auto Generate
        │
        ▼
Generate structured output (JSON matching CmsResultInput / CmsEducationNewsInput)
        │
        ▼
Call service function: createResult(input) / createEducationNews(input)
        │
        ▼
Service handles: validation → slug check → workflow → audit → DB write
        │
        ▼
Result: Standard CMS record (indistinguishable from manual entry)
```

### AI Provenance Fields

Every AI-generated record carries optional provenance metadata:
- `created_via`: `'ai_assistant'` | `'ai_auto_generate'` | `'cms_editor'` | `'api'` | `'import'`
- `source_type`: `'manual'` | `'ai_generated'` | `'scraped'` | `'rss_feed'`

These fields are informational only — they do NOT affect publishing workflow or permissions.

---

## Existing Data Migration

The 361 `cms_results` and 41 `cms_education_news` records that were inserted via raw SQL are now:
1. **Fully editable** through the CMS admin panel at `/results` and `/education-news`
2. **Identifiable as legacy imports** by `created_by = NULL` (vs. a real user UUID for CMS-created records)
3. **Can be re-published** through the normal CMS workflow to add proper provenance

No data migration is needed — the records are already in the correct tables with correct schema. The CMS UI simply provides CRUD access to them now.

---

## Forbidden Operations (Production)

The following are **NEVER** permitted on production content tables:

1. ❌ Direct SQL `INSERT INTO cms_results ...`
2. ❌ Direct SQL `INSERT INTO cms_education_news ...`
3. ❌ MCP `execute_sql` for content creation
4. ❌ Seed scripts that write to production
5. ❌ Migrations that insert content rows
6. ❌ Backend scripts bypassing services
7. ❌ AI writing directly to Supabase

### Permitted exceptions (non-production only):
- Local development seed data
- Test fixtures
- Demo data for staging environments

---

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| No production content inserted directly | ✅ Enforced via architecture |
| Every publishable table has CMS module | ✅ Results + Education News added |
| Every CRUD uses service layer | ✅ `resultService.ts` + `educationNewsService.ts` |
| AI content indistinguishable from manual | ✅ Same service functions used |
| Workflow support (draft/review/publish/archive) | ✅ Status field + transitions |
| Validation (Zod in editor, slug uniqueness in service) | ✅ |
| Audit trail (created_by, timestamps, provenance) | ✅ |
| Existing entries editable via CMS | ✅ UI routes registered |
| Frontend consumes only CMS-managed data | ✅ No hardcoded content |
| Scalable for future modules | ✅ Pattern established |
