# Example: Creating a New Service

> Step-by-step guide to adding a new CMS module with full CRUD.

---

## Scenario: Adding a "Scholarships" Module

We want to manage scholarship entries in the CMS with list, create, edit, publish, and delete.

---

## Step 1: Database Table

Apply migration in Supabase:

```sql
CREATE TABLE IF NOT EXISTS cms_scholarships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  organization text NOT NULL,
  amount_min numeric,
  amount_max numeric,
  eligibility text,
  deadline date,
  apply_url text,
  description text,
  category text DEFAULT 'general',
  is_featured boolean DEFAULT false,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE cms_scholarships ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
CREATE POLICY "allow_authenticated_select" ON cms_scholarships
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_editors_insert" ON cms_scholarships
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_editors_update" ON cms_scholarships
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "allow_admins_delete" ON cms_scholarships
  FOR DELETE TO authenticated USING (true);
```

---

## Step 2: TypeScript Types

```typescript
// src/types/scholarship.ts
export interface CmsScholarship {
  id: string
  slug: string
  title: string
  organization: string
  amountMin: number | null
  amountMax: number | null
  eligibility: string | null
  deadline: string | null
  applyUrl: string | null
  description: string | null
  category: string
  isFeatured: boolean
  status: 'draft' | 'pending_review' | 'published' | 'archived'
  publishedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CmsScholarshipInput {
  slug: string
  title: string
  organization: string
  amountMin?: number | null
  amountMax?: number | null
  eligibility?: string | null
  deadline?: string | null
  applyUrl?: string | null
  description?: string | null
  category?: string
  isFeatured?: boolean
  status?: CmsScholarship['status']
  createdBy?: string | null
}
```

---

## Step 3: Service

```typescript
// src/services/scholarshipService.ts
import { db } from '@/lib/supabase/client'
import type { CmsScholarship, CmsScholarshipInput } from '@/types/scholarship'

function mapRow(r: Record<string, unknown>): CmsScholarship {
  return {
    id:           r.id as string,
    slug:         r.slug as string,
    title:        r.title as string,
    organization: r.organization as string,
    amountMin:    r.amount_min as number | null,
    amountMax:    r.amount_max as number | null,
    eligibility:  r.eligibility as string | null,
    deadline:     r.deadline as string | null,
    applyUrl:     r.apply_url as string | null,
    description:  r.description as string | null,
    category:     (r.category as string) ?? 'general',
    isFeatured:   (r.is_featured as boolean) ?? false,
    status:       (r.status as CmsScholarship['status']) ?? 'draft',
    publishedAt:  r.published_at as string | null,
    createdBy:    r.created_by as string | null,
    createdAt:    r.created_at as string,
    updatedAt:    r.updated_at as string,
  }
}

export async function listScholarships(opts: {
  status?: string; category?: string; search?: string; limit?: number
} = {}): Promise<{ data: CmsScholarship[]; count: number }> {
  let q = db.from('cms_scholarships').select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
  if (opts.status)   q = q.eq('status', opts.status)
  if (opts.category) q = q.eq('category', opts.category)
  if (opts.search)   q = q.ilike('title', `%${opts.search}%`)
  if (opts.limit)    q = q.limit(opts.limit)
  const { data, error, count } = await q
  if (error) throw error
  return { data: (data ?? []).map((r: any) => mapRow(r)), count: count ?? 0 }
}

export async function getScholarshipById(id: string): Promise<CmsScholarship | null> {
  const { data, error } = await db.from('cms_scholarships').select('*').eq('id', id).single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function createScholarship(input: CmsScholarshipInput): Promise<CmsScholarship> {
  // Check slug uniqueness
  const { data: existing } = await db.from('cms_scholarships').select('id').eq('slug', input.slug).maybeSingle()
  if (existing) throw new Error(`Slug "${input.slug}" already in use.`)

  const { data, error } = await db.from('cms_scholarships').insert({
    slug:          input.slug,
    title:         input.title,
    organization:  input.organization,
    amount_min:    input.amountMin ?? null,
    amount_max:    input.amountMax ?? null,
    eligibility:   input.eligibility ?? null,
    deadline:      input.deadline ?? null,
    apply_url:     input.applyUrl ?? null,
    description:   input.description ?? null,
    category:      input.category ?? 'general',
    is_featured:   input.isFeatured ?? false,
    status:        input.status ?? 'draft',
    created_by:    input.createdBy ?? null,
  }).select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateScholarship(id: string, input: Partial<CmsScholarshipInput>): Promise<CmsScholarship> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const fieldMap: Record<string, string> = {
    slug: 'slug', title: 'title', organization: 'organization',
    amountMin: 'amount_min', amountMax: 'amount_max', eligibility: 'eligibility',
    deadline: 'deadline', applyUrl: 'apply_url', description: 'description',
    category: 'category', isFeatured: 'is_featured',
  }
  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as any)[key] !== undefined) updates[col] = (input as any)[key]
  }
  if (input.status) {
    updates.status = input.status
    if (input.status === 'published') updates.published_at = new Date().toISOString()
  }
  const { data, error } = await db.from('cms_scholarships').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function deleteScholarship(id: string): Promise<void> {
  const { error } = await db.from('cms_scholarships').delete().eq('id', id)
  if (error) throw error
}
```

---

## Step 4: Query Keys

```typescript
// Add to src/lib/queryKeys.ts
export const scholarshipKeys = {
  all:    () => ['scholarships'] as const,
  list:   (opts?: Record<string, unknown>) => ['scholarships', 'list', opts] as const,
  detail: (id: string) => ['scholarships', 'detail', id] as const,
} as const
```

---

## Step 5: Register Routes

```typescript
// In src/router/index.tsx
const ScholarshipsListPage = lazyPage(() => import("@/pages/scholarships/ScholarshipsListPage"), "ScholarshipsListPage");
const ScholarshipEditPage  = lazyPage(() => import("@/pages/scholarships/ScholarshipEditPage"), "ScholarshipEditPage");

// Add to routes:
{ path: "/scholarships",     element: <ScholarshipsListPage /> },
{ path: "/scholarships/new", element: <ScholarshipEditPage /> },
{ path: "/scholarships/:id", element: <ScholarshipEditPage /> },
```

---

## Step 6: Create Pages

Create `src/pages/scholarships/ScholarshipsListPage.tsx` and `ScholarshipEditPage.tsx` following the patterns in existing pages (e.g., `ResultsListPage.tsx`).

---

## Summary

| What | File |
|------|------|
| Types | `src/types/scholarship.ts` |
| Service | `src/services/scholarshipService.ts` |
| Query Keys | `src/lib/queryKeys.ts` |
| Routes | `src/router/index.tsx` |
| List Page | `src/pages/scholarships/ScholarshipsListPage.tsx` |
| Edit Page | `src/pages/scholarships/ScholarshipEditPage.tsx` |
| Migration | Supabase SQL Editor |

Zero changes to existing files except `queryKeys.ts` and `router/index.tsx` (append only).
