/**
 * reusableComponentService.ts — CRUD for reusable_component (Shared Content Library).
 * REQ-028: Reusable blocks embedded via reference, not copy.
 * No React imports.
 */
import { db } from '@/lib/supabase/client'

export interface ReusableComponent {
  id: string
  name: string
  description: string | null
  blockType: string
  content: Record<string, unknown>
  tags: string[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  usageCount?: number
}

export interface ComponentInput {
  name: string
  description?: string
  blockType: string
  content: Record<string, unknown>
  tags?: string[]
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): ReusableComponent {
  return {
    id:          r.id as string,
    name:        r.name as string,
    description: r.description as string | null,
    blockType:   r.block_type as string,
    content:     (r.content as Record<string, unknown>) ?? {},
    tags:        (r.tags as string[]) ?? [],
    createdBy:   r.created_by as string | null,
    createdAt:   r.created_at as string,
    updatedAt:   r.updated_at as string,
    deletedAt:   r.deleted_at as string | null,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listComponents(query?: string): Promise<ReusableComponent[]> {
  let q = db
    .from('reusable_component')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (query && query.trim()) {
    q = q.ilike('name', `%${query.trim()}%`)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function getComponentById(id: string): Promise<ReusableComponent | null> {
  const { data, error } = await db
    .from('reusable_component')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function createComponent(
  input: ComponentInput,
  userId?: string
): Promise<ReusableComponent> {
  const { data, error } = await db
    .from('reusable_component')
    .insert({
      name:        input.name,
      description: input.description ?? null,
      block_type:  input.blockType,
      content:     input.content,
      tags:        input.tags ?? [],
      created_by:  userId ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateComponent(
  id: string,
  input: Partial<ComponentInput>
): Promise<ReusableComponent> {
  const updates: Record<string, unknown> = {}
  if (input.name        !== undefined) updates.name        = input.name
  if (input.description !== undefined) updates.description = input.description
  if (input.blockType   !== undefined) updates.block_type  = input.blockType
  if (input.content     !== undefined) updates.content     = input.content
  if (input.tags        !== undefined) updates.tags        = input.tags

  const { data, error } = await db
    .from('reusable_component')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

/**
 * Soft-deletes a component. Blocked if active references exist (REQ-028.6).
 */
export async function deleteComponent(id: string): Promise<void> {
  const count = await getUsageCount(id)
  if (count > 0) {
    throw new Error(
      `This block is used in ${count} module${count > 1 ? 's' : ''}. Remove from those modules before deleting.`
    )
  }

  const { error } = await db
    .from('reusable_component')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/**
 * Returns how many module_blocks reference this component (REQ-028.5).
 */
export async function getUsageCount(id: string): Promise<number> {
  const { count, error } = await db
    .from('module_block_component_ref')
    .select('module_block_id', { count: 'exact', head: true })
    .eq('reusable_component_id', id)
  if (error) throw error
  return count ?? 0
}

/**
 * Creates a reference from a module block to a shared component (REQ-028.3).
 */
export async function insertComponentRef(
  moduleBlockId: string,
  componentId: string
): Promise<void> {
  const { error } = await db
    .from('module_block_component_ref')
    .insert({
      module_block_id:       moduleBlockId,
      reusable_component_id: componentId,
    })
  if (error) throw error
}

/**
 * Removes a reference from a module block to a shared component.
 */
export async function removeComponentRef(
  moduleBlockId: string,
  componentId: string
): Promise<void> {
  const { error } = await db
    .from('module_block_component_ref')
    .delete()
    .eq('module_block_id', moduleBlockId)
    .eq('reusable_component_id', componentId)
  if (error) throw error
}
