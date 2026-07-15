/**
 * usePillars.ts — Loads the active pillar list from the database.
 * Replaces the hardcoded PILLARS constant in site.ts.
 * Sidebar and entity creation wizard use this hook.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { pillarKeys } from '@/lib/queryKeys'
import { listPillars } from '@/services/pillar/pillarService'
import type { Pillar } from '@/types/pillar'

export function usePillars(): UseQueryResult<Pillar[]> {
  return useQuery({
    queryKey: pillarKeys.list(),
    queryFn:  () => listPillars(false),
    staleTime: 5 * 60_000,
    retry: false,  // Don't retry if table doesn't exist
  })
}

export function useAllPillars(): UseQueryResult<Pillar[]> {
  return useQuery({
    queryKey: [...pillarKeys.list(), 'all'],
    queryFn:  () => listPillars(true),  // include inactive
    staleTime: 5 * 60_000,
  })
}
