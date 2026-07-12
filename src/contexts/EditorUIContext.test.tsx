/**
 * EditorUIContext.test.tsx
 *
 * Regression tests for the tab-switch state-loss bug.
 *
 * Verifies that:
 *  - activeTab state survives across multiple tab switches
 *  - dirty tracking survives tab switches
 *  - clearDirty does NOT clear other tabs
 *  - the provider does not reset state on re-render
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { EditorUIProvider, useEditorUI } from './EditorUIContext'

function wrapper({ children }: { children: React.ReactNode }) {
  return <EditorUIProvider defaultTab="general">{children}</EditorUIProvider>
}

describe('EditorUIContext — tab switching', () => {
  it('starts on the defaultTab', () => {
    const { result } = renderHook(() => useEditorUI(), { wrapper })
    expect(result.current.state.activeTab).toBe('general')
  })

  it('preserves activeTab after multiple switches', () => {
    const { result } = renderHook(() => useEditorUI(), { wrapper })

    act(() => result.current.setActiveTab('timeline'))
    expect(result.current.state.activeTab).toBe('timeline')

    act(() => result.current.setActiveTab('seo'))
    expect(result.current.state.activeTab).toBe('seo')

    // Switching back must not reset to default
    act(() => result.current.setActiveTab('general'))
    expect(result.current.state.activeTab).toBe('general')
  })

  it('marks and reads dirty state per tab independently', () => {
    const { result } = renderHook(() => useEditorUI(), { wrapper })

    act(() => result.current.markDirty('general'))
    expect(result.current.isTabDirty('general')).toBe(true)
    expect(result.current.isTabDirty('timeline')).toBe(false)

    act(() => result.current.markDirty('timeline'))
    expect(result.current.isTabDirty('general')).toBe(true)
    expect(result.current.isTabDirty('timeline')).toBe(true)
  })

  it('clearDirty only clears the targeted tab', () => {
    const { result } = renderHook(() => useEditorUI(), { wrapper })

    act(() => {
      result.current.markDirty('general')
      result.current.markDirty('seo')
    })

    act(() => result.current.clearDirty('general'))

    expect(result.current.isTabDirty('general')).toBe(false)
    expect(result.current.isTabDirty('seo')).toBe(true)
  })

  it('clearAllDirty clears every tab', () => {
    const { result } = renderHook(() => useEditorUI(), { wrapper })

    act(() => {
      result.current.markDirty('general')
      result.current.markDirty('timeline')
      result.current.markDirty('seo')
    })

    act(() => result.current.clearAllDirty())

    expect(result.current.isTabDirty('general')).toBe(false)
    expect(result.current.isTabDirty('timeline')).toBe(false)
    expect(result.current.isTabDirty('seo')).toBe(false)
  })

  it('dirty state is preserved while switching tabs', () => {
    const { result } = renderHook(() => useEditorUI(), { wrapper })

    // Simulate user edits General then switches to Timeline
    act(() => result.current.markDirty('general'))
    act(() => result.current.setActiveTab('timeline'))

    // General is still dirty even though we left it
    expect(result.current.isTabDirty('general')).toBe(true)
    expect(result.current.state.activeTab).toBe('timeline')

    // Switch back — dirty flag must still be there
    act(() => result.current.setActiveTab('general'))
    expect(result.current.isTabDirty('general')).toBe(true)
  })

  it('provider does not reset state on parent re-render', () => {
    // Renders the provider with a counter prop that changes to trigger re-render
    function CounterWrapper({ count, children }: { count: number; children: React.ReactNode }) {
      return (
        <EditorUIProvider defaultTab="general">
          <span data-testid="count">{count}</span>
          {children}
        </EditorUIProvider>
      )
    }

    const { result, rerender } = renderHook(() => useEditorUI(), {
      wrapper: ({ children }) => <CounterWrapper count={1}>{children}</CounterWrapper>,
    })

    act(() => {
      result.current.setActiveTab('seo')
      result.current.markDirty('seo')
    })

    // Trigger a re-render of the wrapper (simulates a parent state change)
    rerender()

    expect(result.current.state.activeTab).toBe('seo')
    expect(result.current.isTabDirty('seo')).toBe(true)
  })
})
