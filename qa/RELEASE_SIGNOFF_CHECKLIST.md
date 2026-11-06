# Release Sign-off Checklist — Production Deployment

> **Version**: _______________  
> **Release Date**: _______________  
> **Release Manager**: _______________  
> **Previous Version**: _______________

---

## Pre-Deployment (Complete BEFORE deploying)

### 1. Code & Build

| # | Item | Status | Verified By |
|---|------|--------|-------------|
| 1.1 | All code merged to main branch | ☐ | |
| 1.2 | `tsc --noEmit` passes on CMS (zero errors) | ☐ | |
| 1.3 | `tsc --noEmit` passes on Frontend (zero errors) | ☐ | |
| 1.4 | `npm run build` succeeds on CMS (vite build) | ☐ | |
| 1.5 | `npm run build` succeeds on Frontend (next build) | ☐ | |
| 1.6 | No `console.log` left in production code | ☐ | |
| 1.7 | No TODO/FIXME items in critical paths | ☐ | |
| 1.8 | Git tag created for this release | ☐ | |

### 2. Environment Variables

| # | Variable | Location | Set? |
|---|----------|----------|------|
| 2.1 | `VITE_SUPABASE_URL` | CMS server | ☐ |
| 2.2 | `VITE_SUPABASE_ANON_KEY` | CMS server | ☐ |
| 2.3 | `VITE_FRONTEND_URL` | CMS server | ☐ |
| 2.4 | `NEXT_PUBLIC_SUPABASE_URL` | Frontend server | ☐ |
| 2.5 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend server | ☐ |
| 2.6 | `REVALIDATE_TOKEN` | Frontend server | ☐ |
| 2.7 | `NEXT_PUBLIC_GA_ID` | Frontend server | ☐ |
| 2.8 | `NEXT_PUBLIC_GSC_VERIFY` | Frontend server | ☐ |

### 3. Database

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.1 | Database backup taken | ☐ | Timestamp: ___ |
| 3.2 | All migrations applied | ☐ | |
| 3.3 | RLS policies active on all content tables | ☐ | |
| 3.4 | No pending schema changes | ☐ | |
| 3.5 | Indexes verified (cms_results, cms_education_news) | ☐ | |
| 3.6 | Test query executes successfully | ☐ | |
| 3.7 | **Create-a-draft smoke test** — create ONE draft record in EACH pillar (entrance-exam, government-exam, govt-vacancy, board-exam, university-exam), confirm its first cycle (`exam_editions`) saves with **no** "new row violates row-level security policy for table exam_editions" error, then delete all five | ☐ | Guards the draft-on-create RLS regression that went unnoticed from 2026-10-04 (fixed by migration `20261012142358`) |

### 4. Security

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.1 | Gemini API key rotated (if exposed) | ☐ | |
| 4.2 | No secrets in source code (grep verified) | ☐ | |
| 4.3 | .env files NOT deployed (gitignored) | ☐ | |
| 4.4 | SSL certificate valid (not expiring < 30 days) | ☐ | |
| 4.5 | CORS configured correctly | ☐ | |
| 4.6 | Supabase service role key NOT exposed | ☐ | |

### 5. Infrastructure

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.1 | Server accessible (SSH/console) | ☐ | |
| 5.2 | Host build/deploy configured (GitHub auto-deploy on push to `main`) | ☐ | Hostinger builds both apps from the connected repos. There is no pm2 process to configure and `deploy-cms.sh` is not the live path — see `docs/DEPLOYMENT_GUIDE.md` §1b (§4 there is legacy reference only). |
| 5.3 | Nginx/reverse proxy configured | ☐ | Hosted layer; check only if a header or TLS symptom appears. |
| 5.4 | DNS records pointing correctly | ☐ | |
| 5.5 | CDN configured (if applicable) | ☐ | |
| 5.6 | Storage bucket accessible | ☐ | |
| 5.7 | Enough disk space (> 5GB free) | ☐ | |
| 5.8 | Node.js version correct (18+) | ☐ | |

---

## Deployment Steps

The release IS a push. There is no build or restart to run by hand — the host clones the repo,
builds it and serves it. What the releaser does is verify the result from the outside.

