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
    officialWebsite:     row.official_website as string | null,
    // M3.8 taxonomy FK columns
    conductingBodyId:    row.conducting_body_id as string | null,
    categoryId:          row.category_id as string | null,
    departmentId:        row.department_id as string | null,
    examLevelId:         row.exam_level_id as string | null,
    examModeId:          row.exam_mode_id as string | null,
    applicationModeId:   row.application_mode_id as string | null,
    pillar:              row.pillar as string | null,
    contentTypeId:       row.content_type_id as string | null,
    templateVersionId:   row.template_version_id as string | null,
    // templateSnapshot is populated by getEntityById after a join with entity_snapshot.
    // The entity row itself has no template_snapshot column (moved to entity_snapshot in M1).
    templateSnapshot:    {} as import('@/types/lifecycle-template').TemplateConfiguration,
    subType:             row.sub_type as string | null,
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
    lastVerifiedAt:      row.last_verified_at as string | null,
    lastVerifiedBy:      row.last_verified_by as string | null,
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

// ── Get by ID (with snapshot join) ───────────────────────────────────────────

export async function getEntityById(id: string): Promise<Entity | null> {
  // Fetch entity and its snapshot in parallel.
  // template_snapshot does NOT exist on the entity row — it lives in entity_snapshot
  // (moved in M1 migration 005 for performance). We join it here so that
  // EntityEditorShell.templateSnapshot.moduleVisibility is always populated.
  const [entityResult, snapshotResult] = await Promise.all([
    db.from('entity').select('*').eq('id', id).is('deleted_at', null).single(),
    db.from('entity_snapshot').select('snapshot').eq('entity_id', id).single(),
  ])

  if (entityResult.error || entityResult.data == null) return null

  const entity = mapRow(entityResult.data as Record<string, unknown>)

  // Overlay the snapshot — this is what EntityEditorShell uses for tab visibility
  if (snapshotResult.data) {
    entity.templateSnapshot = snapshotResult.data.snapshot as import('@/types/lifecycle-template').TemplateConfiguration
  }

  return entity
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createEntity(input: EntityCreateInput): Promise<Entity> {
  const slug = input.slug || generateSlug(input.name)

  // Validate slug availability before insert
  const available = await checkEntitySlug(slug, input.pillar ?? null)
  if (!available) {
    // Auto-append year as per REQ-008.8
    const year = new Date().getFullYear()
    const yearSlug = `${slug}-${year}`
    const yearAvailable = await checkEntitySlug(yearSlug, input.pillar ?? null)
    if (!yearAvailable) {
      throw new Error(`URL path '${slug}' is already in use. Please choose a different name.`)
    }
  }

  const finalSlug = available ? slug : `${slug}-${new Date().getFullYear()}`

  const { data, error } = await db
    .from('entity')
    .insert({
      entity_type:         'exam',
      slug:                finalSlug,
      name:                input.name,
      short_name:          input.shortName ?? null,
      conducting_body_id:  input.conductingBodyId ?? null,
      official_website:    input.officialWebsite ?? null,
      category_id:         input.categoryId ?? null,
      pillar:              input.pillar ?? null,
      content_type_id:     input.contentTypeId ?? null,
      template_version_id: input.templateVersionId,
      workflow_status:     input.workflowStatus ?? 'draft',
      is_featured:         input.isFeatured ?? false,
      priority:            input.priority ?? null,
      featured_until:      input.featuredUntil ?? null,
      tags:                input.tags ?? [],
      search_keywords:     input.searchKeywords ?? [],
      lang:                input.lang ?? 'en',
      metadata:            input.metadata ?? {},
    })
    .select('*')
    .single()
  if (error) throw error

  const entity = mapRow(data as Record<string, unknown>)

  // Write immutable snapshot to entity_snapshot table (ADR-005, REQ-041.4)
  const { createSnapshot } = await import('../template/snapshotService')
  await createSnapshot(entity.id, input.templateVersionId!)

  // Seed skeleton SEO row so getEntityFull never returns null seo
  await db.from('entity_seo').insert({
    entity_id: entity.id,
  }).throwOnError()

  // Note: entity_slug_history is NOT written on creation — only on slug changes.
  // Writing old_slug === new_slug at creation time corrupts resolveSlug() for
  // soft-deleted entities (DB-005 fix).

  return entity
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateEntity(
  id: string,
  input: Partial<EntityCreateInput>,
  userId?: string
): Promise<Entity> {
  // Fetch current slug before updating (for slug history)
  const current = await getEntityById(id)

  const updates: Record<string, unknown> = {}

  // fieldMap: EntityCreateInput key → entity table column name.
  // Only columns that actually exist on the entity table are listed here.
  // Legacy columns (conducting_body, exam_level, exam_mode, etc.) were removed
  // in M1 migration 006 — they must NOT appear here.
  const fieldMap: Record<string, string> = {
    slug:              'slug',
    name:              'name',
    shortName:         'short_name',
    conductingBodyId:  'conducting_body_id',   // UUID FK — was missing (VERIFIED-001)
    officialWebsite:   'official_website',
    categoryId:        'category_id',
    pillar:            'pillar',
    contentTypeId:     'content_type_id',
    workflowStatus:    'workflow_status',
    isFeatured:        'is_featured',
    priority:          'priority',
    featuredUntil:     'featured_until',
    tags:              'tags',
    searchKeywords:    'search_keywords',
    lang:              'lang',
    metadata:          'metadata',             // was missing (VERIFIED-001)
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((input as Record<string, unknown>)[key] !== undefined) {
      updates[col] = (input as Record<string, unknown>)[key]
    }
  }

  // Always update updated_at explicitly as a pre-trigger safety net.
  // The DB trigger (migration 009) handles this too, but explicit is safer
  // during the window between code deploy and migration apply.
  updates.updated_at = new Date().toISOString()
  if (userId) updates.updated_by = userId

  const { data, error } = await db
    .from('entity')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()
  if (error) throw error
  const updated = mapRow(data as Record<string, unknown>)

  // Record slug change if slug was updated
  if (current && input.slug && input.slug !== current.slug && current.pillar) {
    try {
      const { recordSlugChange } = await import('./slugHistoryService')
      await recordSlugChange(id, current.slug, input.slug, current.pillar, userId)
    } catch {
      // Non-fatal: slug history failure should not block the save
    }
  }

  return updated
}

// ── Workflow transition ───────────────────────────────────────────────────────

export async function transitionWorkflow(
  id: string,
  targetStatus: import('@/types/entity').WorkflowStatus,
  userId: string
): Promise<Entity> {
  const { WORKFLOW_TRANSITIONS } = await import('@/types/entity')
  const entity = await getEntityById(id)
  if (!entity) throw new Error(`Entity ${id} not found`)

  const allowed = WORKFLOW_TRANSITIONS[entity.workflowStatus]
  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `Cannot transition from '${entity.workflowStatus}' to '${targetStatus}'.` +
      ` Allowed: ${allowed.join(', ') || 'none'}`
    )
  }

  // Publishing gate: require SEO completeness
  if (targetStatus === 'published') {
    const { getPublishReadiness } = await import('./healthService')
    const issues = await getPublishReadiness(id)
    if (issues.length > 0) {
      throw new Error(`Cannot publish: ${issues.join('; ')}`)
    }
  }

  const { data, error } = await db
    .from('entity')
    .update({ workflow_status: targetStatus })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error

  // Create revision snapshot on publish (REQ-016.7)
  if (targetStatus === 'published') {
    const { getEntityFull } = await import('./entityService')
    const { createRevision } = await import('./revisionService')
    const full = await getEntityFull(id)
    if (full) {
      await createRevision(id, full as unknown as Record<string, unknown>, 'Published', userId)
    }
  }

  // Record workflow event
  await db.from('entity_event_log').insert({
    entity_id:  id,
    event_type: `workflow.${targetStatus}`,
    actor_id:   userId,
    payload:    { from: entity.workflowStatus, to: targetStatus },
  })

  return mapRow(data as Record<string, unknown>)
}

