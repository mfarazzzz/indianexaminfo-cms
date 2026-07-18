# Smoke Test Plan — IndianExamInfo

> **Duration**: 15 minutes  
> **When to Run**: After every deployment, hotfix, or environment change  
> **Pass Criteria**: All 20 tests must pass. Any failure = deployment rollback.

---

## Pre-requisites
- CMS accessible at production URL
- Frontend accessible at production URL
- At least 1 admin user account available
- Browser: Chrome latest

---

## Smoke Tests (20 Critical Path Tests)

| # | Area | Test | Steps | Expected | Pass/Fail |
|---|------|------|-------|----------|-----------|
| 1 | CMS Auth | Login | Open CMS → Enter credentials → Login | Dashboard loads | |
| 2 | CMS Nav | Sidebar navigation | Click each sidebar item | No 404s, all pages load | |
| 3 | CMS Exams | Exam list loads | Go to /exams | Table renders with exam data | |
| 4 | CMS Exams | Open exam editor | Click any exam → Edit | Editor form loads with data | |
| 5 | CMS Results | Results list | Go to /results | 361 entries visible | |
| 6 | CMS Results | Create result | New Result → Fill → Save Draft | Created successfully | |
| 7 | CMS News | News list | Go to /education-news | 41 entries visible | |
| 8 | CMS Blog | Blog list | Go to /blog | Blog posts listed | |
| 9 | CMS Settings | Settings page | Go to /settings | Settings load, values shown | |
| 10 | CMS Media | Media library | Go to /media | Page renders (may be empty) | |
| 11 | Frontend | Homepage | Open frontend root | Cards render, no console errors | |
| 12 | Frontend | Exam detail | Click any exam card | Detail page with data renders | |
| 13 | Frontend | Category page | Visit /sarkari-naukri/banking | Banking exams listed | |
| 14 | Frontend | Content type | Visit any /result sub-page | Page renders | |
| 15 | Frontend | Blog page | Visit /blog | Blog listing renders | |
| 16 | Frontend | Search | Search "SSC" | Results appear | |
| 17 | Frontend | 404 page | Visit /this-does-not-exist | Custom 404, not crash | |
| 18 | SEO | Sitemap | Visit /sitemap.xml | Valid XML with URLs | |
| 19 | SEO | Robots | Visit /robots.txt | Valid robots.txt | |
| 20 | Security | No errors in console | Open DevTools Console | No red errors (warnings OK) | |

---

## Result

| Outcome | Action |
|---------|--------|
| 20/20 Pass | ✅ Deployment confirmed |
| 1-2 Low failures | ⚠️ Log issues, proceed with monitoring |
| Any Critical failure | ❌ Rollback immediately |

**Tester**: ___  **Date**: ___  **Result**: ___ / 20
