/**
 * useAmendmentsSection.ts — Orchestrates entity amendments for the Amendments tab.
 */
import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSatelliteQuery, useReorderMutation } from './useEntityQuery'
import { useConfirmDelete } from './useConfirmDelete'
import { amendmentKeys } from '@/lib/queryKeys'
import {
  listAmendments,
  createAmendment,
  updateAmendment,
  publishAmendment,
  reorderAmendments,
  softDeleteAmendment,
} from '@/services/entity/amendmentService'
import type { EntityAmendment, AmendmentInput } from '@/types/entity-amendment'

export function useAmendmentsSection(entityId: string) {
  const qc = useQueryClient()
  const queryKey = amendmentKeys.list(entityId)

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const {
    data: amendments = [],
    isLoading,
    error,
  } = useSatelliteQuery<EntityAmendment[]>(
    entityId,
    queryKey,
    () => listAmendments(entityId)
  )

  const publishedCount = useMemo(
    () => amendments.filter(a => a.workflowStatus === 'published').length,
    [amendments]
  )

  // ── Create ──────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (input: AmendmentInput) => createAmendment(input),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  // ── Update ──────────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AmendmentInput> }) =>
      updateAmendment(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  // ── Publish ─────────────────────────────────────────────────────────────────
  const publishMutation = useMutation({
    mutationFn: (id: string) => publishAmendment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  // ── Reorder ─────────────────────────────────────────────────────────────────
  const reorderMutation = useReorderMutation<EntityAmendment>(
    queryKey,
    (orderedIds: string[]) => reorderAmendments(entityId, orderedIds)
  )

  // ── Delete ──────────────────────────────────────────────────────────────────
  const {
    pendingDeleteId,
    deleteItem: stageDelete,
    confirmDelete,
    cancelDelete,
  } = useConfirmDelete(
    queryKey,
    softDeleteAmendment,
    'Failed to delete amendment'
  )

  return {
    amendments,
    publishedCount,
    isLoading,
    error,
    createAmendment: createMutation.mutate,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    updateAmendment: updateMutation.mutate,
    publishAmendment: publishMutation.mutate,
    reorder: reorderMutation.mutate,
    stageDelete,
    pendingDeleteId,
    confirmDelete,
    cancelDelete,
  }
}
