/**
 * relationshipService.ts — Typed directional entity relationships (ADR-009).
 * Single table, free-text relationship_type, bidirectional queries.
 */
import { db } from '@/lib/supabase/client'
import type { EntityRelationship, EntityRelationshipWithDirection, RelationshipInput } from '@/types/entity-relationship'
import type { EntityListItem } from '@/types/entity'

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): EntityRelationship {
  return {
    id:               row.id as string,
    sourceEntityId:   row.source_entity_id as string,
    targetEntityId:   row.target_entity_id as string,
    relationshipType: row.relationship_type as string,
    displayOrder:     row.display_order as number,
    createdAt:        row.created_at as string,
    createdBy:        row.created_by as string | null,
    deletedAt:        row.deleted_at as string | null,
  }
}

function mapEntityListRow(row: Record<string, unknown>): EntityListItem {
  return {
    id:             row.id as string,
    entityType:     row.entity_type as string,
    slug:           row.slug as string,
    name:           row.name as string,
    shortName:      row.short_name as string | null,
    pillar:         row.pillar as string | null,
    workflowStatus: row.workflow_status as EntityListItem['workflowStatus'],
    isFeatured:     row.is_featured as boolean,
    priority:       row.priority as number | null,
    updatedAt:      row.updated_at as string,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listRelationships(
  entityId: string
): Promise<EntityRelationshipWithDirection[]> {
  // Fetch outgoing (this entity is source)
  const { data: outgoing, error: outErr } = await db
    .from('entity_relationship')
    .select(`
      *,
      target:entity!target_entity_id(
        id, entity_type, slug, name, short_name, pillar,
        workflow_status, is_featured, priority, updated_at
      )
    `)
    .eq('source_entity_id', entityId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (outErr) throw outErr

  // Fetch incoming (this entity is target)
  const { data: incoming, error: inErr } = await db
    .from('entity_relationship')
    .select(`
      *,
      source:entity!source_entity_id(
        id, entity_type, slug, name, short_name, pillar,
        workflow_status, is_featured, priority, updated_at
      )
    `)
    .eq('target_entity_id', entityId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (inErr) throw inErr

  const results: EntityRelationshipWithDirection[] = []

  for (const row of outgoing ?? []) {
    const r = row as Record<string, unknown>
    results.push({
      ...mapRow(r),
      direction: 'outgoing',
      targetEntity: mapEntityListRow(r.target as Record<string, unknown>),
    })
  }

  for (const row of incoming ?? []) {
    const r = row as Record<string, unknown>
    results.push({
      ...mapRow(r),
      direction: 'incoming',
      targetEntity: mapEntityListRow(r.source as Record<string, unknown>),
    })
  }

  return results
}

export async function createRelationship(
  input: RelationshipInput,
  userId?: string
): Promise<EntityRelationship> {
  if (input.sourceEntityId === input.targetEntityId) {
    throw new Error('An entity cannot be related to itself.')
  }

  const { data, error } = await db
    .from('entity_relationship')
    .insert({
      source_entity_id:  input.sourceEntityId,
      target_entity_id:  input.targetEntityId,
      relationship_type: input.relationshipType,
      display_order:     input.displayOrder ?? 0,
      created_by:        userId ?? null,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('This relationship already exists.')
    }
    throw error
  }
  return mapRow(data as Record<string, unknown>)
}

export async function reorderRelationships(
  entityId: string,
  relationshipType: string,
  orderedIds: string[]
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from('entity_relationship')
        .update({ display_order: index })
        .eq('id', id)
        .eq('source_entity_id', entityId)
        .eq('relationship_type', relationshipType)
    )
  )
}

export async function deleteRelationship(id: string): Promise<void> {
  const { error } = await db
    .from('entity_relationship')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
