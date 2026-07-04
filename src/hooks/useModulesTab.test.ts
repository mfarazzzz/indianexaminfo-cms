/**
 * useModulesTab.test.ts — Integration tests for useModulesTab hook.
 * All service calls mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useModulesTab } from './useModulesTab'
import { makeModule } from '@/__tests__/fixtures'

vi.mock('@/services/entity/moduleService', () => ({
  listModules:     vi.fn(),
  createModule:    vi.fn(),
  updateModule:    vi.fn(),
  softDeleteModule: vi.fn(),
  reorderModules:  vi.fn(),
  publishModule:   vi.fn(),
  duplicateModule: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import {
  listModules, createModule, softDeleteModule,
} from '@/services/entity/moduleService'

const mockList   = vi.mocked(listModules)
const mockCreate = vi.mocked(createModule)
const mockDelete = vi.mocked(softDeleteModule)

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('useModulesTab', () => {
  it('starts in loading state then shows modules', async () => {
    const modules = [makeModule({ id: 'mod-1' }), makeModule({ id: 'mod-2' })]
    mockList.mockResolvedValue(modules)
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useModulesTab('ent-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.modules).toHaveLength(2)
    expect(result.current.modules[0].id).toBe('mod-1')
  })

  it('createModule invalidates query on success', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue(makeModule({ id: 'new-mod' }))
    const { wrapper, qc } = createWrapper()
    const { result } = renderHook(() => useModulesTab('ent-1'), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    await act(async () => {
      await result.current.createModule({
        moduleType: 'overview', displayOrder: 0, workflowStatus: 'draft', isFeatured: false, tags: [],
      })
    })

    expect(mockCreate).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalled()
  })

  it('createModule captures error message in createError', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockRejectedValue(new Error('A sub-title is required'))
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useModulesTab('ent-1'), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.createModule({
        moduleType: 'overview', displayOrder: 0, workflowStatus: 'draft', isFeatured: false, tags: [],
      })
    })

    await waitFor(() => expect(result.current.createError).toContain('sub-title'))
  })

  it('deleteItem sets pendingDeleteId, confirmDelete calls service', async () => {
    const modules = [makeModule({ id: 'mod-1' })]
    mockList.mockResolvedValue(modules)
    mockDelete.mockResolvedValue(undefined)
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useModulesTab('ent-1'), { wrapper })

    await waitFor(() => expect(result.current.modules).toHaveLength(1))

    act(() => result.current.deleteModule('mod-1'))
    expect(result.current.pendingDeleteId).toBe('mod-1')
    expect(mockDelete).not.toHaveBeenCalled()

    await act(async () => { await result.current.confirmDelete() })
    expect(mockDelete).toHaveBeenCalledWith('mod-1')
  })

  it('confirmDelete rollback on service error', async () => {
    const modules = [makeModule({ id: 'mod-1' })]
    mockList.mockResolvedValue(modules)
    mockDelete.mockRejectedValue(new Error('Delete failed'))
    const { wrapper, qc } = createWrapper()
    qc.setQueryData(['entities', 'detail', 'ent-1', 'modules'], modules)
    const { result } = renderHook(() => useModulesTab('ent-1'), { wrapper })

    await waitFor(() => expect(result.current.modules).toHaveLength(1))
    act(() => result.current.deleteModule('mod-1'))
    await act(async () => { await result.current.confirmDelete() })

    await waitFor(() => {
      const cached = qc.getQueryData<typeof modules>(['entities', 'detail', 'ent-1', 'modules'])
      expect(cached).toEqual(modules)
    })
  })

  it('cancelDelete clears pendingDeleteId without calling service', async () => {
    mockList.mockResolvedValue([makeModule({ id: 'mod-1' })])
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useModulesTab('ent-1'), { wrapper })

    await waitFor(() => expect(result.current.modules).toHaveLength(1))
    act(() => result.current.deleteModule('mod-1'))
    act(() => result.current.cancelDelete())
    expect(result.current.pendingDeleteId).toBeNull()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
