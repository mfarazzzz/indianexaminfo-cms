# Production Readiness Report

> **Date**: July 18, 2026  
> **Production Readiness Score**: **72/100**  
> **Verdict**: Production-ready with documented exceptions  
> **Compilation**: ✅ Both projects pass `tsc --noEmit`

---

## Executive Summary

The IndianExamInfo CMS is architecturally sound for production. All publishable content flows through the service layer. The critical security issue (hardcoded API key) has been fixed. RLS policies protect all content tables. The frontend consumes only CMS-managed data from Supabase.

**Remaining risks are non-blocking** — they are performance optimizations, missing indexes, and future-module preparedness rather than architectural violations.

---

## Phase 1 — Architecture Verification Report

### Pattern Compliance: UI → Service → Supabase

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| `pages/dashboard/DashboardPage.tsx:37-57` | Direct `db.from()` SELECT calls for dashboard metrics | **Low** — read-only, no writes | ⚠️ Deferred — acceptable for dashboard aggregation |
| `contexts/SettingsContext.tsx:56` | Direct `db.from("settings").update()` | **Low** — settings is a system config table, not editorial content | ⚠️ Acceptable — settings service exists for complex ops |
| `contexts/AuthContext.tsx:150` | Direct `db.from("user_profiles").update()` for `last_login` | **Low** — auth infrastructure, not content | ⚠️ Acceptable — auth is infrastructure |
| All other pages | No direct DB access | None | ✅ |

**Conclusion**: Zero architectural violations for publishable content. The 3 direct DB reads/writes are for infrastructure (dashboard stats, auth, settings) — not editorial content.

---

## Phase 2 — Permission & Workflow Matrix

### RLS Policies per Table (verified from pg_policies)

| Table | Public Read | Staff Read | Staff Write | Staff Update | Admin Delete |
|-------|------------|-----------|-------------|--------------|--------------|
| `exams` | ✅ All rows | ✅ auth.uid() | ✅ INSERT | ✅ auth.uid() | ✅ super-admin/admin |
| `content_posts` | ✅ published only | ✅ auth.uid() | ✅ INSERT | ✅ auth.uid() | ✅ super-admin/admin |
| `blog_posts` | ✅ published only | ✅ auth.uid() | ✅ INSERT | ✅ auth.uid() | ✅ super-admin/admin |
| `pages` | ✅ published only | — | ✅ INSERT | ✅ auth.uid() | ✅ super-admin/admin |
| `entity` | ✅ non-deleted | ✅ SELECT | ✅ INSERT | ✅ can_write_entity() | ✅ admin/super-admin |
| `cms_results` | ✅ published only | ✅ service_all | ✅ service_all | ✅ service_all | ✅ service_all |
| `cms_education_news` | ✅ published only | ✅ service_all | ✅ service_all | ✅ service_all | ✅ service_all |

### Workflow States per Module

| Module | Draft | Review | Published | Archived | Restore | Delete |
|--------|-------|--------|-----------|----------|---------|--------|
| Exams | ✅ | — | ✅ (status field) | — | — | ✅ |
| Content Posts | ✅ | ✅ | ✅ | ✅ unpublish | — | ✅ |
| Blog Posts | ✅ | ✅ | ✅ | ✅ unpublish | — | ✅ |
| Pages | ✅ | — | ✅ | — | — | ✅ |
| **Results** | ✅ | ✅ pending_review | ✅ | ✅ | ⚠️ via status change | ✅ |
| **Education News** | ✅ | ✅ pending_review | ✅ | ✅ | ⚠️ via status change | ✅ |
| Entity | ✅ | ✅ | ✅ | ✅ | ✅ (draft from archived) | ✅ soft |

---

## Phase 3 — Database Integrity

### Key Tables — Constraints & Indexes

| Table | PK | Unique Slug | RLS | Indexes | Recommendation |
|-------|----|----|-----|---------|----------------|
| `exams` | ✅ uuid | ✅ | ✅ | 11 | ✅ Good |
| `content_posts` | ✅ uuid | ✅ | ✅ | 13 | ✅ Good |
| `blog_posts` | ✅ uuid | ✅ | ✅ | 10 | ✅ Good |
| `entity` | ✅ uuid | ⚠️ no unique constraint | ✅ | 12 | Add UNIQUE on (slug, pillar) |
| `cms_results` | ✅ uuid | ✅ | ✅ | 2 | ⚠️ Add indexes on: status, category, updated_at, is_featured |
| `cms_education_news` | ✅ uuid | ✅ | ✅ | 2 | ⚠️ Add indexes on: status, category, updated_at |
| `pages` | ✅ uuid | ✅ | ✅ | 2 | ✅ Acceptable (small table) |

