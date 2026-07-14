/**
 * ResizablePanel.tsx — Drag-to-resize panel with localStorage persistence.
 *
 * Features:
 * - Pointer event-based drag handle (mousedown/pointermove/pointerup)
 * - Clamped to min/max width bounds
 * - Persists width to localStorage on drag-end (not per pixel)
 * - Rehydrates from localStorage on mount
 * - Collapsible (width → 0 visually, handle still accessible)
 * - Keyboard accessible: arrow keys to resize by 10px increments
 */
import React, { useRef, useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface ResizablePanelProps {
  /** localStorage key for persisting width */
  storageKey: string
  /** Default width in pixels (used if nothing in localStorage) */
  defaultWidth: number
  /** Minimum allowed width in pixels */
  minWidth: number
  /** Maximum allowed width in pixels */
  maxWidth: number
  /** Whether the resize handle is on the 'left' or 'right' edge */
  handleSide: 'left' | 'right'
  /** Whether the panel is currently collapsed */
  collapsed: boolean
  /** Panel content */
  children: React.ReactNode
  /** Additional class names for the outer container */
  className?: string
  /** Called when width changes (for parent layout sync) */
  onWidthChange?: (width: number) => void
}

function readPersistedWidth(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = parseInt(raw, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  } catch { /* localStorage unavailable */ }
  return fallback
}

function persistWidth(key: string, width: number): void {
  try {
    localStorage.setItem(key, String(Math.round(width)))
  } catch { /* localStorage unavailable */ }
}

export function ResizablePanel({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  handleSide,
  collapsed,
  children,
  className,
  onWidthChange,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(() => readPersistedWidth(storageKey, defaultWidth))
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const panelRef = useRef<HTMLDivElement>(null)

  // Rehydrate on mount (handles SSR/test environments where localStorage may differ)
  useEffect(() => {
    const persisted = readPersistedWidth(storageKey, defaultWidth)
    setWidth(persisted)
  }, [storageKey, defaultWidth])

  // Notify parent on width changes
  useEffect(() => {
    if (!collapsed) onWidthChange?.(width)
  }, [width, collapsed, onWidthChange])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    const el = e.target as HTMLElement
    if (el.setPointerCapture) el.setPointerCapture(e.pointerId)
  }, [width])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const delta = handleSide === 'right'
      ? e.clientX - startX.current
      : startX.current - e.clientX
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth.current + delta))
    setWidth(newWidth)
  }, [handleSide, minWidth, maxWidth])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    const el = e.target as HTMLElement
    if (el.releasePointerCapture) el.releasePointerCapture(e.pointerId)
    // Persist on drag-end only (not per pixel)
    persistWidth(storageKey, width)
  }, [storageKey, width])

  // Keyboard resize: arrow keys move by 10px
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let delta = 0
    if (e.key === 'ArrowLeft') delta = handleSide === 'right' ? -10 : 10
    if (e.key === 'ArrowRight') delta = handleSide === 'right' ? 10 : -10
    if (delta === 0) return
    e.preventDefault()
    const newWidth = Math.max(minWidth, Math.min(maxWidth, width + delta))
    setWidth(newWidth)
    persistWidth(storageKey, newWidth)
  }, [width, handleSide, minWidth, maxWidth, storageKey])

  if (collapsed) return null

  return (
    <div
      ref={panelRef}
      className={cn('relative shrink-0 overflow-hidden', className)}
      style={{ width: `${width}px` }}
      data-testid={`resizable-panel-${storageKey}`}
    >
      {children}
      {/* Drag handle */}
      <div
        className={cn(
          'absolute top-0 bottom-0 w-1 cursor-col-resize z-10',
          'hover:bg-blue-400/40 active:bg-blue-500/60 transition-colors',
          handleSide === 'right' ? 'right-0' : 'left-0'
        )}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-label={`Resize ${storageKey} panel`}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        data-testid={`resize-handle-${storageKey}`}
      />
    </div>
  )
}
