/**
 * useAutosave — Debounced autosave hook.
 *
 * Fires saveFn() after 30 seconds of editor inactivity.
 * On failure, retries after 10 seconds.
 *
 * The saveFn reference is captured via a ref so that:
 *  - the caller can pass an inline function without triggering extra re-renders
 *  - the timer closure always calls the latest version of saveFn
 *
 * @param saveFn  Async function that performs the save. Must throw on failure.
 * @param enabled Set to false to disable autosave (e.g. for new-entity forms).
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseAutosaveReturn {
  status: AutosaveStatus
  lastSaved: Date | null
  /** Call on every form change to reset the 30-second debounce timer. */
  scheduleAutosave: () => void
  /** Force an immediate save — e.g. when switching tabs with unsaved changes. */
  saveNow: () => Promise<void>
}

const DEBOUNCE_MS = 30_000
const RETRY_MS = 10_000
const MAX_RETRIES = 3

/** Errors that should NOT trigger retry (non-transient) */
function isNonRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return (
      msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') ||
      msg.includes('forbidden') || msg.includes('session expired') ||
      msg.includes('jwt expired') || msg.includes('not authenticated')
    )
  }
  return false
}

export function useAutosave(
  saveFn: () => Promise<void>,
  enabled = true
): UseAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Always holds the latest saveFn — avoids stale closures inside timers
  const saveFnRef = useRef<() => Promise<void>>(saveFn)
  useEffect(() => { saveFnRef.current = saveFn }, [saveFn])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const isSavingRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // runSave is stable — it only reads from refs, never from closed-over values
  const runSave = useCallback(async () => {
    // Prevent double-save (rapid clicks or overlapping timers)
    if (isSavingRef.current) return
    isSavingRef.current = true
    setStatus('saving')
    try {
      await saveFnRef.current()
      setLastSaved(new Date())
      setStatus('saved')
      retryCountRef.current = 0 // reset on success
    } catch (err) {
      setStatus('error')
      // Don't retry on auth/session errors — user needs to re-authenticate
      if (isNonRetryableError(err)) {
        console.warn('[useAutosave] Non-retryable error, stopping retries:', err)
        retryCountRef.current = 0
      } else if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++
        timerRef.current = setTimeout(runSave, RETRY_MS)
      } else {
        console.warn('[useAutosave] Max retries reached, giving up')
        retryCountRef.current = 0
      }
    } finally {
      isSavingRef.current = false
    }
  }, []) // intentionally empty — all values accessed via refs

  const scheduleAutosave = useCallback(() => {
    if (!enabled) return
    clearTimer()
    timerRef.current = setTimeout(runSave, DEBOUNCE_MS)
  }, [enabled, clearTimer, runSave])

  const saveNow = useCallback(async () => {
    clearTimer()
    await runSave()
  }, [clearTimer, runSave])

  // Clean up timer on unmount
  useEffect(() => () => clearTimer(), [clearTimer])

  return { status, lastSaved, scheduleAutosave, saveNow }
}
