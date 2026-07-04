/**
 * useConfirmDelete — Reusable optimistic delete hook.
 *
 * Generalises the optimistic delete pattern from useTimelineTab.
 * Works with any satellite table that caches an array of { id: string } items.
 *
 * Usage:
 *   const { pendingDeleteId, deleteItem, confirmDelete, cancelDelete } =
 *     useConfirmDelete(entityKeys.timeline(entityId), softDeleteTimelineEvent, 'Failed to delete event — change restored')
 */
import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface UseConfirmDeleteReturn {
  pendingDeleteId: string | null
  /** Stage an item for deletion — sets pendingDeleteId without calling deleteFn */
  deleteItem: (id: string) => void
  /** Executes the delete optimistically, rolls back on error */
  confirmDelete: () => Promise<void>
  /** Cancels the staged deletion without any service call */
  cancelDelete: () => void
}

export function useConfirmDelete(
  queryKey: readonly unknown[],
  deleteFn: (id: string) => Promise<void>,
  onErrorMsg: string
): UseConfirmDeleteReturn {
  const qc = useQueryClient()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Array<{ id: string }>>(queryKey)
      qc.setQueryData<Array<{ id: string }>>(
        queryKey,
        prev => (prev ?? []).filter(item => item.id !== id)
      )
      return { previous }
    },
    onError: (_err: Error, _id, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(queryKey, context.previous)
      }
      toast.error(onErrorMsg)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
    },
  })

  const deleteItem = useCallback((id: string) => {
    setPendingDeleteId(id)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    await deleteMutation.mutateAsync(id).catch(() => {})
  }, [pendingDeleteId, deleteMutation])

  const cancelDelete = useCallback(() => {
    setPendingDeleteId(null)
  }, [])

  return { pendingDeleteId, deleteItem, confirmDelete, cancelDelete }
}
