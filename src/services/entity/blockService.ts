/**
 * blockService.ts — CRUD for entity_module_block table.
 * No React imports. Business logic only.
 */
import { db } from '@/lib/supabase/client'
import type { ModuleBlock } from '@/types/entity'

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): ModuleBlock {
  return {
    id:           r.id as string,
    moduleId:     r.module_id as string,
    blockType:    r.block_type as string,
    displayOrder: (r.display_order as number) ?? 0,
    content:      (r.content as ModuleBlock['content']) ?? {},
    isVisible:    (r.is_visible as boolean) ?? true,
    createdAt:    r.created_at as string,
    updatedAt:    r.updated_at as string,
    deletedAt:    r.deleted_at as string | null,
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listBlocks(moduleId: string): Promise<ModuleBlock[]> {
  const { data, error } = await db
    .from('entity_module_block')
    .select('*')
    .eq('module_id', moduleId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createBlock(
  moduleId: string,
  blockType: string,
  content: Record<string, unknown>,
  displayOrder?: number
): Promise<ModuleBlock> {
  const { data, error } = await db
    .from('entity_module_block')
    .insert({
      module_id:     moduleId,
      block_type:    blockType,
      content,
      display_order: displayOrder ?? 0,
      is_visible:    true,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Update content ────────────────────────────────────────────────────────────

export async function updateBlock(
  id: string,
  content: Record<string, unknown>
): Promise<ModuleBlock> {
  const { data, error } = await db
    .from('entity_module_block')
    .update({ content })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Update visibility (returns full row) ──────────────────────────────────────

export async function updateBlockVisibility(
  id: string,
  isVisible: boolean
): Promise<ModuleBlock> {
  const { data, error } = await db
    .from('entity_module_block')
    .update({ is_visible: isVisible })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Soft delete ───────────────────────────────────────────────────────────────

export async function softDeleteBlock(id: string): Promise<void> {
  const { error } = await db
    .from('entity_module_block')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Reorder ───────────────────────────────────────────────────────────────────

export async function reorderBlocks(
  moduleId: string,
  orderedIds: string[]
): Promise<void> {
  // TODO: replace with batch RPC for scale (see ARCHITECTURE.md §6.5)
  await Promise.all(
    orderedIds.map((id, idx) =>
      db
        .from('entity_module_block')
        .update({ display_order: idx })
        .eq('id', id)
        .eq('module_id', moduleId)
    )
  )
}

// ── Duplicate ─────────────────────────────────────────────────────────────────

export async function duplicateBlock(id: string): Promise<ModuleBlock> {
  // Fetch source block
  const { data: src, error: srcErr } = await db
    .from('entity_module_block')
    .select('*')
    .eq('id', id)
    .single()
  if (srcErr || src == null) throw srcErr ?? new Error('Block not found')

  const source = mapRow(src as Record<string, unknown>)

  // Get current max display_order for this module
  const { data: maxData } = await db
    .from('entity_module_block')
    .select('display_order')
    .eq('module_id', source.moduleId)
    .is('deleted_at', null)
    .order('display_order', { ascending: false })
    .limit(1)

  const maxOrder = (maxData as Array<{ display_order: number }> | null)?.[0]?.display_order ?? -1

  const { data, error } = await db
    .from('entity_module_block')
    .insert({
      module_id:     source.moduleId,
      block_type:    source.blockType,
      content:       source.content,
      display_order: maxOrder + 1,
      is_visible:    true,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}
