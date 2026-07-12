/**
 * queryClient.test.ts
 *
 * Regression tests for the browser-tab-switch data-loss bug.
 *
 * Root cause summary
 * ──────────────────
 * The global QueryClient had `refetchOnWindowFocus: false` (correct) but also
 * `refetchOnMount: 'always'`. In TanStack Query v5 the 'always' value triggers
 * an unconditional network request on every component mount — regardless of
 * staleTime. This meant that every time a Suspense boundary or React Strict
 * Mode double-invoked a tab component, the entity query refetched, returned
 * fresh server data, and — when combined with a bug where GeneralTab used an
 * inline `useQuery` without `staleTime` — could breach the `seedRef` guard
 * and call `reset()`, wiping unsaved form values.
 *
 * Fix
 * ───
 * `refetchOnMount` was changed from `'always'` to `true`.
 * `true` means "refetch on mount only when the cached data is older than
 * staleTime", which is the safe behaviour for an editor application.
 */
import { describe, it, expect } from 'vitest'
import { queryClient } from './queryClient'

// Access the resolved defaults from the QueryClient instance
const defaults = (queryClient.getDefaultOptions().queries ?? {}) as Record<string, unknown>

describe('QueryClient — editor-safe defaults', () => {
  it('disables refetchOnWindowFocus so browser tab-switch never triggers a reload', () => {
    expect(defaults.refetchOnWindowFocus).toBe(false)
  })

  it('uses refetchOnMount: true (stale-aware) not "always" (unconditional)', () => {
    // 'always' would fire a network request on every component mount even if the
    // cache is fresh, which can breach the GeneralTab seedRef guard and call
    // reset(), discarding unsaved user edits.
    expect(defaults.refetchOnMount).toBe(true)
    expect(defaults.refetchOnMount).not.toBe('always')
  })

  it('keeps refetchOnReconnect enabled — network outage recovery is still wanted', () => {
    expect(defaults.refetchOnReconnect).toBe(true)
  })

  it('has a staleTime of 5 minutes — prevents aggressive cache invalidation during editing', () => {
    expect(defaults.staleTime).toBe(5 * 60_000)
  })

  it('has a gcTime of 10 minutes — keeps cache alive during an editing session', () => {
    expect(defaults.gcTime).toBe(10 * 60_000)
  })

  it('retries failed queries twice — transient network errors do not break the editor', () => {
    expect(defaults.retry).toBe(2)
  })
})
