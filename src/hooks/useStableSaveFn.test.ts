/**
 * useStableSaveFn.test.ts
 *
 * Verifies the stable callback contract:
 * 1. The returned reference is the same identity across re-renders.
 * 2. On invocation, the hook calls the LATEST handleSubmit/saveFn pair.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStableSaveFn } from './useStableSaveFn'

describe('useStableSaveFn', () => {
  it('returns the same callback reference across 3+ re-renders', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const handleSubmit = vi.fn((fn: () => void) => fn)

    const { result, rerender } = renderHook(
      ({ save, submit }) => useStableSaveFn(submit, save),
      { initialProps: { save: saveFn, submit: handleSubmit } }
    )

    const firstRef = result.current

    rerender({ save: saveFn, submit: handleSubmit })
    expect(result.current).toBe(firstRef)

    rerender({ save: saveFn, submit: handleSubmit })
    expect(result.current).toBe(firstRef)

    rerender({ save: saveFn, submit: handleSubmit })
    expect(result.current).toBe(firstRef)
  })

  it('calls the latest saveFn after reference changes', async () => {
    const saveFn1 = vi.fn().mockResolvedValue(undefined)
    const saveFn2 = vi.fn().mockResolvedValue(undefined)
    const handleSubmit = vi.fn((fn: () => void) => fn)

    const { result, rerender } = renderHook(
      ({ save }) => useStableSaveFn(handleSubmit, save),
      { initialProps: { save: saveFn1 } }
    )

    // Capture reference before update
    const stableRef = result.current

    // Update to saveFn2
    rerender({ save: saveFn2 })

    // Same reference as before
    expect(result.current).toBe(stableRef)

    // Invoke — should call saveFn2, not saveFn1
    await act(async () => { await result.current() })

    expect(saveFn2).toHaveBeenCalled()
    expect(saveFn1).not.toHaveBeenCalled()
  })

  it('always calls the latest saveFn at invocation time (stale-closure safety)', async () => {
    // The key property: even if saveFn changes after the stable callback is returned,
    // invoking the stable callback calls the CURRENT saveFn, not the old one.
    let callCount1 = 0
    let callCount2 = 0

    const saveFn1 = vi.fn(async () => { callCount1++ })
    const saveFn2 = vi.fn(async () => { callCount2++ })

    // handleSubmit just calls the passed fn directly (simplest possible wrapper)
    const handleSubmit = (fn: (...args: unknown[]) => unknown) => () => Promise.resolve(fn())

    const { result, rerender } = renderHook(
      ({ save }) => useStableSaveFn(handleSubmit, save),
      { initialProps: { save: saveFn1 } }
    )

    // Rerender with saveFn2 and flush effects
    await act(async () => {
      rerender({ save: saveFn2 })
    })

    // Invoke the stable callback — should use saveFn2 because the effect updated the ref
    await act(async () => { await result.current() })

    expect(callCount2).toBe(1)
    expect(callCount1).toBe(0)
  })

  it('stable reference holds across 20 re-renders (stress)', () => {
    const saveFn = vi.fn()
    const handleSubmit = vi.fn((fn: () => void) => fn)

    const { result, rerender } = renderHook(
      ({ n }) => useStableSaveFn(handleSubmit, saveFn),
      { initialProps: { n: 0 } }
    )

    const firstRef = result.current
    for (let i = 1; i <= 20; i++) {
      rerender({ n: i })
      expect(result.current).toBe(firstRef)
    }
  })
})
