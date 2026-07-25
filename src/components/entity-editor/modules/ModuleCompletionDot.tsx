/**
 * ModuleCompletionDot — Visual indicator for module content state.
 * Three mutually exclusive states: empty (grey dot), filled (blue dot), published (green checkmark).
 * Precedence: published > filled > empty. (Req 12.1–12.5)
 */
import React from 'react'
import { Check } from 'lucide-react'
import type { EntityModule, ModuleBlock } from '@/types/entity'

interface ModuleCompletionDotProps {
  module: EntityModule
  blocks: ModuleBlock[]
}

type CompletionState = 'empty' | 'filled' | 'published'

function getCompletionState(module: EntityModule, blocks: ModuleBlock[]): CompletionState {
  // Precedence: published > filled > empty
  if (module.workflowStatus === 'published') return 'published'

  // Check if any visible, non-deleted block has non-empty content
  const hasContent = blocks.some(block => {
    if (block.deletedAt) return false
    if (!block.isVisible) return false
    const content = block.content
    if (!content || typeof content !== 'object') return false

    // Check all string values in content for non-whitespace
    return Object.values(content).some(val => {
      if (typeof val === 'string') return val.trim().length > 0
      if (Array.isArray(val)) return val.length > 0
      if (typeof val === 'object' && val !== null) return Object.keys(val).length > 0
      return false
    })
  })

  return hasContent ? 'filled' : 'empty'
}

export function ModuleCompletionDot({ module, blocks }: ModuleCompletionDotProps) {
  const state = getCompletionState(module, blocks)

  if (state === 'published') {
    return (
      <span className="inline-flex items-center justify-center h-4 w-4" title="Published" aria-label="Module published">
        <Check className="h-3.5 w-3.5 text-green-600" />
      </span>
    )
  }

  if (state === 'filled') {
    return (
      <span
        className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500"
        title="Has content"
        aria-label="Module has content"
      />
    )
  }

  // empty
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full border-2 border-slate-300 bg-transparent"
      title="Empty"
      aria-label="Module is empty"
    />
  )
}
