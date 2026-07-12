import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            5 * 60_000,  // 5 min — CMS data doesn't need sub-minute freshness
      gcTime:               10 * 60_000, // 10 min garbage collection
      retry:                2,
      refetchOnWindowFocus: false,       // Tab-switch should NOT reload CMS data
      refetchOnReconnect:   true,        // DO refetch after network reconnect
      refetchOnMount:       true,        // DO refetch on first mount
    },
    mutations: {
      retry: 0,
    },
  },
})
