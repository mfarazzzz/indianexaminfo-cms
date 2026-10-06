/**
 * S2.2 — `kind` and the new pass-through keys must survive the write path.
 *
 * Contract: kind is dropped when empty (never key:""), kept when set;
 * phase / rank_batch / audience / supersedes ride the spread contract
 * untouched (rendered in S3); the FX3 C1 window keys keep working.
 */
import { describe, expect, it } from 'vitest'
import { serializeDateRowsForWrite } from './EntranceExamEditorPage'

describe('serializeDateRowsForWrite — kind + S2.2 pass-through keys', () => {
  it('drops an empty kind — "no kind" means the key is ABSENT', () => {
    const [out] = serializeDateRowsForWrite([
      { label: 'Exam Date', date: '2026-12-01', isUrgent: true, kind: '  ' },
    ] as never)
    expect('kind' in out).toBe(false)
  })

  it('keeps a real kind on a counselling row', () => {
    const [out] = serializeDateRowsForWrite([
      { label: 'Choice Filling Window', date: '2026-10-05', isUrgent: true, type: 'counselling', kind: 'choice_filling' },
    ] as never)
    expect(out.kind).toBe('choice_filling')
    expect(out.type).toBe('counselling')
  })

  it('phase / rank_batch / audience / supersedes ride through untouched', () => {
    const rows = serializeDateRowsForWrite([
      {
        label: 'Choice Filling Window', date: '2026-10-05', isUrgent: true,
        type: 'counselling', kind: 'choice_filling',
        phase: 'Phase-3', rank_batch: '1–1,52,202', audience: 'candidate',
      },
      {
        label: 'Registration Extended to 03.08.2026', date: '2026-08-03', isUrgent: true,
        type: 'application_end', kind: 'extension', supersedes: 'row-id-of-08-07',
      },
    ] as never)
    expect(rows[0]).toMatchObject({ phase: 'Phase-3', rank_batch: '1–1,52,202', audience: 'candidate' })
    expect(rows[1]).toMatchObject({ kind: 'extension', supersedes: 'row-id-of-08-07' })
  })

  it('a stored legacy row (no kind at all) is written without a kind key', () => {
    const [out] = serializeDateRowsForWrite([
      { label: 'Notification Release', date: '2026-08-07', isUrgent: false, type: 'notification' },
    ] as never)
    expect('kind' in out).toBe(false)
  })
})
