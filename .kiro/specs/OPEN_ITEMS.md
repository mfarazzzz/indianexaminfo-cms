# Open Investigation Items

Items that are not blocking the legacy-exam-migration spec but must not silently become "confirmed safe" without explicit resolution.

## 1. cms_users / cms_roles / cms_permissions — dormancy verification (OPEN)

**Status:** Unresolved. Code-search showed no CMS admin app references, but database-layer verification has NOT been done.

**What's needed:** Check RLS policies on these tables, check for Postgres functions or triggers that reference them, check Supabase Auth hooks or middleware that might enforce permissions via `cms_permissions`. The question is whether these tables are load-bearing for auth at the database level even if no app code visibly queries them.

**Risk if unresolved:** Treating them as "dormant, safe to touch" without this check could break auth for the 2 active CMS users if something at the Supabase/Postgres layer depends on them silently.

**Blocking:** Nothing currently. Does NOT block legacy migration (out of scope). Should be resolved before any Tier 3 cleanup action on these tables.

## 2. cms_results CMS screen — operational hazard (OPEN)

**Status:** Unresolved. We confirmed cms_results data was migrated INTO sarkari_naukri (proven by `_migration_log_sarkari`). But we have NOT confirmed whether the CMS admin UI still shows a "Results" editing screen backed by `cms_results`.

**What's needed:** Confirm whether editing `cms_results` rows today (via any CMS admin screen) silently does nothing to live frontend content — i.e., are editors potentially making changes they believe are going live, when in reality `sarkari_naukri` is what the frontend reads?

**Risk if unresolved:** Editors waste time making "updates" to a dead table, or worse, believe content is live when it isn't. This is a live operational hazard independent of any migration timeline.

**Blocking:** Nothing technical. Should be communicated to CMS editors ASAP if confirmed as a dead screen.

## 3. cms_education_news — frontend scope clarification (LOW PRIORITY, OPEN)

**Status:** Partially resolved. Confirmed it's actively used by both CMS admin (full CRUD service) and public frontend (search API + educationNewsService). NOT a duplicate of content_posts.

**What's still open:** Whether it has a dedicated frontend page/section (e.g., `/education-news`) or only appears as search results. Lower stakes than items 1-2.

**Product decision pending:** Should cms_education_news eventually unify with blog_posts, or stay as its own content type permanently? Not blocking anything — parked for later.

---

*Last updated: 2026-07-25, end of exam-data-deduplication spec session.*
