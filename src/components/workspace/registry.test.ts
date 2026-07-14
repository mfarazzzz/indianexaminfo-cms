/**
 * registry.test.ts — Tests for the Workspace Module Registry.
 *
 * Covers: registration, resolution, unknown keys, group filtering, hasModule type guard.
 */
import { describe, it, expect, beforeEach } from 'vitest'

// We need to reset registry state between tests. The registry uses a module-level Map,
// so we re-import fresh for each describe block using dynamic import.

describe('Workspace Module Registry', () => {
  // Use the actual module — register and query
  let registerModule: typeof import('./registry').registerModule
  let getModule: typeof import('./registry').getModule
  let getAllModules: typeof import('./registry').getAllModules
  let hasModule: typeof import('./registry').hasModule
  let getModulesByGroup: typeof import('./registry').getModulesByGroup

  beforeEach(async () => {
    // Clear the module cache to get a fresh registry per test
    vi.resetModules()
    const mod = await import('./registry')
    registerModule = mod.registerModule
    getModule = mod.getModule
    getAllModules = mod.getAllModules
    hasModule = mod.hasModule
    getModulesByGroup = mod.getModulesByGroup
  })

  it('registers a module and retrieves it by key', () => {
    registerModule({
      key: 'timeline',
      label: 'Timeline',
      icon: 'Calendar',
      group: 'structured',
      defaultOrder: 3,
      editor: () => Promise.resolve({ default: () => null }),
      inspector: null,
      permission: null,
      hasHealthWidget: true,
    })
    const mod = getModule('timeline')
    expect(mod).toBeDefined()
    expect(mod!.label).toBe('Timeline')
    expect(mod!.group).toBe('structured')
    expect(mod!.hasHealthWidget).toBe(true)
  })

  it('returns undefined for unregistered keys', () => {
    expect(getModule('general')).toBeUndefined()
  })

  it('getAllModules returns all registered modules', () => {
    registerModule({
      key: 'general', label: 'General', icon: 'FileText', group: 'identity',
      defaultOrder: 1, editor: () => Promise.resolve({ default: () => null }),
      inspector: null, permission: null, hasHealthWidget: false,
    })
    registerModule({
      key: 'seo', label: 'SEO', icon: 'Search', group: 'workflow',
      defaultOrder: 14, editor: () => Promise.resolve({ default: () => null }),
      inspector: null, permission: 'manage_entity_seo', hasHealthWidget: true,
    })
    expect(getAllModules()).toHaveLength(2)
  })

  it('hasModule returns true for registered keys', () => {
    registerModule({
      key: 'fee', label: 'Fees', icon: 'IndianRupee', group: 'structured',
      defaultOrder: 6, editor: () => Promise.resolve({ default: () => null }),
      inspector: null, permission: null, hasHealthWidget: false,
    })
    expect(hasModule('fee')).toBe(true)
    expect(hasModule('nonexistent')).toBe(false)
  })

  it('getModulesByGroup filters and sorts by defaultOrder', () => {
    registerModule({
      key: 'syllabus', label: 'Syllabus', icon: 'Book', group: 'structured',
      defaultOrder: 9, editor: () => Promise.resolve({ default: () => null }),
      inspector: null, permission: null, hasHealthWidget: false,
    })
    registerModule({
      key: 'eligibility', label: 'Eligibility', icon: 'UserCheck', group: 'structured',
      defaultOrder: 4, editor: () => Promise.resolve({ default: () => null }),
      inspector: null, permission: null, hasHealthWidget: false,
    })
    registerModule({
      key: 'seo', label: 'SEO', icon: 'Search', group: 'workflow',
      defaultOrder: 14, editor: () => Promise.resolve({ default: () => null }),
      inspector: null, permission: null, hasHealthWidget: true,
    })
    const structured = getModulesByGroup('structured')
    expect(structured).toHaveLength(2)
    expect(structured[0].key).toBe('eligibility') // order 4 before 9
    expect(structured[1].key).toBe('syllabus')
  })

  it('overwrites existing registration for the same key', () => {
    registerModule({
      key: 'general', label: 'General v1', icon: 'FileText', group: 'identity',
      defaultOrder: 1, editor: () => Promise.resolve({ default: () => null }),
      inspector: null, permission: null, hasHealthWidget: false,
    })
    registerModule({
      key: 'general', label: 'General v2', icon: 'FileText', group: 'identity',
      defaultOrder: 1, editor: () => Promise.resolve({ default: () => null }),
      inspector: null, permission: null, hasHealthWidget: false,
    })
    expect(getModule('general')!.label).toBe('General v2')
    expect(getAllModules()).toHaveLength(1)
  })

  it('inspector field is nullable for modules without custom inspectors', () => {
    registerModule({
      key: 'vacancy', label: 'Vacancy', icon: 'Users', group: 'structured',
      defaultOrder: 5, editor: () => Promise.resolve({ default: () => null }),
      inspector: null, permission: null, hasHealthWidget: false,
    })
    expect(getModule('vacancy')!.inspector).toBeNull()
  })

  it('inspector field accepts a lazy loader function', () => {
    const inspectorLoader = () => Promise.resolve({ default: () => null })
    registerModule({
      key: 'timeline', label: 'Timeline', icon: 'Calendar', group: 'structured',
      defaultOrder: 3, editor: () => Promise.resolve({ default: () => null }),
      inspector: inspectorLoader, permission: null, hasHealthWidget: true,
    })
    expect(getModule('timeline')!.inspector).toBe(inspectorLoader)
  })
})

// Need vi for resetModules
import { vi } from 'vitest'
