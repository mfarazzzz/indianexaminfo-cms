/**
 * useSlugValidation — Debounced slug uniqueness check against conducting_body_id + slug.
 * Returns availability status and conflicting entity info. (Req 7.2, 7.5)
 */
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { db } from '@/lib/supabase/client'

interface SlugValidationResult {
  isAvailable: boolean
  conflictingEntityId: string | null
  conflictingEntityName: string | null
  isChecking: boolean
}

export function useSlugValidation(
  slug: string,
  conductingBodyId: string | null,
  excludeEntityId?: string | null
): SlugValidationResult {
  const [debouncedSlug, setDebouncedSlug] = useState(slug)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(slug), 500)
    return () => clearTimeout(timer)
  }, [slug])

  const shouldQuery = !!debouncedSlug && !!conductingBodyId

  const { data, isLoading } = useQuery({
    queryKey: ['slug-validation', debouncedSlug, conductingBodyId, excludeEntityId],
    queryFn: async () => {
      const { data, error } = await db.rpc('check_slug_available', {
        p_slug: debouncedSlug,
        p_conducting_body_id: conductingBodyId,
        p_exclude_entity_id: excludeEntityId ?? null,
      })
      if (error) throw error
      const row = (data as any[])?.[0]
      return {
        isAvailable: row?.is_available ?? true,
        conflictingEntityId: row?.conflicting_entity_id ?? null,
        conflictingEntityName: row?.conflicting_entity_name ?? null,
      }
    },
    enabled: shouldQuery,
    staleTime: 5_000,
  })

  return {
    isAvailable: data?.isAvailable ?? true,
    conflictingEntityId: data?.conflictingEntityId ?? null,
    conflictingEntityName: data?.conflictingEntityName ?? null,
    isChecking: isLoading && shouldQuery,
  }
}
