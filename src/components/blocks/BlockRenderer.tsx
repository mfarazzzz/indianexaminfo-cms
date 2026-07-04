/**
 * BlockRenderer — Generic dispatch component.
 *
 * Zero switch/case. Zero if/else on blockType.
 * All dispatch goes through blockRegistry.get(block.blockType).
 *
 * Architecture: ARCHITECTURE.md §2.1, §8.2
 */
import React from 'react'
import { get } from '@/lib/blocks/blockRegistry'
import type { ModuleBlock } from '@/types/entity'

interface BlockRendererProps {
  block: ModuleBlock
  mode: 'edit' | 'preview'
  onContentChange?: (content: Record<string, unknown>) => void
}

const noop = () => {}

export function BlockRenderer({ block, mode, onContentChange }: BlockRendererProps) {
  const def = get(block.blockType)
  const Component = mode === 'edit' ? def.editor : def.renderer
  const content = { ...block.content as Record<string, unknown>, __blockType: block.blockType }
  return (
    <Component
      content={content}
      onChange={onContentChange ?? noop}
    />
  )
}
