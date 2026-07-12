import { QueryClient } from '@tanstack/react-query'

/**
 * Global QueryClient configuration for the CMS editor application.
 *
 * EDITOR SAFETY RULES — why these values were chosen:
 *
 * refetchOnWindowFocus: false
 *   Browser tab-switch must NEVER overwrite in-progress edits.
 *   The default (true) fires a background refetch every time the window
 *   regains focus, which can trigger the entity query to return fresh server
 *   data and — if the form seed guard is breached — call reset(), discarding
 *   all unsaved user input. Disabled globally; individual read-only views may
 *   opt back in with { refetchOnWindowFocus: true }.
 *
 * refetchOnMount: true   (NOT 'always')
 *   - true  → refetch on mount only when cached data is older than staleTime.
 *             Safe for editors: fresh cache from a recent load is reused.
 *   - 'always' → refetch on EVERY mount, even if data was fetched 1 second ago.
 *             This is the wrong choice for editor tabs: each Suspense boundary
 *             remount (lazy tab first render, Strict Mode double-invoke) fires a
 *             network request, which races against the form and can reset() it.
 *   We use true here so that the 5-minute staleTime acts as the real gate.
 *
 * refetchOnReconnect: true
 *   After a network outage, stale data should be refreshed once connectivity
 *   returns. The seedRef guard in form tabs prevents this from overwriting
 *   any unsaved edits already in the form.
 *
 * staleTime: 5 min
 *   CMS records change infrequently during an editing session. A 5-minute
 *   freshness window prevents unnecessary round-trips while still ensuring
 *   editors see reasonably current data on a cold load.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            5 * 60_000,  // 5 min — CMS data doesn't need sub-minute freshness
      gcTime:               10 * 60_000, // 10 min garbage collection
      retry:                2,
      refetchOnWindowFocus: false,       // CRITICAL: tab-switch must never reload CMS data
      refetchOnReconnect:   true,        // refetch after network reconnect (seedRef guards the form)
      refetchOnMount:       true,        // refetch on mount only when stale — NOT 'always'
    },
    mutations: {
      retry: 0,
    },
  },
})
