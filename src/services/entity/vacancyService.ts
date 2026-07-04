import { db } from '@/lib/supabase/client'
import type { EntityVacancy } from '@/types/entity'
import type { VacancyRowInput } from '@/lib/validation/entitySchemas'

function mapRow(r: Record<string, unknown>): EntityVacancy {
  return {
    id: r.id as string,
    entityId: r.entity_id as string,
    category: r.category as string,
    label: r.label as string,
    value: r.value as number,
    notes: r.notes as string | null,
    displayOrder: (r.display_order as number) ?? 0,
    deletedAt: r.deleted_at as string | null,
  }
}

export async function listVacancies(entityId: string): Promise<EntityVacancy[]> {
  const { data, error } = await db
    .from('entity_vacancy')
    .select('*')
    .eq('entity_id', entityId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

/**
 * Replace all vacancy rows for an entity atomically:
 * soft-deletes existing rows, then inserts the new set.
 */
export async function upsertVacancyRows(
  entityId: string,
  rows: VacancyRowInput[]
): Promise<void> {
  await db
    .from('entity_vacancy')
    .update({ deleted_at: new Date().toISOString() })
    .eq('entity_id', entityId)
    .is('deleted_at', null)

  if (rows.length === 0) return

  const { error } = await db.from('entity_vacancy').insert(
    rows.map((r, i) => ({
      entity_id: entityId,
      category: r.category,
      label: r.label,
      value: r.value,
      notes: r.notes ?? null,
      display_order: r.displayOrder ?? i,
    }))
  )
  if (error) throw error
}
