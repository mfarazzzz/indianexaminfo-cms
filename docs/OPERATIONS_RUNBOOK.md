# Operations Runbook

> Procedures for handling operational issues in production.

> **How this platform is actually deployed (read before using any command below).**
> Both apps are Hostinger-managed builds from the connected GitHub repositories. Shipping a
> change is: **push to `main`; the host builds it; confirm the admin build stamp.** There is no
> pm2 process, no `deploy-cms.sh` run, no `rsync` and no hand-run `npm run build` on a server in
> the live path — any `pm2 …` line still sitting in an older section of these documents is
> legacy VPS text (`docs/DEPLOYMENT_GUIDE.md` §4 says so explicitly) and following it will not
> deploy anything. The build stamp is the check:
> `<meta name="build" content="<sha> <sync> <iso>">` on `https://admincms1.indianexaminfo.com/`
> and on `https://www.indianexaminfo.com/`.

---

## 1. Service Outage — CMS Not Loading

### Symptoms
- Users see blank page or "Failed to load"
- The host returns 502/503

### Diagnosis

```powershell
# 1. What is actually live? Read the build stamp — no login, no server access.
Invoke-WebRequest https://admincms1.indianexaminfo.com/ -UseBasicParsing | Select-Object -ExpandProperty Content | Select-String -Pattern 'name="build" content="([^"]+)"'

# 2. Is it the app or the host? Status code plus the served bundle name.
Invoke-WebRequest https://admincms1.indianexaminfo.com/ -UseBasicParsing | Select-Object StatusCode
```

Then, in the Hostinger hosting panel: the site's **build log** (it shows the clone, the checked-out
commit and the build result) and the site's **Node version / resource usage**. In Supabase:
project status and the API/edge-function logs. If the project is paused, that is the outage.

### Resolution

There is no process to restart. Match the fix to what the diagnosis showed:

- **Build failed or not run** → read the host build log, fix the cause in the repo, push to
  `main`, confirm the stamp moved to the new sha.
- **Deployed sha is older than `main`** → the host build did not run; check the integration/branch
  setting rather than rebuilding locally.
- **Supabase paused or out** → resume the project / check https://status.supabase.com.
- **A bad release shipped** → `git revert <sha>` and push; the rebuild IS the rollback (see
  `qa/RELEASE_SIGNOFF_CHECKLIST.md` → Rollback Plan).

Legacy VPS commands (`pm2 restart`, `nginx -t`, truncating `/var/log/pm2/*`) are listed in
`docs/DEPLOYMENT_GUIDE.md` §4 for reference only; they do not apply to either live host.

---

## 2. Database Connection Failures

### Symptoms
- "Missing VITE_SUPABASE_URL" errors in console
- Pages load but show no data
- "Failed to fetch" errors in network tab

### Diagnosis

1. Check Supabase dashboard → Project status
2. Verify environment variables in build
3. Check if Supabase is experiencing an outage: https://status.supabase.com

### Resolution

```bash
# If Supabase project is paused (free tier):
# → Go to Supabase dashboard → Resume project

# If environment variables are wrong:
# → Rebuild with correct .env values
# → Redeploy

# If Supabase is rate-limiting:
# → Check connection pool usage in dashboard
# → Reduce query frequency or upgrade plan
```

---

## 3. AI Service Failures

### Symptoms
- "Gemini API key not configured" error
- "Rate limited by Google" message
- AI buttons show errors

### Diagnosis

1. Check Settings → AI → API key is present
2. Check Google Cloud Console for quota/billing
3. Check if the model name is valid

### Resolution

| Issue | Fix |
|-------|-----|
| Key not configured | Settings → AI → Enter valid key |
| Rate limited (429) | Wait 60 seconds, reduce usage |
| Billing issue | Check Google Cloud billing |
| Model not found | Update `gemini_model` in settings to valid model name |
| Network error | Check server can reach `generativelanguage.googleapis.com` |

**Workaround:** Users can always paste JSON directly — this bypasses the API entirely.

---

## 4. Storage/Upload Failures

### Symptoms
- "Upload failed" errors
- Images not displaying after upload
- Storage quota warnings

### Diagnosis

1. Check Supabase Storage → Bucket status
2. Verify storage policies in Supabase dashboard
3. Check file size (max limits)
4. Check MIME type (allowed types)

### Resolution

| Issue | Fix |
|-------|-----|
| Bucket not found | Create `media` bucket in Supabase Storage |
| Policy violation | Check RLS policies on storage |
| Size exceeded | Inform user of file size limits |
| Invalid type | Only image types are accepted |
| Quota exceeded | Upgrade Supabase plan or clean unused files |

---

## 5. Search Issues

### Symptoms
- Search returns no results
- Search returns stale data
- Search is slow

### Diagnosis

```sql
-- Check if data exists
SELECT count(*) FROM entity WHERE deleted_at IS NULL;

-- Test search directly
SELECT name FROM entity WHERE name ILIKE '%query%' LIMIT 5;
```

### Resolution

| Issue | Fix |
|-------|-----|
| No results | Verify data exists and `deleted_at IS NULL` |
| Stale results | Check TanStack Query cache invalidation |
| Slow search | Add GIN index on search columns |

---

## 6. Performance Degradation

### Symptoms
- Pages load slowly (> 3 seconds)
- Editor feels sluggish
- List pages take long to render

### Diagnosis

There is no CMS process to inspect — the admin app is a static bundle served by the host, so
"the editor feels sluggish" is a browser/host question, not a server one.

