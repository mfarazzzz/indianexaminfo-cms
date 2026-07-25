# Security Fixes — 2026-07-25

## Summary

During a routine database audit cleanup, a post-execution advisor check surfaced two live production security exposures. Both were investigated, confirmed exploitable, and fixed within the same session.

## Finding 1: Unauthenticated Email Enumeration (ERROR severity)

**What was exposed:** A view `auth_user_emails` (`SELECT id, email FROM auth.users`) existed in the `public` schema with full read/write grants to the `anon` Postgres role. Any unauthenticated HTTP request to `GET /rest/v1/auth_user_emails` could enumerate every registered user's UUID and email address.

**Duration:** Unknown. The view existed prior to this audit with no creation timestamp in migration history. Likely present since the initial CMS schema setup.

**Impact:** Low (only 2 user accounts exist), but the mechanism was fully exploitable — no authentication required, no rate limiting at the PostgREST layer.

**Fix applied:**
1. Revoked all anon access to the view (initial fix — insufficient due to PUBLIC role inheritance)
2. Revoked from PUBLIC role (actual fix that closed the grant path)
3. Dropped the view entirely and replaced it with a `get_auth_user_emails()` function that:
   - Is SECURITY DEFINER (needed to read auth.users)
   - Has `SET search_path = ''` (prevents search_path manipulation)
   - Checks `auth.uid()` is an admin/super-admin before returning any data
   - Is explicitly granted to `authenticated` only (not PUBLIC, not anon)
4. Updated `userService.ts` to call the function via `.rpc()` instead of the former view

**Residual risk:** None. The view no longer exists. The replacement function returns empty results for any non-admin caller, including other authenticated users.

## Finding 2: Anon-Callable SECURITY DEFINER Functions (WARN severity)

**What was exposed:** 10 SECURITY DEFINER functions in the `public` schema had EXECUTE granted via the `PUBLIC` Postgres role, which `anon` inherits. This meant any unauthenticated request could invoke these functions via `/rest/v1/rpc/<function_name>`:

- `handle_new_user()` — trigger function, could theoretically be called to create user_profiles entries
- `acquire_content_lock()` — could lock content without authentication
- `release_content_lock()` — could release locks
- `save_content_version()` — could create version entries
- `elms_audit_trigger_fn()` — audit trigger
- `current_user_role()` — system probe (returns NULL for anon, but reveals function existence)
- `get_my_role_slug()` — system probe
- `has_role(text)` — system probe
- `can_write_entity()` — permission check
- `can_publish_entity()` — permission check

**Duration:** Same as above — likely present since schema creation.

**Impact:** Medium. Most functions would fail gracefully when called without a valid `auth.uid()`, but `acquire_content_lock` and `save_content_version` accept explicit user IDs as parameters, meaning an attacker could potentially invoke them with forged UUIDs.

**Fix applied:**
1. `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC` for all 10 functions
2. `REVOKE EXECUTE ... FROM PUBLIC` also applied to `check_duplicate_entity` and `check_slug_available` (same pattern)
3. Explicit `GRANT EXECUTE TO authenticated` for functions that the CMS application needs to call directly
4. Trigger functions (`handle_new_user`, `elms_audit_trigger_fn`) do not need explicit grants — the trigger mechanism executes them in the owner's context regardless

**Residual risk:** None for direct invocation. The `authenticated`-level warnings that remain in the advisor are acceptable — authenticated users are legitimate CMS operators.

## Verification

- `has_function_privilege('anon', ..., 'EXECUTE')` returns `false` for all affected functions
- `has_function_privilege('authenticated', ..., 'EXECUTE')` returns `true` for functions the CMS needs
- `has_function_privilege('service_role', ..., 'EXECUTE')` returns `true` (unaffected)
- The `auth_user_emails` view no longer exists in `information_schema.views`
- `get_auth_user_emails()` returns empty when called without admin-level `auth.uid()`

## Lessons

1. Supabase's default PostgREST exposure model makes anything in the `public` schema with grants to `anon` or `PUBLIC` automatically API-accessible. Views and functions are attack surface, not just tables.
2. `REVOKE FROM anon` is insufficient if `PUBLIC` still has the grant — `anon` inherits from `PUBLIC`. Always revoke from `PUBLIC` when closing anon access paths.
3. SECURITY DEFINER views over `auth.users` should never exist in the `public` schema with broad grants. Use a function with internal role-checking instead.
