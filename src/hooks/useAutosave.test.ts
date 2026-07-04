import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutosave } from './useAutosave'

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('starts in idle state', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(saveFn))
    expect(result.current.status).toBe('idle')
    expect(result.current.lastSaved).toBeNull()
  })

  it('does not call saveFn before scheduleAutosave is called', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAutosave(saveFn))
    vi.advanceTimersByTime(60_000)
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('fires saveFn after 30s of inactivity', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(saveFn))

    act(() => result.current.scheduleAutosave())
    expect(saveFn).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('saved')
    expect(result.current.lastSaved).toBeInstanceOf(Date)
  })

  it('debounces: multiple calls reset the timer', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(saveFn))

    act(() => result.current.scheduleAutosave())
    vi.advanceTimersByTime(15_000)
    act(() => result.current.scheduleAutosave()) // reset timer
    vi.advanceTimersByTime(15_000) // only 15s since last schedule

    expect(saveFn).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(15_000) // now 30s since last reset
    })
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('retries after 10s on failure', async () => {
    const saveFn = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(undefined)

    const { result } = renderHook(() => useAutosave(saveFn))

    act(() => result.current.scheduleAutosave())

    await act(async () => { vi.advanceTimersByTime(30_000) })
    expect(result.current.status).toBe('error')
    expect(saveFn).toHaveBeenCalledTimes(1)

    await act(async () => { vi.advanceTimersByTime(10_000) })
    expect(saveFn).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('saved')
  })

  it('saveNow fires immediately without waiting 30s', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(saveFn))

    act(() => result.current.scheduleAutosave()) // start timer

    await act(async () => { await result.current.saveNow() })
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('saved')
  })

  it('does nothing when enabled=false', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(saveFn, false))

    act(() => result.current.scheduleAutosave())
    await act(async () => { vi.advanceTimersByTime(30_000) })
    expect(saveFn).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('cleans up timer on unmount without firing', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { result, unmount } = renderHook(() => useAutosave(saveFn))

    act(() => result.current.scheduleAutosave())
    unmount()

    await act(async () => { vi.advanceTimersByTime(60_000) })
    expect(saveFn).not.toHaveBeenCalled()
  })
})
