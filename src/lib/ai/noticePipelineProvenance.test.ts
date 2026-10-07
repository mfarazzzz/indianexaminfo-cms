/**
 * Follow-up 1 — the notice's OWN issue date goes to provenance, not important_dates.
 *
 * `exam_derived_status` reads the `notification` type (MIN(date) WHERE
 * date_type='notification'), so a press-release / addendum LETTERHEAD date must
 * never become a notification row. runNoticePipeline diverts a notification row
 * only when its date equals the notice's own issue date AND its quote is the
 * header / sign-off reference line. A real "released on <date>" event in the
 * body passes through untouched.
 */
import { describe, expect, it } from 'vitest'
import { runNoticePipeline } from './noticePipeline'
import type { AllowedOptions } from './extractionContract'

const allowed: AllowedOptions = {
  categories: [{ slug: 'teaching-and-education', name: 'Teaching and Education' }],
  regions: [{ slug: 'up', label: 'Uttar Pradesh' }],
  entityTypes: ['exam', 'university-admission'],
  selectionModels: ['written-exam', 'merit-based'],
}

const HEADER = 'पृ0सं0 / डीएलएड 2026 / 123 / 2026-27, दिनांक 01 अक्टूबर 2026'

const answer = (fields: Record<string, unknown>, dates: unknown[]) =>
  JSON.stringify({ fields, dates })

const noticeRef = { value: HEADER, confidence: 0.95, sourceQuote: HEADER }

describe('runNoticePipeline — notice issue date → provenance (follow-up 1)', () => {
  it('DIVERTS a header/sign-off "notification" row equal to the notice issue date', () => {
    const src = [
      HEADER,
      'आवेदन पत्र 05.10.2026 से 07.10.2026 तक भरा जा सकेगा।',
    ].join('\n')
    const raw = answer(
      { noticeReference: noticeRef },
      [
        { label: 'Notice issuance', kind: 'notification', type: 'notification', dateText: '01 अक्टूबर 2026', sourceQuote: HEADER, confidence: 0.9 },
        { label: 'Institution choice filling', kind: 'choice_filling', type: 'counselling', dateText: '05.10.2026 से 07.10.2026', sourceQuote: 'आवेदन पत्र 05.10.2026 से 07.10.2026', confidence: 0.9 },
      ],
    )
    const res = runNoticePipeline(raw, allowed, src, 2026)
    expect(res.rows.some((r) => r.type === 'notification')).toBe(false) // pulled OUT
    expect(res.rows.map((r) => r.kind)).toEqual(['choice_filling'])     // the real event stays
    expect(res.provenance).toEqual({ noticeIssueDate: '2026-10-01', noticeIssueQuote: HEADER })
  })

  it('PASSES THROUGH a real "notification released on <different date>" body event', () => {
    const src = [
      'पृ0सं0 / भर्ती / 55 / 2026, दिनांक 01 अक्टूबर 2026',
      'यह विज्ञप्ति दिनांक 10 अक्टूबर 2026 को जारी की गई थी जिसमें आवेदन आमंत्रित हैं।',
    ].join('\n')
    const raw = answer(
      { noticeReference: { value: 'पृ0सं0 / भर्ती / 55 / 2026, दिनांक 01 अक्टूबर 2026', confidence: 0.95, sourceQuote: 'पृ0सं0 / भर्ती / 55 / 2026, दिनांक 01 अक्टूबर 2026' } },
      [{ label: 'Notification Release', kind: 'notification', type: 'notification', dateText: '10 अक्टूबर 2026', sourceQuote: 'यह विज्ञप्ति दिनांक 10 अक्टूबर 2026 को जारी की गई थी', confidence: 0.9 }],
    )
    const res = runNoticePipeline(raw, allowed, src, 2026)
    expect(res.rows.some((r) => r.type === 'notification' && r.date === '2026-10-10')).toBe(true)
    expect(res.provenance).toBeUndefined()
  })

  it('PASSES THROUGH a same-date mention in the BODY (no reference marker) — the gate is quote location, not just the date', () => {
    const src = [
      'पृ0सं0 / भर्ती / 55 / 2026, दिनांक 01 अक्टूबर 2026',
      'सूचना जारी करने की तिथि 01 अक्टूबर 2026 है।',
    ].join('\n')
    const raw = answer(
      { noticeReference: { value: 'पृ0सं0 / भर्ती / 55 / 2026, दिनांक 01 अक्टूबर 2026', confidence: 0.95, sourceQuote: 'पृ0सं0 / भर्ती / 55 / 2026, दिनांक 01 अक्टूबर 2026' } },
      [{ label: 'Notification issued', kind: 'notification', type: 'notification', dateText: '01 अक्टूबर 2026', sourceQuote: 'सूचना जारी करने की तिथि 01 अक्टूबर 2026 है', confidence: 0.9 }],
    )
    const res = runNoticePipeline(raw, allowed, src, 2026)
    // date equals the issue date, but the quote is a body sentence (no ref marker,
    // not the noticeReference line) → treated as a real notification event.
    expect(res.rows.some((r) => r.type === 'notification' && r.date === '2026-10-01')).toBe(true)
    expect(res.provenance).toBeUndefined()
  })

  it('with no noticeReference at all, nothing is diverted (safe default)', () => {
    const src = 'विज्ञप्ति दिनांक 01 अक्टूबर 2026 जारी। आवेदन 05.10.2026 से।'
    const raw = answer({}, [{ label: 'Notification', kind: 'notification', type: 'notification', dateText: '01 अक्टूबर 2026', sourceQuote: 'विज्ञप्ति दिनांक 01 अक्टूबर 2026 जारी', confidence: 0.9 }])
    const res = runNoticePipeline(raw, allowed, src, 2026)
    expect(res.provenance).toBeUndefined()
    expect(res.rows.some((r) => r.type === 'notification')).toBe(true)
  })
})