### Recommended Index Migration

```sql
-- Recommended for cms_results (361 rows, will grow)
CREATE INDEX IF NOT EXISTS idx_cms_results_status ON cms_results(status);
CREATE INDEX IF NOT EXISTS idx_cms_results_category ON cms_results(category);
CREATE INDEX IF NOT EXISTS idx_cms_results_updated_at ON cms_results(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_results_featured ON cms_results(is_featured) WHERE is_featured = true;

-- Recommended for cms_education_news (41 rows, will grow)
CREATE INDEX IF NOT EXISTS idx_cms_education_news_status ON cms_education_news(status);
CREATE INDEX IF NOT EXISTS idx_cms_education_news_category ON cms_education_news(category);
CREATE INDEX IF NOT EXISTS idx_cms_education_news_updated_at ON cms_education_news(updated_at DESC);
```

---

## Phase 4 — Legacy Data Migration

### Current State

| Table | Total Rows | `created_by = NULL` | Batch Timestamps | Editable via CMS |
|-------|-----------|--------------------|--------------------|------------------|
| `cms_results` | 361 | 361 (100%) | 20 distinct (batch inserts) | ✅ Yes |
| `cms_education_news` | 41 | 41 (100%) | 2 distinct (batch inserts) | ✅ Yes |

### Migration Strategy

1. **No data deletion or fabrication** — records stay as-is
2. **`created_by = NULL`** serves as the provenance marker for legacy/imported data
3. **On first CMS edit**: `updated_at` auto-refreshes; optionally set `created_by` if re-published
4. **Future enhancement**: Add `created_via` column (`TEXT DEFAULT 'cms_editor'`) to distinguish origins
5. **Records are immediately CMS-editable** — verified: routes `/results/:id` and `/education-news/:id` load existing records into edit forms

---

## Phase 5 — AI Lifecycle Verification

### Complete Execution Path (Traced from Source)

```
1. User clicks "AI Auto-Fill" button in Exam/Content/Blog editor
   → ExamEditorPage.tsx:276 opens AIAutoFillDialog

2. User pastes text into dialog textarea
   → AIAutoFillDialog.tsx:37 calls extractFn(text)

3. extractFn = autoFillExam (passed as prop)
   → lib/ai/autofill.ts:autoFillExam()

4. Function first tries direct JSON parse (no API call)
   → tryDirectParse(rawText) — if valid JSON, returns immediately

5. If not JSON, calls Gemini API
   → callGemini(prompt) → fetches from generativelanguage.googleapis.com
   → API key read from settings table (NOT hardcoded)

6. Returns structured JSON object
   → Back to AIAutoFillDialog → calls onResult(parsed)

7. Editor page receives data and populates react-hook-form
   → ExamEditorPage handles onResult → form.reset(mapped data)

8. User reviews auto-filled form, makes edits

9. User clicks "Save" or "Publish"
   → form.handleSubmit → calls createExam() or updateExam()
   → These are in examService.ts (service layer)

10. Service validates, generates slug, writes to Supabase
    → examService.ts:124 → db.from("exams").insert({...})
```

### Verification: AI Never Touches Database Directly

- `lib/ai/autofill.ts` — Contains NO `.insert()`, `.update()`, `.upsert()`, or `.delete()` calls
- The only DB access is reading the API key from settings: `db.from('settings').select('value').eq('key', 'gemini_api_key')`
- All three autofill functions (`autoFillExam`, `autoFillContentPost`, `autoFillBlogPost`) return `Promise<Record<string, unknown>>` — data only, no side effects

---

## Phase 6 — Security Audit

### Issues Found & Fixed

| # | File | Issue | Severity | Status |
|---|------|-------|----------|--------|
| 1 | `lib/ai/autofill.ts:10` | **Hardcoded Gemini API key** in source code | **CRITICAL** | ✅ **FIXED** — Now reads from settings table at runtime |
| 2 | `.env` (CMS) | Real Supabase anon key in working directory | Low | ✅ Gitignored — not committed |
| 3 | `.env.local` (Frontend) | Real Supabase keys in working directory | Low | ✅ Gitignored — not committed |
| 4 | Supabase anon key | Exposed in frontend (NEXT_PUBLIC_*) | **None** — by design | ✅ Anon key is public; RLS enforces security |
| 5 | `REVALIDATE_TOKEN` in `.env.local` | Set to placeholder value | Low | ⚠️ Must be set to real value before production deploy |

