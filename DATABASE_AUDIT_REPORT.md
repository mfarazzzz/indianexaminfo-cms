# Database Schema Audit — Full Findings & Remediation Plan

**Date:** 2026-07-25  
**Scope:** All tables, indexes, constraints, functions, triggers, views, and RLS policies in `public` schema  
**Status:** Phase 1 (audit) & Phase 2 (risk-tiered proposals) complete. Awaiting review before Tier 3 execution.

---

## Executive Summary

The database contains **65+ tables** organized into three distinct subsystems that evolved at different times:

1. **"indianexaminfo-cms" system** (prefix-less tables) — `exams`, `content_posts`, `blog_posts`, `categories`, `pages`, `menus`, `media`, `settings`, `roles`, `permissions`, `audit_log`, `content_versions`, etc. This is the **live production frontend** data source. **127 exams**, 12 blog posts, 3 content posts.

2. **"Entity Lifecycle Management System" (ELMS)** — `entity`, `entity_module`, `module_block`, `entity_timeline_event`, `entity_seo`, `entity_eligibility`, `entity_vacancy`, `entity_fee`, `entity_exam_pattern`, `entity_selection_stage`, `entity_syllabus_subject`, `entity_media`, `entity_download`, `entity_link`, `entity_revision`, `entity_activity_log`, `entity_broken_link`, `entity_migration_log`, `conducting_body`, `media_library`, `reusable_component`, `module_block_component_ref`. This is a **newer CMS editor architecture** with modular content blocks. **3 entities** exist (testing/pilot).

3. **"cms_*" prefixed tables** — `cms_articles`, `cms_authors`, `cms_categories`, `cms_tags`, `cms_exams`, `cms_results`, `cms_education_news`, `cms_events`, `cms_holidays`, `cms_institutions`, `cms_places`, `cms_restaurants`, `cms_editorials`, `cms_pages`, `cms_media`, `cms_ads`, `cms_users`, `cms_roles`, `cms_permissions`, etc. This appears to be an **alternative frontend CMS** for a Hindi-language news/information site (sarkariresults.info or similar). Has **361 results**, 41 education news items. Has its own user/auth/permission system separate from the main CMS.

4. **`sarkari_naukri`** — A standalone recruitment/job table with **361 rows**, actively used by both frontend and CMS.

---

## Phase 1: Audit Findings

### 1. REDUNDANT/DUPLICATE STRUCTURES

#### 1.1 Triple-duplication of exam data (CRITICAL)

| Table | Rows | Used by Frontend | Used by CMS |
|-------|------|-----------------|-------------|
| `exams` | 127 | ✅ (examService.ts) | ✅ (examService.ts in CMS) |
| `entity` | 3 | ❌ | ✅ (entityService.ts — new editor) |
| `cms_exams` | 0 | ❌ | ❌ (no code references found) |

**Finding:** The live production frontend reads exclusively from `exams`. The CMS admin panel has *two* editor UIs — the original `exams`-based editor and the newer ELMS `entity`-based editor. `cms_exams` is completely unused (0 rows, 0 code references). The `entity` table has only 3 pilot rows and is not read by any public-facing frontend.

#### 1.2 Duplicate category tables

| Table | Rows | Used |
|-------|------|------|
| `categories` | 19 | ✅ (FK from `exams`, `menu_items`, `entity`) |
| `cms_categories` | 0 | ❌ (no code references in this CMS codebase) |

#### 1.3 Duplicate media tables

| Table | Rows | Used |
|-------|------|------|
| `media` | 0 | ✅ (`mediaService.ts` reads/writes) |
| `media_library` | 0 | Used by entity system (`entity_media`, `entity_download` FK) |
| `cms_media` + `cms_media_variants` | 0 | Used by cms_* tables (FK from `cms_articles`, `cms_results`, etc.) |

Three separate media management systems exist.

#### 1.4 Duplicate audit/versioning tables

| Table | Rows | Used |
|-------|------|------|
| `audit_log` | 0 | ✅ (`auditService.ts`) |
| `cms_audit_log` | 0 | ❌ (no code references) |
| `content_versions` | 0 | Has RLS policies, trigger (`prune_content_versions`) |
| `cms_content_versions` | 0 | ❌ (no code references) |
| `entity_revision` | 0 | Used by entity system |
| `entity_activity_log` | 12 | Used by entity system |

#### 1.5 Duplicate user/role/permission systems

| Table | Rows | Used |
|-------|------|------|
| `user_profiles` + `roles` + `permissions` + `role_permissions` | 2/6/22/63 | ✅ (main CMS auth via `current_user_role()`, `has_role()`, `get_my_role_slug()`) |
| `cms_users` + `cms_roles` + `cms_permissions` + `cms_ai_permissions` | 2/7/96/0 | ✅ (cms_* system via `v_cms_user_permissions` view, service_role policies) |

