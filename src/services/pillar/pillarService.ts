/**
 * pillarService.ts — CRUD for the `pillar` structural taxonomy table.
 * Pillars are database-driven (not hardcoded). Adding a pillar = 1 DB row, 0 code changes.
 */
import { db } from '@/lib/supabase/client'
import type { Pillar, PillarInput } from '@/types/pillar'

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Pillar {
  return {
    id:           row.id as string,
    slug:         row.slug as string,
    label:        row.label as string,
    description:  row.description as string | null,
    icon:         row.icon as string | null,
    displayOrder: row.display_order as number,
    isActive:     row.is_active as boolean,
    createdAt:    row.created_at as string,
    updatedAt:    row.updated_at as string,
    deletedAt:    row.deleted_at as string | null,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listPillars(includeInactive = false): Promise<Pillar[]> {
  let q = db
    .from('pillar')
    .select('*')
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  if (!includeInactive) q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function getPillarBySlug(slug: string): Promise<Pillar | null> {
  const { data, error } = await db
    .from('pillar')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function createPillar(input: PillarInput): Promise<Pillar> {
  const { data, error } = await db
    .from('pillar')
    .insert({
      slug:          input.slug,
      label:         input.label,
      description:   input.description ?? null,
      icon:          input.icon ?? null,
      display_order: input.displayOrder ?? 0,
      is_active:     input.isActive ?? true,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updatePillar(id: string, input: Partial<PillarInput>): Promise<Pillar> {
  const updates: Record<string, unknown> = {}
  if (input.slug          !== undefined) updates.slug          = input.slug
  if (input.label         !== undefined) updates.label         = input.label
  if (input.description   !== undefined) updates.description   = input.description
  if (input.icon          !== undefined) updates.icon          = input.icon
  if (input.displayOrder  !== undefined) updates.display_order = input.displayOrder
  if (input.isActive      !== undefined) updates.is_active     = input.isActive

  const { data, error } = await db
    .from('pillar')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function softDeletePillar(id: string): Promise<void> {
  const { error } = await db
    .from('pillar')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
