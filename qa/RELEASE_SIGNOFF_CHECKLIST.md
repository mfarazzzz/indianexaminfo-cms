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
| 5.2 | PM2/process manager configured | ☐ | |
| 5.3 | Nginx/reverse proxy configured | ☐ | |
| 5.4 | DNS records pointing correctly | ☐ | |
| 5.5 | CDN configured (if applicable) | ☐ | |
| 5.6 | Storage bucket accessible | ☐ | |
| 5.7 | Enough disk space (> 5GB free) | ☐ | |
| 5.8 | Node.js version correct (18+) | ☐ | |

---

## Deployment Steps

| # | Step | Command/Action | Done? |
|---|------|---------------|-------|
| 1 | Pull latest code | `git pull origin main` | ☐ |
| 2 | Install dependencies (CMS) | `npm ci` | ☐ |
| 3 | Build CMS | `npm run build` | ☐ |
| 4 | Install dependencies (Frontend) | `npm ci` | ☐ |
| 5 | Build Frontend | `npm run build` | ☐ |
| 6 | Restart CMS process | `pm2 restart cms` or equivalent | ☐ |
| 7 | Restart Frontend process | `pm2 restart frontend` or equivalent | ☐ |
| 8 | Verify CMS accessible | Open CMS URL in browser | ☐ |
| 9 | Verify Frontend accessible | Open frontend URL | ☐ |
| 10 | Run Smoke Tests (20 tests) | See SMOKE_TEST_PLAN.md | ☐ |

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
| Server logs | PM2 logs / journalctl | ☐ |
| Supabase dashboard | supabase.com/dashboard | ☐ |

---

## Rollback Plan

If critical issues are discovered post-deployment:

1. **Revert code**: `git revert` or deploy previous tag
2. **Restart services**: `pm2 restart all`
3. **Verify rollback**: Run Smoke Tests
4. **Communicate**: Notify team of rollback and root cause
5. **Database**: If migration was applied, evaluate if rollback migration needed

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
