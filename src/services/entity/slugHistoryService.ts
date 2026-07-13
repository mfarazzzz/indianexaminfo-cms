/**
 * slugHistoryService.ts — Append-only slug redirect chain.
 * Every slug change creates a redirect entry.
 * resolveSlug() follows the chain up to MAX_HOPS.
 * Rows are NEVER deleted (append-only governance policy).
 */
import { db } from '@/lib/supabase/client'
import type { EntitySlugHistory, SlugResolution } from '@/types/entity-slug-history'

const MAX_HOPS = 10

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): EntitySlugHistory {
  return {
    id:           row.id as string,
    entityId:     row.entity_id as string,
    oldSlug:      row.old_slug as string,
    newSlug:      row.new_slug as string,
    pillarSlug:   row.pillar_slug as string,
    redirectType: row.redirect_type as '301' | '302',
    createdAt:    row.created_at as string,
    createdBy:    row.created_by as string | null,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Records a slug change. Called inside entityService.updateEntity() when slug changes.
 * Append-only — never update or delete these rows.
 */
export async function recordSlugChange(
  entityId: string,
  oldSlug: string,
  newSlug: string,
  pillarSlug: string,
  userId?: string
): Promise<void> {
  const { error } = await db
    .from('entity_slug_history')
    .insert({
      entity_id:    entityId,
      old_slug:     oldSlug,
      new_slug:     newSlug,
      pillar_slug:  pillarSlug,
      redirect_type:'301',
      created_by:   userId ?? null,
    })
  if (error) throw error
}

/**
 * Resolves a slug to an entity, following up to MAX_HOPS redirects.
 * (a) Checks if slug is a live entity slug.
 * (b) If not, walks entity_slug_history for a redirect chain.
 */
export async function resolveSlug(
  slug: string,
  pillarSlug: string
): Promise<SlugResolution> {
  let currentSlug = slug
  let hops = 0

  while (hops < MAX_HOPS) {
    // Check if currentSlug is a live entity
    const { data: liveEntity } = await db
      .from('entity')
      .select('id')
      .eq('slug', currentSlug)
      .eq('pillar', pillarSlug)
      .is('deleted_at', null)
      .limit(1)
      .single()

    if (liveEntity) {
      return { resolved: true, entityId: liveEntity.id as string, hops }
    }

    // Check slug history for a redirect
    const { data: redirect } = await db
      .from('entity_slug_history')
      .select('new_slug, redirect_type')
      .eq('old_slug', currentSlug)
      .eq('pillar_slug', pillarSlug)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!redirect) {
      return { resolved: false, reason: 'no_redirect_found', hops }
    }

    currentSlug = redirect.new_slug as string
    hops++
  }

  return { resolved: false, reason: 'max_hops_exceeded', hops }
}

/**
 * Lists all slug history entries for an entity, newest first.
 */
export async function listSlugHistory(entityId: string): Promise<EntitySlugHistory[]> {
  const { data, error } = await db
    .from('entity_slug_history')
    .select('*')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}
