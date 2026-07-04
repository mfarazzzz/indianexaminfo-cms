/**
 * useStableSaveFn — Extracts the autosaveFnRef pattern into a reusable hook.
 *
 * Returns a stable callback (same identity across re-renders) that always
 * invokes the latest handleSubmit(saveFn) pair. Safe to pass directly to
 * useAutosave without triggering extra effect re-runs.
 *
 * Pattern source: ARCHITECTURE.md §5.3
 *
 * @param handleSubmit - react-hook-form's handleSubmit function
 * @param saveFn       - async function that persists form data
 */
import { useCallback, useEffect, useRef } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandleSubmit = (fn: (...args: any[]) => unknown) => () => Promise<void>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SaveFn = (...args: any[]) => Promise<unknown>

export function useStableSaveFn(
  handleSubmit: HandleSubmit,
  saveFn: SaveFn
): () => Promise<void> {
  // Always holds the latest (handleSubmit, saveFn) pair — no stale closures
  const fnRef = useRef<() => Promise<void>>(async () => {})

  // Runs every render (no dep array) to keep fnRef current
  useEffect(() => {
    fnRef.current = handleSubmit(saveFn)
  })

  // Stable reference — never changes between renders
  return useCallback(() => fnRef.current(), [])
}