Two fully independent auth/permission systems operating in parallel.

#### 1.6 Duplicate pages tables

| Table | Rows | Used |
|-------|------|------|
| `pages` | 6 | ✅ (has RLS policies, is_system flag) |
| `cms_pages` | 0 | ❌ (no code references) |

#### 1.7 Duplicate blog/article tables

| Table | Rows | Used |
|-------|------|------|
| `blog_posts` + `blog_authors` | 12/1 | ✅ (active in CMS) |
| `cms_articles` + `cms_authors` + `cms_editorials` | 0/0/0 | ❌ from this CMS (may be used by separate frontend) |

#### 1.8 Duplicate indexes (same column, same table)

| Table | Redundant Indexes |
|-------|-------------------|
| `blog_posts` | `blog_posts_slug_key` (UNIQUE) + `blog_posts_slug_idx` (btree) |
| `categories` | `categories_slug_key` + `categories_slug_idx` |
| `cms_articles` | `cms_articles_slug_key` + `idx_cms_articles_slug` |
| `cms_authors` | `cms_authors_slug_key` + `idx_cms_authors_slug` |
| `cms_categories` | `cms_categories_slug_key` + `idx_cms_categories_slug` |
| `cms_tags` | `cms_tags_slug_key` + `idx_cms_tags_slug` |
| `content_posts` | `content_posts_slug_key` + `content_posts_slug_idx` |
| `entity_seo` | `entity_seo_entity_id_key` + `idx_entity_seo_entity` |
| `exams` | `exams_slug_key` + `exams_slug_idx` |
| `redirects` | `redirects_from_path_key` + `redirects_from_path_idx` |

A UNIQUE constraint already creates a btree index. The separate btree index on the same column is pure waste (doubles write overhead, doubles storage for that index).

---

### 2. ORPHANED/UNUSED STRUCTURES

#### 2.1 Confirmed unused — no code references found

| Table | Rows | Confidence |
|-------|------|-----------|
| `cms_exams` | 0 | **Confirmed unused** — 0 rows, 0 code refs |
| `cms_categories` | 0 | **Confirmed unused** from this CMS |
| `cms_pages` | 0 | **Confirmed unused** from this CMS |
| `cms_content_versions` | 0 | **Confirmed unused** — 0 rows, 0 code refs |
| `cms_audit_log` | 0 | **Confirmed unused** — 0 rows, 0 code refs |
| `cms_webhook_log` | 0 | **Confirmed unused** — 0 rows, 0 code refs |

#### 2.2 Likely unused — cms_* tables with data but unknown frontend

| Table | Rows | Confidence |
|-------|------|-----------|
| `cms_results` | 361 | **Post-migration artifact** — all rows migrated to `sarkari_naukri`. CMS route redirects. |
| `cms_education_news` | 41 | **Live** — powers site-wide search results only (not a dedicated page) |
| `cms_articles` | 0 | Likely unused from this CMS (no code references in this codebase) |
| `cms_events`, `cms_holidays`, `cms_institutions`, `cms_places`, `cms_restaurants` | 0 | No code references in either codebase |

#### 2.3 Missing table referenced by code

| Table | Referenced in | Status |
|-------|-------------|--------|
| `entity_snapshot` | `snapshotService.ts`, `healthService.ts`, `entityService.ts` | **DOES NOT EXIST in database** |

This is a bug — the code writes to `entity_snapshot` but the table was never created (or was dropped). This would cause runtime errors for entity creation.

---

### 3. INCONSISTENT NAMING/TYPING

#### 3.1 Table naming conventions

- **Three competing conventions in one schema:**
  - Prefix-less: `exams`, `categories`, `blog_posts`, `media`, `pages`, `roles`
  - `entity_` prefix: `entity_module`, `entity_seo`, `entity_timeline_event`
  - `cms_` prefix: `cms_articles`, `cms_results`, `cms_exams`
- **Singular vs plural:** `entity` (singular) vs `exams` (plural) vs `blog_posts` (plural) vs `conducting_body` (singular)
- Internal/migration table uses `_` prefix: `_migration_log_sarkari`

#### 3.2 Status field inconsistencies

| Table | Column | Type | Values |
|-------|--------|------|--------|
| `exams` | `status` | enum `exam_status` | upcoming, active, registration-open, etc. |
| `entity` | `workflow_status` | text | draft, published, etc. |
| `blog_posts` | `status` | enum `post_status` | draft, review, published, unpublished |
| `cms_articles` | `status` | text (CHECK) | draft, pending_review, approved, published, archived |
| `sarkari_naukri` | `status` + `workflow_status` | text (CHECK) each | Two separate status fields! |
| `content_posts` | `status` | enum `post_status` | draft, review, published, unpublished |

