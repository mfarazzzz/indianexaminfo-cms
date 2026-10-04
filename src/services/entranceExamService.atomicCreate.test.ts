/**
 * FX1.5 — atomic create: a failed edition insert triggers a compensating delete.
 *
 * createEntranceExam inserts exams then exam_editions. If the edition insert
 * fails, it must DELETE the just-created exam (so no orphan with zero editions
 * survives — the FX1 state) and surface the real error.
 * All Supabase calls mocked — no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ db: { from: (...a: any[]) => mockFrom(...a) } }))
vi.mock('@/services/moduleRegistryService', () => ({ getModuleRegistry: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/revalidate', () => ({ revalidateExams: vi.fn().mockResolvedValue(undefined) }))

import { createEntranceExam, type NewExamInput } from './entranceExamService'

const input: NewExamInput = {
  name: 'Test Exam', shortName: 'TE', slug: 'test-exam', region: 'all-india',
  categoryId: 'cat-1', conductingBody: 'CB', officialWebsite: 'https://x.in',
  selectionModel: 'written-exam', firstEditionYear: 2026,
}

beforeEach(() => { vi.clearAllMocks() })

describe('createEntranceExam FX1.5 compensating delete', () => {
  it('deletes the orphan exam when the edition insert fails', async () => {
    const actions: string[] = []
    let call = 0
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.insert = vi.fn(() => { actions.push(`insert:${table}`); return chain })
      chain.delete = vi.fn(() => { actions.push(`delete:${table}`); return chain })
      call++
      // call 1: slug uniqueness check (exams) → free
      if (call === 1) { chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }); return chain }
      // call 2: exams insert → succeeds, returns a row
      if (call === 2) { chain.single = vi.fn().mockResolvedValue({ data: { id: 'ex-new', slug: 'test-exam' }, error: null }); return chain }
      // call 3: exam_editions insert → FAILS
      if (call === 3) { chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'edition boom' } }); return chain }
      // call 4: compensating delete on exams → succeeds
      chain.then = (res: (v: any) => void) => res({ error: null })
      return chain
    })

    await expect(createEntranceExam(input)).rejects.toThrow(/Could not create the first cycle: edition boom/)
    // The orphan exam must have been deleted.
    expect(actions).toContain('delete:exams')
  })

  it('names BOTH failures when the compensating delete also fails', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      const chain: any = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.insert = vi.fn(() => chain)
      chain.delete = vi.fn(() => chain)
      call++
      if (call === 1) { chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }); return chain }
      if (call === 2) { chain.single = vi.fn().mockResolvedValue({ data: { id: 'ex-new', slug: 'test-exam' }, error: null }); return chain }
      if (call === 3) { chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'edition boom' } }); return chain }
      // compensating delete fails too
      chain.then = (res: (v: any) => void) => res({ error: { message: 'delete boom' } })
      return chain
    })

    await expect(createEntranceExam(input)).rejects.toThrow(/edition boom.*delete boom.*manual repair/s)
  })
})
