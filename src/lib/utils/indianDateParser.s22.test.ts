/**
 * S2.2 — Hindi dates, Indian windows, and clock times must parse.
 *
 * Pins the owner's list: "05.10.2026"; "5 अक्टूबर 2026"; ranges
 * "05.10.2026 से 07.10.2026"; "(अपराह्न)"; "सायं 06:00 बजे".
 * These feed the FX3 C1 row keys (end_date/start_time/end_time/time_text).
 */
import { describe, expect, it } from 'vitest'
import { parseDateText, parseDateWindow, splitDateRange, validateAndFixDate } from './indianDateParser'

describe('parseDateText — Hindi month names (S2.2)', () => {
  it.each([
    ['5 अक्टूबर 2026', '2026-10-05'],
    ['05 अक्टूबर 2026', '2026-10-05'],
    ['11 अगस्त 2026', '2026-08-11'],
    ['29 जुलाई 2026', '2026-07-29'],
    ['अक्टूबर 5, 2026', '2026-10-05'],
    ['15 नवंबर 2026', '2026-11-15'],
  ])('%s → %s', (text, iso) => {
    expect(parseDateText(text)).toBe(iso)
  })

  it('keeps every pre-existing format working (regression fence)', () => {
    expect(parseDateText('2026-08-03')).toBe('2026-08-03')
    expect(parseDateText('11.05.2026')).toBe('2026-05-11')
    expect(parseDateText('03/08/2026')).toBe('2026-08-03')
    expect(parseDateText('3 Aug 2026')).toBe('2026-08-03')
    expect(parseDateText('End of October, 2026')).toBe('2026-10-28')
    expect(parseDateText('15.06.2026 to 18.06.2026')).toBe('2026-06-15')
  })
})

describe('splitDateRange — Hindi and English separators (S2.2)', () => {
  it("splits on 'से' and strips 'तक'", () => {
    expect(splitDateRange('05.10.2026 से 07.10.2026 तक')).toEqual(['05.10.2026', '07.10.2026'])
    expect(splitDateRange('05.10.2026 से 07.10.2026')).toEqual(['05.10.2026', '07.10.2026'])
  })
  it('splits on spaced dash / en dash', () => {
    expect(splitDateRange('09 Oct – 14 Oct')).toEqual(['09 Oct', '14 Oct'])
  })
  it('does NOT split DD-MM-YYYY (no spaces around the dash)', () => {
    expect(splitDateRange('03-08-2026')).toEqual(['03-08-2026'])
    expect(splitDateRange('2026-08-03')).toEqual(['2026-08-03'])
  })
})

describe('parseDateWindow — the Phase-3 shapes (S2.2)', () => {
  it('choice filling: "05.10.2026 (अपराह्न) से 07.10.2026 सायं 06:00 बजे"', () => {
    const w = parseDateWindow('05.10.2026 (अपराह्न) से 07.10.2026 सायं 06:00 बजे')
    expect(w.date).toBe('2026-10-05')
    expect(w.end_date).toBe('2026-10-07')
    expect(w.end_time).toBe('18:00')            // सायं 06:00 बजे → 18:00 IST
    expect(w.start_time).toBe('')
    expect(w.time_text).toBe('afternoon')       // अपराह्न → canonical English
  })

  it('document verification: "09.10.2026 से 14.10.2026 (सायं 05:00 बजे)"', () => {
    const w = parseDateWindow('09.10.2026 से 14.10.2026 (सायं 05:00 बजे)')
    expect(w.date).toBe('2026-10-09')
    expect(w.end_date).toBe('2026-10-14')
    expect(w.end_time).toBe('17:00')
  })

  it('single deadline with clock: "07.10.2026, 6:00 PM" → end_time on the day', () => {
    const w = parseDateWindow('07.10.2026, 6:00 PM')
    expect(w.date).toBe('2026-10-07')
    expect(w.end_time).toBe('18:00')
    expect(w.end_date).toBe('')
  })

  it('morning clock stays AM, सुबह 12 means midnight-noon boundary (12:00 stays 12)', () => {
    expect(parseDateWindow('05.10.2026 सुबह 11:00 बजे').end_time).toBe('11:00')
    expect(parseDateWindow('05.10.2026 रात 08:00 बजे').end_time).toBe('20:00')
  })

  it('plain single dates leave every optional key empty', () => {
    const w = parseDateWindow('08.10.2026')
    expect(w).toEqual({ date: '2026-10-08', end_date: '', start_time: '', end_time: '', time_text: '' })
  })

  it('time_text "evening" from सायं when no clock is given', () => {
    const w = parseDateWindow('05.10.2026 (सायं)')
    expect(w.date).toBe('2026-10-05')
    expect(w.time_text).toBe('evening')
    expect(w.end_time).toBe('')
  })

  it('an inverted range never stores end before start', () => {
    const w = parseDateWindow('07.10.2026 से 05.10.2026')
    expect(w.date).toBe('2026-10-07')
    expect(w.end_date).toBe('2026-10-07') // clamped, validateDateRowsForWrite would reject otherwise
  })

  it('validateAndFixDate still repairs and rejects', () => {
    expect(validateAndFixDate('2026-13-40')).toBe('')
    expect(validateAndFixDate('2026-10-05')).toBe('2026-10-05')
    expect(validateAndFixDate('05.10.2026')).toBe('2026-10-05')
  })
})
