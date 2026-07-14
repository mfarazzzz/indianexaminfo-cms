/**
 * snapshotService.ts — Template snapshot management (ADR-005).
 * Snapshot stored in entity_snapshot table (separate from entity — REQ-041.4).
 * IMMUTABLE after creation. Only createSnapshot() is provided — no upgradeSnapshot().
 */
import { db } from '@/lib/supabase/client'
import type { TemplateConfiguration } from '@/types/lifecycle-template'

/**
 * Copies the template version's configuration into entity_snapshot.
 * Called inside createEntity() immediately after the entity INSERT.
 * REQ-002.6, REQ-041.4
 */
export async function createSnapshot(
  entityId: string,
  versionId: string
): Promise<void> {
  const { data: version, error: fetchError } = await db
    .from('lifecycle_template_version')
    .select('configuration')
    .eq('id', versionId)
    .single()

  if (fetchError || !version) {
    throw new Error(`Template version ${versionId} not found`)
  }

  const { error: insertError } = await db
    .from('entity_snapshot')
    .insert({
      entity_id: entityId,
      snapshot:  version.configuration,
    })

  if (insertError) throw insertError
}

/**
 * Reads the snapshot for an entity.
 * Returns null if no snapshot exists (e.g. legacy entities).
 */
export async function getSnapshot(entityId: string): Promise<TemplateConfiguration | null> {
  const { data, error } = await db
    .from('entity_snapshot')
    .select('snapshot')
    .eq('entity_id', entityId)
    .single()

  if (error || !data) return null
  return data.snapshot as TemplateConfiguration
}

/**
 * Returns the active version for a given template.
 * Used by createEntity() to resolve the correct version at creation time.
 */
export async function getActiveVersion(templateId: string): Promise<{
  id: string
  configuration: TemplateConfiguration
} | null> {
  const { data, error } = await db
    .from('lifecycle_template_version')
    .select('id, configuration')
    .eq('template_id', templateId)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return {
    id:            data.id as string,
    configuration: data.configuration as TemplateConfiguration,
  }
}
