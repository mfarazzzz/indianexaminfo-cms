/**
 * inspectorRegistry.test.ts — Tests for the Inspector Registry.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Inspector Registry', () => {
  let registerInspector: typeof import('./inspectorRegistry').registerInspector
  let getInspector: typeof import('./inspectorRegistry').getInspector
  let hasInspector: typeof import('./inspectorRegistry').hasInspector
  let getAllInspectors: typeof import('./inspectorRegistry').getAllInspectors

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('./inspectorRegistry')
    registerInspector = mod.registerInspector
    getInspector = mod.getInspector
    hasInspector = mod.hasInspector
    getAllInspectors = mod.getAllInspectors
  })

  it('registers and retrieves an inspector by module key', () => {
    const component = () => null
    registerInspector({
      moduleKey: 'timeline',
      component: component as any,
      widgets: [],
      actions: [],
    })
    const def = getInspector('timeline')
    expect(def).toBeDefined()
    expect(def!.moduleKey).toBe('timeline')
    expect(def!.component).toBe(component)
  })

  it('returns undefined for unregistered keys', () => {
    expect(getInspector('general')).toBeUndefined()
  })

  it('hasInspector returns correct boolean', () => {
    registerInspector({
      moduleKey: 'seo',
      component: (() => null) as any,
      widgets: [],
      actions: [],
    })
    expect(hasInspector('seo')).toBe(true)
    expect(hasInspector('nonexistent')).toBe(false)
  })

  it('getAllInspectors returns all registered definitions', () => {
    registerInspector({ moduleKey: 'general', component: (() => null) as any, widgets: [], actions: [] })
    registerInspector({ moduleKey: 'seo', component: (() => null) as any, widgets: [], actions: [] })
    expect(getAllInspectors()).toHaveLength(2)
  })

  it('supports widgets and actions in the definition', () => {
    const widget = { key: 'w1', label: 'Widget', component: (() => null) as any, order: 1 }
    const action = { key: 'a1', label: 'Action', variant: 'primary' as const, handler: 'publish', order: 1 }
    registerInspector({
      moduleKey: 'publishing',
      component: (() => null) as any,
      widgets: [widget],
      actions: [action],
    })
    const def = getInspector('publishing')
    expect(def!.widgets).toHaveLength(1)
    expect(def!.actions).toHaveLength(1)
    expect(def!.widgets[0].key).toBe('w1')
    expect(def!.actions[0].handler).toBe('publish')
  })
})
