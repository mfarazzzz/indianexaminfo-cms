/**
 * blockRegistry.ts — Module-level singleton for the Content OS block plugin system.
 *
 * Design: plain Map (not React context), synchronously readable at render time.
 * Adding a new block type requires ONE call to `register()` — zero changes to
 * BlockRenderer, ModuleEditor, or any shared component.
 *
 * Architecture: ARCHITECTURE.md §8.1–8.3
 */
import React from 'react'
import type { ZodTypeAny } from 'zod'
import { z } from 'zod'
import { AlertCircle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BlockEditorProps {
  content: Record<string, unknown>
  onChange: (content: Record<string, unknown>) => void
}

export interface BlockRendererProps {
  content: Record<string, unknown>
}

export interface BlockDefinition {
  type: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  editor: React.ComponentType<BlockEditorProps>
  renderer: React.ComponentType<BlockRendererProps>
  schema: ZodTypeAny
  defaultContent: Record<string, unknown>
  /** Optional: returns a one-line summary for the collapsed BlockCard view */
  summary?: (content: Record<string, unknown>) => string
}

// ── Fallback definition (returned for unknown block types) ─────────────────────

const UnknownEditor: React.FC<BlockEditorProps> = ({ content }) =>
  React.createElement('div', { className: 'rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800' },
    `Unknown block type: "${(content as Record<string,unknown>).type ?? 'unknown'}". This block cannot be edited.`
  )
UnknownEditor.displayName = 'UnknownBlockEditor'

const UnknownRenderer: React.FC<BlockRendererProps> = ({ content }) => {
  const type = (content as Record<string,unknown>).__blockType as string ?? (content as Record<string,unknown>).type as string ?? 'unknown'
  return React.createElement('div', { className: 'rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-400' },
    `[Unknown block: ${type}]`
  )
}
UnknownRenderer.displayName = 'UnknownBlockRenderer'

const FALLBACK: BlockDefinition = {
  type: '__unknown__',
  label: 'Unknown Block',
  icon: AlertCircle,
  editor: UnknownEditor,
  renderer: UnknownRenderer,
  schema: z.object({}).passthrough(),
  defaultContent: {},
}

// ── Registry singleton ────────────────────────────────────────────────────────

const _registry = new Map<string, BlockDefinition>()

/** Register a block type. Overwrites silently if the type already exists. */
export function register(definition: BlockDefinition): void {
  _registry.set(definition.type, definition)
}

/**
 * Get a block definition by type.
 * Returns the safe fallback for unknown types — NEVER throws, NEVER returns undefined.
 */
export function get(blockType: string): BlockDefinition {
  return _registry.get(blockType) ?? FALLBACK
}

/**
 * Returns all registered definitions (excluding the internal fallback).
 * Used by AddBlockMenu to build the block palette.
 */
export function getAll(): BlockDefinition[] {
  return Array.from(_registry.values())
}

/** Returns true if the block type is registered. */
export function has(blockType: string): boolean {
  return _registry.has(blockType)
}

/**
 * FOR TEST USE ONLY — not part of the public API.
 * Resets the registry to prevent test pollution between test files.
 */
export function _resetForTests(): void {
  _registry.clear()
}
