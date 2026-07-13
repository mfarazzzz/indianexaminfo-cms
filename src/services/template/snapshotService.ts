/**
 * snapshotService.ts — Template snapshot management.
 * A snapshot is a frozen copy of the template version's configuration stored
 * on the entity at creation time. IMMUTABLE after creation (ADR-005).
 *
 * Only createSnapshot() is provided — there is NO upgradeSnapshot().
 */
import { db } from '@/lib/supabase/client'
import type { TemplateConfiguration } from '@/types/lifecycle-template'

/**
 * Copies the template version's configuration into entity.template_snapshot.
 * Must be called inside the createEntity() transaction.
 */
export async function createSnapshot(
  entityId: string,
  versionId: string
): Promise<void> {
  // Fetch the version configuration
  const { data: version, error: fetchError } = await db
    .from('lifecycle_template_version')
    .select('configuration')
    .eq('id', versionId)
    .single()

  if (fetchError || !version) {
    throw new Error(`Template version ${versionId} not found`)
  }

  // Write the snapshot to the entity
  const { error: updateError } = await db
    .from('entity')
    .update({ template_snapshot: version.configuration })
    .eq('id', entityId)

  if (updateError) throw updateError
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
    id: data.id as string,
    configuration: data.configuration as TemplateConfiguration,
  }
}
