/**
 * useContentTypes.ts — Loads content types, optionally filtered by pillar.
 * Used in entity creation wizard step 2.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { contentTypeKeys } from '@/lib/queryKeys'
import { listContentTypes } from '@/services/template/contentTypeService'
import type { ContentType } from '@/types/content-type'

export function useContentTypes(pillarId?: string): UseQueryResult<ContentType[]> {
  return useQuery({
    queryKey: contentTypeKeys.list(pillarId),
    queryFn:  () => listContentTypes(pillarId),
    enabled:  !!pillarId,
    staleTime: 5 * 60_000,
  })
}

export function useAllContentTypes(): UseQueryResult<ContentType[]> {
  return useQuery({
    queryKey: contentTypeKeys.list(),
    queryFn:  () => listContentTypes(),
    staleTime: 5 * 60_000,
  })
}
