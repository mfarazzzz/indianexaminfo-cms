/**
 * S2.5 — match and update, NEVER duplicate.
 *
 * The UP D.El.Ed cycle proves the need: six notices, one record. The merge
 * must append new dated events, keep earlier ones, fill blank standard slots,
 * ignore true duplicates, and give an extension row a supersedes link to the
 * deadline it replaced — never overwrite that deadline.
 */
import { describe, expect, it } from 'vitest'
import { mergeAcceptedDateRows, pickSuperseded, type MergeableRow } from './dateRowMerge'

const row = (o: Partial<MergeableRow> & { label: string; date: string }): MergeableRow => ({
  isUrgent: false, ...o,
})

describe('mergeAcceptedDateRows — the cycle timeline (S2.5)', () => {
  it('appends a Phase-3 event next to the kept Phase-2 one', () => {
    const existing = [
      row({ label: 'Choice Filling Phase-2', date: '2026-09-01', type: 'counselling', kind: 'choice_filling' }),
    ]
    const proposed = [
      row({ label: 'Choice Filling Phase-3', date: '2026-10-05', type: 'counselling', kind: 'choice_filling', phase: 'Phase-3' }),
    ]
    const res = mergeAcceptedDateRows(existing, proposed)
    expect(res.rows).toHaveLength(2)
    expect(res.added).toBe(1)
    expect(res.rows[0].date).toBe('2026-09-01') // earlier row KEPT
  })

  it('ignores a true duplicate: same kind AND same window', () => {
    const existing = [row({ label: 'Seat Allotment', date: '2026-10-08', type: 'counselling', kind: 'allotment' })]
    const proposed = [row({ label: 'Phase-3 Seat Allotment', date: '2026-10-08', type: 'counselling', kind: 'allotment' })]
    const res = mergeAcceptedDateRows(existing, proposed)
    expect(res.rows).toHaveLength(1)
    expect(res.duplicatesIgnored).toBe(1)
    expect(res.added).toBe(0)
  })

  it('fills a blank standard slot without disturbing its metadata', () => {
    const existing = [row({ label: 'Notification Release', date: '', type: 'notification', verified: true })]
    const proposed = [row({ label: 'Notification Release', date: '2026-08-07', type: 'notification', kind: 'notification' })]
    const res = mergeAcceptedDateRows(existing, proposed)
    expect(res.filled).toBe(1)
    expect(res.rows[0]).toMatchObject({ date: '2026-08-07', verified: true, kind: 'notification' })
    expect(res.rows).toHaveLength(1)
  })

  it('never clobbers a dated row of the same label — different dates are different events', () => {
    const existing = [row({ label: 'Result Declaration', date: '2026-06-01', type: 'result', kind: 'result' })]
    const proposed = [row({ label: 'Result Declaration', date: '2026-12-01', type: 'result', kind: 'result' })]
    const res = mergeAcceptedDateRows(existing, proposed)
    expect(res.rows).toHaveLength(2)
    expect(res.rows[0].date).toBe('2026-06-01')
  })

  it('an extension APPENDS with supersedes -> the earlier deadline; the old row survives', () => {
    const existing = [
      row({ label: 'Registration Closes', date: '2026-07-08', type: 'application_end', kind: 'registration_end' }),
    ]
    const proposed = [
      row({ label: 'Registration Extended to 03.08.2026', date: '2026-08-03', type: 'application_end', kind: 'extension' }),
    ]
    const res = mergeAcceptedDateRows(existing, proposed)
    expect(res.rows).toHaveLength(2)
    expect(res.superseding).toBe(1)
    const ext = res.rows[1]
    expect(ext.kind).toBe('extension')
    expect(ext.supersedes).toEqual({ label: 'Registration Closes', date: '2026-07-08' })
    expect(res.rows[0].date).toBe('2026-07-08') // NOT overwritten
  })

  it('a second extension supersedes the FIRST extension-era deadline, choosing the latest', () => {
    const existing = [
      row({ label: 'Registration Closes', date: '2026-07-08', type: 'application_end', kind: 'registration_end' }),
      row({ label: 'Registration Extended to 03.08.2026', date: '2026-08-03', type: 'application_end', kind: 'extension' }),
    ]
    const target = pickSuperseded(existing, row({ label: 'Last Extension 10.08', date: '2026-08-10', type: 'application_end', kind: 'extension' }))
    expect(target?.date).toBe('2026-08-03')
  })

  it('an extension with nothing plausible before it still appends, without a link', () => {
    const proposed = [row({ label: 'Registration Extended to 03.08.2026', date: '2026-08-03', type: 'application_end', kind: 'extension' })]
    const res = mergeAcceptedDateRows([], proposed)
    expect(res.rows).toHaveLength(1)
    expect('supersedes' in res.rows[0]).toBe(false)
    expect(res.superseding).toBe(0)
  })
})
