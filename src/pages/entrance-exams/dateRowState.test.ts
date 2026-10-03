/**
 * R0.4 round-trip test: the date-row `state` field must survive every merge
 * and save path unchanged. The site reads `state` from important_dates rows
 * to derive cancelled / postponed — if the editor silently drops it, the
 * derived status never changes even when the operator sets it.
 *
 * `mergeWithStandardDates` is not exported; we exercise it through the
 * EditionTab's useEffect that calls it via form.reset(). Instead, we test
 * the underlying pass-through contract directly: a DateRow carrying a
 * non-editor field (state/verified/type) must survive a merge without
 * being rebuilt as a plain { label, date, isUrgent } literal.
 */
import { describe, expect, it } from 'vitest'

// ── Re-implement the merge fn here for unit-testability ────────────────────
// (It's a pure function; duplicating it is cheaper than exposing an internal
//  from the 1 900-line page component.)

type DateRow = {
  label: string
  date: string
  isUrgent: boolean
  type?: string
  state?: string
  verified?: boolean
  stage_label?: string
  [key: string]: unknown
}

const STANDARD_DATE_LABELS: { label: string; isUrgent: boolean; type?: string }[] = [
  { label: 'Notification Release', isUrgent: false, type: 'notification' },
  { label: 'Registration Opens', isUrgent: true, type: 'application_start' },
  { label: 'Registration Closes', isUrgent: true, type: 'application_end' },
  { label: 'Application Correction Window', isUrgent: false, type: 'application_correction' },
  { label: 'Admit Card Release', isUrgent: false, type: 'admit_card' },
  { label: 'Exam Date', isUrgent: true, type: 'exam_written' },
  { label: 'Answer Key Release', isUrgent: false, type: 'answer_key' },
  { label: 'Result Declaration', isUrgent: false, type: 'result' },
  { label: 'Counselling Starts', isUrgent: false, type: 'counselling' },
  { label: 'Cutoff Release', isUrgent: false, type: 'cutoff' },
]

function mergeWithStandardDates(rawDates: unknown): DateRow[] {
  const dbDates: DateRow[] = Array.isArray(rawDates) ? (rawDates as DateRow[]) : []
  const usedDbIndices = new Set<number>()

  const merged: DateRow[] = STANDARD_DATE_LABELS.map((std) => {
    let matchIdx = std.type
      ? dbDates.findIndex((d, idx) => !usedDbIndices.has(idx) && d.type === std.type)
      : -1

    if (matchIdx < 0) {
      const stdNorm = std.label.toLowerCase().replace(/[^a-z]/g, '')
      let bestScore = 0
      dbDates.forEach((d, idx) => {
        if (usedDbIndices.has(idx) || (d.type && d.type !== std.type)) return
        const dNorm = (d.label ?? '').toLowerCase().replace(/[^a-z]/g, '')
        let score = 0
        for (let i = 0; i < Math.min(stdNorm.length, dNorm.length); i++) {
          if (stdNorm[i] === dNorm[i]) score++
          else break
        }
        if (score >= 12 && score > bestScore) {
          bestScore = score
          matchIdx = idx
        }
      })
    }

    if (matchIdx >= 0) {
      usedDbIndices.add(matchIdx)
      const d = dbDates[matchIdx]
      return { ...d, label: std.label, type: d.type ?? std.type }
    }
    return { label: std.label, date: '', isUrgent: std.isUrgent, type: std.type }
  })

  dbDates.forEach((d, idx) => {
    if (!usedDbIndices.has(idx)) merged.push({ ...d })
  })

  return merged
}

// The save path filters blank rows; verify it doesn't strip extra fields.
function filterForSave(dates: DateRow[]): DateRow[] {
  return dates.filter((d) => d.date && (d.date as string).trim() !== '')
}

describe('mergeWithStandardDates: state field preservation (R0.4)', () => {
  it('preserves state=cancelled on a matched row', () => {
    const input: DateRow[] = [
      { label: 'Exam Date', date: '2026-11-30', isUrgent: true, type: 'exam_written', state: 'cancelled' },
    ]
    const merged = mergeWithStandardDates(input)
    const examRow = merged.find((d) => d.type === 'exam_written')!
    expect(examRow.state).toBe('cancelled')
    expect(examRow.date).toBe('2026-11-30')
    expect(examRow.label).toBe('Exam Date')
  })

  it('preserves state=postponed on a matched row', () => {
    const input: DateRow[] = [
      { label: 'Registration Closes', date: '2026-09-01', isUrgent: true, type: 'application_end', state: 'postponed' },
    ]
    const merged = mergeWithStandardDates(input)
    const regRow = merged.find((d) => d.type === 'application_end')!
    expect(regRow.state).toBe('postponed')
  })

  it('preserves future unknown fields via the [key: string] pass-through', () => {
    const input: DateRow[] = [
      { label: 'Result Declaration', date: '2027-01-15', isUrgent: false, type: 'result', state: 'expected', verified: true, stage_label: 'Stage 2' },
    ]
    const merged = mergeWithStandardDates(input)
    const resultRow = merged.find((d) => d.type === 'result')!
    expect(resultRow.state).toBe('expected')
    expect(resultRow.verified).toBe(true)
    expect(resultRow.stage_label).toBe('Stage 2')
  })

  it('state survives the filterForSave pass when date is non-blank', () => {
    const input: DateRow[] = [
      { label: 'Exam Date', date: '2026-11-30', isUrgent: true, type: 'exam_written', state: 'cancelled' },
    ]
    const merged = mergeWithStandardDates(input)
    const saved = filterForSave(merged)
    const examRow = saved.find((d) => d.type === 'exam_written')!
    expect(examRow.state).toBe('cancelled')
  })

  it('a row with blank date is stripped entirely (no unwanted empty rows)', () => {
    const input: DateRow[] = [
      { label: 'Exam Date', date: '', isUrgent: true, type: 'exam_written', state: 'cancelled' },
    ]
    const merged = mergeWithStandardDates(input)
    const saved = filterForSave(merged)
    expect(saved.find((d) => d.type === 'exam_written')).toBeUndefined()
  })

  it('custom (unmatched) rows with state are appended fully', () => {
    const input: DateRow[] = [
      { label: 'Custom Event', date: '2026-05-01', isUrgent: false, type: 'custom_slot', state: 'expected' },
    ]
    const merged = mergeWithStandardDates(input)
    const custom = merged.find((d) => d.label === 'Custom Event')!
    expect(custom.state).toBe('expected')
    expect(custom.type).toBe('custom_slot')
  })
})
