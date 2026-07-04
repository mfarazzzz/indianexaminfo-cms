/**
 * BlockRenderer.test.tsx
 *
 * Verifies Property 5: BlockRenderer dispatches to the correct registered
 * component without any switch/case on blockType.
 * Also verifies the safe fallback for unknown block types.
 */
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as fc from 'fast-check'
import { register, _resetForTests } from '@/lib/blocks/blockRegistry'
import { BlockRenderer } from './BlockRenderer'
import type { BlockDefinition } from '@/lib/blocks/blockRegistry'
import type { ModuleBlock } from '@/types/entity'
import { z } from 'zod'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBlock(blockType: string, content: Record<string, unknown> = {}): ModuleBlock {
  return {
    id: 'blk-1', moduleId: 'mod-1', blockType,
    displayOrder: 0, content, isVisible: true,
    createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    deletedAt: null,
  }
}

function makeDef(type: string, editorTestId: string, rendererTestId: string): BlockDefinition {
  return {
    type,
    label: type,
    icon: () => null,
    editor: () => React.createElement('div', { 'data-testid': editorTestId }, `editor:${type}`),
    renderer: () => React.createElement('div', { 'data-testid': rendererTestId }, `renderer:${type}`),
    schema: z.object({}),
    defaultContent: {},
  }
}

beforeEach(() => _resetForTests())

// ── Example tests ─────────────────────────────────────────────────────────────

describe('BlockRenderer — mode=edit', () => {
  it('renders the registered editor for a known block type', () => {
    register(makeDef('heading', 'heading-editor', 'heading-renderer'))
    const block = makeBlock('heading')
    render(<BlockRenderer block={block} mode="edit" />)
    expect(screen.getByTestId('heading-editor')).toBeInTheDocument()
    expect(screen.queryByTestId('heading-renderer')).not.toBeInTheDocument()
  })
})

describe('BlockRenderer — mode=preview', () => {
  it('renders the registered renderer for a known block type', () => {
    register(makeDef('paragraph', 'para-editor', 'para-renderer'))
    const block = makeBlock('paragraph')
    render(<BlockRenderer block={block} mode="preview" />)
    expect(screen.getByTestId('para-renderer')).toBeInTheDocument()
    expect(screen.queryByTestId('para-editor')).not.toBeInTheDocument()
  })
})

describe('BlockRenderer — unknown block type', () => {
  it('renders the fallback placeholder without throwing', () => {
    const block = makeBlock('totally-unknown-type-xyz')
    expect(() => render(<BlockRenderer block={block} mode="preview" />)).not.toThrow()
    // Fallback renderer renders something (doesn't crash)
    expect(document.body.textContent).toContain('totally-unknown-type-xyz')
  })

  it('fallback in edit mode also does not throw', () => {
    const block = makeBlock('another-unknown')
    expect(() => render(<BlockRenderer block={block} mode="edit" />)).not.toThrow()
  })
})

describe('BlockRenderer — no network calls in preview mode', () => {
  it('preview renders from content prop only (no fetch)', () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({} as Response)
    register(makeDef('quote', 'q-editor', 'q-renderer'))
    render(<BlockRenderer block={makeBlock('quote', { type: 'quote', text: 'Hello' })} mode="preview" />)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

// ── Property 5: dispatch correctness (fast-check) ─────────────────────────────

describe('Property 5: BlockRenderer dispatch correctness', () => {
  it('always renders the correct component for registered types', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.constantFrom('edit' as const, 'preview' as const),
        (type, mode) => {
          _resetForTests()
          const editorId = `editor-${type}`
          const rendererId = `renderer-${type}`
          register(makeDef(type, editorId, rendererId))
          const block = makeBlock(type)

          const { unmount } = render(<BlockRenderer block={block} mode={mode} />)
          const expectedId = mode === 'edit' ? editorId : rendererId
          const wrongId = mode === 'edit' ? rendererId : editorId

          const found = !!document.querySelector(`[data-testid="${expectedId}"]`)
          const wrong = !!document.querySelector(`[data-testid="${wrongId}"]`)
          unmount()

          expect(found).toBe(true)
          expect(wrong).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })
})
