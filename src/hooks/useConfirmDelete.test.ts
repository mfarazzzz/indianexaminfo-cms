/**
 * useConfirmDelete.test.ts
 *
 * Tests the optimistic delete hook contract:
 * - deleteItem stages deletion (sets pendingDeleteId, no service call)
 * - confirmDelete removes from cache optimistically, calls deleteFn
 * - On error: cache is restored and toast is shown
 * - cancelDelete clears pendingDeleteId without calling deleteFn
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useConfirmDelete } from './useConfirmDelete'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { toast } from 'sonner'
const mockToastError = vi.mocked(toast.error)

const TEST_KEY = ['test', 'items'] as const

function createWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: qc }, children)
  )
}

beforeEach(() => vi.clearAllMocks())

describe('useConfirmDelete', () => {
  it('deleteItem sets pendingDeleteId without calling deleteFn', () => {
    const deleteFn = vi.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(
      () => useConfirmDelete(TEST_KEY, deleteFn, 'Failed'),
      { wrapper: createWrapper(qc) }
    )

    act(() => result.current.deleteItem('item-1'))

    expect(result.current.pendingDeleteId).toBe('item-1')
    expect(deleteFn).not.toHaveBeenCalled()
  })

  it('confirmDelete removes item from cache and calls deleteFn', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(TEST_KEY, [{ id: 'item-1' }, { id: 'item-2' }])

    const { result } = renderHook(
      () => useConfirmDelete(TEST_KEY, deleteFn, 'Failed'),
      { wrapper: createWrapper(qc) }
    )

    act(() => result.current.deleteItem('item-1'))
    expect(result.current.pendingDeleteId).toBe('item-1')

    await act(async () => { await result.current.confirmDelete() })

    expect(deleteFn).toHaveBeenCalledWith('item-1')
    expect(result.current.pendingDeleteId).toBeNull()
  })

  it('on deleteFn error: restores cache and shows toast', async () => {
    const deleteFn = vi.fn().mockRejectedValue(new Error('Server error'))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const original = [{ id: 'item-1' }, { id: 'item-2' }]
    qc.setQueryData(TEST_KEY, original)

    const { result } = renderHook(
      () => useConfirmDelete(TEST_KEY, deleteFn, 'Delete failed'),
      { wrapper: createWrapper(qc) }
    )

    act(() => result.current.deleteItem('item-1'))
    await act(async () => { await result.current.confirmDelete() })

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Delete failed'))
    // Cache restored
    const cached = qc.getQueryData<Array<{ id: string }>>(TEST_KEY)
    expect(cached).toEqual(original)
  })

  it('cancelDelete clears pendingDeleteId without calling deleteFn', () => {
    const deleteFn = vi.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { result } = renderHook(
      () => useConfirmDelete(TEST_KEY, deleteFn, 'Failed'),
      { wrapper: createWrapper(qc) }
    )

    act(() => result.current.deleteItem('item-1'))
    expect(result.current.pendingDeleteId).toBe('item-1')

    act(() => result.current.cancelDelete())
    expect(result.current.pendingDeleteId).toBeNull()
    expect(deleteFn).not.toHaveBeenCalled()
  })

  it('confirmDelete is a no-op when pendingDeleteId is null', async () => {
    const deleteFn = vi.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { result } = renderHook(
      () => useConfirmDelete(TEST_KEY, deleteFn, 'Failed'),
      { wrapper: createWrapper(qc) }
    )

    // No deleteItem called first
    await act(async () => { await result.current.confirmDelete() })
    expect(deleteFn).not.toHaveBeenCalled()
  })
})
