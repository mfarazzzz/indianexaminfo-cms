/**
 * FX2.5 — create with AI-filled dates and the state select left unchosen must
 * succeed and must NOT write state:"".
 *
 * The DB CHECK `exam_editions_important_dates_valid` runs
 * important_dates_all_iso(important_dates). This test mirrors that function in
 * JS and asserts the serialized payload the editor writes satisfies it, and
 * that "no state chosen" produces an ABSENT key (never "").
 *
 * The real CHECK (verbatim from the live DB):
 *   date present & non-empty -> must match ^\d{4}-\d{2}-\d{2}$
 *   else                     -> lower(state) IN ('expected','postponed','cancelled')
 */
import { describe, expect, it } from 'vitest'
import { serializeDateRowsForWrite } from './EntranceExamEditorPage'

/** Faithful JS mirror of public.important_dates_all_iso(jsonb). */
function importantDatesAllIso(dates: Array<Record<string, unknown>> | null): boolean {
  if (dates === null) return true
  return dates.every((x) => {
    const date = x.date as string | undefined
    if (date != null && date !== '') return /^\d{4}-\d{2}-\d{2}$/.test(date)
    const state = String(x.state ?? '').toLowerCase()
    return ['expected', 'postponed', 'cancelled'].includes(state)
  })
}

describe('serializeDateRowsForWrite (FX2.5)', () => {
  it("drops the empty state so 'no state chosen' means the key is ABSENT, never ''", () => {
    const out = serializeDateRowsForWrite([
      { label: 'Notification Release', date: '2026-08-07', isUrgent: false, state: '' },
      { label: 'Registration Closes', date: '2026-10-07', isUrgent: true, state: '' },
    ] as any)
    expect(out).toHaveLength(2)
    for (const row of out) {
      expect('state' in row).toBe(false) // key absent, not ""
    }
  })

  it('keeps a real state when one is chosen', () => {
    const out = serializeDateRowsForWrite([
      { label: 'Exam Date', date: '2026-12-01', isUrgent: true, state: 'postponed' },
    ] as any)
    expect(out[0].state).toBe('postponed')
  })

  it('drops rows with no date (the CHECK would reject an empty-date row with no tentative state)', () => {
    const out = serializeDateRowsForWrite([
      { label: 'Notification Release', date: '2026-08-07', isUrgent: false },
      { label: 'Answer Key Release', date: '', isUrgent: false, state: '' },
    ] as any)
    expect(out).toHaveLength(1)
    expect(out[0].label).toBe('Notification Release')
  })

  it('the serialized payload for the owner\'s AI dates passes the real CHECK mirror', () => {
    const serialized = serializeDateRowsForWrite([
      { label: 'Notification Release', date: '2026-08-07', isUrgent: false, state: '' },
      { label: 'Registration Closes', date: '2026-10-07', isUrgent: true, state: '' },
      { label: 'Admit Card Release', date: '', isUrgent: false, state: '' }, // blank standard row
    ] as any)
    expect(importantDatesAllIso(serialized)).toBe(true)
    // And no state:"" anywhere.
    expect(JSON.stringify(serialized)).not.toContain('"state":""')
  })

  it('an UNSERIALIZED empty-date row with state:"" would FAIL the CHECK (why the fix matters)', () => {
    // This is the latent hazard the serializer removes: a blank row that slips past
    // any future unfiltered write path.
    const bad = [{ label: 'Result', date: '', isUrgent: false, state: '' }]
    expect(importantDatesAllIso(bad)).toBe(false)
    // After serialization the row is dropped, so the payload is clean.
    expect(importantDatesAllIso(serializeDateRowsForWrite(bad as any))).toBe(true)
  })
})
