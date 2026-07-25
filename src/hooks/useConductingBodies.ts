/**
 * useConductingBodies — TanStack Query hook for the conducting_body lookup table.
 * Small table (<200 rows), cached indefinitely.
 */
import { useQuery } from '@tanstack/react-query'
import { conductingBodyKeys } from '@/lib/queryKeys'
import { listConductingBodies } from '@/services/entity/conductingBodyService'
import type { ConductingBody } from '@/types/entity'

export function useConductingBodies() {
  return useQuery<ConductingBody[]>({
    queryKey: conductingBodyKeys.list(),
    queryFn: listConductingBodies,
    staleTime: Infinity,
  })
}
