/**
 * usePillars.ts — Returns the pillar list.
 *
 * The `pillar` table does not exist in the production database.
 * Pillars are the enum labels on `exams.pillar` / `categories.pillar` (pillar_type)
 * that are ACTUALLY in use by live rows — the five current pillars:
 *   'government-exam' | 'govt-vacancy' | 'entrance-exam' | 'board-exam' | 'university-exam'
 *
 * These MUST match the slugs stored on category/exam rows, or CMS tabs that filter
 * by pillar show nothing. The previous list used legacy slugs
 * ('sarkari-naukri' | 'board-university') that no row uses, which hid 4 of the 5
 * pillars' categories from the Categories page (56 rows unreachable). See
 * CMS_REFACTORS_AND_STATUS_DESIGN "Three-vocabulary pillar split" for the wider
 * cleanup; this list is the corrected canonical five.
 *
 * This hook returns the static pillar list without any network request.
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
  { id: '1', slug: 'government-exam', label: 'Govt Exam', description: 'Government competitive exams (UPSC, SSC, RRB, banking)', icon: '🏛️', displayOrder: 1, isActive: true, createdAt: '', updatedAt: '', deletedAt: null },
  { id: '2', slug: 'govt-vacancy', label: 'Govt Vacancy', description: 'Government recruitment & direct vacancies', icon: '📋', displayOrder: 2, isActive: true, createdAt: '', updatedAt: '', deletedAt: null },
  { id: '3', slug: 'entrance-exam', label: 'Entrance Exam', description: 'Competitive entrance exams', icon: '📝', displayOrder: 3, isActive: true, createdAt: '', updatedAt: '', deletedAt: null },
  { id: '4', slug: 'board-exam', label: 'Board Exam', description: 'School boards (class 10 & 12)', icon: '🏫', displayOrder: 4, isActive: true, createdAt: '', updatedAt: '', deletedAt: null },
  { id: '5', slug: 'university-exam', label: 'University Exam', description: 'University & higher-education admissions and exams', icon: '🎓', displayOrder: 5, isActive: true, createdAt: '', updatedAt: '', deletedAt: null },
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
