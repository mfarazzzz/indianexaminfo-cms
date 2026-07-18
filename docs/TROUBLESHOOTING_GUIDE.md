# Troubleshooting Guide

> Solutions to common problems encountered during development and operations.

---

## 1. Build Failures

### `tsc` type errors during build

**Symptom:** `npm run build` fails with TypeScript errors.

**Fix:**
```bash
# Run typecheck to see all errors:
npm run typecheck

# Common causes:
# - Missing type imports (add `import type { X } from '...'`)
# - Null safety (add optional chaining `?.` or null checks)
# - Service return type mismatch (check mapRow function)
```

### Vite build out of memory

**Symptom:** Build crashes with `JavaScript heap out of memory`.

**Fix:**
```bash
# Increase Node memory:
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Module not found errors

**Symptom:** `Cannot find module '@/...'`

**Fix:**
- Verify `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }`
- Verify `vite.config.ts` has matching resolve alias
- Run `npm ci` to ensure dependencies are fresh

---

## 2. Supabase Connection Issues

### "Missing VITE_SUPABASE_URL" on startup

**Symptom:** App crashes immediately with environment error.

**Fix:**
1. Ensure `.env` file exists at project root
2. Ensure variables are prefixed with `VITE_`:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
3. Restart the dev server (Vite only reads .env on start)

### "Invalid API key" errors

**Symptom:** All Supabase queries return 401.

**Fix:**
- Verify the anon key in `.env` matches Supabase Dashboard → Settings → API → anon public key
- Ensure there are no extra quotes or whitespace in the key
- Check if the project was recently paused (free tier auto-pause)

### RLS policy blocking queries

**Symptom:** Queries return empty arrays even though data exists.

**Fix:**
- Check Supabase Dashboard → Authentication → verify user is logged in
- Check Table Editor → RLS policies for the affected table
- Test with service key temporarily to confirm RLS is the issue
- Add appropriate policy: `CREATE POLICY "allow_authenticated" ON table FOR SELECT TO authenticated USING (true);`

---

## 3. Missing Environment Variables

### AI features not working

**Symptom:** "Gemini API key not configured" error.

**Fix:** Settings → AI → Enter your Google Gemini API key. This is stored in the `settings` table, not in `.env`.

### Revalidation not triggering

**Symptom:** Frontend shows stale data after publish.

**Fix:**
1. Settings → Integrations → Verify `frontend_url` is set
2. Settings → Integrations → Verify `revalidate_token` is set
3. Both values must be present for revalidation to activate

---

## 4. AI API Failures

### Rate limited (429)

**Symptom:** "Rate limited by Google. Wait 60 seconds."

**Fix:**
- Wait 60 seconds and retry
- Or paste JSON directly (bypasses API entirely)
- Consider upgrading to a paid Google Cloud tier for higher quotas

### Empty AI response

**Symptom:** "Empty AI response" error.

**Fix:**
- The input text may be too short — provide more context
- The model may be overloaded — retry in a few seconds
- Check if the model name in settings is valid (e.g., `gemini-1.5-flash`)

### AI returns invalid JSON

**Symptom:** "AI response was not valid JSON"

**Fix:**
- Retry (sometimes models return markdown-wrapped JSON)
- Use the direct JSON paste feature: format data as JSON in another AI tool, paste it

---

## 5. Slug Conflicts

### "Slug already in use" error on create

**Symptom:** Entity creation fails with slug uniqueness error.

**Fix:**
- The system auto-appends the current year as a fallback
- If that also conflicts, choose a different name
- Check for soft-deleted entities with the same slug:
  ```sql
  SELECT id, slug, deleted_at FROM entity WHERE slug = 'the-slug';
  ```

### "URL path already in use" on update

**Symptom:** Editing an entity's slug fails.

**Fix:**
- Slugs must be unique within the same pillar
- Use `checkEntitySlug(slug, pillar, excludeId)` to verify before saving
- The entity's own ID should be excluded from the check

---

## 6. Permission Errors

### "You don't have permission" in UI

**Symptom:** Buttons are disabled or sections hidden.

**Fix:**
1. Check user's role: `user_profiles.role_id → roles.slug`
2. Check role permissions: `role_permissions` entries for that role
3. Add missing permissions via Supabase Table Editor
4. User must log out and back in to refresh permissions

### Can't publish entity

**Symptom:** Publish button shows error.

**Fix:**
- User needs `publish_entity` permission
- Entity must have SEO title and meta description filled
- Entity must be in `review` state (not `draft`)
- Check workflow transitions: `draft → review → published`

---

## 7. Upload Failures

### File upload error

**Symptom:** Media upload shows error toast.

**Fix:**
| Error | Resolution |
|-------|-----------|
| "File too large" | Reduce file size (check `validateImageFile` limits) |
| "Invalid file type" | Only image formats accepted (jpg, png, gif, webp, svg) |
| "Upload failed" | Check Supabase Storage bucket exists (`media`) |
| "Permission denied" | Check Storage policies in Supabase dashboard |

### Images show broken after upload

**Symptom:** Upload succeeds but image URL returns 404.

**Fix:**
- Verify the `media` bucket has public access enabled
- Check the public URL format in Supabase Storage settings
- Ensure the bucket policy allows public reads

---

## 8. Broken Frontend Routes

### Page shows blank or redirects to login

**Symptom:** Navigating to a route shows nothing or redirects.

**Fix:**
1. Check if the route exists in `src/router/index.tsx`
2. Check if the page component is properly exported
3. Check for lazy-load errors in browser console
4. Verify ProtectedRoute is not blocking (user must be authenticated)

### 404 after deploying to production

**Symptom:** Direct URL access returns Nginx 404.

**Fix:** Ensure Nginx has the SPA fallback:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

---

## 9. Missing Search Results

### Entity search returns nothing

**Symptom:** Search bar shows "No results" for known entities.

**Fix:**
1. Verify entity has `deleted_at IS NULL`
2. Verify entity's `name` field contains the search term
3. Search is case-insensitive but uses `ILIKE` (substring match)
4. Check TanStack Query cache — may need manual invalidation

### Stale search results

**Symptom:** Recently created entities don't appear in search.

**Fix:**
- TanStack Query may be serving cached results
- Navigate away and back to trigger a refetch
- Or manually invalidate: `queryClient.invalidateQueries({ queryKey: entityKeys.lists() })`

---

## 10. Development Environment Issues

### Hot Module Replacement (HMR) not working

**Symptom:** Changes don't reflect without manual reload.

**Fix:**
```bash
# Kill and restart dev server
# Ctrl+C then:
npm run dev

# If persists, clear Vite cache:
rm -rf node_modules/.vite
npm run dev
```

### Tests failing with "Cannot find module"

**Symptom:** Vitest can't resolve `@/` imports.

**Fix:** Verify `vitest.config.ts` (or `vite.config.ts`) has the `resolve.alias` configured:
```typescript
resolve: {
  alias: { '@': path.resolve(__dirname, './src') }
}
```

### "act(...)" warnings in tests

**Symptom:** React warnings about state updates not wrapped in `act()`.

**Fix:** Usually safe to ignore in integration tests. For unit tests, wrap async operations:
```typescript
await act(async () => {
  // trigger state update
})
```

---

## 11. Quick Diagnostic Commands

```bash
# Check if dev server is accessible
curl -s http://localhost:5173 | head -5

# Check TypeScript errors
npm run typecheck 2>&1 | head -20

# Check for unused imports/vars
npm run lint 2>&1 | grep "error"

# Verify production build
npm run build && ls -la dist/

# Check test status
npm run test 2>&1 | tail -20

# Check PM2 status (production)
pm2 status
pm2 logs indianexaminfo-cms --lines 20
```
