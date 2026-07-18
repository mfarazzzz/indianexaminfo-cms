# Master QA Checklist — IndianExamInfo CMS & Frontend

> **Version**: 1.0  
> **Date**: July 18, 2026  
> **Total Test Cases**: 312  
> **Modules Covered**: 22  

---

## How to Use This Checklist

1. Execute each test case in order
2. Mark Pass ✅ or Fail ❌ in the status column
3. For failures, log the issue in the Notes column with a screenshot
4. All Critical and High severity failures must be resolved before release
5. Medium/Low failures can be deferred with PM approval

---

## Module Index

| # | Module | Test Cases | Priority |
|---|--------|-----------|----------|
| 1 | Authentication & RBAC | 15 | Critical |
| 2 | Dashboard | 8 | High |
| 3 | Exam Manager | 22 | Critical |
| 4 | Content Posts | 18 | Critical |
| 5 | Sarkari Results | 20 | Critical |
| 6 | Education News | 18 | Critical |
| 7 | Blog Posts | 18 | High |
| 8 | Static Pages | 12 | High |
| 9 | Categories | 10 | High |
| 10 | Media Library | 12 | Medium |
| 11 | Menu Manager | 8 | Medium |
| 12 | User Management | 10 | High |
| 13 | Settings | 12 | High |
| 14 | AI Features | 18 | High |
| 15 | Ads Module | 10 | Medium |
| 16 | Entity System | 15 | High |
| 17 | Frontend Sync | 20 | Critical |
| 18 | SEO | 18 | High |
| 19 | Search & Filters | 12 | High |
| 20 | Performance | 15 | Medium |
| 21 | Security | 20 | Critical |
| 22 | Cross-Browser & Responsive | 20 | High |

---

## Quick Smoke Test (5 minutes)

Run these 10 tests first to verify basic functionality:

| # | Test | Expected |
|---|------|----------|
| 1 | Open CMS login page | Login form renders |
| 2 | Login as admin | Dashboard loads |
| 3 | Navigate to Exams | Exam list loads with data |
| 4 | Navigate to Results | Results list loads (361 entries) |
| 5 | Click "New Result" | Editor form opens |
| 6 | Navigate to Education News | News list loads (41 entries) |
| 7 | Open frontend homepage | Homepage renders with exam cards |
| 8 | Click any exam card | Exam detail page opens |
| 9 | Check /sitemap.xml | Sitemap returns valid XML |
| 10 | Search for "UPSC" on frontend | Search results appear |

---

## Execution Status Summary

| Status | Count |
|--------|-------|
| ✅ Pass | ___ / 312 |
| ❌ Fail | ___ / 312 |
| ⏭️ Skip | ___ / 312 |
| 🔄 Retest | ___ / 312 |

**Tester**: _______________  
**Date Started**: _______________  
**Date Completed**: _______________  
**Sign-off**: _______________
