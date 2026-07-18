# Operations Runbook

> Procedures for handling operational issues in production.

---

## 1. Service Outage — CMS Not Loading

### Symptoms
- Users see blank page or "Failed to load"
- Nginx returns 502/503

### Diagnosis

```bash
# Check PM2 process
pm2 status

# Check PM2 logs
pm2 logs indianexaminfo-cms --lines 50

# Check Nginx
sudo systemctl status nginx
sudo nginx -t  # Test config

# Check disk space
df -h
```

### Resolution

```bash
# If PM2 process crashed:
pm2 restart indianexaminfo-cms

# If PM2 keeps restarting (crash loop):
pm2 logs indianexaminfo-cms --err --lines 100
# Fix root cause, then:
pm2 restart indianexaminfo-cms

# If Nginx is down:
sudo systemctl restart nginx

# If disk full:
# Clear old logs
sudo truncate -s 0 /var/log/pm2/cms-out.log
sudo truncate -s 0 /var/log/pm2/cms-error.log
pm2 flush  # Clear PM2 internal logs
```

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

```bash
# Check PM2 memory usage
pm2 monit

# Check Supabase query performance
# Dashboard → Database → Query Performance
```

### Resolution

| Issue | Fix |
|-------|-----|
| High memory (PM2) | Restart: `pm2 restart indianexaminfo-cms` |
| Slow queries | Add indexes in Supabase (check query plans) |
| Large entity load | Check `getEntityFull` — may need pagination |
| Bundle too large | Check Vite build output for oversized chunks |
| Too many queries | Verify TanStack Query isn't refetching excessively |

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
| PM2 process status | PM2 + cron | Status ≠ online |
| Server disk usage | `df` cron | > 85% |
| Supabase project status | Status page | Any degradation |
| Error log growth | Log rotation | > 100MB/day |
| Memory usage | PM2 | > 200MB (restart threshold: 256MB) |

### Log Rotation

```bash
# Add to /etc/logrotate.d/pm2-cms
/var/log/pm2/cms-*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
}
```

---

## 10. Recovery Procedures

### Full Recovery (catastrophic failure)

1. Provision new server (Ubuntu 22.04)
2. Install Node.js 20, Nginx, PM2
3. Restore latest code from Git
4. Build: `npm ci && npm run build`
5. Deploy to `/var/www/indianexaminfo-cms/dist/`
6. Configure Nginx (copy `nginx.conf`)
7. Start PM2: `pm2 start ecosystem.config.js`
8. Verify: access CMS in browser
9. Database: Supabase manages DB separately (no server dependency)

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
