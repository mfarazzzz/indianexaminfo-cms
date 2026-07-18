/**
 * educationNewsService.ts — CRUD for `cms_education_news` table.
 * No React imports. Business logic only.
 *
 * This is the ONLY pathway for creating/editing/publishing education news entries.
 * Direct SQL inserts are forbidden in production.
 */
import { db } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CmsEducationNews {
  id: string
  slug: string
  title: string
  titleHindi: string | null
  category: string
  excerpt: string | null
  excerptHindi: string | null
  content: string | null
  contentHindi: string | null
  imageId: string | null
  source: string | null
  sourceLink: string | null
  author: string | null
  isBreaking: boolean
  isImportant: boolean
  isFeatured: boolean
  relatedExams: Record<string, unknown>[] | null
  relatedResults: Record<string, unknown>[] | null
  tags: Record<string, unknown>[] | null
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived'
  publishedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CmsEducationNewsInput {
  slug: string
  title: string
  titleHindi?: string | null
  category: string
  excerpt?: string | null
  excerptHindi?: string | null
  content?: string | null
  contentHindi?: string | null
  imageId?: string | null
  source?: string | null
  sourceLink?: string | null
  author?: string | null
  isBreaking?: boolean
  isImportant?: boolean
  isFeatured?: boolean
  relatedExams?: Record<string, unknown>[] | null
  relatedResults?: Record<string, unknown>[] | null
  tags?: Record<string, unknown>[] | null
  status?: CmsEducationNews['status']
  createdBy?: string | null
  // Provenance
  createdVia?: string
  sourceType?: string
}

export interface CmsEducationNewsListOpts {
  status?: string
  category?: string
  search?: string
  isFeatured?: boolean
  isBreaking?: boolean
  isImportant?: boolean
  limit?: number
  offset?: number
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): CmsEducationNews {
  return {
    id:              r.id as string,
    slug:            r.slug as string,
    title:           r.title as string,
    titleHindi:      r.title_hindi as string | null,
    category:        r.category as string,
    excerpt:         r.excerpt as string | null,
    excerptHindi:    r.excerpt_hindi as string | null,
    content:         r.content as string | null,
    contentHindi:    r.content_hindi as string | null,
    imageId:         r.image_id as string | null,
    source:          r.source as string | null,
    sourceLink:      r.source_link as string | null,
    author:          r.author as string | null,
    isBreaking:      (r.is_breaking as boolean) ?? false,
    isImportant:     (r.is_important as boolean) ?? false,
    isFeatured:      (r.is_featured as boolean) ?? false,
    relatedExams:    r.related_exams as Record<string, unknown>[] | null,
    relatedResults:  r.related_results as Record<string, unknown>[] | null,
    tags:            r.tags as Record<string, unknown>[] | null,
    status:          (r.status as CmsEducationNews['status']) ?? 'draft',
    publishedAt:     r.published_at as string | null,
    createdBy:       r.created_by as string | null,
    createdAt:       r.created_at as string,
    updatedAt:       r.updated_at as string,
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listEducationNews(
  opts: CmsEducationNewsListOpts = {}
): Promise<{ data: CmsEducationNews[]; count: number }> {
  let q = db
    .from('cms_education_news')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })

  if (opts.status)     q = q.eq('status', opts.status)
  if (opts.category)   q = q.eq('category', opts.category)
  if (opts.isFeatured !== undefined)  q = q.eq('is_featured', opts.isFeatured)
  if (opts.isBreaking !== undefined)  q = q.eq('is_breaking', opts.isBreaking)
  if (opts.isImportant !== undefined) q = q.eq('is_important', opts.isImportant)
  if (opts.search)     q = q.ilike('title', `%${opts.search}%`)
  if (opts.limit)      q = q.limit(opts.limit)
  if (opts.offset)     q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { data: (data ?? []).map((r: any) => mapRow(r)), count: count ?? 0 }
}

// ── Get by ID ─────────────────────────────────────────────────────────────────

export async function getEducationNewsById(id: string): Promise<CmsEducationNews | null> {
  const { data, error } = await db
    .from('cms_education_news')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

// ── Get by Slug ───────────────────────────────────────────────────────────────

export async function getEducationNewsBySlug(slug: string): Promise<CmsEducationNews | null> {
  const { data, error } = await db
    .from('cms_education_news')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createEducationNews(input: CmsEducationNewsInput): Promise<CmsEducationNews> {
  const existing = await getEducationNewsBySlug(input.slug)
  if (existing) {
    throw new Error(`Slug "${input.slug}" is already in use.`)
  }

  const status = input.status ?? 'draft'
  const publishedAt = status === 'published' ? new Date().toISOString() : null

  const { data, error } = await db
    .from('cms_education_news')
    .insert({
      slug:             input.slug,
      title:            input.title,
      title_hindi:      input.titleHindi ?? null,
      category:         input.category,
      excerpt:          input.excerpt ?? null,
      excerpt_hindi:    input.excerptHindi ?? null,
      content:          input.content ?? null,
      content_hindi:    input.contentHindi ?? null,
      image_id:         input.imageId ?? null,
      source:           input.source ?? null,
      source_link:      input.sourceLink ?? null,
      author:           input.author ?? null,
      is_breaking:      input.isBreaking ?? false,
      is_important:     input.isImportant ?? false,
      is_featured:      input.isFeatured ?? false,
      related_exams:    input.relatedExams ?? null,
      related_results:  input.relatedResults ?? null,
      tags:             input.tags ?? null,
      status,
      published_at:     publishedAt,
      created_by:       input.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateEducationNews(
  id: string,
  input: Partial<CmsEducationNewsInput>
): Promise<CmsEducationNews> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  const fieldMap: Record<string, string> = {
    slug:           'slug',
    title:          'title',
    titleHindi:     'title_hindi',
    category:       'category',
    excerpt:        'excerpt',
    excerptHindi:   'excerpt_hindi',
    content:        'content',
    contentHindi:   'content_hindi',
    imageId:        'image_id',
    source:         'source',
    sourceLink:     'source_link',
    author:         'author',
    isBreaking:     'is_breaking',
    isImportant:    'is_important',
    isFeatured:     'is_featured',
    relatedExams:   'related_exams',
    relatedResults: 'related_results',
    tags:           'tags',
    createdBy:      'created_by',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as Record<string, unknown>)[key] !== undefined) {
      updates[col] = (input as Record<string, unknown>)[key]
    }
  }

  if (input.status !== undefined) {
    updates.status = input.status
    if (input.status === 'published') {
      updates.published_at = new Date().toISOString()
    }
  }

  const { data, error } = await db
    .from('cms_education_news')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Publish ───────────────────────────────────────────────────────────────────

export async function publishEducationNews(id: string): Promise<CmsEducationNews> {
  return updateEducationNews(id, { status: 'published' })
}

// ── Archive ───────────────────────────────────────────────────────────────────

export async function archiveEducationNews(id: string): Promise<CmsEducationNews> {
  return updateEducationNews(id, { status: 'archived' })
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteEducationNews(id: string): Promise<void> {
  const { error } = await db.from('cms_education_news').delete().eq('id', id)
  if (error) throw error
}

// ── Bulk ──────────────────────────────────────────────────────────────────────

export async function bulkPublishNews(ids: string[]): Promise<void> {
  const { error } = await db
    .from('cms_education_news')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

export async function bulkDeleteNews(ids: string[]): Promise<void> {
  const { error } = await db.from('cms_education_news').delete().in('id', ids)
  if (error) throw error
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchEducationNews(query: string, limit = 20): Promise<CmsEducationNews[]> {
  if (!query.trim()) return []
  const { data, error } = await db
    .from('cms_education_news')
    .select('*')
    .or(`title.ilike.%${query}%,category.ilike.%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r: any) => mapRow(r))
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getEducationNewsStats(): Promise<{
  total: number; published: number; draft: number; breaking: number
}> {
  const [total, published, draft, breaking] = await Promise.all([
    db.from('cms_education_news').select('id', { count: 'exact', head: true }),
    db.from('cms_education_news').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('cms_education_news').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    db.from('cms_education_news').select('id', { count: 'exact', head: true }).eq('is_breaking', true),
  ])
  return {
    total: total.count ?? 0,
    published: published.count ?? 0,
    draft: draft.count ?? 0,
    breaking: breaking.count ?? 0,
  }
}
