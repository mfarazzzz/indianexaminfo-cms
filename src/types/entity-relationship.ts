/**
 * entity-relationship.ts — Typed directional entity relationships (ADR-009)
 * One table, free-text relationship_type, bidirectional queries via direction field.
 */

import type { EntityListItem } from './entity'

export interface EntityRelationship {
  id: string
  sourceEntityId: string
  targetEntityId: string
  /** Free-text: 'parent_exam' | 'related_exam' | 'supersedes' | etc. */
  relationshipType: string
  displayOrder: number
  createdAt: string
  createdBy?: string | null
  deletedAt?: string | null
}

/** Returned by listRelationships — includes direction and hydrated target entity */
export interface EntityRelationshipWithDirection extends EntityRelationship {
  direction: 'outgoing' | 'incoming'
  targetEntity: EntityListItem
}

export interface RelationshipInput {
  sourceEntityId: string
  targetEntityId: string
  relationshipType: string
  displayOrder?: number
}
