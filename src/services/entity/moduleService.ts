import { db } from '@/lib/supabase/client'
import type { EntityModule } from '@/types/entity'
import type { ModuleCreateInput } from '@/lib/validation/entitySchemas'

function mapRow(r: Record<string, unknown>): EntityModule {
  return {
    id: r.id as string, entityId: r.entity_id as string,
    moduleType: r.module_type as string,
    subTitle: r.sub_title as string | null,
    displayOrder: (r.display_order as number) ?? 0,
    workflowStatus: r.workflow_status as EntityModule['workflowStatus'],
    isFeatured: (r.is_featured as boolean) ?? false,
    tags: (r.tags as string[]) ?? [],
    scheduledPublishAt: r.scheduled_publish_at as string | null,
    publishedAt: r.published_at as string | null,
    publishedBy: r.published_by as string | null,
    seoOverrideTitle: r.seo_override_title as string | null,
    seoOverrideDesc: r.seo_override_desc as string | null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    createdBy: r.created_by as string | null,
    updatedBy: r.updated_by as string | null,
    deletedAt: r.deleted_at as string | null,
  }
}

export async function listModules(entityId: string): Promise<EntityModule[]> {
  const { data, error } = await db
    .from('entity_module').select('*')
    .eq('entity_id', entityId).is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function getModuleById(id: string): Promise<EntityModule | null> {
  const { data, error } = await db
    .from('entity_module').select('*').eq('id', id).is('deleted_at', null).single()
  if (error || data == null) return null
  return mapRow(data as Record<string, unknown>)
}

export async function createModule(
  entityId: string, input: ModuleCreateInput
): Promise<EntityModule> {
  // Check if sub_title is required (second module of same type)
  const { data: existing } = await db
    .from('entity_module').select('id')
    .eq('entity_id', entityId).eq('module_type', input.moduleType)
    .is('deleted_at', null).limit(1)
  if ((existing ?? []).length > 0 && (!input.subTitle || input.subTitle.trim() === '')) {
    throw new Error(
      `A sub-title is required to distinguish this module from existing modules of the same type.`
    )
  }
  const { data, error } = await db
    .from('entity_module')
    .insert({
      entity_id: entityId, module_type: input.moduleType,
      sub_title: input.subTitle ?? null,
      display_order: input.displayOrder ?? 0,
      workflow_status: input.workflowStatus ?? 'draft',
      is_featured: input.isFeatured ?? false,
      tags: input.tags ?? [],
      scheduled_publish_at: input.scheduledPublishAt ?? null,
      seo_override_title: input.seoOverrideTitle ?? null,
      seo_override_desc: input.seoOverrideDesc ?? null,
    })
    .select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateModule(
  id: string, input: Partial<ModuleCreateInput>
): Promise<EntityModule> {
  const updates: Record<string, unknown> = {}
  const map: Record<string, string> = {
    moduleType: 'module_type', subTitle: 'sub_title',
    displayOrder: 'display_order', workflowStatus: 'workflow_status',
    isFeatured: 'is_featured', tags: 'tags',
    scheduledPublishAt: 'scheduled_publish_at',
    seoOverrideTitle: 'seo_override_title', seoOverrideDesc: 'seo_override_desc',
  }
  for (const [k, col] of Object.entries(map)) {
    if ((input as Record<string, unknown>)[k] !== undefined)
      updates[col] = (input as Record<string, unknown>)[k]
  }
  const { data, error } = await db
    .from('entity_module').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function publishModule(id: string, userId: string): Promise<EntityModule> {
  const { data, error } = await db
    .from('entity_module')
    .update({ workflow_status: 'published', published_at: new Date().toISOString(), published_by: userId })
    .eq('id', id).select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function softDeleteModule(id: string): Promise<void> {
  const { error } = await db
    .from('entity_module')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function reorderModules(
  entityId: string, orderedIds: string[]
): Promise<void> {
  // TODO: replace with batch RPC for scale (see ARCHITECTURE.md §6.5)
  await Promise.all(
    orderedIds.map((id, idx) =>
      db.from('entity_module').update({ display_order: idx })
        .eq('id', id).eq('entity_id', entityId)
    )
  )
}

export async function duplicateModule(id: string): Promise<EntityModule> {
  // Fetch source module
  const source = await getModuleById(id)
  if (!source) throw new Error('Module not found')

  // Count non-deleted modules for this entity to determine display_order
  const { count } = await db
    .from('entity_module')
    .select('id', { count: 'exact', head: true })
    .eq('entity_id', source.entityId)
    .is('deleted_at', null)

  const { data, error } = await db
    .from('entity_module')
    .insert({
      entity_id:           source.entityId,
      module_type:         source.moduleType,
      sub_title:           source.subTitle ?? null,
      display_order:       count ?? 0,
      workflow_status:     'draft',
      is_featured:         source.isFeatured,
      tags:                source.tags,
      scheduled_publish_at: null,
      published_at:        null,
      published_by:        null,
      seo_override_title:  source.seoOverrideTitle ?? null,
      seo_override_desc:   source.seoOverrideDesc ?? null,
      metadata:            source.metadata ?? {},
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}
