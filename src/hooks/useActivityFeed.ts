/**
 * useActivityFeed — TanStack Query hook for the dashboard activity feed.
 * Fetches recent module_filled/module_updated entries. (Req 8.3–8.6)
 */
import { useQuery } from '@tanstack/react-query'
import { activityFeedKeys } from '@/lib/queryKeys'
import { listRecentActivity } from '@/services/entity/activityLogService'
import type { DashboardActivityEntry } from '@/types/entity'

export function useActivityFeed(limit = 25) {
  return useQuery<DashboardActivityEntry[]>({
    queryKey: activityFeedKeys.recent(limit),
    queryFn: () => listRecentActivity(limit),
    staleTime: 30_000,
  })
}
