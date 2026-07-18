# Deployment Guide

> How to deploy IndianExamInfo CMS across all environments.

---

## 1. Environments

| Environment | URL | Purpose |
|------------|-----|---------|
| Development | `localhost:5173` | Local development with HMR |
| Staging | `staging-cms.indianexaminfo.com` | Pre-production testing |
| Production | `cms.indianexaminfo.com` | Live editorial system |

---

## 2. Development Setup

### Prerequisites
- Node.js 20+ (LTS)
- npm 9+
- Supabase project (free tier for dev)

### Steps

```bash
# 1. Clone and install
git clone <repo-url>
cd indianexaminfo-cms
npm ci

# 2. Configure environment
cp .env.example .env
# Edit .env:
#   VITE_SUPABASE_URL=https://your-project.supabase.co
#   VITE_SUPABASE_ANON_KEY=your-anon-key

# 3. Start dev server
npm run dev
# → http://localhost:5173
```

### Development Database

Use a separate Supabase project for development. Apply migrations from the `seeds/` directory for test data.

---

## 3. Build Process

```bash
# Full production build (TypeScript compile + Vite bundle)
npm run build

# Output: dist/
#   ├── index.html
#   └── assets/
#       ├── index-[hash].js
#       ├── index-[hash].css
#       └── [chunk]-[hash].js (code-split chunks)
```

The build process:
1. TypeScript compilation (`tsc`) — fails on type errors
2. Vite production bundling — tree-shaking, minification, code-splitting
3. Output to `dist/` directory

### Build Verification

```bash
# Preview production build locally
npm run preview
# → http://localhost:4173
```

---

## 4. Production Deployment

### 4.1 Server Requirements

- Linux server (Ubuntu 22.04+ recommended)
- Node.js 20+ (for `serve` static server)
- Nginx (reverse proxy + security headers)
- PM2 (process management)
- SSL certificate (Let's Encrypt)

### 4.2 Deployment Steps

```bash
# On the server:

# 1. Install global dependencies
npm install -g pm2 serve

# 2. Create deployment directory
sudo mkdir -p /var/www/indianexaminfo-cms
sudo chown $USER:$USER /var/www/indianexaminfo-cms

# 3. Copy built files (from CI or manual build)
rsync -avz dist/ user@server:/var/www/indianexaminfo-cms/dist/

# 4. Copy PM2 config
cp ecosystem.config.js /var/www/indianexaminfo-cms/

# 5. Start with PM2
cd /var/www/indianexaminfo-cms
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Enable auto-start on reboot
```

### 4.3 PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: "indianexaminfo-cms",
    script: "serve",
    args: "dist -p 4000 -s --no-clipboard",
    cwd: "/var/www/indianexaminfo-cms",
    env: { NODE_ENV: "production" },
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    max_memory_restart: "256M",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    out_file: "/var/log/pm2/cms-out.log",
    error_file: "/var/log/pm2/cms-error.log",
  }],
};
```

### 4.4 Nginx Configuration

```nginx
server {
    listen 80;
    server_name cms.indianexaminfo.com;
    root /var/www/indianexaminfo-cms/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets (1 year, immutable hashes)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

For HTTPS, add SSL configuration with certbot/Let's Encrypt.

---

## 5. Environment Variables (Production)

The production `.env` is baked into the build at compile time (Vite replaces `import.meta.env.*` at build):

| Variable | Production Value |
|----------|-----------------|
| `VITE_SUPABASE_URL` | `https://your-prod-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Production anon key |
| `VITE_FRONTEND_URL` | `https://indianexaminfo.com` |
| `VITE_ENABLE_HTML_BLOCK` | `false` (or omit) |

**Important:** Since this is an SPA, environment variables are embedded in the JavaScript bundle. The `ANON_KEY` is safe to expose (RLS enforces access). Never embed service keys.

---

## 6. Database Migrations

### Applying Migrations

Migrations are managed via the Supabase dashboard or CLI:

```bash
# Using Supabase CLI
supabase db push  # Apply all pending migrations

# Or via dashboard:
# Supabase Dashboard → SQL Editor → paste migration SQL
```

### Migration Principles

1. One concern per migration
2. Always use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`
3. Never drop columns without a deprecation migration first
4. Test on a Supabase branch before production
5. Keep a rollback script for every migration

---

## 7. Backup Strategy

### Database Backups

Supabase provides automatic daily backups (Pro plan). For additional safety:

```bash
# Manual backup via pg_dump (requires direct DB connection)
pg_dump postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres \
  --format=custom --file=backup-$(date +%Y%m%d).dump
```

### Storage Backups

Supabase Storage files can be synced to S3/GCS:
```bash
# Use Supabase CLI or custom script to list and download all media files
```

### Code Backups

- Git repository with remote origin
- GitHub/GitLab automatic backup

---

## 8. Rollback Procedure

### Code Rollback

```bash
# If deployment broke the frontend:
# 1. Revert to previous build artifacts
cd /var/www/indianexaminfo-cms
# Assuming previous dist is preserved:
mv dist dist-broken
mv dist-previous dist
pm2 restart indianexaminfo-cms
```

### Database Rollback

```sql
-- Reverse the last migration (specific to each migration)
-- Example: DROP the newly added column
ALTER TABLE entity DROP COLUMN IF EXISTS new_column;
```

For critical rollbacks, restore from Supabase point-in-time recovery (Pro plan).

---

## 9. CI/CD Pipeline

### GitHub Actions (`.github/workflows/ci.yml`)

```yaml
name: CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build
```

All 4 quality gates must pass before merge:
1. **Lint** — ESLint
2. **Typecheck** — TypeScript
3. **Tests** — Vitest with coverage
4. **Build** — Production build succeeds

---

## 10. Release Checklist

### Pre-Deployment

- [ ] All CI checks pass on the release branch
- [ ] Manual smoke test on staging
- [ ] Database migrations applied to staging and verified
- [ ] Environment variables confirmed for production
- [ ] No breaking changes to Supabase schema
- [ ] Backup current production database

### Deployment

- [ ] Build production assets
- [ ] Deploy to server
- [ ] Verify PM2 process is running
- [ ] Verify Nginx is serving correctly

### Post-Deployment

- [ ] Verify login works
- [ ] Verify entity creation works
- [ ] Verify AI features work (if API key configured)
- [ ] Verify media upload works
- [ ] Check PM2 logs for errors: `pm2 logs --lines 50`
- [ ] Verify revalidation is triggering (if frontend configured)
- [ ] Monitor for 30 minutes

---

## 11. Monitoring

### PM2 Monitoring

```bash
pm2 status          # Process status
pm2 monit           # Real-time monitoring
pm2 logs            # Tail logs
pm2 logs --lines 100  # Recent logs
```

### Log Locations

| Log | Path |
|-----|------|
| PM2 stdout | `/var/log/pm2/cms-out.log` |
| PM2 stderr | `/var/log/pm2/cms-error.log` |
| Nginx access | `/var/log/nginx/access.log` |
| Nginx error | `/var/log/nginx/error.log` |

### Health Indicators

- PM2 process status: `online`
- PM2 restart count: should be 0 after stable deploy
- Nginx returns 200 for `/`
- Supabase dashboard shows active connections
