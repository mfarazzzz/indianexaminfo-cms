/**
 * useEntityQuery — shared hooks for all entity data fetching.
 *
 * Eliminates duplicated useQuery boilerplate across 15 editor tabs.
 * Every tab uses the same loading/error state shape and cache keys.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { entityKeys, type EntityListOpts } from '@/lib/queryKeys'
import {
  getEntityById,
  listEntities,
  updateEntity,
  softDeleteEntity,
} from '@/services/entity/entityService'
import type { Entity, EntityListItem } from '@/types/entity'
import type { EntityCreateInput } from '@/lib/validation/entitySchemas'

// ── Entity detail ─────────────────────────────────────────────────────────────

/**
 * Fetches the entity parent record by ID.
 * Disabled automatically when id is falsy (new-entity flow).
 */
export function useEntityQuery(
  id: string | null | undefined
): UseQueryResult<Entity | null> {
  return useQuery({
    queryKey: entityKeys.detail(id ?? 'new'),
    queryFn: () => (id ? getEntityById(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 30_000,
  })
}

// ── Entity list ───────────────────────────────────────────────────────────────

export function useEntityListQuery(opts: EntityListOpts = {}) {
  return useQuery({
    queryKey: entityKeys.list(opts),
    queryFn: () => listEntities(opts),
    staleTime: 30_000,
  })
}

// ── Entity mutation ───────────────────────────────────────────────────────────

interface UseEntityMutationOptions {
  onSuccess?: (entity: Entity) => void
  onError?: (error: Error) => void
}

/**
 * Generic update mutation for an entity.
 * Automatically invalidates the detail and list caches on success.
 */
export function useEntityMutation(
  entityId: string,
  options?: UseEntityMutationOptions
): UseMutationResult<Entity, Error, Partial<EntityCreateInput>> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<EntityCreateInput>) =>
      updateEntity(entityId, input),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: entityKeys.detail(saved.id) })
      qc.invalidateQueries({ queryKey: entityKeys.lists() })
      options?.onSuccess?.(saved)
    },
    onError: (err: Error) => options?.onError?.(err),
  })
}

// ── Satellite query ───────────────────────────────────────────────────────────

/**
 * Generic hook for any satellite table (timeline, seo, eligibility, etc.).
 *
 * Usage:
 *   const { data: timeline = [] } = useSatelliteQuery(
 *     entityId,
 *     entityKeys.timeline(entityId),
 *     () => listTimeline(entityId)
 *   )
 */
export function useSatelliteQuery<T>(
  entityId: string | null | undefined,
  queryKey: readonly unknown[],
  fetchFn: () => Promise<T>
): UseQueryResult<T> {
  return useQuery({
    queryKey,
    queryFn: fetchFn,
    enabled: !!entityId,
    staleTime: 30_000,
  })
}

// ── Reorder mutation ──────────────────────────────────────────────────────────

/**
 * Generic reorder mutation.
 * Applies an optimistic update immediately, then persists via reorderFn.
 * On error, restores the previous order from the cache.
 *
 * Usage:
 *   const reorder = useReorderMutation(
 *     entityKeys.timeline(entityId),
 *     (ids) => reorderTimeline(entityId, ids)
 *   )
 *   reorder.mutate(newOrderedIds)
 */
export function useReorderMutation<T extends { id: string }>(
  queryKey: readonly unknown[],
  reorderFn: (orderedIds: string[]) => Promise<void>
): UseMutationResult<void, Error, string[]> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reorderFn,
    onMutate: async (orderedIds: string[]) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<T[]>(queryKey)
      if (previous) {
        const idToItem = new Map(previous.map(item => [item.id, item]))
        const reordered = orderedIds
          .map(id => idToItem.get(id))
          .filter((item): item is T => item !== undefined)
        qc.setQueryData<T[]>(queryKey, reordered)
      }
      return { previous }
    },
    onError: (_err, _ids, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey })
    },
  })
}

// ── Soft-delete mutation ──────────────────────────────────────────────────────

export function useSoftDeleteEntityMutation(options?: {
  onSuccess?: () => void
  onError?: (err: Error) => void
}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteEntity(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entityKeys.lists() })
      options?.onSuccess?.()
    },
    onError: (err: Error) => options?.onError?.(err),
  })
}

// ── List item from cache ──────────────────────────────────────────────────────

/**
 * Returns a single list item from the list cache without a network request.
 * Useful for showing entity name in breadcrumbs before the detail loads.
 */
export function useEntityFromListCache(
  id: string
): EntityListItem | undefined {
  const qc = useQueryClient()
  const allListCaches = qc.getQueriesData<{ data: EntityListItem[] }>({
    queryKey: entityKeys.lists(),
  })
  for (const [, result] of allListCaches) {
    const found = result?.data?.find(item => item.id === id)
    if (found) return found
  }
  return undefined
}
