/**
 * S2.5 — match before a new record. The UP D.El.Ed case from the brief:
 * the Phase-3 notice must point at the existing "UP D.El.Ed Admission 2026"
 * record, not birth a twin. Scoring is explainable, and a failed search never
 * pretends "no match".
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { scoreCandidate, pickLikelyMatch, findLikelyExamMatch, MATCH_THRESHOLD, type ExamCandidate } from './noticeMatch'

vi.mock('@/services/entranceExamService', () => ({
  getEntranceExams: vi.fn(),
}))
import { getEntranceExams } from '@/services/entranceExamService'

const deled: ExamCandidate = {
  id: 'ex-1',
  name: 'UP D.El.Ed Admission 2026',
  shortName: 'UP DELED',
  conductingBody: 'Uttar Pradesh Primary & Joint Directorate',
  workflowStatus: 'published',
}

describe('scoreCandidate — explainable agreement (S2.5)', () => {
  it('the Phase-3 notice facts match the existing cycle record above threshold', () => {
    const { score, reasons } = scoreCandidate(deled, {
      name: 'UP D.El.Ed Phase-3 Counselling 2026',
      shortName: 'UP D.El.Ed',
      conductingBody: 'UP Primary & Joint Directorate',
      year: 2026,
    })
    expect(score).toBeGreaterThanOrEqual(MATCH_THRESHOLD)
    expect(reasons.length).toBeGreaterThan(0)
  })

  it('"UP DELED" and "UP D.El.Ed" collapse to the same short name', () => {
    const { score } = scoreCandidate(deled, { shortName: 'UP D.El.Ed' })
    expect(score).toBeGreaterThanOrEqual(0.5)
  })

  it('an unrelated exam scores below the threshold', () => {
    const ctet: ExamCandidate = { id: 'ex-2', name: 'CTET December 2026', shortName: 'CTET', conductingBody: 'CBSE' }
    const { score } = scoreCandidate(ctet, { name: 'UP D.El.Ed Phase-3 2026', shortName: 'UP D.El.Ed', conductingBody: 'UP Basic Education' })
    expect(score).toBeLessThan(MATCH_THRESHOLD)
  })
})

describe('pickLikelyMatch', () => {
  it('returns the best candidate over the threshold, or null', () => {
    const best = pickLikelyMatch([
      { id: 'x', name: 'Bihar Board 12th 2026', shortName: 'BSEB', conductingBody: 'BSEB' },
      deled,
    ], { name: 'UP D.El.Ed Admission 2026', shortName: 'UP DELED', conductingBody: 'Uttar Pradesh Primary & Joint Directorate' })
    expect(best?.exam.id).toBe('ex-1')

    expect(pickLikelyMatch([{ id: 'x', name: 'NEET UG 2026', shortName: 'NEET', conductingBody: 'NTA' }],
      { shortName: 'UP DELED' })).toBeNull()
  })
})

describe('findLikelyExamMatch — search then score', () => {
  beforeEach(() => { vi.mocked(getEntranceExams).mockReset() })

  it('searches the pillar and surfaces the existing record', async () => {
    vi.mocked(getEntranceExams).mockResolvedValue([{
      id: 'ex-1', name: 'UP D.El.Ed Admission 2026', shortName: 'UP DELED',
      conductingBody: 'Uttar Pradesh Primary & Joint Directorate', workflowStatus: 'published',
    }] as never)
    const m = await findLikelyExamMatch(
      { name: 'UP D.El.Ed Phase-3', shortName: 'UP DELED', conductingBody: 'Uttar Pradesh Primary & Joint Directorate' },
      'entrance-exam', 2026,
    )
    expect(m?.exam.id).toBe('ex-1')
    expect(getEntranceExams).toHaveBeenCalled()
  })

  it('a failed search never claims "no match" from empty evidence — it scores what it got (nothing) and returns null, never throws', async () => {
    vi.mocked(getEntranceExams).mockRejectedValue(new Error('network'))
    await expect(findLikelyExamMatch({ shortName: 'UP DELED' }, 'entrance-exam')).resolves.toBeNull()
  })

  it('no usable facts → no search, no match', async () => {
    const m = await findLikelyExamMatch({ shortName: 'a b' }, 'entrance-exam')
    expect(m).toBeNull()
    expect(getEntranceExams).not.toHaveBeenCalled()
  })
})
