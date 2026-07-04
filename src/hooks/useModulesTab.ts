/**
 * useModulesTab — orchestration hook for ModulesTab.
 *
 * Manages module list, create/delete/duplicate/reorder/publish, and UI state.
 * All business logic belongs in moduleService.
 */
import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { entityKeys } from '@/lib/queryKeys'
import { useSatelliteQuery, useReorderMutation } from '@/hooks/useEntityQuery'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import {
  listModules, createModule, updateModule,
  softDeleteModule, reorderModules, publishModule, duplicateModule,
} from '@/services/entity/moduleService'
import type { EntityModule } from '@/types/entity'
import type { ModuleCreateInput } from '@/lib/validation/entitySchemas'

export interface UseModulesTabReturn {
  modules: EntityModule[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
  isCreating: boolean
  startCreate: () => void
  cancelCreate: () => void
  createModule: (input: ModuleCreateInput) => Promise<void>
  createError: string | null
  deleteModule: (id: string) => void
  duplicateModule: (id: string) => Promise<void>
  reorderModules: (orderedIds: string[]) => void
  publishModule: (id: string, userId: string) => Promise<void>
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  pendingDeleteId: string | null
  confirmDelete: () => Promise<void>
  cancelDelete: () => void
}

export function useModulesTab(entityId: string): UseModulesTabReturn {
  const qc = useQueryClient()
  const queryKey = entityKeys.modules(entityId)

  const { data, isLoading, error, refetch } = useSatelliteQuery<EntityModule[]>(
    entityId, queryKey, () => listModules(entityId)
  )
  const modules = data ?? []

  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const startCreate = useCallback(() => { setIsCreating(true); setCreateError(null) }, [])
  const cancelCreate = useCallback(() => { setIsCreating(false); setCreateError(null) }, [])

  // ── Create ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (input: ModuleCreateInput) => createModule(entityId, input),
    onSuccess: () => { setIsCreating(false); setCreateError(null); qc.invalidateQueries({ queryKey }) },
    onError: (err: Error) => setCreateError(err.message),
  })
  const createModuleFn = useCallback(async (input: ModuleCreateInput): Promise<void> => {
    await createMutation.mutateAsync(input).catch(() => {})
  }, [createMutation])

  // ── Delete (via shared hook) ───────────────────────────────────────────────
  const { pendingDeleteId, deleteItem, confirmDelete, cancelDelete } = useConfirmDelete(
    queryKey,
    softDeleteModule,
    'Failed to delete module — change restored'
  )

  // ── Duplicate ──────────────────────────────────────────────────────────────
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => duplicateModule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err: Error) => toast.error(err.message),
  })
  const duplicateModuleFn = useCallback(async (id: string): Promise<void> => {
    await duplicateMutation.mutateAsync(id).catch(() => {})
  }, [duplicateMutation])

  // ── Reorder ────────────────────────────────────────────────────────────────
  const reorderMutation = useReorderMutation<EntityModule>(
    queryKey, (ids) => reorderModules(entityId, ids)
  )
  const reorderModulesFn = useCallback(
    (orderedIds: string[]) => reorderMutation.mutate(orderedIds),
    [reorderMutation]
  )

  // ── Publish ────────────────────────────────────────────────────────────────
  const publishMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => publishModule(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err: Error) => toast.error(err.message),
  })
  const publishModuleFn = useCallback(async (id: string, userId: string): Promise<void> => {
    await publishMutation.mutateAsync({ id, userId }).catch(() => {})
  }, [publishMutation])

  return {
    modules, isLoading, error: error as Error | null, refetch,
    isCreating, startCreate, cancelCreate, createModule: createModuleFn, createError,
    deleteModule: deleteItem, duplicateModule: duplicateModuleFn,
    reorderModules: reorderModulesFn, publishModule: publishModuleFn,
    expandedId, setExpandedId,
    pendingDeleteId, confirmDelete, cancelDelete,
  }
}
