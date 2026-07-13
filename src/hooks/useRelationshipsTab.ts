/**
 * useRelationshipsTab.ts — Orchestrates entity relationships for the Relationships tab.
 */
import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSatelliteQuery, useReorderMutation } from './useEntityQuery'
import { useConfirmDelete } from './useConfirmDelete'
import { relationshipKeys } from '@/lib/queryKeys'
import {
  listRelationships,
  createRelationship,
  reorderRelationships,
  deleteRelationship,
} from '@/services/entity/relationshipService'
import type { EntityRelationshipWithDirection, RelationshipInput } from '@/types/entity-relationship'

export function useRelationshipsTab(entityId: string) {
  const qc = useQueryClient()
  const queryKey = relationshipKeys.list(entityId)

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const {
    data: relationships = [],
    isLoading,
    error,
  } = useSatelliteQuery<EntityRelationshipWithDirection[]>(
    entityId,
    queryKey,
    () => listRelationships(entityId)
  )

  // ── Grouped by type ─────────────────────────────────────────────────────────
  const outgoing = useMemo(
    () => relationships.filter(r => r.direction === 'outgoing'),
    [relationships]
  )
  const incoming = useMemo(
    () => relationships.filter(r => r.direction === 'incoming'),
    [relationships]
  )
  const groupedOutgoing = useMemo(() => {
    const map = new Map<string, EntityRelationshipWithDirection[]>()
    for (const r of outgoing) {
      const list = map.get(r.relationshipType) ?? []
      list.push(r)
      map.set(r.relationshipType, list)
    }
    return map
  }, [outgoing])

  // ── Create ──────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (input: RelationshipInput) => createRelationship(input),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  // ── Reorder ─────────────────────────────────────────────────────────────────
  const reorderMutation = useReorderMutation<EntityRelationshipWithDirection>(
    queryKey,
    (orderedIds: string[]) => {
      // Reorder within a single type — caller must filter by type first
      return reorderRelationships(entityId, '', orderedIds)
    }
  )

  // ── Delete ──────────────────────────────────────────────────────────────────
  const {
    pendingDeleteId,
    deleteItem: stageDelete,
    confirmDelete,
    cancelDelete,
  } = useConfirmDelete(
    queryKey,
    deleteRelationship,
    'Failed to delete relationship'
  )

  return {
    relationships,
    outgoing,
    incoming,
    groupedOutgoing,
    isLoading,
    error,
    createRelationship: createMutation.mutate,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    reorder: reorderMutation.mutate,
    stageDelete,
    pendingDeleteId,
    confirmDelete,
    cancelDelete,
  }
}
