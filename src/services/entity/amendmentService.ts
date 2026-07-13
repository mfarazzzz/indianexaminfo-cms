/**
 * amendmentService.ts — CRUD for entity_amendment (corrigendum records).
 * Amendments are public-facing: readers see "Updated On / What's Changed".
 */
import { db } from '@/lib/supabase/client'
import type { EntityAmendment, AmendmentInput } from '@/types/entity-amendment'

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): EntityAmendment {
  return {
    id:             row.id as string,
    entityId:       row.entity_id as string,
    title:          row.title as string,
    description:    row.description as string | null,
    changedFields:  (row.changed_fields as string[]) ?? [],
    changeSummary:  row.change_summary as string,
    effectiveDate:  row.effective_date as string,
    publishedDate:  row.published_date as string | null,
    workflowStatus: row.workflow_status as EntityAmendment['workflowStatus'],
    displayOrder:   row.display_order as number,
    createdAt:      row.created_at as string,
    createdBy:      row.created_by as string | null,
    updatedAt:      row.updated_at as string,
    updatedBy:      row.updated_by as string | null,
    deletedAt:      row.deleted_at as string | null,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listAmendments(entityId: string): Promise<EntityAmendment[]> {
  const { data, error } = await db
    .from('entity_amendment')
    .select('*')
    .eq('entity_id', entityId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function listPublishedAmendments(entityId: string): Promise<EntityAmendment[]> {
  const { data, error } = await db
    .from('entity_amendment')
    .select('*')
    .eq('entity_id', entityId)
    .eq('workflow_status', 'published')
    .is('deleted_at', null)
    .order('effective_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function createAmendment(
  input: AmendmentInput,
  userId?: string
): Promise<EntityAmendment> {
  if (!input.title?.trim())          throw new Error('Amendment title is required')
  if (!input.changeSummary?.trim())  throw new Error('Change summary is required')
  if (!input.effectiveDate)          throw new Error('Effective date is required')

  const { data, error } = await db
    .from('entity_amendment')
    .insert({
      entity_id:      input.entityId,
      title:          input.title.trim(),
      description:    null,
      changed_fields: input.changedFields ?? [],
      change_summary: input.changeSummary.trim(),
      effective_date: input.effectiveDate,
      workflow_status:'draft',
      display_order:  input.displayOrder ?? 0,
      created_by:     userId ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateAmendment(
  id: string,
  input: Partial<AmendmentInput>,
  userId?: string
): Promise<EntityAmendment> {
  const updates: Record<string, unknown> = { updated_by: userId ?? null }
  if (input.title          !== undefined) updates.title           = input.title
  if (input.description    !== undefined) updates.description     = input.description
  if (input.changedFields  !== undefined) updates.changed_fields  = input.changedFields
  if (input.changeSummary  !== undefined) updates.change_summary  = input.changeSummary
  if (input.effectiveDate  !== undefined) updates.effective_date  = input.effectiveDate
  if (input.displayOrder   !== undefined) updates.display_order   = input.displayOrder

  const { data, error } = await db
    .from('entity_amendment')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function publishAmendment(id: string): Promise<EntityAmendment> {
  const { data, error } = await db
    .from('entity_amendment')
    .update({
      workflow_status: 'published',
      published_date:  new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function reorderAmendments(
  entityId: string,
  orderedIds: string[]
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from('entity_amendment')
        .update({ display_order: index })
        .eq('id', id)
        .eq('entity_id', entityId)
    )
  )
}

export async function softDeleteAmendment(id: string): Promise<void> {
  const { error } = await db
    .from('entity_amendment')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
