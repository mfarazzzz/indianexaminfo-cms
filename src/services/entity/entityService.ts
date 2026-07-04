/**
 * entityService.ts — CRUD for the new `entity` table.
 * Maintains backward compatibility: existing examService.ts still works unchanged.
 */
import { db } from '@/lib/supabase/client'
import type { Entity, EntityListItem, EntityFull, EntityMediaMap } from '@/types/entity'
import type { EntityCreateInput } from '@/lib/validation/entitySchemas'
import { generateSlug } from '@/lib/validation/entitySchemas'
import type { EntityListOpts } from '@/lib/queryKeys'
import { listTimeline } from './timelineService'
import { listModules } from './moduleService'
import { getSeo } from './seoService'
import { getEligibility } from './eligibilityService'
import { listVacancies } from './vacancyService'
import { getFee } from './feeService'
import { listExamPattern } from './examPatternService'
import { listSelectionStages } from './selectionService'
import { listSyllabus } from './syllabusService'
import { listDownloads } from './downloadService'
import { listLinks } from './linkService'

const EMPTY_MEDIA: EntityMediaMap = {
  thumbnail: null,
  banner: null,
  ogImage: null,
  gallery: [],
  infographics: [],
  timelineImages: [],
  resultImages: [],
  admitCardImages: [],
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Entity {
  return {
    id:                  row.id as string,
    entityType:          (row.entity_type as string) ?? 'exam',
    slug:                row.slug as string,
    name:                row.name as string,
    shortName:           row.short_name as string | null,
    conductingBody:      row.conducting_body as string | null,
    officialWebsite:     row.official_website as string | null,
    categoryId:          row.category_id as string | null,
    pillar:              row.pillar as string | null,
    subType:             row.sub_type as string | null,
    examLevel:           row.exam_level as string | null,
    examMode:            row.exam_mode as string | null,
    applicationMode:     row.application_mode as string | null,
    examFrequency:       row.exam_frequency as string | null,
    workflowStatus:      row.workflow_status as Entity['workflowStatus'],
    isFeatured:          row.is_featured as boolean,
    priority:            row.priority as number | null,
    featuredUntil:       row.featured_until as string | null,
    tags:                (row.tags as string[]) ?? [],
    searchKeywords:      (row.search_keywords as string[]) ?? [],
    scheduledPublishAt:  row.scheduled_publish_at as string | null,
    publishedAt:         row.published_at as string | null,
    publishedBy:         row.published_by as string | null,
    lang:                (row.lang as string) ?? 'en',
    metadata:            (row.metadata as Record<string, unknown>) ?? {},
    createdAt:           row.created_at as string,
    updatedAt:           row.updated_at as string,
    createdBy:           row.created_by as string | null,
    updatedBy:           row.updated_by as string | null,
    deletedAt:           row.deleted_at as string | null,
  }
}

function mapListRow(row: Record<string, unknown>): EntityListItem {
  return {
    id:              row.id as string,
    entityType:      (row.entity_type as string) ?? 'exam',
    slug:            row.slug as string,
    name:            row.name as string,
    shortName:       row.short_name as string | null,
    pillar:          row.pillar as string | null,
    workflowStatus:  row.workflow_status as EntityListItem['workflowStatus'],
    isFeatured:      row.is_featured as boolean,
    priority:        row.priority as number | null,
    updatedAt:       row.updated_at as string,
  }
}

// ── List (keyset pagination — no OFFSET) ─────────────────────────────────────

export async function listEntities(
  opts: EntityListOpts = {}
): Promise<{ data: EntityListItem[]; count: number }> {
  let q = db
    .from('entity')
    .select('id, entity_type, slug, name, short_name, pillar, workflow_status, is_featured, priority, updated_at', { count: 'exact' })
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (opts.pillar)          q = q.eq('pillar', opts.pillar)
  if (opts.workflowStatus)  q = q.eq('workflow_status', opts.workflowStatus)
  if (opts.entityType)      q = q.eq('entity_type', opts.entityType)
  if (opts.isFeatured !== undefined) q = q.eq('is_featured', opts.isFeatured)
  if (opts.categoryId)      q = q.eq('category_id', opts.categoryId)
  if (opts.search)          q = q.ilike('name', `%${opts.search}%`)
  if (opts.cursor)          q = q.lt('updated_at', opts.cursor)
  if (opts.limit)           q = q.limit(opts.limit)
  else                      q = q.limit(50)

  const { data, error, count } = await q
  if (error) throw error
  return { data: (data ?? []).map(mapListRow), count: count ?? 0 }
}

// ── Get by ID ─────────────────────────────────────────────────────────────────

export async function getEntityById(id: string): Promise<Entity | null> {
  const { data, error } = await db
    .from('entity')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error || data == null) return null
  return mapRow(data as Record<string, unknown>)
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createEntity(input: EntityCreateInput): Promise<Entity> {
  const slug = input.slug || generateSlug(input.name)
  const { data, error } = await db
    .from('entity')
    .insert({
      entity_type:      'exam',
      slug,
      name:             input.name,
      short_name:       input.shortName ?? null,
      conducting_body:  input.conductingBody,
      official_website: input.officialWebsite ?? null,
      category_id:      input.categoryId ?? null,
      pillar:           input.pillar ?? null,
      sub_type:         input.subType ?? null,
      exam_level:       input.examLevel ?? null,
      exam_mode:        input.examMode ?? null,
      application_mode: input.applicationMode ?? null,
      exam_frequency:   input.examFrequency ?? null,
      workflow_status:  input.workflowStatus ?? 'draft',
      is_featured:      input.isFeatured ?? false,
      priority:         input.priority ?? null,
      featured_until:   input.featuredUntil ?? null,
      tags:             input.tags ?? [],
      search_keywords:  input.searchKeywords ?? [],
      lang:             input.lang ?? 'en',
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateEntity(
  id: string,
  input: Partial<EntityCreateInput>
): Promise<Entity> {
  const updates: Record<string, unknown> = {}
  const fieldMap: Record<string, string> = {
    slug: 'slug', name: 'name', shortName: 'short_name',
    conductingBody: 'conducting_body', officialWebsite: 'official_website',
    categoryId: 'category_id', pillar: 'pillar', subType: 'sub_type',
    examLevel: 'exam_level', examMode: 'exam_mode',
    applicationMode: 'application_mode', examFrequency: 'exam_frequency',
    workflowStatus: 'workflow_status', isFeatured: 'is_featured',
    priority: 'priority', featuredUntil: 'featured_until',
    tags: 'tags', searchKeywords: 'search_keywords', lang: 'lang',
  }
  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as Record<string, unknown>)[key] !== undefined) {
      updates[col] = (input as Record<string, unknown>)[key]
    }
  }
  const { data, error } = await db
    .from('entity')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Soft delete ───────────────────────────────────────────────────────────────

export async function softDeleteEntity(id: string): Promise<void> {
  const { error } = await db
    .from('entity')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Slug availability check ───────────────────────────────────────────────────

export async function checkEntitySlug(
  slug: string,
  pillar: string | null,
  excludeId?: string
): Promise<boolean> {
  let q = db
    .from('entity')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
  if (pillar)    q = q.eq('pillar', pillar)
  if (excludeId) q = q.neq('id', excludeId)
  const { data } = await q
  return (data ?? []).length === 0
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchEntities(
  query: string,
  limit = 20
): Promise<EntityListItem[]> {
  const { data } = await db
    .from('entity')
    .select('id, entity_type, slug, name, short_name, pillar, workflow_status, is_featured, priority, updated_at')
    .is('deleted_at', null)
    .ilike('name', `%${query}%`)
    .limit(limit)
  return (data ?? []).map(mapListRow)
}

// ── Bulk operations ───────────────────────────────────────────────────────────

export async function bulkUpdateStatus(
  ids: string[],
  status: string
): Promise<void> {
  const { error } = await db
    .from('entity')
    .update({ workflow_status: status })
    .in('id', ids)
    .is('deleted_at', null)
  if (error) throw error
}

export async function bulkSetFeatured(
  ids: string[],
  isFeatured: boolean
): Promise<void> {
  const { error } = await db
    .from('entity')
    .update({ is_featured: isFeatured })
    .in('id', ids)
    .is('deleted_at', null)
  if (error) throw error
}

export async function bulkSoftDelete(ids: string[]): Promise<void> {
  const { error } = await db
    .from('entity')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

export async function bulkUpdateCategory(
  ids: string[],
  categoryId: string
): Promise<void> {
  const { error } = await db
    .from('entity')
    .update({ category_id: categoryId })
    .in('id', ids)
    .is('deleted_at', null)
  if (error) throw error
}

// ── Full hydration ─────────────────────────────────────────────────────────────

/**
 * Returns a fully-hydrated EntityFull by fetching all satellite tables in parallel.
 * This is the single source of truth for preview, publish, revision snapshots,
 * AI context, and frontend rendering.
 */
export async function getEntityFull(id: string): Promise<EntityFull | null> {
  const entity = await getEntityById(id)
  if (!entity) return null

  const [
    timelineEvents,
    modules,
    seo,
    eligibility,
    vacancies,
    fee,
    examPattern,
    selectionStages,
    syllabusSubjects,
    downloads,
    links,
  ] = await Promise.all([
    listTimeline(id),
    listModules(id),
    getSeo(id),
    getEligibility(id),
    listVacancies(id),
    getFee(id),
    listExamPattern(id),
    listSelectionStages(id),
    listSyllabus(id),
    listDownloads(id),
    listLinks(id),
  ])

  return {
    ...entity,
    overview: null,          // populated by overviewService when implemented
    timelineEvents,
    modules,
    seo,
    eligibility,
    vacancies,
    fee,
    examPattern,
    selectionStages,
    syllabusSubjects,
    downloads,
    links,
    media: EMPTY_MEDIA,      // populated by mediaService when implemented
    revisions: [],           // populated by revisionService on demand
    brokenLinkCount: 0,      // populated by broken-link-scan Edge Function
    completenessScore: 0,    // populated by completenessScore utility
  }
}
