/**
 * FX1.4 — deleteEdition guard tests.
 *
 * Rules:
 *  - the ONLY edition of an exam may never be deleted;
 *  - the CURRENT edition may not be deleted while other editions exist;
 *  - a non-current edition (with ≥2 total) may be deleted.
 * All Supabase calls are mocked — no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ db: { from: vi.fn() } }))
vi.mock('@/services/moduleRegistryService', () => ({ getModuleRegistry: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/revalidate', () => ({ revalidateExams: vi.fn().mockResolvedValue(undefined) }))

import { db } from '@/lib/supabase/client'
import { deleteEdition } from './entranceExamService'

const mockFrom = vi.mocked(db.from)

/**
 * Build a chain factory for deleteEdition's call sequence (in order):
 *  1. from('exam_editions').select('id, exam_id, is_current').eq('id',…).single()  → the edition
 *  2. from('exam_editions').select('id',{count,head}).eq('exam_id',…)              → { count } (awaited directly)
 *  3. from('exam_editions').delete().eq('id',…)                                    → delete (awaited)
 */
function install(opts: { edition: { id: string; exam_id: string; is_current: boolean } | null; count: number }) {
  let deleteCalled = false
  let call = 0
  mockFrom.mockImplementation(() => {
    call++
    const chain: any = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    if (call === 1) {
      chain.single = vi.fn().mockResolvedValue({ data: opts.edition, error: null })
    } else if (call === 2) {
      // count query: awaiting the chain yields { count, error }
      chain.then = (res: (v: any) => void) => res({ count: opts.count, error: null })
    } else {
      chain.delete = vi.fn(() => chain)
      chain.then = (res: (v: any) => void) => { deleteCalled = true; res({ error: null }) }
    }
    return chain
  })
  return { wasDeleted: () => deleteCalled }
}

beforeEach(() => { vi.clearAllMocks() })

describe('deleteEdition (FX1.4)', () => {
  it('refuses to delete the ONLY edition of an exam', async () => {
    install({ edition: { id: 'ed-1', exam_id: 'ex-1', is_current: true }, count: 1 })
    await expect(deleteEdition('ed-1')).rejects.toThrow(/only cycle/)
  })

  it('refuses to delete the CURRENT edition while another exists', async () => {
    install({ edition: { id: 'ed-2', exam_id: 'ex-1', is_current: true }, count: 3 })
    await expect(deleteEdition('ed-2')).rejects.toThrow(/current cycle while other cycles exist/)
  })

  it('allows deleting a NON-current edition when ≥2 exist', async () => {
    const { wasDeleted } = install({ edition: { id: 'ed-3', exam_id: 'ex-1', is_current: false }, count: 2 })
    await deleteEdition('ed-3')
    expect(wasDeleted()).toBe(true)
  })
})