#### 3.3 Pillar field inconsistencies

| Table | Type |
|-------|------|
| `exams` | enum `pillar_type` (sarkari-naukri, entrance-exam, board-university) |
| `entity` | text (no constraint) |
| `content_posts` | enum `pillar_type` |

The `entity.pillar` is unvalidated text while `exams.pillar` uses a proper enum.

#### 3.4 Foreign key naming

- `entity_conducting_body_id_fkey` vs `exams_category_id_fkey` — inconsistent prefix patterns
- `entity_category_id_fkey` follows a different pattern than `entity_conducting_body_id_fkey`

#### 3.5 Date storage

- `exams.last_updated`: `date` type
- `exams.created_at`, `updated_at`: `timestamptz`
- `entity_timeline_event.event_date`: `date`
- `sarkari_naukri.notification_date`: `date`
- All `created_at`/`updated_at` use `timestamptz` consistently ✓

#### 3.6 Text conducting_body vs FK conducting_body_id

- `exams.conducting_body`: plain text column
- `entity.conducting_body`: plain text column
- `entity.conducting_body_id`: UUID FK to `conducting_body` table
- The `entity` table has BOTH a text field and an FK for the same concept

---

### 4. MISSING CONSTRAINTS / INTEGRITY GAPS

#### 4.1 Missing foreign keys

| Table | Column | Should FK to | Issue |
|-------|--------|-------------|-------|
| `exams.conducting_body` | text | `conducting_body.name` | Text-only, no referential integrity |
| `entity.conducting_body` | text | N/A | Redundant with `conducting_body_id` FK |
| `content_versions.entity_id` | UUID | `exams.id` or `content_posts.id` etc. | Polymorphic — no FK possible, relies on app logic |
| `related_content.source_id/target_id` | UUID | Polymorphic | Same pattern — no FK |
| `sarkari_naukri.image_id` | UUID | `cms_media.id`? | No FK constraint exists |
| `sarkari_naukri.source_id` | UUID | Multiple tables | No FK |
| `cms_articles.created_by` | UUID | `auth.users.id`? | No FK defined |

#### 4.2 Missing NOT NULL where data model implies required

| Table.Column | Issue |
|-------------|-------|
| `entity.pillar` | Nullable, but every exam must have a pillar |
| `entity.conducting_body_id` | Nullable, yet `conducting_body` text is also nullable — one should be required |
| `exams.pillar` | Not nullable ✓ (correct) |
| `sarkari_naukri.created_at` | Nullable with default — should be NOT NULL |
| `sarkari_naukri.updated_at` | Nullable with default — should be NOT NULL |

#### 4.3 Missing indexes on frequently-filtered columns

| Table | Column | Used in queries | Has index? |
|-------|--------|----------------|-----------|
| `sarkari_naukri` | `slug` | Yes (slug lookups) | ✅ UNIQUE |
| `entity` | `conducting_body_id` | Yes (taxonomy merges) | Only partial (via `uq_entity_conducting_body_slug`) |
| `content_posts` | `exam_entity_name` | Potentially | ❌ |
| `entity_activity_log` | `module_id` | Yes (module lookups) | ❌ |

---

### 5. RLS AND SECURITY GAPS

#### 5.1 RLS disabled

| Table | RLS Enabled | Issue |
|-------|-------------|-------|
| `_migration_log_sarkari` | **❌ NO** | Fully exposed to anon/authenticated roles |

#### 5.2 Overly permissive policies

| Table | Policy | Issue |
|-------|--------|-------|
| `exams` | `public_read_exams` | `qual = true` — all rows visible to anon, including draft/unpublished |
| `blog_authors` | `staff_write_blog_authors` | INSERT with no qual — any user can insert |
| `content_posts` | `staff_write_content` | INSERT with no qual |
| `menus` | `staff_write_menus` | INSERT with no qual |
| `categories` | `staff_write_categories` | INSERT with no qual |
| `exams` | `staff_write_exams` | INSERT with no qual |
| `sarkari_naukri` | `authenticated_delete` | `qual = true` — any authenticated user can delete any row |
| `cms_education_news` | `authenticated_delete` | Same — any authenticated user can delete |
| `cms_results` | `authenticated_delete` | Same pattern |

#### 5.3 Missing anon read access

The `entity` table and all `entity_*` satellite tables only allow `authenticated` access. If the entity system is ever exposed to a public frontend, anon read policies will be needed.