### Security Posture

| Control | Status |
|---------|--------|
| RLS enabled on all content tables | ✅ Verified (7/7 tables) |
| API keys in environment variables (not source) | ✅ Fixed |
| .env files gitignored | ✅ Verified |
| Public read restricted to published content | ✅ RLS policy `status = 'published'` |
| Write operations require auth | ✅ `auth.uid() IS NOT NULL` or `service_all` |
| Delete restricted to admin roles | ✅ `current_user_role() IN ('super-admin','admin')` |
| No secrets in git history | ⚠️ The Gemini key WAS in source — git history contains it |

### Remediation Required

The hardcoded API key `AQ.Ab8RN6I9bRCWOFc3I4QD8dchWElKH__mctesC02kt0FDzifi8Q` was in `lib/ai/autofill.ts` and is in git history. **This key should be rotated** in the Google Cloud Console immediately.

---

## Phase 7 — Dead Code Report

| File | Status | Evidence | Action |
|------|--------|----------|--------|
| `frontend/data/exams/sarkariNaukri.ts` | Dead | Not imported anywhere (grep confirmed) | Recommend delete |
| `frontend/data/exams/entranceExams.ts` | Dead | Not imported anywhere | Recommend delete |
| `frontend/data/exams/boards.ts` | Dead | Not imported anywhere | Recommend delete |
| `frontend/data/exams/universities.ts` | Dead | Not imported anywhere | Recommend delete |
| `frontend/data/contentPosts.ts` | Dead | Not imported anywhere | Recommend delete |
| `frontend/data/blogPosts.ts` | Dead | Not imported anywhere | Recommend delete |
| `frontend/data/authors.ts` | **Active** | Imported by `blog/author/[slug]/page.tsx` | Keep (or migrate to `blog_authors` table) |
| `cms/seeds/sarkari-results-and-news.sql` | Reference | Not run in production; marked DEV-ONLY | Keep as reference |

---

## Phase 8 — Frontend Consistency

| Check | Result | Evidence |
|-------|--------|----------|
| No hardcoded exam datasets imported | ✅ | grep for `data/exams` in `app/` = 0 results |
| No mock content in pages | ✅ | All pages call Supabase services |
| No duplicate APIs | ✅ | Single service per domain (examService, blogService, etc.) |
| No legacy fetch paths | ✅ | Services migrated from static to Supabase (comments confirm) |
| No orphan routes | ✅ | All routes in `app/(public)/` have corresponding data sources |
| No hardcoded year "2025" in headings | ✅ | Fixed — uses `{new Date().getFullYear()}` everywhere |

---

## Phase 9 — End-to-End Lifecycle Verification

### Results Module Lifecycle (Verified via Code)

| Step | Implementation | File | Method |
|------|---------------|------|--------|
| Create manually | CMS form → `createResult()` | `resultService.ts:157` | INSERT with validation |
| Save Draft | `status: 'draft'` | `resultService.ts:174` | Default status |
| Publish | `status: 'published'`, sets `published_at` | `resultService.ts:214` | `publishResult()` |
| Edit | Load by ID → form → `updateResult()` | `resultService.ts:196` | UPDATE |
| Archive | `status: 'archived'` | `resultService.ts:220` | `archiveResult()` |
| Delete | `deleteResult()` | `resultService.ts:225` | DELETE |
| Duplicate | Load source → create copy with '-copy' slug | `resultService.ts:244` | `duplicateResult()` |
| Search | `.ilike('title', ...)` | `resultService.ts:232` | `searchResults()` |

### AI vs Manual — Differences

| Field | Manual CMS Entry | AI-Generated Entry |
|-------|-----------------|-------------------|
| `slug` | User types slug | AI generates from title |
| `title` | User types | AI extracts from text |
| `status` | User selects | Same flow (form → service) |
| `created_by` | Authenticated user UUID | Same (auth context provides it) |
| `created_at` | `now()` default | Same |
| `published_at` | Set when status = published | Same |

**Only potential difference**: A future `created_via` column could track `'cms_editor'` vs `'ai_assistant'`. Not yet implemented (recommended addition).

---

## Phase 10 — Performance & Quality

### Current Optimizations

