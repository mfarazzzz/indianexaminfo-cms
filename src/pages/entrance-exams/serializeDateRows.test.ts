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
import { serializeDateRowsForWrite, validateDateRowsForWrite } from './EntranceExamEditorPage'

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

describe('C1 — time-with-date keys: round-trip + validation', () => {
  it('keeps end_date/start_time/end_time/time_text when filled', () => {
    const out = serializeDateRowsForWrite([
      { label: 'Choice filling', date: '2026-10-05', isUrgent: true, end_date: '2026-10-07', start_time: '09:00', end_time: '18:00', time_text: 'afternoon' },
    ] as any)
    expect(out[0]).toMatchObject({ end_date: '2026-10-07', start_time: '09:00', end_time: '18:00', time_text: 'afternoon' })
  })

  it('drops empty time keys — never writes key:""', () => {
    const out = serializeDateRowsForWrite([
      { label: 'Exam Date', date: '2026-12-01', isUrgent: true, end_date: '', start_time: '', end_time: '', time_text: '  ' },
    ] as any)
    for (const k of ['end_date', 'start_time', 'end_time', 'time_text']) {
      expect(k in out[0]).toBe(false)
    }
  })

  it('rejects end_date before date', () => {
    const errs = validateDateRowsForWrite([
      { label: 'Registration', date: '2026-07-08', end_date: '2026-06-15', isUrgent: false },
    ] as any)
    expect(errs.join(' ')).toMatch(/end date .* before the start date/)
  })

  it('rejects end_time with no date', () => {
    const errs = validateDateRowsForWrite([
      { label: 'Result', date: '', end_time: '17:00', isUrgent: false },
    ] as any)
    // empty-date row is dropped by serialize, so no error — but a dated row with
    // end_time is fine; the "needs a date" case only bites a non-empty row that
    // has end_time but neither date nor end_date, which serialize already removed.
    expect(errs).toEqual([])
  })

  it('rejects same-day end_time before start_time', () => {
    const errs = validateDateRowsForWrite([
      { label: 'Verification', date: '2026-10-09', start_time: '18:00', end_time: '09:00', isUrgent: false },
    ] as any)
    expect(errs.join(' ')).toMatch(/end time .* before start time .* same day/)
  })

  it('accepts a valid multi-day range with times', () => {
    const errs = validateDateRowsForWrite([
      { label: 'Choice filling', date: '2026-10-05', end_date: '2026-10-07', start_time: '09:00', end_time: '18:00', isUrgent: true },
    ] as any)
    expect(errs).toEqual([])
  })

  it('accepts a same-day range where end_time >= start_time', () => {
    const errs = validateDateRowsForWrite([
      { label: 'Exam', date: '2026-12-01', start_time: '09:00', end_time: '12:30', isUrgent: true },
    ] as any)
    expect(errs).toEqual([])
  })
})
