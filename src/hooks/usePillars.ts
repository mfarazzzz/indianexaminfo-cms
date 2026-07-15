/**
 * usePillars.ts — Returns the pillar list.
 *
 * The `pillar` table does not exist in the production database.
 * Pillars are defined as an enum type on the `exams.pillar` column:
 *   'sarkari-naukri' | 'entrance-exam' | 'board-university'
 *
 * This hook returns the static pillar list without any network request.
 * If a `pillar` table is created in the future, this can be switched back
 * to a Supabase query.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'

export interface PillarItem {
  slug: string
  label: string
  id: string
  description: string | null
  icon: string | null
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

const STATIC_PILLARS: PillarItem[] = [
  { id: '1', slug: 'sarkari-naukri', label: 'Sarkari Naukri', description: 'Government job exams', icon: '🏛️', displayOrder: 1, isActive: true, createdAt: '', updatedAt: '', deletedAt: null },
  { id: '2', slug: 'entrance-exam', label: 'Entrance Exam', description: 'Competitive entrance exams', icon: '📝', displayOrder: 2, isActive: true, createdAt: '', updatedAt: '', deletedAt: null },
  { id: '3', slug: 'board-university', label: 'Board & University', description: 'Board and university exams', icon: '🏫', displayOrder: 3, isActive: true, createdAt: '', updatedAt: '', deletedAt: null },
]

export function usePillars(): UseQueryResult<PillarItem[]> {
  return useQuery({
    queryKey: ['pillars', 'static'],
    queryFn: () => Promise.resolve(STATIC_PILLARS),
    staleTime: Infinity, // Never refetch — static data
  })
}

export function useAllPillars(): UseQueryResult<PillarItem[]> {
  return useQuery({
    queryKey: ['pillars', 'all', 'static'],
    queryFn: () => Promise.resolve(STATIC_PILLARS),
    staleTime: Infinity,
  })
}
