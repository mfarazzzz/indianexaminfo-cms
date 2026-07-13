/**
 * useEntityHealth.ts — Computed entity health model (ADR-010).
 * Health is computed on-demand, cached 2 minutes client-side.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { healthKeys } from '@/lib/queryKeys'
import { computeEntityHealth, getPublishReadiness } from '@/services/entity/healthService'
import type { EntityHealth } from '@/types/entity-health'

export function useEntityHealth(
  entityId: string | null | undefined
): UseQueryResult<EntityHealth> {
  return useQuery({
    queryKey: healthKeys.entity(entityId ?? ''),
    queryFn:  () => computeEntityHealth(entityId!),
    enabled:  !!entityId,
    staleTime: 2 * 60_000,  // 2 minutes — always reasonably fresh
  })
}

export function usePublishReadiness(
  entityId: string | null | undefined
): UseQueryResult<string[]> {
  return useQuery({
    queryKey: [...healthKeys.entity(entityId ?? ''), 'readiness'],
    queryFn:  () => getPublishReadiness(entityId!),
    enabled:  !!entityId,
    staleTime: 30_000,  // 30 seconds — checked more frequently during editing
  })
}