// ── Verify content ────────────────────────────────────────────────────────────

export async function verifyEntity(
  id: string,
  userId: string,
  source?: string,
  notes?: string
): Promise<Entity> {
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('entity')
    .update({ last_verified_at: now, last_verified_by: userId })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error

  // Audit log
  await db.from('entity_activity_log').insert({
    entity_id:   id,
    actor_id:    userId,
    action:      'verification',
    target_type: 'entity',
    target_id:   id,
    changes:     { verified_at: now, source: source ?? null, notes: notes ?? null },
  })

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
 * Snapshot loaded from entity_snapshot table (separate from entity row — REQ-041.4).
 */
export async function getEntityFull(id: string): Promise<EntityFull | null> {
  const entity = await getEntityById(id)
  if (!entity) return null

  const [
    snapshotData,
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
    import('../template/snapshotService').then(m => m.getSnapshot(id)),
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

  // Merge snapshot into entity (entity.templateSnapshot kept for type compat)
  const entityWithSnapshot = {
    ...entity,
    templateSnapshot: snapshotData ?? ({} as import('@/types/lifecycle-template').TemplateConfiguration),
  }

  return {
    ...entityWithSnapshot,
    overview: null,
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
    media: EMPTY_MEDIA,
    revisions: [],
    brokenLinkCount: 0,
    completenessScore: 0,
  }
}
