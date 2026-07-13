/**
 * contentTypeService.ts — CRUD for the `content_type` structural taxonomy table.
 * Content Types classify WHAT an entity is (notification, result, blog post).
 * Decoupled from lifecycle stages — a Result content type exists independently
 * of whether the exam has reached the Result timeline stage.
 */
import { db } from '@/lib/supabase/client'
import type { ContentType, ContentTypeInput } from '@/types/content-type'

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): ContentType {
  return {
    id:                    row.id as string,
    pillarId:              row.pillar_id as string,
    slug:                  row.slug as string,
    label:                 row.label as string,
    urlPattern:            row.url_pattern as string,
    defaultSchemaOrgType:  row.default_schema_org_type as string,
    isActive:              row.is_active as boolean,
    displayOrder:          row.display_order as number,
    createdAt:             row.created_at as string,
    updatedAt:             row.updated_at as string,
    deletedAt:             row.deleted_at as string | null,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listContentTypes(pillarId?: string): Promise<ContentType[]> {
  let q = db
    .from('content_type')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  if (pillarId) q = q.eq('pillar_id', pillarId)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function getContentTypeById(id: string): Promise<ContentType | null> {
  const { data, error } = await db
    .from('content_type')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function getContentTypeBySlug(slug: string): Promise<ContentType | null> {
  const { data, error } = await db
    .from('content_type')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function createContentType(input: ContentTypeInput): Promise<ContentType> {
  const { data, error } = await db
    .from('content_type')
    .insert({
      pillar_id:               input.pillarId,
      slug:                    input.slug,
      label:                   input.label,
      url_pattern:             input.urlPattern,
      default_schema_org_type: input.defaultSchemaOrgType ?? 'Article',
      is_active:               input.isActive ?? true,
      display_order:           input.displayOrder ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateContentType(
  id: string,
  input: Partial<ContentTypeInput>
): Promise<ContentType> {
  const updates: Record<string, unknown> = {}
  if (input.slug                !== undefined) updates.slug                    = input.slug
  if (input.label               !== undefined) updates.label                   = input.label
  if (input.urlPattern          !== undefined) updates.url_pattern             = input.urlPattern
  if (input.defaultSchemaOrgType !== undefined) updates.default_schema_org_type = input.defaultSchemaOrgType
  if (input.isActive            !== undefined) updates.is_active               = input.isActive
  if (input.displayOrder        !== undefined) updates.display_order           = input.displayOrder

  const { data, error } = await db
    .from('content_type')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function softDeleteContentType(id: string): Promise<void> {
  const { error } = await db
    .from('content_type')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
