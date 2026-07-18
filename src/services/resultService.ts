/**
 * resultService.ts — CRUD for `cms_results` table.
 * No React imports. Business logic only.
 *
 * This is the ONLY pathway for creating/editing/publishing result entries.
 * Direct SQL inserts are forbidden in production.
 */
import { db } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CmsResult {
  id: string
  slug: string
  title: string
  titleHindi: string | null
  resultDate: string
  expectedDate: string | null
  organization: string
  organizationHindi: string | null
  category: string | null
  description: string | null
  descriptionHindi: string | null
  resultLink: string | null
  alternateLinks: Record<string, string>[] | null
  imageId: string | null
  totalCandidates: number | null
  passPercentage: number | null
  cutoffMarks: string | null
  resultStatus: string | null
  isNew: boolean
  isFeatured: boolean
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived'
  publishedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CmsResultInput {
  slug: string
  title: string
  titleHindi?: string | null
  resultDate: string
  expectedDate?: string | null
  organization: string
  organizationHindi?: string | null
  category?: string | null
  description?: string | null
  descriptionHindi?: string | null
  resultLink?: string | null
  alternateLinks?: Record<string, string>[] | null
  imageId?: string | null
  totalCandidates?: number | null
  passPercentage?: number | null
  cutoffMarks?: string | null
  resultStatus?: string | null
  isNew?: boolean
  isFeatured?: boolean
  status?: CmsResult['status']
  createdBy?: string | null
  // Provenance metadata (for AI/automation sources)
  createdVia?: string       // 'cms_editor' | 'ai_assistant' | 'api' | 'import'
  sourceType?: string       // 'manual' | 'ai_generated' | 'scraped' | 'rss'
  sourceUrl?: string | null
}

export interface CmsResultListOpts {
  status?: string
  category?: string
  search?: string
  isFeatured?: boolean
  isNew?: boolean
  resultStatus?: string
  limit?: number
  offset?: number
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): CmsResult {
  return {
    id:                r.id as string,
    slug:              r.slug as string,
    title:             r.title as string,
    titleHindi:        r.title_hindi as string | null,
    resultDate:        r.result_date as string,
    expectedDate:      r.expected_date as string | null,
    organization:      r.organization as string,
    organizationHindi: r.organization_hindi as string | null,
    category:          r.category as string | null,
    description:       r.description as string | null,
    descriptionHindi:  r.description_hindi as string | null,
    resultLink:        r.result_link as string | null,
    alternateLinks:    r.alternate_links as Record<string, string>[] | null,
    imageId:           r.image_id as string | null,
    totalCandidates:   r.total_candidates as number | null,
    passPercentage:    r.pass_percentage as number | null,
    cutoffMarks:       r.cutoff_marks as string | null,
    resultStatus:      r.result_status as string | null,
    isNew:             (r.is_new as boolean) ?? false,
    isFeatured:        (r.is_featured as boolean) ?? false,
    status:            (r.status as CmsResult['status']) ?? 'draft',
    publishedAt:       r.published_at as string | null,
    createdBy:         r.created_by as string | null,
    createdAt:         r.created_at as string,
    updatedAt:         r.updated_at as string,
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listResults(
  opts: CmsResultListOpts = {}
): Promise<{ data: CmsResult[]; count: number }> {
  let q = db
    .from('cms_results')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })

  if (opts.status)        q = q.eq('status', opts.status)
  if (opts.category)      q = q.eq('category', opts.category)
  if (opts.resultStatus)  q = q.eq('result_status', opts.resultStatus)
  if (opts.isFeatured !== undefined) q = q.eq('is_featured', opts.isFeatured)
  if (opts.isNew !== undefined)      q = q.eq('is_new', opts.isNew)
  if (opts.search)        q = q.ilike('title', `%${opts.search}%`)
  if (opts.limit)         q = q.limit(opts.limit)
  if (opts.offset)        q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { data: (data ?? []).map((r: any) => mapRow(r)), count: count ?? 0 }
}

// ── Get by ID ─────────────────────────────────────────────────────────────────

export async function getResultById(id: string): Promise<CmsResult | null> {
  const { data, error } = await db
    .from('cms_results')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

// ── Get by Slug ───────────────────────────────────────────────────────────────

export async function getResultBySlug(slug: string): Promise<CmsResult | null> {
  const { data, error } = await db
    .from('cms_results')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createResult(input: CmsResultInput): Promise<CmsResult> {
  // Validate slug uniqueness
  const existing = await getResultBySlug(input.slug)
  if (existing) {
    throw new Error(`Slug "${input.slug}" is already in use. Choose a different slug.`)
  }

  const status = input.status ?? 'draft'
  const publishedAt = status === 'published' ? new Date().toISOString() : null

  const { data, error } = await db
    .from('cms_results')
    .insert({
      slug:              input.slug,
      title:             input.title,
      title_hindi:       input.titleHindi ?? null,
      result_date:       input.resultDate,
      expected_date:     input.expectedDate ?? null,
      organization:      input.organization,
      organization_hindi: input.organizationHindi ?? null,
      category:          input.category ?? null,
      description:       input.description ?? null,
      description_hindi: input.descriptionHindi ?? null,
      result_link:       input.resultLink ?? null,
      alternate_links:   input.alternateLinks ?? null,
      image_id:          input.imageId ?? null,
      total_candidates:  input.totalCandidates ?? null,
      pass_percentage:   input.passPercentage ?? null,
      cutoff_marks:      input.cutoffMarks ?? null,
      result_status:     input.resultStatus ?? null,
      is_new:            input.isNew ?? false,
      is_featured:       input.isFeatured ?? false,
      status,
      published_at:      publishedAt,
      created_by:        input.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateResult(id: string, input: Partial<CmsResultInput>): Promise<CmsResult> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  const fieldMap: Record<string, string> = {
    slug:              'slug',
    title:             'title',
    titleHindi:        'title_hindi',
    resultDate:        'result_date',
    expectedDate:      'expected_date',
    organization:      'organization',
    organizationHindi: 'organization_hindi',
    category:          'category',
    description:       'description',
    descriptionHindi:  'description_hindi',
    resultLink:        'result_link',
    alternateLinks:    'alternate_links',
    imageId:           'image_id',
    totalCandidates:   'total_candidates',
    passPercentage:    'pass_percentage',
    cutoffMarks:       'cutoff_marks',
    resultStatus:      'result_status',
    isNew:             'is_new',
    isFeatured:        'is_featured',
    createdBy:         'created_by',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as Record<string, unknown>)[key] !== undefined) {
      updates[col] = (input as Record<string, unknown>)[key]
    }
  }

  // Handle status transitions
  if (input.status !== undefined) {
    updates.status = input.status
    if (input.status === 'published') {
      updates.published_at = new Date().toISOString()
    }
  }

  const { data, error } = await db
    .from('cms_results')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Publish ───────────────────────────────────────────────────────────────────

export async function publishResult(id: string, userId?: string): Promise<CmsResult> {
  return updateResult(id, { status: 'published', createdBy: userId ?? undefined })
}

// ── Archive ───────────────────────────────────────────────────────────────────

export async function archiveResult(id: string): Promise<CmsResult> {
  return updateResult(id, { status: 'archived' })
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteResult(id: string): Promise<void> {
  const { error } = await db.from('cms_results').delete().eq('id', id)
  if (error) throw error
}

// ── Bulk operations ───────────────────────────────────────────────────────────

export async function bulkPublishResults(ids: string[]): Promise<void> {
  const { error } = await db
    .from('cms_results')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

export async function bulkArchiveResults(ids: string[]): Promise<void> {
  const { error } = await db
    .from('cms_results')
    .update({ status: 'archived' })
    .in('id', ids)
  if (error) throw error
}

export async function bulkDeleteResults(ids: string[]): Promise<void> {
  const { error } = await db.from('cms_results').delete().in('id', ids)
  if (error) throw error
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchResults(query: string, limit = 20): Promise<CmsResult[]> {
  if (!query.trim()) return []
  const { data, error } = await db
    .from('cms_results')
    .select('*')
    .or(`title.ilike.%${query}%,organization.ilike.%${query}%,slug.ilike.%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r: any) => mapRow(r))
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getResultStats(): Promise<{
  total: number; published: number; draft: number; featured: number
}> {
  const [total, published, draft, featured] = await Promise.all([
    db.from('cms_results').select('id', { count: 'exact', head: true }),
    db.from('cms_results').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('cms_results').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    db.from('cms_results').select('id', { count: 'exact', head: true }).eq('is_featured', true),
  ])
  return {
    total: total.count ?? 0,
    published: published.count ?? 0,
    draft: draft.count ?? 0,
    featured: featured.count ?? 0,
  }
}

// ── Duplicate ─────────────────────────────────────────────────────────────────

export async function duplicateResult(id: string): Promise<CmsResult> {
  const source = await getResultById(id)
  if (!source) throw new Error('Result not found')

  return createResult({
    slug: `${source.slug}-copy-${Date.now().toString(36)}`,
    title: `${source.title} (Copy)`,
    titleHindi: source.titleHindi,
    resultDate: source.resultDate,
    expectedDate: source.expectedDate,
    organization: source.organization,
    organizationHindi: source.organizationHindi,
    category: source.category,
    description: source.description,
    descriptionHindi: source.descriptionHindi,
    resultLink: source.resultLink,
    alternateLinks: source.alternateLinks,
    totalCandidates: source.totalCandidates,
    passPercentage: source.passPercentage,
    cutoffMarks: source.cutoffMarks,
    resultStatus: source.resultStatus,
    isNew: false,
    isFeatured: false,
    status: 'draft',
  })
}