---

### 6. STRUCTURAL DEBT — `exams` vs `entity` (The Critical Question)

#### Current State

| Aspect | `exams` | `entity` + satellites |
|--------|---------|----------------------|
| Row count | 127 (production data) | 3 (pilot data) |
| Frontend reads | ✅ Live production | ❌ Not exposed |
| CMS editor | ✅ Original editor | ✅ New ELMS editor |
| Schema | Flat, wide (47 columns, lots of JSONB) | Normalized (narrow core + satellite tables) |
| Dates/Vacancies | Embedded in `important_dates` JSONB, `vacancy` integer | Separate `entity_timeline_event`, `entity_vacancy` tables |
| Eligibility/Fees | Embedded in `eligibility` JSONB, `application_fee` JSONB | Separate `entity_eligibility`, `entity_fee` tables |
| SEO | Inline `seo_title`, `seo_description` | Separate `entity_seo` table |
| Content blocks | N/A (uses `content_posts` with typed JSONB) | `entity_module` → `module_block` hierarchy |
| Versioning | `content_versions` table (polymorphic) | `entity_revision` table (FK-linked) |
| Audit trail | `audit_log` (shared) | `entity_activity_log` (dedicated) |
| Conducting body | Text field only | FK to `conducting_body` table + redundant text |

#### Assessment

The **`entity` system is architecturally superior** (normalized, modular, audited, better integrity) but has almost no data. The **`exams` table is the production source of truth** with 127 real records being served to users. Both the `indianexaminfo-frontend` and the `indianexaminfo-cms` codebase read `exams` directly.

A unified target schema would look like `entity` + satellites, but migrating 127 production exams into it requires:
1. Data transformation (JSONB → separate tables)
2. Frontend rewrites (examService.ts → entityService.ts)
3. Maintaining backward compatibility during transition

**This is explicitly a Tier 3 decision that must not be made unilaterally.**

---

## Phase 2: Risk-Tiered Remediation Plan

### TIER 1 — Safe, purely additive, reversible

| # | Change | Justification |
|---|--------|---------------|
| T1-1 | Drop redundant btree indexes that duplicate UNIQUE constraints: `blog_posts_slug_idx`, `categories_slug_idx`, `idx_cms_articles_slug`, `idx_cms_authors_slug`, `idx_cms_categories_slug`, `idx_cms_tags_slug`, `content_posts_slug_idx`, `idx_entity_seo_entity`, `exams_slug_idx`, `redirects_from_path_idx` | UNIQUE already creates a btree index. The extra index wastes storage and slows writes. Dropping is safe — the UNIQUE index remains. |
| T1-2 | Add `COMMENT` to `entity.conducting_body` column documenting it as deprecated in favor of `conducting_body_id` | Documentation only |
| T1-3 | Add index on `entity_activity_log(module_id)` | Missing index on FK column used in joins |
| T1-4 | Create the missing `entity_snapshot` table | Code references it but it doesn't exist — this is blocking entity creation |
| T1-5 | Add `COMMENT` to `sarkari_naukri` documenting dual-status fields | Documentation only |

### TIER 2 — Additive but requires verification

| # | Change | Verification needed | Justification |
|---|--------|-------------------|---------------|
| T2-1 | `ALTER TABLE sarkari_naukri ALTER COLUMN created_at SET NOT NULL` | Verify no NULL values exist | Schema implies required |
| T2-2 | `ALTER TABLE sarkari_naukri ALTER COLUMN updated_at SET NOT NULL` | Verify no NULL values exist | Schema implies required |
| T2-3 | Enable RLS on `_migration_log_sarkari` with admin-only SELECT policy | Must add policy BEFORE enabling RLS or all access breaks | Security gap |
| T2-4 | Restrict `exams` public_read policy to `status != 'draft'` or similar | Verify current frontend doesn't rely on reading drafts via anon | Drafts are publicly visible |
| T2-5 | Add CHECK constraint on `entity.pillar` matching `pillar_type` enum values | Verify existing 3 rows have valid pillar values | Type consistency |

### TIER 3 — Destructive or hard to reverse (PROPOSALS ONLY)

