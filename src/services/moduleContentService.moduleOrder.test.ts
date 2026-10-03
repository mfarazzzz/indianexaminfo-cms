/**
 * moduleContentService.moduleOrder.test.ts — R0.3 invariant.
 *
 * Pins the owner-approved rule: whenever a module is saved WITH content, its
 * slug must be present in _config.moduleOrder. The frontend editorial block
 * builds its render list FROM moduleOrder (EntityDetailPage ContentModulesBlock:
 * order = config.moduleOrder ?? Object.keys) — a slug missing from moduleOrder
 * is HIDDEN on the site even when enabled. So content ⇒ in moduleOrder, always.
 *
 * Also pins: saveModuleContent never reorders, never removes, and never
 * touches enabledModules (the per-module toggle is the editor's decision).
 * All Supabase calls are mocked — no network required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ db: { from: vi.fn() } }))
vi.mock('@/lib/revalidate', () => ({ revalidateExams: vi.fn().mockResolvedValue(undefined) }))

import { db } from '@/lib/supabase/client'
import { saveModuleContent, toggleModuleEnabled } from './moduleContentService'

const mockFrom = vi.mocked(db.from)

/**
 * Install a chain over a row whose content_modules is `contentModules`.
 * Captures the payload of every update() call.
 */
function installChain(contentModules: Record<string, unknown>) {
  const updated: Record<string, unknown>[] = []
  mockFrom.mockImplementation(() => {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq']) chain[m] = vi.fn(() => chain)
    chain.single = vi.fn().mockResolvedValue({ data: { content_modules: contentModules }, error: null })
    chain.update = vi.fn((payload: Record<string, unknown>) => {
      updated.push(payload)
      return chain
    })
    return chain as never
  })
  return updated
}

beforeEach(() => vi.clearAllMocks())

describe('saveModuleContent — R0.3: content ⇒ slug present in moduleOrder', () => {
  it('appends the slug when moduleOrder does not contain it', async () => {
    const updated = installChain({
      overview: { body: 'x' },
      _config: { moduleOrder: ['overview'], enabledModules: ['overview'] },
    })
    await saveModuleContent('ed-1', 'exam-pattern', { body: 'y' }, 'user-1')

    expect(updated).toHaveLength(1)
    const written = updated[0].content_modules as Record<string, any>
    expect(written._config.moduleOrder).toEqual(['overview', 'exam-pattern'])
    // enabledModules untouched — save is not an enable action.
    expect(written._config.enabledModules).toEqual(['overview'])
    // Existing module content untouched (merge, not replace).
    expect(written.overview).toEqual({ body: 'x' })
  })

  it('leaves moduleOrder verbatim when the slug is already present (no reorder, no dupe)', async () => {
    const updated = installChain({
      _config: { moduleOrder: ['overview', 'exam-pattern'], enabledModules: [] },
    })
    await saveModuleContent('ed-1', 'exam-pattern', { body: 'z' }, 'user-1')

    const written = updated[0].content_modules as Record<string, any>
    expect(written._config.moduleOrder).toEqual(['overview', 'exam-pattern'])
  })

  it('creates a _config with the slug when the edition has none', async () => {
    const updated = installChain({ news: { items: [{ title: 'T' }] } })
    await saveModuleContent('ed-1', 'news', { items: [{ title: 'T2' }] }, 'user-1')

    const written = updated[0].content_modules as Record<string, any>
    expect(written._config.moduleOrder).toEqual(['news'])
    expect(written._config.enabledModules).toEqual([])
  })
})

describe('toggleModuleEnabled — enable keeps the moduleOrder invariant', () => {
  it('appends the slug to moduleOrder when enabling a module absent from it', async () => {
    const updated = installChain({
      _config: { moduleOrder: ['overview'], enabledModules: ['overview'] },
    })
    const config = await toggleModuleEnabled('ed-1', 'cut-off', true)

    expect(config.moduleOrder).toEqual(['overview', 'cut-off'])
    expect(config.enabledModules).toEqual(['overview', 'cut-off'])
    const written = updated[updated.length - 1].content_modules as Record<string, any>
    expect(written._config.moduleOrder).toContain('cut-off')
  })

  it('disabling does NOT remove the slug from moduleOrder (order is not visibility)', async () => {
    const updated = installChain({
      _config: { moduleOrder: ['overview', 'cut-off'], enabledModules: ['overview', 'cut-off'] },
    })
    const config = await toggleModuleEnabled('ed-1', 'cut-off', false)

    expect(config.enabledModules).toEqual(['overview'])
    expect(config.moduleOrder).toEqual(['overview', 'cut-off'])
  })
})
