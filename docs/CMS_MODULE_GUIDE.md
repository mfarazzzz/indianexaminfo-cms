# CMS Module Guide

> Complete reference for all CMS content modules and how to extend the system.

---

## 1. Module Architecture

The CMS is organized into **content modules**, each responsible for a specific domain of content. Every module follows the same pattern:

```
Route → Page Component → Hook → Service → Database Table
```

---

## 2. Module Registry

All modules are registered in two systems:

1. **Legacy Modules** — Operate on their own dedicated tables (exams, content_posts, blog_posts, etc.)
2. **Content OS Modules** — Operate within the entity system (entity_module + module_block)

---

## 3. Legacy Modules

### 3.1 Exam Manager

| Property | Value |
|----------|-------|
| **Purpose** | Manage legacy exam entries (pre-entity system) |
| **Routes** | `/exams`, `/exams/new`, `/exams/:id` |
| **Service** | `src/services/examService.ts` |
| **Table** | `exams` |
| **Permissions** | `create_exam`, `edit_any_exam`, `delete_exam`, `publish_exam` |

**SEO**: Auto-generates `seo_title` and `seo_description` fields.
**AI**: Supports AI autofill for exam details, dates, and eligibility.

---

### 3.2 Content Posts

| Property | Value |
|----------|-------|
| **Purpose** | Manage typed content (notifications, admit cards, results, etc.) |
| **Routes** | `/content`, `/content/new`, `/content/:id` |
| **Service** | `src/services/contentService.ts` |
| **Table** | `content_posts` |
| **Permissions** | `create_post`, `edit_any_post`, `edit_own_post`, `delete_post`, `publish_post` |

**Content Types** (12): notification, application, admit-card, date-sheet, syllabus, answer-key, result, cutoff, previous-papers, mock-test, study-material, books

Each content type has its own field configuration defined in `src/config/contentTypeFields.ts`.

---

### 3.3 Blog Posts

| Property | Value |
|----------|-------|
| **Purpose** | Educational articles, news, guides |
| **Routes** | `/blog`, `/blog/new`, `/blog/:id`, `/blog/authors` |
| **Service** | `src/services/blogService.ts` |
| **Table** | `blog_posts`, `blog_authors` |
| **Permissions** | `create_post`, `edit_any_post`, `publish_post` |

**Sections**: education-news, exam-prep, career-guidance, scholarship, study-abroad, edtech, student-life, opinion

**Features**: Author management, reading time calculation, word count, table of contents, related exams linking.

---

### 3.4 Results (Sarkari Result)

| Property | Value |
|----------|-------|
| **Purpose** | Manage government exam results |
| **Routes** | `/results`, `/results/new`, `/results/:id` |
| **Service** | `src/services/resultService.ts` |
| **Table** | `cms_results` |
| **Permissions** | `create_post`, `edit_any_post`, `publish_post` |

**Features**: Hindi/English bilingual, category-wise cutoffs, bulk publish, duplicate, search.

---

### 3.5 Education News

| Property | Value |
|----------|-------|
| **Purpose** | Education sector news articles |
| **Routes** | `/education-news`, `/education-news/new`, `/education-news/:id` |
| **Service** | `src/services/educationNewsService.ts` |
| **Table** | `cms_education_news` |
| **Permissions** | `create_post`, `edit_any_post`, `publish_post` |

**Features**: Breaking news flag, importance flag, related exams/results, bilingual support.

---

### 3.6 Static Pages

| Property | Value |
|----------|-------|
| **Purpose** | CMS-managed static pages (About, Terms, Privacy, etc.) |
| **Routes** | `/pages`, `/pages/new`, `/pages/:id` |
| **Service** | `src/services/pageService.ts` |
| **Table** | `pages` |
| **Permissions** | `manage_pages` |

---

### 3.7 Categories

| Property | Value |
|----------|-------|
| **Purpose** | Hierarchical content categorization |
| **Routes** | `/categories` |
| **Service** | `src/services/categoryService.ts` |
| **Table** | `categories` |
| **Permissions** | `manage_categories` |

---

### 3.8 Menus

| Property | Value |
|----------|-------|
| **Purpose** | Navigation menu management |
| **Routes** | `/menus` |
| **Service** | `src/services/menuService.ts` |
| **Table** | `menus`, `menu_items` |
| **Permissions** | `manage_menus` |

---

### 3.9 Media Library

| Property | Value |
|----------|-------|
| **Purpose** | File upload and management |
| **Routes** | `/media` |
| **Service** | `src/services/mediaService.ts` |
| **Table** | `media` (metadata), Supabase Storage (files) |
| **Permissions** | `upload_media`, `delete_media` |

**Security**: Allowed folders whitelist, randomized filenames, MIME/size validation.

---

### 3.10 Advertising

| Property | Value |
|----------|-------|
| **Purpose** | Ad campaign management |
| **Routes** | `/ads`, `/ads/campaigns/:id`, `/ads/creatives`, `/ads/zones`, `/ads/reports` |
| **Service** | `src/services/adService.ts` |
| **Table** | `advertisers`, `ad_campaigns`, `ad_creatives`, `ad_zones`, `ad_reports` |
| **Permissions** | `manage_ads`, `view_own_ads`, `manage_ad_zones` |

---

### 3.11 User Management

| Property | Value |
|----------|-------|
| **Purpose** | User accounts and role assignment |
| **Routes** | `/users` |
| **Service** | `src/services/userService.ts` |
| **Table** | `user_profiles`, `roles`, `role_permissions` |
| **Permissions** | `manage_users`, `manage_roles` |

