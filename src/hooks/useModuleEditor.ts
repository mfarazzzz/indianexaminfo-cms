/**
 * useModuleEditor — orchestration hook for ModuleEditor.
 *
 * Manages block list, CRUD, reorder, visibility, and UI state.
 * All business logic belongs in blockService.
 */
import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { entityKeys } from '@/lib/queryKeys'
import { useSatelliteQuery, useReorderMutation } from '@/hooks/useEntityQuery'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import {
  listBlocks, createBlock, updateBlock, updateBlockVisibility,
  softDeleteBlock, reorderBlocks, duplicateBlock,
} from '@/services/entity/blockService'
import type { ModuleBlock } from '@/types/entity'

export interface UseModuleEditorReturn {
  blocks: ModuleBlock[]
  isLoading: boolean
  error: Error | null
  createBlock: (blockType: string, defaultContent: Record<string, unknown>) => Promise<void>
  updateBlock: (id: string, content: Record<string, unknown>) => Promise<ModuleBlock>
  deleteBlock: (id: string) => void
  duplicateBlock: (id: string) => Promise<void>
  reorderBlocks: (orderedIds: string[]) => void
  toggleBlockVisibility: (id: string, isVisible: boolean) => Promise<void>
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  pendingDeleteId: string | null
  confirmDelete: () => Promise<void>
  cancelDelete: () => void
}

export function useModuleEditor(moduleId: string): UseModuleEditorReturn {
  const qc = useQueryClient()
  const queryKey = entityKeys.blocks(moduleId)

  const { data, isLoading, error } = useSatelliteQuery<ModuleBlock[]>(
    moduleId, queryKey, () => listBlocks(moduleId)
  )
  const blocks = data ?? []

  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Create ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: ({ blockType, content }: { blockType: string; content: Record<string, unknown> }) =>
      createBlock(moduleId, blockType, content, blocks.length),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err: Error) => toast.error(err.message),
  })
  const createBlockFn = useCallback(async (blockType: string, content: Record<string, unknown>): Promise<void> => {
    await createMutation.mutateAsync({ blockType, content }).catch(() => {})
  }, [createMutation])

  // ── Update ─────────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: Record<string, unknown> }) =>
      updateBlock(id, content),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })
  const updateBlockFn = useCallback(
    (id: string, content: Record<string, unknown>) =>
      updateMutation.mutateAsync({ id, content }),
    [updateMutation]
  )

  // ── Delete (via shared hook) ───────────────────────────────────────────────
  const { pendingDeleteId, deleteItem, confirmDelete, cancelDelete } = useConfirmDelete(
    queryKey,
    softDeleteBlock,
    'Failed to delete block — change restored'
  )

  // ── Duplicate ──────────────────────────────────────────────────────────────
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => duplicateBlock(id),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err: Error) => toast.error(err.message),
  })
  const duplicateBlockFn = useCallback(async (id: string): Promise<void> => {
    await duplicateMutation.mutateAsync(id).catch(() => {})
  }, [duplicateMutation])

  // ── Reorder ────────────────────────────────────────────────────────────────
  const reorderMutation = useReorderMutation<ModuleBlock>(
    queryKey, (ids) => reorderBlocks(moduleId, ids)
  )
  const reorderBlocksFn = useCallback(
    (orderedIds: string[]) => reorderMutation.mutate(orderedIds),
    [reorderMutation]
  )

  // ── Visibility ─────────────────────────────────────────────────────────────
  const visibilityMutation = useMutation({
    mutationFn: ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      updateBlockVisibility(id, isVisible),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err: Error) => toast.error(err.message),
  })
  const toggleBlockVisibilityFn = useCallback(async (id: string, isVisible: boolean): Promise<void> => {
    await visibilityMutation.mutateAsync({ id, isVisible }).catch(() => {})
  }, [visibilityMutation])

  return {
    blocks, isLoading, error: error as Error | null,
    createBlock: createBlockFn, updateBlock: updateBlockFn,
    deleteBlock: deleteItem, duplicateBlock: duplicateBlockFn,
    reorderBlocks: reorderBlocksFn, toggleBlockVisibility: toggleBlockVisibilityFn,
    expandedId, setExpandedId,
    pendingDeleteId, confirmDelete, cancelDelete,
  }
}