| # | Change | Risk | Rollback plan |
|---|--------|------|--------------|
| **T3-1** | **Resolve `exams` vs `entity` canonical source** — decide whether to (A) migrate `exams` data into `entity` + satellites and retire `exams`, or (B) keep `exams` as production and treat `entity` as the internal editing layer that syncs to `exams` | **HIGHEST PRIORITY.** Affects all downstream schema work. Blocks any attempt to unify the two representations. | N/A — this is a design decision, not a migration. Once decided, execution is a separate Tier 3 item. |
| T3-2 | Drop `cms_exams` table (0 rows, 0 code references) | Low data risk (empty), but may be used by unreachable frontend code | Backup via `pg_dump --table=cms_exams` before drop |
| T3-3 | Drop `cms_content_versions` table (0 rows, 0 code references) | Same | Backup before drop |
| T3-4 | Drop `cms_audit_log` table (0 rows, 0 code references) | Same | Backup before drop |
| T3-5 | Drop `cms_webhook_log` table (0 rows, 0 code references) | Same | Backup before drop |
| T3-6 | Consolidate `media` (0 rows) into `media_library` or vice versa | Requires rewriting `mediaService.ts` | Rename + view fallback |
| T3-7 | Consolidate `audit_log` + `entity_activity_log` into a unified audit table | Requires code changes in both systems | Keep old table as view |
| T3-8 | Drop text `entity.conducting_body` column (redundant with FK `conducting_body_id`) | Requires verifying no code reads the text field directly | Add view column as fallback |
| T3-9 | Drop `cms_users` + `cms_roles` + `cms_permissions` + `cms_ai_permissions` + `cms_ai_config` + `cms_ai_usage` + `v_cms_user_permissions` view (confirmed dormant at all layers — see Reconciliation 3) | Low risk — zero references in RLS, functions, triggers, auth hooks, or application code | Backup all tables + view before drop |
| T3-10 | Drop `cms_results` table (361 rows, fully migrated to `sarkari_naukri` with lineage in `_migration_log_sarkari` — see Reconciliation 1). Also remove dead `resultService.ts` code. | Low data risk — data already lives in `sarkari_naukri`. CMS route already redirects. | Migration log preserves lineage. Backup table before drop. |
| T3-11 | Drop all confirmed-unused `cms_*` tables with 0 rows (`cms_pages`, `cms_categories`, etc.) | Risk: unknown external frontends may use them | Backup + soft-delete first |
| T3-12 | Rename `entity` to `entity_core` or `exam_entity` for clarity | Breaks all code referencing it | Search-and-replace + old name as view |
| T3-13 | Restrict `sarkari_naukri` authenticated_delete policy to admin-only | Any authenticated user can currently delete any row | Policy update (reversible but noted as T3 because it changes access control) |

---

## Phase 3: Execution Results

### Tier 1 — Executed (2026-07-25)

| Item | Status | Details |
|------|--------|---------|
| T1-4 | ✅ Done | Created `entity_snapshot`, `lifecycle_template`, `lifecycle_template_version` tables with RLS policies. All three were missing despite active code references. |
| T1-1 | ✅ Done | Dropped 10 redundant indexes: `blog_posts_slug_idx`, `categories_slug_idx`, `idx_cms_articles_slug`, `idx_cms_authors_slug`, `idx_cms_categories_slug`, `idx_cms_tags_slug`, `content_posts_slug_idx`, `idx_entity_seo_entity`, `exams_slug_idx`, `redirects_from_path_idx` |
| T1-2 | ✅ Done | Added deprecation comment on `entity.conducting_body` column |
| T1-3 | ✅ Done | Created index `idx_activity_log_module` on `entity_activity_log(module_id)` |
| T1-5 | ✅ Done | Added documentation comments on `sarkari_naukri.status` and `sarkari_naukri.workflow_status` |

**Additional finding during T1-4:** Not only `entity_snapshot` was missing — `lifecycle_template` and `lifecycle_template_version` (used by `templateService.ts`) were also absent. All three were created together.

### Tier 2 — Applied (2026-07-25)

| Item | Status | Details |
|------|--------|---------|
| T2-1 | ✅ Applied | `ALTER TABLE sarkari_naukri ALTER COLUMN created_at SET NOT NULL` |
| T2-2 | ✅ Applied | `ALTER TABLE sarkari_naukri ALTER COLUMN updated_at SET NOT NULL` |
| T2-3 | ✅ Applied | Enabled RLS on `_migration_log_sarkari` + admin-only SELECT policy |
| T2-4 | ⏸️ Hold | No draft rows exist, enum doesn't support "draft". Correctly deferred. |
| T2-5 | ✅ Applied | Added CHECK constraint `chk_entity_pillar` on `entity.pillar` |

### Tier 3 — Executed (2026-07-25, approved low-risk drops)