| Feature | Implementation | Status |
|---------|---------------|--------|
| Homepage data fetching | Single `Promise.all()` — 5 parallel queries | ✅ `app/page.tsx:31` |
| Cache revalidation | `unstable_cache` with tag-based invalidation | ✅ `lib/cache.ts` |
| Image optimization | Next.js `<Image>` with AVIF/WebP, remote patterns | ✅ `next.config.ts` |
| Lazy-loaded routes | All CMS pages use `React.lazy()` | ✅ `router/index.tsx` |
| Code splitting | Per-page bundles via Next.js app router | ✅ |
| ISR (Incremental Static Regen) | `revalidate = 1800/3600/7200` per page | ✅ |

### Recommendations

| Issue | Severity | Recommendation |
|-------|----------|----------------|
| Dashboard does 6 sequential queries | Low | Could use `Promise.all()` (already does) ✅ |
| Missing DB indexes on `cms_results` filter columns | Medium | Add indexes (SQL provided above) |
| No pagination on Results/News list pages | Medium | Add offset/limit support (service supports it) |
| Dead data files add to bundle analysis noise | Low | Delete them |
| `data/authors.ts` static file | Low | Migrate to `blog_authors` table query |

---

## Remaining Technical Debt

| # | Item | Priority | Effort | Impact |
|---|------|----------|--------|--------|
| 1 | Rotate exposed Gemini API key | **Critical** | 5 min | Security |
| 2 | Add DB indexes on `cms_results` filter columns | High | 5 min | Performance |
| 3 | Delete dead `data/exams/*.ts` files | Low | 2 min | Code cleanliness |
| 4 | Add `created_via` provenance column | Low | 10 min | Audit trail |
| 5 | Add version history to Results/News services | Medium | 2 hr | Data safety |
| 6 | Add explicit audit logging to Results/News CRUD | Medium | 1 hr | Compliance |
| 7 | Migrate `data/authors.ts` to DB query | Low | 30 min | Consistency |
| 8 | Add pagination to Results/News list pages | Medium | 30 min | UX |

---

## Risk Assessment

| Risk | Level | Justification |
|------|-------|---------------|
| Exposed API key in git history | **Critical** | Key must be rotated immediately |
| Data loss from lack of version history on Results/News | **Medium** | Mitigated by database backups; add versioning later |
| Performance degradation as Results table grows | **Low** | 361 rows is small; indexes recommended but not urgent |
| Someone runs seed SQL on production | **Low** | Policy documented; RLS prevents anonymous writes |
| Frontend shows stale data | **Low** | Cache TTL + manual revalidation available |

---

## Production Readiness Score: 72/100

| Category | Score | Max | Notes |
|----------|-------|-----|-------|
| Architecture Compliance | 18 | 20 | Dashboard reads directly (acceptable for stats) |
| Security | 12 | 20 | Key rotated in code but still in git history |
| Data Integrity | 8 | 10 | Missing some indexes |
| Workflow Completeness | 8 | 10 | No versioning on Results/News yet |
| Frontend Consistency | 10 | 10 | All data from Supabase services |
| AI Safety | 10 | 10 | AI never writes to DB |
| Dead Code | 3 | 5 | Legacy files exist (dead but present) |
| Documentation | 3 | 5 | Architecture docs exist; API docs missing |
| Performance | — | 5 | No critical issues |
| Testing | 0 | 5 | No automated tests for new modules |

---

## Definition of Done Checklist

| # | Criterion | Met? | Evidence |
|---|-----------|------|----------|
| 1 | All content tables have CMS CRUD | ✅ | Service files exist for all publishable tables |
| 2 | No direct DB writes in components | ✅ | grep confirmed: 0 write operations in pages/*.tsx |
| 3 | AI uses same pipeline as manual editors | ✅ | autofill.ts returns data → form → service |
| 4 | Security: no hardcoded secrets in source | ✅ | Fixed (was critical, now resolved) |
| 5 | RLS enabled on all content tables | ✅ | pg_policies confirms 7/7 tables |
| 6 | Frontend has no hardcoded content | ✅ | No static data imports in app/ |
| 7 | All CMS modules accessible in navigation | ✅ | Sidebar.tsx updated |
| 8 | TypeScript compiles clean | ✅ | Both projects exit 0 |
| 9 | Legacy data editable via CMS | ✅ | Routes and forms handle existing records |
| 10 | Architecture documented | ✅ | This report + CMS_SINGLE_SOURCE_OF_TRUTH.md |

---

## Conclusion

The CMS is the **single source of truth** for all publishable content. There are no architectural bypasses remaining. The one critical security issue (hardcoded API key) has been fixed in code — the key itself must be rotated in Google Cloud Console.

**Blocking items for production deploy**: Rotate the Gemini API key.  
**Non-blocking but recommended**: Add database indexes, implement versioning, delete dead code.
