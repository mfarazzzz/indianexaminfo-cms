/**
 * useModuleEditor.test.ts — Integration tests for useModuleEditor hook.
 * All service calls mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useModuleEditor } from './useModuleEditor'
import { makeBlock } from '@/__tests__/fixtures'

vi.mock('@/services/entity/blockService', () => ({
  listBlocks:             vi.fn(),
  createBlock:            vi.fn(),
  updateBlock:            vi.fn(),
  updateBlockVisibility:  vi.fn(),
  softDeleteBlock:        vi.fn(),
  reorderBlocks:          vi.fn(),
  duplicateBlock:         vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import {
  listBlocks, createBlock, softDeleteBlock,
} from '@/services/entity/blockService'

const mockList   = vi.mocked(listBlocks)
const mockCreate = vi.mocked(createBlock)
const mockDelete = vi.mocked(softDeleteBlock)

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('useModuleEditor', () => {
  it('starts loading then returns blocks', async () => {
    const blocks = [makeBlock({ id: 'blk-1' }), makeBlock({ id: 'blk-2' })]
    mockList.mockResolvedValue(blocks)
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useModuleEditor('mod-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.blocks).toHaveLength(2)
  })

  it('createBlock invalidates query on success', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue(makeBlock({ id: 'new-blk' }))
    const { wrapper, qc } = createWrapper()
    const { result } = renderHook(() => useModuleEditor('mod-1'), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const spy = vi.spyOn(qc, 'invalidateQueries')

    await act(async () => {
      await result.current.createBlock('heading', { type: 'heading', level: 2, text: '' })
    })

    expect(mockCreate).toHaveBeenCalledWith('mod-1', 'heading', expect.any(Object), 0)
    expect(spy).toHaveBeenCalled()
  })

  it('deleteBlock sets pendingDeleteId, confirmDelete calls service', async () => {
    mockList.mockResolvedValue([makeBlock({ id: 'blk-1' })])
    mockDelete.mockResolvedValue(undefined)
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useModuleEditor('mod-1'), { wrapper })

    await waitFor(() => expect(result.current.blocks).toHaveLength(1))

    act(() => result.current.deleteBlock('blk-1'))
    expect(result.current.pendingDeleteId).toBe('blk-1')
    expect(mockDelete).not.toHaveBeenCalled()

    await act(async () => { await result.current.confirmDelete() })
    expect(mockDelete).toHaveBeenCalledWith('blk-1')
  })

  it('optimistic delete rollback on error', async () => {
    const blocks = [makeBlock({ id: 'blk-1' })]
    mockList.mockResolvedValue(blocks)
    mockDelete.mockRejectedValue(new Error('Delete failed'))
    const { wrapper, qc } = createWrapper()
    qc.setQueryData(['modules', 'detail', 'mod-1', 'blocks'], blocks)
    const { result } = renderHook(() => useModuleEditor('mod-1'), { wrapper })

    await waitFor(() => expect(result.current.blocks).toHaveLength(1))
    act(() => result.current.deleteBlock('blk-1'))
    await act(async () => { await result.current.confirmDelete() })

    await waitFor(() => {
      const cached = qc.getQueryData<typeof blocks>(['modules', 'detail', 'mod-1', 'blocks'])
      expect(cached).toEqual(blocks)
    })
  })

  it('cancelDelete clears pendingDeleteId without calling service', async () => {
    mockList.mockResolvedValue([makeBlock({ id: 'blk-1' })])
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useModuleEditor('mod-1'), { wrapper })

    await waitFor(() => expect(result.current.blocks).toHaveLength(1))
    act(() => result.current.deleteBlock('blk-1'))
    act(() => result.current.cancelDelete())
    expect(result.current.pendingDeleteId).toBeNull()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