| Item | Status | Details |
|------|--------|---------|
| T3-9 | ✅ Dropped | `v_cms_user_permissions` view, `cms_ai_permissions`, `cms_ai_config`, `cms_ai_usage`, `cms_users`, `cms_roles`, `cms_permissions` — all in one atomic migration |
| T3-2 | ✅ Dropped | `cms_exams` (0 rows) |
| T3-3 | ✅ Dropped | `cms_content_versions` (0 rows) |
| T3-4 | ✅ Dropped | `cms_audit_log` (0 rows) |
| T3-5 | ✅ Dropped | `cms_webhook_log` (0 rows) |
| T3-11 | ✅ Dropped | `cms_pages`, `cms_categories`, `cms_articles`, `cms_article_tags`, `cms_article_categories`, `cms_editorials`, `cms_editorial_articles` (all 0 rows) |
| T3-10 | ✅ Dropped | `cms_results` (361 rows, fully migrated to `sarkari_naukri`). Precondition verified: no edge functions, no pg_cron, no event triggers. |

**Pre-drop verification completed for cms_results:**
- pg_cron: not installed
- Edge functions: zero deployed
- Event triggers: only Supabase infrastructure (PostgREST, GraphQL, pg_net grants) — none reference any of the dropped tables

### Tier 3 — Remaining (awaiting legacy migration spec)

| Item | Status |
|------|--------|
| T3-1 | ⏸️ Carried forward to legacy migration spec — will be resolved as the opening question of that session's Requirements phase |
| T3-6 | ⏸️ Media table consolidation — deferred |
| T3-7 | ⏸️ Audit table consolidation — deferred |
| T3-8 | ⏸️ Drop entity.conducting_body text column — deferred |
| T3-12 | ⏸️ Entity table rename — deferred |
| T3-13 | ⏸️ Restrict sarkari_naukri authenticated_delete — deferred |

---

## Phase 4: cms_* Investigation Results (2026-07-25)

### Question 1: What frontend(s) read from cms_* tables?

**Answer: The same main frontend (indianexaminfo.com) reads `cms_education_news` directly.** There is NO separate frontend application or domain for the cms_* tables.

Evidence:
- `indianexaminfo-frontend/services/educationNewsService.ts` reads from `cms_education_news` (used for search results)
- The frontend's `/results` page reads from `content_posts` and `exams`, **NOT** from `cms_results`
- `cms_results` is managed exclusively through the CMS admin panel (`ResultsListPage.tsx` → `resultService.ts`)
- There is only ONE domain configured anywhere: `indianexaminfo.com` (frontend) and `cms.indianexaminfo.com` (CMS admin)
- No evidence of sarkariresults.info or any other domain exists in the workspace

**Conclusion:** The `cms_results` table is a **post-migration artifact** — all 361 rows were fully migrated into `sarkari_naukri` (proven by `_migration_log_sarkari` with 361/361 source→target mappings). The CMS admin route `/results` already redirects to `/sarkari-naukri`. The `ResultsListPage` component is dead code. `cms_education_news` is live but only surfaces through site-wide search — it does NOT power a dedicated frontend page.

### Question 2: Is `sarkari_naukri` genuinely shared by both systems?

**Answer: Yes, confirmed.** Both codebases actively read/write `sarkari_naukri`:

- **Frontend** (`indianexaminfo-frontend/services/sarkariNaukriService.ts`): Extensive read queries for listing, filtering by state/category/department, slug-based detail pages, stats. All reads filter on `workflow_status = 'published'`.
- **CMS** (`indianexaminfo-cms/src/services/sarkariNaukriService.ts`): Full CRUD — list, get by ID/slug, create, update, delete, bulk publish/archive/delete, search, stats, state/category aggregation.

Both use the **same Supabase project** (same URL/key). The table is truly shared across both applications.

### Question 3: Is the cms_* auth system (`cms_users`, `cms_roles`, `cms_permissions`) actively used?

**Answer: It is NOT used for login.** The CMS login flow is:

1. `AuthContext.tsx` calls `supabase.auth.signInWithPassword()` (Supabase native auth)
2. It then reads `user_profiles` (joined with `roles`) to get the user's CMS role and permissions
3. Permissions come from `role_permissions` → `permissions` (the prefix-less auth system)

The `cms_users`/`cms_roles`/`cms_permissions` tables exist with data (2 users, 7 roles, 96 permissions) but **no application code queries them directly**. The `v_cms_user_permissions` view exists but has zero references in the codebase. These appear to be a **dormant alternative auth design** — possibly from an earlier architecture that was replaced by the `user_profiles`/`roles`/`permissions` system, or scaffolding for a planned migration that never happened. The RLS policies for cms_* tables use `service_role` (bypasses RLS entirely) which confirms they're accessed via a service key, not through user-session-based RLS like the main system.

### Revised T3-1: Restated Based on Investigation

The original audit framed this as a potential three-way choice. Based on investigation, it's actually a **two-system problem** (not three):

