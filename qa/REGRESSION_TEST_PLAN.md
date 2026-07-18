# Regression Test Plan — IndianExamInfo

> **When to Run**: Before every release to production  
> **Duration**: 2-4 hours (full), 30 min (priority only)  
> **Focus**: Ensure new changes don't break existing functionality

---

## Priority Levels

| Level | Run When | Test Count |
|-------|----------|-----------|
| P0 - Critical | Every release | 45 |
| P1 - High | Every release | 60 |
| P2 - Medium | Major releases only | 80 |
| P3 - Low | Quarterly | 40+ |

---

## P0 — Critical Regression Tests (Must Pass)

| # | Module | Test | Risk if Broken |
|---|--------|------|----------------|
| 1 | Auth | Admin can login | Complete system unusable |
| 2 | Auth | Protected routes require auth | Security breach |
| 3 | Exams | List exams loads data | Core functionality |
| 4 | Exams | Create exam works | Content creation blocked |
| 5 | Exams | Edit exam saves | Content updates blocked |
| 6 | Exams | Publish exam → frontend visible | Publishing pipeline broken |
| 7 | Results | List results loads | Module unusable |
| 8 | Results | Create result works | Content creation blocked |
| 9 | Results | Edit result saves | Updates blocked |
| 10 | News | List news loads | Module unusable |
| 11 | News | Create news works | Blocked |
| 12 | Content | Create content post | Core feature |
| 13 | Blog | Create blog post | Core feature |
| 14 | Frontend | Homepage renders | User-facing failure |
| 15 | Frontend | Exam detail page works | Core UX |
| 16 | Frontend | No console errors on homepage | Quality signal |
| 17 | Frontend | Search returns results | Discovery broken |
| 18 | SEO | Sitemap generates | SEO degradation |
| 19 | SEO | Year shows current (2026) | SEO quality |
| 20 | Security | RLS blocks anon writes | Security |
| 21 | DB | No null slugs exist | URL generation breaks |
| 22 | DB | No duplicate slugs | Routing conflicts |
| 23 | API | /api/revalidate requires token | Security |
| 24 | Nav | All sidebar links work | Usability |
| 25 | Settings | Settings page loads | Config access |

---

## P1 — High Priority Regression Tests

| # | Module | Test |
|---|--------|------|
| 26 | Exams | Filter by pillar works |
| 27 | Exams | Search by name works |
| 28 | Exams | AI Auto-Fill populates form |
| 29 | Exams | Delete exam (admin only) |
| 30 | Exams | Featured toggle saves |
| 31 | Results | Filter by category |
| 32 | Results | Filter by status |
| 33 | Results | Publish sets published_at |
| 34 | Results | Archive changes status |
| 35 | Results | Slug uniqueness enforced |
| 36 | News | Filter by category |
| 37 | News | Breaking flag saves |
| 38 | Blog | Publish/unpublish cycle |
| 39 | Blog | Section filter works |
| 40 | Blog | Author assignment works |
| 41 | Pages | Create/edit page |
| 42 | Pages | System pages not deletable |
| 43 | Categories | Create category |
| 44 | Categories | Edit category |
| 45 | Media | Upload image |
| 46 | Users | Invite user |
| 47 | Users | Change role |
| 48 | Settings | Save AI settings |
| 49 | Settings | Revalidation works |
| 50 | Frontend | Category page lists correct exams |
| 51 | Frontend | Blog detail page renders |
| 52 | Frontend | Breadcrumbs correct |
| 53 | Frontend | Mobile layout not broken |
| 54 | Frontend | Admit card hub page |
| 55 | Frontend | Results hub page |
| 56 | SEO | Meta title correct on exam page |
| 57 | SEO | Canonical URL correct |
| 58 | SEO | JSON-LD schema present |
| 59 | Security | XSS in title field sanitized |
| 60 | Security | CSP headers present |

---

## Regression Trigger Matrix

| Change Type | Required Regression |
|-------------|-------------------|
| New CMS module added | P0 + P1 |
| Service layer change | P0 + affected module P1 |
| Database migration | P0 full + DB integrity |
| Frontend route change | P0 + Frontend + SEO |
| Security patch | P0 + Security full |
| Dependency update | P0 + Smoke |
| UI/CSS change only | Smoke + visual check |
| Content-only change | Smoke only |
