import { db } from '@/lib/supabase/client'
import type { EntitySelectionStage } from '@/types/entity'
import type { SelectionStageInput } from '@/lib/validation/entitySchemas'

function mapRow(r: Record<string, unknown>): EntitySelectionStage {
  return {
    id: r.id as string,
    entityId: r.entity_id as string,
    stageName: r.stage_name as string,
    description: r.description as string | null,
    marks: r.marks as number | null,
    weightagePercent: r.weightage_percent as number | null,
    isQualifying: (r.is_qualifying as boolean) ?? false,
    notes: r.notes as string | null,
    displayOrder: (r.display_order as number) ?? 0,
    deletedAt: r.deleted_at as string | null,
  }
}

export async function listSelectionStages(
  entityId: string
): Promise<EntitySelectionStage[]> {
  const { data, error } = await db
    .from('entity_selection_stage')
    .select('*')
    .eq('entity_id', entityId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function createSelectionStage(
  entityId: string,
  input: SelectionStageInput
): Promise<EntitySelectionStage> {
  const { data, error } = await db
    .from('entity_selection_stage')
    .insert({
      entity_id: entityId,
      stage_name: input.stageName,
      description: input.description ?? null,
      marks: input.marks ?? null,
      weightage_percent: input.weightagePercent ?? null,
      is_qualifying: input.isQualifying ?? false,
      notes: input.notes ?? null,
      display_order: input.displayOrder ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateSelectionStage(
  id: string,
  input: Partial<SelectionStageInput>
): Promise<void> {
  const updates: Record<string, unknown> = {}
  const fieldMap: Record<string, string> = {
    stageName: 'stage_name',
    description: 'description',
    marks: 'marks',
    weightagePercent: 'weightage_percent',
    isQualifying: 'is_qualifying',
    notes: 'notes',
    displayOrder: 'display_order',
  }
  for (const [k, col] of Object.entries(fieldMap)) {
    if ((input as Record<string, unknown>)[k] !== undefined)
      updates[col] = (input as Record<string, unknown>)[k]
  }
  const { error } = await db
    .from('entity_selection_stage')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function softDeleteSelectionStage(id: string): Promise<void> {
  const { error } = await db
    .from('entity_selection_stage')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function reorderSelectionStages(
  entityId: string,
  orderedIds: string[]
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .from('entity_selection_stage')
        .update({ display_order: i })
        .eq('id', id)
        .eq('entity_id', entityId)
    )
  )
}