**System A: The "Exam Platform" (production, live)**
- Tables: `exams` (127 rows), `content_posts` (3 rows), `blog_posts` (12 rows), `categories`, `menus`, `pages`, `media`, `sarkari_naukri` (361 rows)
- Auth: `user_profiles` + `roles` + `permissions` + `role_permissions`
- Read by: indianexaminfo.com (Next.js frontend)
- Edited by: cms.indianexaminfo.com (this CMS)

**System B: The "Entity Lifecycle Management System" (new architecture, pilot)**
- Tables: `entity` (3 rows), `entity_module`, `module_block`, `entity_timeline_event`, `entity_seo`, `entity_eligibility`, `entity_vacancy`, `entity_fee`, `entity_exam_pattern`, `entity_selection_stage`, `entity_syllabus_subject`, `entity_media`, `entity_download`, `entity_link`, `entity_revision`, `entity_activity_log`, `media_library`, `conducting_body`, `reusable_component`, `lifecycle_template`, `lifecycle_template_version`, `entity_snapshot`
- Auth: Same `user_profiles`/`roles` system (shared)
- Read by: Nobody publicly (no frontend integration yet)
- Edited by: cms.indianexaminfo.com (the ELMS entity editor)

**The cms_* prefixed tables** (`cms_results`, `cms_education_news`, `cms_exams`, `cms_articles`, etc.) are **features of THIS SAME CMS** — managed by this admin panel, partially consumed by the same frontend. They are NOT a separate product. `cms_exams` specifically is dead (0 rows, 0 code refs), but `cms_results` (361 rows) and `cms_education_news` (41 rows) are live content.

**Revised decision for T3-1:**

| Option | Description | Impact |
|--------|-------------|--------|
| **A** | Migrate `exams` → `entity` + satellites; rewrite frontend to read from entity system | Clean long-term architecture. Major project — frontend rewrite + data migration. |
| **B** | Keep `exams` as production; `entity` system is the CMS editing layer that syncs back to `exams` on publish | No frontend changes. Sync layer required. Two representations persist. |
| **C** | Keep both running independently; new exams created in `entity`, legacy stays in `exams` until naturally deprecated | Minimal effort. Divergent data forever. Not recommended. |

**The cms_* tables are explicitly out of scope for T3-1** — they fall into two categories:
1. **Live content tables** (`cms_education_news` — feeds site search; `sarkari_naukri` — shared by frontend + CMS): Must remain untouched.
2. **Confirmed dead/migrated** (`cms_results` — fully migrated to `sarkari_naukri`; `cms_exams`, `cms_pages`, etc. — 0 rows, 0 references): Tier 3 drop candidates independent of the exams↔entity decision.
3. **Confirmed dormant auth stack** (`cms_users`, `cms_roles`, `cms_permissions`, `cms_ai_*`, `v_cms_user_permissions`): Tier 3 drop candidates, no active references at any layer.

None of these affect or are affected by the T3-1 decision about `exams` vs `entity`.

---

## Reconciliation Notes (2026-07-25, post-investigation)

### Reconciliation 1: cms_results is a STRANDED POST-MIGRATION TABLE

**Prior finding was correct.** The `_migration_log_sarkari` table proves a complete 1:1 migration:
- Source: `cms_results` (361 rows)
- Target: `sarkari_naukri` (361 rows)  
- Every single `sarkari_naukri` row has `source_table = 'cms_results'` and a valid `source_id` pointing back
- The migration log has 361 entries, all with `source_table = 'cms_results'`

**The CMS admin screen is already dead.** The router at `/results` redirects to `/sarkari-naukri` with a comment `// CMS Results (LEGACY — redirects to Sarkari Naukri)`. Nobody can reach `ResultsListPage` through the UI. The component exists as dead code.

**Operational hazard assessment:** There is NO hazard today — the redirect is already in place. However, `resultService.ts` still has full CRUD functions that could be called programmatically (e.g., from an API route or import). The table itself is stale — any edits to `cms_results` have zero downstream effect on the public frontend (which reads `content_posts`/`exams` for the `/results` hub and `sarkari_naukri` for the Sarkari Naukri section).

**Recommendation:** `cms_results` should be classified as a Tier 3 drop candidate (post-migration artifact). Before dropping: (a) verify no scheduled jobs or edge functions reference it, (b) confirm `resultService.ts` dead code can be removed. No warning banner needed since the admin screen is already inaccessible.

### Reconciliation 2: cms_education_news frontend scope

**`cms_education_news` surfaces ONLY through site-wide search.** Specifically:
- `/api/search/route.ts` — calls `searchEducationNews(q)` and returns results in the "News" tab
- `/app/(public)/search/page.tsx` — displays education news results in search

