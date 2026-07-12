import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            5 * 60_000,  // 5 min — CMS data doesn't need sub-minute freshness
      gcTime:               10 * 60_000, // 10 min garbage collection
      retry:                2,
      refetchOnWindowFocus: false,       // Tab-switch should NOT reload CMS data
      refetchOnReconnect:   true,        // DO refetch after network reconnect
      // "always" re-fetches only when the cached data is actually stale (> staleTime).
      // Previously `true` caused a network refetch on every component mount even when
      // fresh data was already cached, which triggered GeneralTab's reset() effect and
      // wiped unsaved form values every time the user switched back to the tab.
      refetchOnMount:       'always',
    },
    mutations: {
      retry: 0,
    },
  },
})