| # | Step | Command/Action | Done? |
|---|------|---------------|-------|
| 1 | Confirm both repos are clean and the intended commits are on `main` | `git log --oneline origin/main..HEAD` must be empty after the push | ☐ |
| 2 | Push to `main` (CMS) | `git push origin main` — the host builds it | ☐ |
| 3 | Push to `main` (Frontend) | `git push origin main` — the host builds it | ☐ |
| 4 | Confirm the CMS build stamp matches the pushed sha | `Invoke-WebRequest https://admincms1.indianexaminfo.com/ -UseBasicParsing` and read `<meta name="build" content="…">` | ☐ |
| 5 | Confirm the frontend build stamp matches | same request against `https://www.indianexaminfo.com/` | ☐ |
| 6 | Verify CMS accessible | Open CMS URL in browser | ☐ |
| 7 | Verify Frontend accessible | Open frontend URL | ☐ |
| 8 | Run Smoke Tests (20 tests) | See SMOKE_TEST_PLAN.md | ☐ |

If a build stamp still shows an older sha after a push, the host build has not run or has
failed — that is the deploy incident, not a cache problem. Do not "fix" it by building on a
server: nothing here serves a hand-built `dist/`.

---

## Post-Deployment Verification

### Immediate (within 5 minutes)

| # | Check | Status |
|---|-------|--------|
| 1 | CMS login works | ☐ |
| 2 | Frontend homepage loads | ☐ |
| 3 | No 500 errors in server logs | ☐ |
| 4 | Database connection stable | ☐ |
| 5 | Sitemap accessible | ☐ |

### Within 1 Hour

| # | Check | Status |
|---|-------|--------|
| 6 | Create a test result in CMS, verify it saves | ☐ |
| 7 | Edit an existing exam, verify update | ☐ |
| 8 | Verify frontend cache refreshes | ☐ |
| 9 | Check Google Search Console for errors | ☐ |
| 10 | Monitor error reporting (if configured) | ☐ |

### Within 24 Hours

| # | Check | Status |
|---|-------|--------|
| 11 | Analytics tracking working | ☐ |
| 12 | Search engine crawling (check logs) | ☐ |
| 13 | No elevated error rates | ☐ |
| 14 | User feedback (if any) | ☐ |
| 15 | Performance metrics stable | ☐ |

---

## Monitoring & Alerts

| System | URL/Tool | Configured? |
|--------|----------|-------------|
| Google Analytics | analytics.google.com | ☐ |
| Google Search Console | search.google.com/search-console | ☐ |
| Uptime monitoring | _______________ | ☐ |
| Error reporting | _______________ | ☐ |
| Build/deploy logs | Hostinger hosting → the site's build log (the host runs the build; there is no pm2 log) | ☐ |
| App logs | Supabase dashboard → Logs (API, database, edge functions) | ☐ |
| Supabase dashboard | supabase.com/dashboard | ☐ |

---

## Rollback Plan

If critical issues are discovered post-deployment:

1. **Revert code**: `git revert <sha>` on the repo and push to `main` — the host rebuilds, which
   IS the rollback. No process restart exists to run.
2. **Confirm the rollback landed**: read both build stamps (`<meta name="build">` on
   `https://www.indianexaminfo.com/` and `https://admincms1.indianexaminfo.com/`); the sha must be
   the reverted commit. If it is not, the incident is a failed host build — read its log.
3. **Verify rollback**: Run Smoke Tests
4. **Communicate**: Notify team of rollback and root cause
5. **Database**: If a migration was applied, evaluate whether a rollback migration is needed —
   a code revert does not undo a migration, and this project applies migrations by owner decision

**Rollback time estimate**: < 10 minutes

---

## Sign-off

| Role | Name | Approved? | Date |
|------|------|-----------|------|
| Release Manager | | ☐ | |
| QA Lead | | ☐ | |
| Technical Lead | | ☐ | |
| Product Owner | | ☐ | |

**Release Status**: ☐ Approved  ☐ Blocked  ☐ Deferred

**Notes**: _______________________________________________
