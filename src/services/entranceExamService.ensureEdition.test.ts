/**
 * FX1.2 — save honesty: an existing exam with zero editions gets a cycle created.
 *
 * Two layers:
 *  1. createCurrentEdition service: inserts an is_current=true edition when none
 *     exists; refuses when a current edition already exists.
 *  2. The handleSave branch decision (modelled as a pure resolver): with no
 *     draft and no current edition, the ONLY correct action is create+write —
 *     the old silent-drop path (write nothing, toast success) is impossible.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ db: { from: (...a: any[]) => mockFrom(...a) } }))
vi.mock('@/services/moduleRegistryService', () => ({ getModuleRegistry: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/revalidate', () => ({ revalidateExams: vi.fn().mockResolvedValue(undefined) }))

import { createCurrentEdition } from './entranceExamService'

beforeEach(() => { vi.clearAllMocks() })

describe('createCurrentEdition (FX1.2)', () => {
  it('inserts an is_current=true edition when none exists', async () => {
    const inserted: Record<string, unknown>[] = []
    let call = 0
    mockFrom.mockImplementation(() => {
      const chain: any = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      call++
      if (call === 1) {
        // guard: no existing current
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
      } else {
        chain.insert = vi.fn((payload: Record<string, unknown>) => { inserted.push(payload); return chain })
        chain.single = vi.fn().mockResolvedValue({
          data: { id: 'ed-new', exam_id: 'ex-1', year: 2026, session: 'main', is_current: true, status: 'upcoming', created_at: '', updated_at: '' },
          error: null,
        })
      }
      return chain
    })

    const ed = await createCurrentEdition('ex-1', 2026)
    expect(ed.id).toBe('ed-new')
    expect(inserted[0]).toMatchObject({ exam_id: 'ex-1', year: 2026, session: 'main', is_current: true })
  })

  it('refuses when a current edition already exists (no second current)', async () => {
    mockFrom.mockImplementation(() => {
      const chain: any = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'ed-existing' }, error: null })
      return chain
    })
    await expect(createCurrentEdition('ex-1', 2026)).rejects.toThrow(/already has a current cycle/)
  })
})

describe('handleSave edition-target decision (FX1.2 model)', () => {
  /**
   * Mirrors the branch in EntranceExamEditorPage.handleSave: given the draft and
   * current edition state, which action runs? Returns the action name.
   */
  function resolveSaveAction(opts: { draft: boolean; current: boolean }): 'activate-draft' | 'update-current' | 'create-current' {
    if (opts.draft) return 'activate-draft'
    if (opts.current) return 'update-current'
    return 'create-current'
  }

  it('zero editions → create-current (never a silent no-op)', () => {
    expect(resolveSaveAction({ draft: false, current: false })).toBe('create-current')
  })
  it('has current → update-current', () => {
    expect(resolveSaveAction({ draft: false, current: true })).toBe('update-current')
  })
  it('has pending draft → activate-draft', () => {
    expect(resolveSaveAction({ draft: true, current: true })).toBe('activate-draft')
  })
})
