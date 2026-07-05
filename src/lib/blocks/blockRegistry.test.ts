/**
 * blockRegistry.test.ts
 *
 * Unit tests for the block registry singleton.
 * No React rendering needed — the registry is pure JS.
 *
 * Includes:
 *  - Example-based tests for register/get/getAll/has
 *  - Property 2: schema.parse(defaultContent) never throws for all core types
 *  - Property 4: getAll returns all registered with required fields (fast-check)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import React from 'react'
import { z } from 'zod'
import {
  register, get, getAll, has, _resetForTests,
  type BlockDefinition,
} from './blockRegistry'
import { registerCoreBlocks } from './coreBlocks'

// ── Helpers ───────────────────────────────────────────────────────────────────

const noop = () => {}
const NoopComponent: React.FC<Record<string, unknown>> = () => null

function makeDef(type: string): BlockDefinition {
  return {
    type,
    label: `Label for ${type}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: NoopComponent as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor: NoopComponent as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderer: NoopComponent as any,
    schema: z.object({ type: z.literal(type) }),
    defaultContent: { type },
  }
}

beforeEach(() => _resetForTests())

// ── Basic API ─────────────────────────────────────────────────────────────────

describe('register / get round-trip', () => {
  it('get returns the definition that was registered', () => {
    const def = makeDef('heading')
    register(def)
    const result = get('heading')
    expect(result.type).toBe('heading')
    expect(result.label).toBe('Label for heading')
  })

  it('overwriting same type replaces and does not throw', () => {
    register(makeDef('heading'))
    const def2 = { ...makeDef('heading'), label: 'Updated Heading' }
    expect(() => register(def2)).not.toThrow()
    expect(get('heading').label).toBe('Updated Heading')
  })
})

describe('get — unregistered type', () => {
  it('returns fallback definition (never throws, never undefined)', () => {
    const result = get('nonexistent-block-xyz')
    expect(result).toBeDefined()
    expect(result.type).toBe('__unknown__')
  })

  it('fallback editor and renderer are callable React components', () => {
    const fallback = get('unknown-type')
    expect(typeof fallback.editor).toBe('function')
    expect(typeof fallback.renderer).toBe('function')
  })
})

describe('has', () => {
  it('returns true for registered type', () => {
    register(makeDef('paragraph'))
    expect(has('paragraph')).toBe(true)
  })

  it('returns false for unregistered type', () => {
    expect(has('not-registered')).toBe(false)
  })
})

describe('getAll', () => {
  it('returns all registered definitions (excludes fallback)', () => {
    register(makeDef('heading'))
    register(makeDef('paragraph'))
    const all = getAll()
    expect(all).toHaveLength(2)
    expect(all.map(d => d.type)).not.toContain('__unknown__')
  })

  it('returns empty array when nothing is registered', () => {
    expect(getAll()).toEqual([])
  })
})

// ── Property 2: schema.parse(defaultContent) succeeds for all core types ──────

describe('Property 2: default content round-trip', () => {
  it('schema.parse(defaultContent) never throws for all 14 core block types', () => {
    registerCoreBlocks()
    const defs = getAll()
    expect(defs.length).toBeGreaterThanOrEqual(14)

    for (const def of defs) {
      expect(
        () => def.schema.parse(def.defaultContent),
        `schema.parse(defaultContent) threw for block type "${def.type}"`
      ).not.toThrow()
    }
  })
})

// ── Property 4: registry completeness (fast-check) ───────────────────────────

describe('Property 4: registry completeness', () => {
  it('getAll returns all registered types with required fields', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 15 }),
        (types) => {
          _resetForTests()
          for (const t of types) register(makeDef(t))

          const all = getAll()
          const registeredTypes = new Set(all.map(d => d.type))

          for (const t of types) {
            expect(registeredTypes.has(t)).toBe(true)
          }
          // No fallback in getAll
          expect(registeredTypes.has('__unknown__')).toBe(false)
          // Every definition has required fields
          for (const def of all) {
            expect(def).toHaveProperty('type')
            expect(def).toHaveProperty('label')
            expect(def).toHaveProperty('schema')
            expect(def).toHaveProperty('defaultContent')
            expect(def).toHaveProperty('editor')
            expect(def).toHaveProperty('renderer')
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