```powershell
# 1. Which build is being served? (a stale bundle explains a regression)
Invoke-WebRequest https://admincms1.indianexaminfo.com/ -UseBasicParsing | Select-Object -ExpandProperty Content | Select-String -Pattern 'name="build" content="([^"]+)"'
```

Then: Supabase dashboard → Database → **Query Performance** and **Slow query statistics**; the
browser's own Network/Performance tabs for the admin session; the Hostinger panel's resource
usage for the site (CPU/RAM throttling shows up as slow first byte, not as a crashed process).

### Resolution

| Issue | Fix |
|-------|-----|
| Slow queries | Add indexes in Supabase (check query plans) |
| Large entity load | Check `getEntityFull` — may need pagination |
| Bundle too large | Check the Vite build output for oversized chunks (`npm run build` locally, read `dist/`) |
| Too many queries | Verify TanStack Query isn't refetching excessively |
| Host resource throttling | Hostinger panel → the site's resources; upgrade or reduce work, there is no process to restart |

---

## 7. Authentication Issues

### Symptoms
- Users cannot log in
- Session expires unexpectedly
- Permission errors after login

### Diagnosis

1. Check Supabase Auth → Users tab
2. Verify user has `is_active = true` in `user_profiles`
3. Check role assignment: `user_profiles.role_id → roles`
4. Check role permissions: `role_permissions` join

### Resolution

| Issue | Fix |
|-------|-----|
| Wrong credentials | Reset password in Supabase Auth |
| Account deactivated | Set `is_active = true` in user_profiles |
| No role assigned | Assign `role_id` in user_profiles |
| Missing permissions | Add entries to role_permissions |
| Token expired | Client auto-refreshes; if stuck, clear cookies |

---

## 8. Revalidation Failures

### Symptoms
- Frontend shows stale content after CMS publish
- Console warns: "Batch failed after max retries"

### Diagnosis

```typescript
// In browser console (admin):
import { getRetryQueueLength, getPendingTagCount } from '@/lib/revalidation/revalidationService'
console.log('Retry queue:', getRetryQueueLength())
console.log('Pending tags:', getPendingTagCount())
```

Check Settings → Integrations:
- `frontend_url` is correct
- `revalidate_token` matches frontend's expected token

### Resolution

| Issue | Fix |
|-------|-----|
| Frontend URL wrong | Update `frontend_url` in settings |
| Token mismatch | Sync `revalidate_token` with frontend `.env` |
| Frontend down | Wait for frontend recovery; CMS retries automatically |
| Network blocked | Ensure server can reach frontend URL |

**Manual revalidation:** If automated revalidation fails, trigger redeployment on the frontend (Next.js rebuild fetches fresh data).

---

## 9. Monitoring Setup

### Essential Monitoring

| What | Tool | Alert Threshold |
|------|------|----------------|
| Site availability | Any uptime checker against `https://admincms1.indianexaminfo.com/` | anything other than 200 |
| Deployed version | The build stamp in the served HTML (`<meta name="build">`) | sha ≠ `main` HEAD after a push |
| Hostinger build result | Hosting panel → the site's build log | any failed build |
| Supabase project status | https://status.supabase.com + project health in the dashboard | any degradation |
| Database slow queries | Supabase dashboard → Query Performance | above your agreed p95 |
| Host resource usage | Hostinger panel (CPU/RAM/disk for the site) | sustained throttling |

There is no `pm2 status` to poll and no `/var/log/pm2/*` to rotate: the CMS is a built static
bundle and the frontend's process is managed by the host. Application-level logs live in
Supabase (API, database, edge functions), not on a server you administer.

---

## 10. Recovery Procedures

### Full Recovery (catastrophic failure)

The recovery unit is the repository, not a server. The app state that matters lives in Supabase
and in git.

1. Confirm the Supabase project is healthy (resume it if paused; the database is not on the host).
2. Confirm `main` holds the last good commit (`git log --oneline -5`); if the last push was the
   problem, `git revert <sha>`.
3. Re-create or re-point the Hostinger site to the connected GitHub repo, branch `main`, with the
   build command the hosting panel records (`docs/DEPLOYMENT_GUIDE.md` §1b — the exact Node
   version and build command there is still marked `TODO`, so read it from the panel).
4. Set the site's environment variables the panel holds (the CMS needs its `VITE_SUPABASE_*`
   values; secrets are entered in the dashboard by the owner, never in a chat or a file).
5. Trigger a build/redeploy from the panel, then **confirm the admin build stamp** matches the
   intended sha and load the CMS in a browser.
6. Do **not** provision a VPS, install PM2, rsync a `dist/` or run `deploy-cms.sh` — that is the
   retired path (`docs/DEPLOYMENT_GUIDE.md` §4) and it will not be served.

### Database Recovery

1. Use Supabase point-in-time recovery (Pro plan)
2. Or restore from manual backup: `pg_restore -d postgres backup.dump`

---

## 11. Incident Response Template

```markdown
## Incident: [Brief Description]

**Severity:** P1/P2/P3
**Detected:** YYYY-MM-DD HH:MM
**Resolved:** YYYY-MM-DD HH:MM
**Duration:** X minutes

### Impact
- What was affected
- How many users impacted

### Timeline
- HH:MM — Issue detected
- HH:MM — Investigation started
- HH:MM — Root cause identified
- HH:MM — Fix applied
- HH:MM — Verified resolved

### Root Cause
[Description]

### Resolution
[What was done to fix it]

### Prevention
[What changes prevent recurrence]
```
