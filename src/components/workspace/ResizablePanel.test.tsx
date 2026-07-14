/**
 * ResizablePanel.test.tsx — Tests for drag-to-resize and localStorage persistence.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ResizablePanel } from './ResizablePanel'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('ResizablePanel', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('renders children at default width when no localStorage value', () => {
    render(
      <ResizablePanel
        storageKey="test-panel"
        defaultWidth={250}
        minWidth={100}
        maxWidth={500}
        handleSide="right"
        collapsed={false}
      >
        <div>Content</div>
      </ResizablePanel>
    )
    const panel = screen.getByTestId('resizable-panel-test-panel')
    expect(panel.style.width).toBe('250px')
  })

  it('rehydrates width from localStorage on mount', () => {
    localStorageMock.setItem('test-panel', '320')
    render(
      <ResizablePanel
        storageKey="test-panel"
        defaultWidth={250}
        minWidth={100}
        maxWidth={500}
        handleSide="right"
        collapsed={false}
      >
        <div>Content</div>
      </ResizablePanel>
    )
    const panel = screen.getByTestId('resizable-panel-test-panel')
    expect(panel.style.width).toBe('320px')
  })

  it('renders nothing when collapsed', () => {
    render(
      <ResizablePanel
        storageKey="test-panel"
        defaultWidth={250}
        minWidth={100}
        maxWidth={500}
        handleSide="right"
        collapsed={true}
      >
        <div data-testid="child">Content</div>
      </ResizablePanel>
    )
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
  })

  it('renders a drag handle with role="separator"', () => {
    render(
      <ResizablePanel
        storageKey="test-panel"
        defaultWidth={250}
        minWidth={100}
        maxWidth={500}
        handleSide="right"
        collapsed={false}
      >
        <div>Content</div>
      </ResizablePanel>
    )
    const handle = screen.getByRole('separator')
    expect(handle).toBeInTheDocument()
    expect(handle).toHaveAttribute('aria-valuenow', '250')
    expect(handle).toHaveAttribute('aria-valuemin', '100')
    expect(handle).toHaveAttribute('aria-valuemax', '500')
  })

  it('persists width to localStorage on pointer up (drag end)', () => {
    render(
      <ResizablePanel
        storageKey="test-panel"
        defaultWidth={250}
        minWidth={100}
        maxWidth={500}
        handleSide="right"
        collapsed={false}
      >
        <div>Content</div>
      </ResizablePanel>
    )
    const handle = screen.getByTestId('resize-handle-test-panel')

    // Simulate drag: down → move → up
    fireEvent.pointerDown(handle, { clientX: 250, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 300 }) // +50px
    fireEvent.pointerUp(handle, { pointerId: 1 })

    expect(localStorageMock.getItem('test-panel')).toBe('300')
  })

  it('clamps width to minWidth', () => {
    render(
      <ResizablePanel
        storageKey="test-panel"
        defaultWidth={250}
        minWidth={150}
        maxWidth={500}
        handleSide="right"
        collapsed={false}
      >
        <div>Content</div>
      </ResizablePanel>
    )
    const handle = screen.getByTestId('resize-handle-test-panel')

    fireEvent.pointerDown(handle, { clientX: 250, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 50 }) // -200px → would be 50px, clamped to 150
    fireEvent.pointerUp(handle, { pointerId: 1 })

    expect(localStorageMock.getItem('test-panel')).toBe('150')
  })

  it('clamps width to maxWidth', () => {
    render(
      <ResizablePanel
        storageKey="test-panel"
        defaultWidth={250}
        minWidth={100}
        maxWidth={400}
        handleSide="right"
        collapsed={false}
      >
        <div>Content</div>
      </ResizablePanel>
    )
    const handle = screen.getByTestId('resize-handle-test-panel')

    fireEvent.pointerDown(handle, { clientX: 250, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 600 }) // +350px → would be 600px, clamped to 400
    fireEvent.pointerUp(handle, { pointerId: 1 })

    expect(localStorageMock.getItem('test-panel')).toBe('400')
  })

  it('supports keyboard resize with arrow keys', () => {
    render(
      <ResizablePanel
        storageKey="test-panel"
        defaultWidth={250}
        minWidth={100}
        maxWidth={500}
        handleSide="right"
        collapsed={false}
      >
        <div>Content</div>
      </ResizablePanel>
    )
    const handle = screen.getByTestId('resize-handle-test-panel')

    // Focus handle and press ArrowRight (+10px for right-side handle)
    handle.focus()
    fireEvent.keyDown(handle, { key: 'ArrowRight' })

    expect(localStorageMock.getItem('test-panel')).toBe('260')
  })

  it('calls onWidthChange callback when width changes', () => {
    const onWidthChange = vi.fn()
    render(
      <ResizablePanel
        storageKey="test-panel"
        defaultWidth={250}
        minWidth={100}
        maxWidth={500}
        handleSide="right"
        collapsed={false}
        onWidthChange={onWidthChange}
      >
        <div>Content</div>
      </ResizablePanel>
    )
    expect(onWidthChange).toHaveBeenCalledWith(250)
  })
})
