import { db } from '@/lib/supabase/client'
import type { EntityRevision, RevisionSummary } from '@/types/entity'

export async function listRevisions(entityId: string): Promise<RevisionSummary[]> {
  const { data, error } = await db
    .from('entity_revision').select('id, version_number, comment, created_by, created_at')
    .eq('entity_id', entityId).order('version_number', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, versionNumber: r.version_number as number,
    comment: r.comment as string | null, createdBy: r.created_by as string | null,
    createdAt: r.created_at as string,
  }))
}

export async function getRevisionSnapshot(revisionId: string): Promise<EntityRevision | null> {
  const { data, error } = await db.from('entity_revision').select('*').eq('id', revisionId).single()
  if (error) return null
  const r = data as Record<string, unknown>
  return {
    id: r.id as string, entityId: r.entity_id as string,
    versionNumber: r.version_number as number,
    snapshot: r.snapshot as EntityRevision['snapshot'],
    comment: r.comment as string | null, createdBy: r.created_by as string | null,
    createdAt: r.created_at as string,
  }
}

export async function createRevision(
  entityId: string,
  snapshot: Record<string, unknown>,
  comment?: string,
  createdBy?: string
): Promise<RevisionSummary> {
  // Get next version number
  const { data: latest } = await db.from('entity_revision')
    .select('version_number').eq('entity_id', entityId)
    .order('version_number', { ascending: false }).limit(1).maybeSingle()
  const nextVersion = ((latest as Record<string, unknown> | null)?.version_number as number ?? 0) + 1

  const { data, error } = await db.from('entity_revision').insert({
    entity_id: entityId, version_number: nextVersion,
    snapshot, comment: comment ?? null, created_by: createdBy ?? null,
  }).select('id, version_number, comment, created_by, created_at').single()
  if (error) throw error
  const r = data as Record<string, unknown>
  return {
    id: r.id as string, versionNumber: r.version_number as number,
    comment: r.comment as string | null, createdBy: r.created_by as string | null,
    createdAt: r.created_at as string,
  }
}