---

### 3.12 Settings

| Property | Value |
|----------|-------|
| **Purpose** | System configuration |
| **Routes** | `/settings` |
| **Service** | `src/services/settingsService.ts` |
| **Table** | `settings` |
| **Permissions** | `manage_settings` |

**Groups**: general, database, ai, seo, notifications, integrations, ads, appearance

---

## 4. Content OS Entity Modules

The new entity system uses a **workspace** model with registered editor panels:

### 4.1 Workspace Modules (18 total)

| Module Key | Label | Group | Description |
|-----------|-------|-------|-------------|
| `general` | General | identity | Entity name, slug, classification |
| `overview` | Overview | identity | Rich text overview sections |
| `timeline` | Timeline | content | Exam lifecycle events |
| `eligibility` | Eligibility | structured | Age, education, experience |
| `vacancy` | Vacancy | structured | Post-wise vacancy breakdown |
| `fee` | Fee | structured | Category-wise application fees |
| `exam_pattern` | Exam Pattern | structured | Papers, marks, duration |
| `selection_process` | Selection | structured | Selection stages |
| `syllabus` | Syllabus | structured | Subject-wise syllabus |
| `modules` | Modules | content | Content modules (blocks) |
| `downloads` | Downloads | assets | Downloadable files |
| `links` | Links | assets | Important links |
| `media` | Media | assets | Image gallery |
| `seo` | SEO | workflow | Title, meta, schema.org |
| `publishing` | Publishing | workflow | Status, scheduling |
| `relationships` | Relationships | workflow | Entity cross-references |
| `amendments` | Amendments | workflow | Post-publish corrections |
| `health` | Health | workflow | Content completeness |
| `verification` | Verification | workflow | Content freshness |

### 4.2 Module Visibility

Which modules appear for a given entity is controlled by the **template snapshot's `moduleVisibility`** map. Each entry specifies:
- `enabled: boolean` — Show in the workspace
- `required: boolean` — Must have content before publishing
- `displayOrder: number` — Sort position

---

## 5. How to Create a New CMS Module

### Step 1: Define the Service

```typescript
// src/services/myNewService.ts
import { db } from '@/lib/supabase/client'

export interface MyRecord { id: string; /* ... */ }

function mapRow(r: Record<string, unknown>): MyRecord { /* ... */ }

export async function listMyRecords(): Promise<MyRecord[]> { /* ... */ }
export async function createMyRecord(input: MyInput): Promise<MyRecord> { /* ... */ }
export async function updateMyRecord(id: string, input: Partial<MyInput>): Promise<MyRecord> { /* ... */ }
export async function deleteMyRecord(id: string): Promise<void> { /* ... */ }
```

### Step 2: Add Validation Schema

```typescript
// src/lib/validation/mySchemas.ts
import { z } from 'zod'

export const MyRecordSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  // ...
})
export type MyInput = z.infer<typeof MyRecordSchema>
```

### Step 3: Create List Page

```typescript
// src/pages/my-module/MyListPage.tsx
export function MyListPage() { /* ... */ }
```

### Step 4: Create Edit Page

```typescript
// src/pages/my-module/MyEditPage.tsx
export function MyEditPage() { /* ... */ }
```

### Step 5: Register Route

```typescript
// src/router/index.tsx
const MyListPage = lazyPage(() => import("@/pages/my-module/MyListPage"), "MyListPage");
const MyEditPage = lazyPage(() => import("@/pages/my-module/MyEditPage"), "MyEditPage");

// Add to route children:
{ path: "/my-module", element: <MyListPage /> },
{ path: "/my-module/new", element: <MyEditPage /> },
{ path: "/my-module/:id", element: <MyEditPage /> },
```

### Step 6: Add Navigation

Add the route to the sidebar navigation in `src/components/layout/Sidebar.tsx`.

### Step 7: Add Query Keys

```typescript
// src/lib/queryKeys.ts
export const myModuleKeys = {
  all:    () => ['my-module'] as const,
  list:   () => ['my-module', 'list'] as const,
  detail: (id: string) => ['my-module', 'detail', id] as const,
} as const
```

---

## 6. Adding a New Entity Workspace Module

To add a new tab/panel to the entity editor workspace:

### Step 1: Register in `src/components/workspace/registry.ts`

```typescript
registerModule({
  key: 'my_panel',
  label: 'My Panel',
  icon: 'file-text',
  group: 'content',
  defaultOrder: 15,
  editor: () => import('@/components/workspace/editors/MyPanelEditor').then(m => ({ default: m.MyPanelEditor })),
  inspector: null,
  permission: null,
  hasHealthWidget: false,
})
```

### Step 2: Create the Editor Component

```typescript
// src/components/workspace/editors/MyPanelEditor.tsx
import type { EditorProps } from '@/components/workspace/registry'

export function MyPanelEditor({ entityId }: EditorProps) {
  // Your editor UI
}
export default MyPanelEditor
```

### Step 3: Update Template Configuration

Add the module to `moduleVisibility` in the lifecycle template version's `configuration` JSON.

---

## 7. Known Limitations

- Legacy modules (exams, content_posts) coexist with the new entity system — they share no data
- The entity system does not yet support real-time collaborative editing
- Reorder operations use parallel updates (not atomic batch RPC) for ≤20 items
- Module-level SEO overrides are stored but not yet consumed by the frontend
- The media library does not support video uploads (Supabase Storage limits)
