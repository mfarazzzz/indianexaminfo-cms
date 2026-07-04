import { db } from '@/lib/supabase/client'
import type { EntityLink } from '@/types/entity'
import type { LinkInput } from '@/lib/validation/entitySchemas'

function mapRow(r: Record<string, unknown>): EntityLink {
  return {
    id: r.id as string, entityId: r.entity_id as string,
    label: r.label as string, url: r.url as string,
    icon: r.icon as string | null,
    buttonStyle: (r.button_style as string) ?? 'primary',
    status: (r.status as EntityLink['status']) ?? 'active',
    displayOrder: (r.display_order as number) ?? 0,
    createdAt: r.created_at as string,
    deletedAt: r.deleted_at as string | null,
  }
}

export async function listLinks(entityId: string): Promise<EntityLink[]> {
  const { data, error } = await db.from('entity_link').select('*')
    .eq('entity_id', entityId).is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function createLink(entityId: string, input: LinkInput): Promise<EntityLink> {
  const { data, error } = await db.from('entity_link').insert({
    entity_id: entityId, label: input.label, url: input.url,
    icon: input.icon ?? null, button_style: input.buttonStyle ?? 'primary',
    status: input.status ?? 'active', display_order: input.displayOrder ?? 0,
  }).select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateLink(id: string, input: Partial<LinkInput>): Promise<EntityLink> {
  const updates: Record<string, unknown> = {}
  const m: Record<string, string> = {
    label: 'label', url: 'url', icon: 'icon',
    buttonStyle: 'button_style', status: 'status', displayOrder: 'display_order',
  }
  for (const [k, col] of Object.entries(m))
    if ((input as Record<string, unknown>)[k] !== undefined)
      updates[col] = (input as Record<string, unknown>)[k]
  const { data, error } = await db.from('entity_link').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function softDeleteLink(id: string): Promise<void> {
  const { error } = await db.from('entity_link').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function reorderLinks(entityId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) =>
    db.from('entity_link').update({ display_order: i }).eq('id', id).eq('entity_id', entityId)))
}
