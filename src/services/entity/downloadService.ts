import { db } from '@/lib/supabase/client'
import type { EntityDownload } from '@/types/entity'
import type { DownloadInput } from '@/lib/validation/entitySchemas'

function mapRow(r: Record<string, unknown>): EntityDownload {
  return {
    id: r.id as string, entityId: r.entity_id as string,
    downloadName: r.download_name as string, category: r.category as string | null,
    mediaId: r.media_id as string | null, externalUrl: r.external_url as string | null,
    fileType: r.file_type as string | null, version: r.version as string | null,
    description: r.description as string | null,
    language: (r.language as string) ?? 'en',
    isVisible: (r.is_visible as boolean) ?? true,
    buttonText: (r.button_text as string) ?? 'Download',
    displayOrder: (r.display_order as number) ?? 0,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    deletedAt: r.deleted_at as string | null,
  }
}

export async function listDownloads(entityId: string): Promise<EntityDownload[]> {
  const { data, error } = await db
    .from('entity_download').select('*')
    .eq('entity_id', entityId).is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function createDownload(entityId: string, input: DownloadInput): Promise<EntityDownload> {
  const { data, error } = await db.from('entity_download').insert({
    entity_id: entityId,
    download_name: input.downloadName, category: input.category ?? null,
    // media_id takes precedence over external_url per R7.3
    media_id: input.mediaId ?? null,
    external_url: input.mediaId ? null : (input.externalUrl ?? null),
    file_type: input.fileType ?? null, version: input.version ?? null,
    description: input.description ?? null, language: input.language ?? 'en',
    is_visible: input.isVisible ?? true, button_text: input.buttonText ?? 'Download',
    display_order: input.displayOrder ?? 0,
  }).select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateDownload(id: string, input: Partial<DownloadInput>): Promise<EntityDownload> {
  const updates: Record<string, unknown> = {}
  const m: Record<string, string> = {
    downloadName: 'download_name', category: 'category', mediaId: 'media_id',
    externalUrl: 'external_url', fileType: 'file_type', version: 'version',
    description: 'description', language: 'language', isVisible: 'is_visible',
    buttonText: 'button_text', displayOrder: 'display_order',
  }
  for (const [k, col] of Object.entries(m))
    if ((input as Record<string, unknown>)[k] !== undefined)
      updates[col] = (input as Record<string, unknown>)[k]
  // Enforce media_id precedence
  if (updates.media_id) updates.external_url = null
  const { data, error } = await db.from('entity_download').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function softDeleteDownload(id: string): Promise<void> {
  const { error } = await db.from('entity_download').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function reorderDownloads(entityId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) =>
    db.from('entity_download').update({ display_order: i }).eq('id', id).eq('entity_id', entityId)))
}

/** Human-readable file size */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