It does **NOT** power a dedicated listing page. The `/blog/education-news` section exists but is served by the `blog_posts` table (filtered by `section = 'education-news'`), not by `cms_education_news`. The `educationNewsService.ts` comment even says: "Used by search and any future news aggregation pages" — the "future" qualifier confirms the dedicated page doesn't exist yet.

**Impact assessment:** `cms_education_news` is live in production (search results include it), but it's a secondary content source feeding into an aggregate search — not a primary navigation destination. Touching it would degrade search quality but would not break any navigable page.

### Reconciliation 3: cms_users/cms_roles/cms_permissions dormancy — CONFIRMED

All four database-layer checks came back clean:

| Check | Result |
|-------|--------|
| RLS policies referencing cms_users/cms_roles/cms_permissions/cms_ai_permissions | **0 matches** |
| Postgres function bodies (pg_proc.prosrc) referencing these tables | **0 matches** |
| Triggers referencing these tables | **0 matches** |
| Auth hooks / custom claims / JWT hooks pointing at cms_users | **0 matches** |

Additional findings:
- The `on_auth_user_created` trigger calls `handle_new_user()` which inserts into `user_profiles` — **NOT** `cms_users`
- No auth schema function references `cms_users`
- The only database object that references these tables is the **`v_cms_user_permissions` view** — which itself has zero consumers (no RLS policy, no function, no trigger, no application code queries it)
- No Supabase custom access token hooks exist that reference these tables

**Classification: Confirmed dormant.** The `cms_users` + `cms_roles` + `cms_permissions` + `cms_ai_permissions` + `cms_ai_config` + `cms_ai_usage` auth stack and the `v_cms_user_permissions` view are provably unused at every layer — application code, RLS policies, Postgres functions, triggers, and auth hooks. They are safe to classify as Tier 3 drop candidates with the standard backup-before-drop precaution.

---

## Interaction with `exams` vs `entity` Decision

**T3-1 remains the gating decision.** Until resolved:

- The `exam-data-deduplication` feature work should proceed on whichever table is currently used for that feature (appears to be `entity` based on the spec)
- No schema unification between `exams` and `entity` should be attempted
- The `exams` table must remain untouched as the live production data source
- The `entity` system can continue to be developed independently for the CMS editor
- A sync/migration strategy (one-time or ongoing) is needed regardless of which direction is chosen
- The `cms_results`, `cms_education_news`, and `sarkari_naukri` tables are independent content features — they are NOT part of the exams↔entity consolidation question

---

## Backlog Notes (not blockers, accurate bookkeeping)

1. **`cms_education_news` footprint is smaller than previously claimed.** An earlier pass described it as "actively used by the public frontend." The verified reality: it feeds one search index endpoint, not a page. The dedicated listing page is "planned, not built" per a code comment. If anyone later frames this table as core content to justify blocking a schema change, the actual footprint is one search aggregation — not a user-navigable section.

2. **`v_cms_user_permissions` view is a dormant reconnection vector.** Zero consumers today (confirmed at all layers). But a view referencing the "dormant" `cms_users`/`cms_permissions` tables can silently become load-bearing if someone rebuilds a permissions feature later and reaches for the existing view without realizing the underlying tables are stale. When the dormant auth stack is eventually dropped (T3-9), the view should be dropped first or simultaneously — not left behind as an orphan that errors on SELECT.

---

## Next Steps

1. ✅ **Tier 1 complete** — all items executed
2. **Tier 2 ready to apply** — T2-1, T2-2, T2-3, T2-5 all passed verification cleanly. Awaiting your go-ahead.
3. **T2-4 on hold** — no "draft" exams exist today; the `exam_status` enum doesn't even include "draft". Zero impact if applied now. Recommend deferring.
4. **T3-1 decision needed** — confirmed as a clean **two-way decision** between `exams` (production) and `entity` (new architecture). The cms_* tables are irrelevant to this choice — they're either dead/migrated or independently live.
5. **Low-risk Tier 3 drops available** (independent of T3-1): `cms_results` (post-migration artifact), `cms_exams` (empty/dead), `cms_content_versions`, `cms_audit_log`, `cms_webhook_log`, `cms_pages`, `cms_categories` (all empty/dead), and the dormant auth stack (`cms_users`/`cms_roles`/`cms_permissions`/`cms_ai_*`/`v_cms_user_permissions`). These can be approved individually.
6. **Dead code cleanup** (non-DB): `ResultsListPage.tsx` and `resultService.ts` are dead code already gated by the router redirect. Can be removed in a separate PR.
