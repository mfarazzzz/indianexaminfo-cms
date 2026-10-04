/**
 * FX3 Part A — edition-creation fixes.
 *  A1: startNewEdition is idempotent on a unique-key (double-click) violation.
 *  A2: the New Edition / Create-cycle default year is the current year when the
 *      exam has no current edition, else the next cycle year.
 * All Supabase calls mocked — no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ db: { from: (...a: any[]) => mockFrom(...a) } }))
vi.mock('@/services/moduleRegistryService', () => ({ getModuleRegistry: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/revalidate', () => ({ revalidateExams: vi.fn().mockResolvedValue(undefined) }))

import { startNewEdition } from './entranceExamService'
import { computeNewEditionDefaultYear } from '@/pages/entrance-exams/EntranceExamEditorPage'

beforeEach(() => { vi.clearAllMocks() })

describe('startNewEdition idempotency (A1)', () => {
  it('returns the existing edition when the insert hits the unique key (23505)', async () => {
    // Call order for the double-click case:
    //  1. duplicate check (select .eq .eq .eq .maybeSingle) -> null (looks free)
    //  2. insert -> 23505 error
    //  3. recovery select -> the existing row
    let call = 0
    mockFrom.mockImplementation(() => {
      const chain: any = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.order = vi.fn(() => chain)
      call++
      if (call === 1) {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }) // no dup found
      } else if (call === 2) {
        chain.insert = vi.fn(() => chain)
        chain.single = vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key uq_exam_edition_year_session' } })
      } else {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'ed-existing', exam_id: 'ex-1', year: 2027, session: 'main', is_current: false, status: 'upcoming', created_at: '', updated_at: '' }, error: null })
      }
      return chain
    })

    const result = await startNewEdition('ex-1', { year: 2027 })
    expect(result.id).toBe('ed-existing') // no throw; the existing row is returned
  })

  it('still throws a NON-unique error (does not swallow real failures)', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      const chain: any = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.order = vi.fn(() => chain)
      call++
      if (call === 1) {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
      } else {
        chain.insert = vi.fn(() => chain)
        chain.single = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } })
      }
      return chain
    })
    await expect(startNewEdition('ex-1', { year: 2028 })).rejects.toThrow(/permission denied/)
  })
})

describe('computeNewEditionDefaultYear (A2)', () => {
  it('no current edition -> the current calendar year (not next year)', () => {
    expect(computeNewEditionDefaultYear(null)).toBe(new Date().getFullYear())
    expect(computeNewEditionDefaultYear(undefined)).toBe(new Date().getFullYear())
  })
  it('has a current edition -> the next cycle year', () => {
    expect(computeNewEditionDefaultYear(2026)).toBe(2027)
    expect(computeNewEditionDefaultYear(2024)).toBe(2025)
  })
})
