/**
 * TimelineDatesContext — Cross-tab date sync for EntityEditorShell.
 *
 * Reads standard dates from entity_timeline_event via TanStack Query cache.
 * When the Timeline Tab saves a date, the cache invalidation triggers a refetch,
 * and all ReadOnlyDateChips in other tabs automatically re-render with the new value.
 *
 * Also provides the total vacancy value for ReadOnlyVacancyChips.
 * (Req 1.4, 1.5, 3.1, 3.3, 4.3, 4.4)
 */
import React, { createContext, useContext, useCallback, useMemo } from 'react'
import { entityKeys } from '@/lib/queryKeys'
import { useSatelliteQuery } from '@/hooks/useEntityQuery'
import { listTimeline } from '@/services/entity/timelineService'
import { useEditorUI } from '@/contexts/EditorUIContext'
import { STANDARD_DATE_TYPES } from '@/types/entity'
import type { TimelineEvent, DateEntry, EntityVacancy } from '@/types/entity'

interface TimelineDatesContextValue {
  /** Map of event_type → DateEntry for standard date types */
  dates: Map<string, DateEntry>
  /** Total vacancy count (from entity_vacancy where category = 'total') */
  totalVacancy: number | null
  /** Whether the underlying queries are still loading */
  isLoading: boolean
  /** Navigate to the Timeline tab and (optionally) highlight a specific event_type */
  navigateToTimeline: (eventType: string) => void
  /** Navigate to the Vacancy tab */
  navigateToVacancy: () => void
}

const TimelineDatesContext = createContext<TimelineDatesContextValue | null>(null)

interface TimelineDatesProviderProps {
  entityId: string
  children: React.ReactNode
}

export function TimelineDatesProvider({ entityId, children }: TimelineDatesProviderProps) {
  const { setActiveTab } = useEditorUI()

  // Timeline events query (shares cache with TimelineTab via same queryKey)
  const { data: timelineEvents, isLoading: timelineLoading } = useSatelliteQuery<TimelineEvent[]>(
    entityId,
    entityKeys.timeline(entityId),
    () => listTimeline(entityId)
  )

  // Vacancy query (shares cache with VacancyTab)
  const { data: vacancies, isLoading: vacancyLoading } = useSatelliteQuery<EntityVacancy[]>(
    entityId,
    entityKeys.vacancies(entityId),
    async () => {
      const { listVacancies } = await import('@/services/entity/vacancyService')
      return listVacancies(entityId)
    }
  )

  // Build dates Map from timeline events
  const dates = useMemo(() => {
    const map = new Map<string, DateEntry>()
    const standardSet = new Set<string>(STANDARD_DATE_TYPES)
    for (const event of timelineEvents ?? []) {
      if (standardSet.has(event.eventType)) {
        map.set(event.eventType, {
          eventType: event.eventType,
          date: event.eventDate ?? null,
          isHighlighted: event.isHighlighted,
          title: event.title,
        })
      }
    }
    return map
  }, [timelineEvents])

  // Extract total vacancy
  const totalVacancy = useMemo(() => {
    const totalRow = (vacancies ?? []).find(v => v.category === 'total' && !v.deletedAt)
    return totalRow?.value ?? null
  }, [vacancies])

  const navigateToTimeline = useCallback((eventType: string) => {
    setActiveTab('timeline')
    // Scroll-to-row could be implemented via a shared ref or scroll event
    // For now, switching tabs is sufficient — the row is visible immediately
  }, [setActiveTab])

  const navigateToVacancy = useCallback(() => {
    setActiveTab('vacancy')
  }, [setActiveTab])

  const value: TimelineDatesContextValue = {
    dates,
    totalVacancy,
    isLoading: timelineLoading || vacancyLoading,
    navigateToTimeline,
    navigateToVacancy,
  }

  return (
    <TimelineDatesContext.Provider value={value}>
      {children}
    </TimelineDatesContext.Provider>
  )
}

/** Hook to consume timeline dates context */
export function useTimelineDates() {
  const ctx = useContext(TimelineDatesContext)
  if (!ctx) throw new Error('useTimelineDates must be used within TimelineDatesProvider')
  return ctx
}
