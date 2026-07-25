/**
 * useDuplicateCheck — Debounced fuzzy match for duplicate entity detection.
 * Triggers after 3+ characters, debounced 500ms. (Req 5.1–5.6)
 */
import { useQuery } from '@tanstack/react-query'
import { duplicateCheckKeys } from '@/lib/queryKeys'
import { checkDuplicateEntity, type DuplicateMatch } from '@/services/entity/duplicateCheckService'
import { useState, useEffect } from 'react'

export function useDuplicateCheck(
  name: string,
  conductingBodyId: string | null,
  enabled = true
) {
  const [debouncedName, setDebouncedName] = useState(name)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(name), 500)
    return () => clearTimeout(timer)
  }, [name])

  const shouldQuery = enabled && debouncedName.length >= 3

  return useQuery<DuplicateMatch[]>({
    queryKey: duplicateCheckKeys.check(debouncedName, conductingBodyId),
    queryFn: () => checkDuplicateEntity(debouncedName, conductingBodyId),
    enabled: shouldQuery,
    staleTime: 10_000,
    retry: false, // Req 5.5: silently discard failures
  })
}
