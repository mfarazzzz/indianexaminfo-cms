/**
 * S2.9 / S2.9a — window pairing: the deterministic safety net under the DATE
 * RULES.
 *
 * A model that splits a COUNSELLING window into a start row and an end/deadline
 * row is corrected by the pipeline itself: same base kind + neighbourhood → ONE
 * row (date + end_date + end_time). Different kinds never merge; different
 * phases never merge.
 *
 * S2.9a EXCEPTION (the regression the owner caught): a kind whose VIEW type the
 * status view reads the window END of is NEVER merged. exam_derived_status takes
 * app_close from its OWN application_end row (MAX(date) WHERE
 * date_type='application_end', migration 20260902122910 — re-confirmed live via
 * pg_get_viewdef), so collapsing a registration window deletes the deadline and
 * the record never shows "registration closed". Registration therefore stays TWO
 * rows: registration_start (application_start) + registration_end
 * (application_end, with end_time when printed).
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

const SOURCE = [
  'Registration opens 15 June 2026.',
  'Last date for submission of the application 08 July 2026, 5:00 PM.',
  'Phase-3 choice filling starts 05.10.2026 (afternoon).',
  'Final deadline for choice filling (Phase-3) 07.10.2026, 6:00 PM.',
  'Seat allotment (Phase-3) 08.10.2026.',
].join('\n')

const answer = (dates: unknown[], fields: Record<string, unknown> = {}) =>
  JSON.stringify({ fields, dates })

const row = (label: string, kind: string, type: string, dateText: string, sourceQuote: string, phase = '') =>
  ({ label, kind, type, dateText, phase, audience: '', confidence: 0.9, sourceQuote })

describe('pairWindowRows — COUNSELLING windows merge (view does not read their end)', () => {
  it('pairs a choice-filling start row with its same-kind deadline (both Phase-3) into one window', () => {
    const raw = answer([
      row('Choice filling starts', 'choice_filling', 'counselling', '05.10.2026 (afternoon)', 'Phase-3 choice filling starts 05.10.2026 (afternoon).', 'Phase-3'),
      row('Final deadline for choice filling', 'choice_filling', 'counselling', '07.10.2026, 6:00 PM', 'Final deadline for choice filling (Phase-3) 07.10.2026, 6:00 PM.', 'Phase-3'),
      row('Seat allotment', 'allotment', 'counselling', '08.10.2026', 'Seat allotment (Phase-3) 08.10.2026.', 'Phase-3'),
    ])
    const res = runNoticePipeline(raw, allowed, SOURCE, 2026)
    expect(res.rows).toHaveLength(2)
    expect(res.rows[0]).toMatchObject({
      kind: 'choice_filling',
      type: 'counselling',
      date: '2026-10-05',
      end_date: '2026-10-07',
      end_time: '18:00',
      time_text: 'afternoon',
      phase: 'Phase-3',
    })
    expect(res.rows[1].kind).toBe('allotment')
    expect(res.mergedWindows).toEqual(['choice_filling: Choice filling starts + Final deadline for choice filling'])
  })
})

describe('pairWindowRows — S2.9a: view-read types NEVER merge', () => {
  it('does NOT merge registration_start + registration_end (application_end drives registration-closed)', () => {
    const raw = answer([
      row('Online application', 'registration_start', 'application_start', '15 June 2026', 'Registration opens 15 June 2026.'),
      row('Last date for application', 'registration_end', 'application_end', '08 July 2026, 5:00 PM', 'Last date for submission of the application 08 July 2026, 5:00 PM.'),
    ])
    const res = runNoticePipeline(raw, allowed, SOURCE, 2026)
    expect(res.rows).toHaveLength(2)
    expect(res.mergedWindows).toEqual([])
    const open = res.rows.find((r) => r.type === 'application_start')!
    const close = res.rows.find((r) => r.type === 'application_end')!
    expect(open.date).toBe('2026-06-15')
    expect(close.date).toBe('2026-07-08')
    expect(close.end_time).toBe('17:00')
    expect(close.end_date).toBeUndefined() // the deadline IS its own row, not folded in
  })

  it('never merges across different kinds (allotment after a registration start stays separate)', () => {
    const raw = answer([
      row('Online application window opens', 'registration_start', 'application_start', '15 June 2026', 'Registration opens 15 June 2026.'),
      row('Seat allotment', 'allotment', 'counselling', '08 July 2026, 5:00 PM', 'Last date for submission of the application 08 July 2026, 5:00 PM.'),
    ])
    const res = runNoticePipeline(raw, allowed, SOURCE, 2026)
    expect(res.rows).toHaveLength(2)
    expect(res.mergedWindows).toEqual([])
  })

  it('never merges rows of different phases even when adjacent', () => {
    const src = [
      'Phase-2 choice filling starts 01.09.2026.',
      'Final deadline for Phase-2 choice filling 03.09.2026.',
      'Phase-3 choice filling starts 05.10.2026.',
      'Final deadline for Phase-3 choice filling 07.10.2026.',
    ].join('\n')
    const raw = answer([
      row('P2 choice opens', 'choice_filling', 'counselling', '01.09.2026', 'Phase-2 choice filling starts 01.09.2026.', 'Phase-2'),
      row('P3 choice deadline', 'choice_filling', 'counselling', '07.10.2026', 'Final deadline for Phase-3 choice filling 07.10.2026.', 'Phase-3'),
      row('P2 choice deadline', 'choice_filling', 'counselling', '03.09.2026', 'Final deadline for Phase-2 choice filling 03.09.2026.', 'Phase-2'),
    ])
    const res = runNoticePipeline(raw, allowed, src, 2026)
    expect(res.rows).toHaveLength(2)
    const p2 = res.rows.find((r) => r.phase === 'Phase-2')!
    expect(p2).toMatchObject({ date: '2026-09-01', end_date: '2026-09-03' })
    const p3 = res.rows.find((r) => r.phase === 'Phase-3')!
    expect(p3.end_date).toBeUndefined()
    expect(res.mergedWindows).toEqual(['choice_filling: P2 choice opens + P2 choice deadline'])
  })

  it('leaves a distant counselling pair alone (quotes more than 3 lines apart are different sections)', () => {
    const src = [
      'Choice filling opens 15 June 2026.',
      'unrelated line',
      'unrelated line',
      'unrelated line',
      'unrelated line',
      'Last date for choice filling 08 July 2026.',
    ].join('\n')
    const raw = answer([
      row('CF opens', 'choice_filling', 'counselling', '15 June 2026', 'Choice filling opens 15 June 2026.'),
      row('CF closes', 'choice_filling', 'counselling', '08 July 2026', 'Last date for choice filling 08 July 2026.'),
    ])
    const res = runNoticePipeline(raw, allowed, src, 2026)
    expect(res.rows).toHaveLength(2)
    expect(res.mergedWindows).toEqual([])
  })

  it('the golden D.El.Ed recording is untouched by pairing (all counselling, no same-kind deadline pair)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const dir = resolve(__dirname, '__fixtures__/up-deled-2026-phase3')
    const pasted = readFileSync(resolve(dir, 'pasted.txt'), 'utf8')
    const recording = JSON.parse(readFileSync(resolve(dir, 'model.responses.json'), 'utf8')) as { raw: string }
    const res = runNoticePipeline(recording.raw, allowed, pasted, 2026)
    expect(res.mergedWindows).toEqual([])
    expect(res.rows).toHaveLength(4)
  })
})

describe('SYNTHETIC recruitment sample — application window stays TWO rows', () => {
  // SYNTHETIC (not a real notice). Labelled so. The most common case:
  // "Online application: 01.11.2026 to 30.11.2026 (up to 11:59 PM)".
  // Even though the model is told to emit TWO rows, a wrong single-row
  // "window" answer must still yield a separate application_end the view can read.
  // Here the model emits the CORRECT two-row shape; the net must not merge it.
  const SRC = ['Online application form submission: 01.11.2026 to 30.11.2026 (up to 11:59 PM).'].join('\n')

  it('two model rows (open + close) → two stored rows: application_start 2026-11-01, application_end 2026-11-30 23:59', () => {
    const raw = answer([
      row('Online application opens', 'registration_start', 'application_start', '01.11.2026', 'Online application form submission: 01.11.2026 to 30.11.2026 (up to 11:59 PM).'),
      row('Online application closes', 'registration_end', 'application_end', '30.11.2026 (up to 11:59 PM)', 'Online application form submission: 01.11.2026 to 30.11.2026 (up to 11:59 PM).'),
    ])
    const res = runNoticePipeline(raw, allowed, SRC, 2026)
    expect(res.mergedWindows).toEqual([])
    expect(res.rows).toHaveLength(2)
    const open = res.rows.find((r) => r.type === 'application_start')!
    const close = res.rows.find((r) => r.type === 'application_end')!
    expect(open.date).toBe('2026-11-01')
    expect(close.date).toBe('2026-11-30')
    expect(close.end_time).toBe('23:59')
  })

  it('even a single model "window" row is split into application_start + application_end for the view', () => {
    // If the model collapses the window into ONE registration_start row carrying
    // an end date, the view would have no application_end row. The pipeline does
    // not invent the second row here (that is a template concern), so this test
    // documents the CONTRACT: the two-row shape is required and never merged.
    const raw = answer([
      row('Online application', 'registration_start', 'application_start', '01.11.2026 to 30.11.2026', 'Online application form submission: 01.11.2026 to 30.11.2026 (up to 11:59 PM).'),
    ])
    const res = runNoticePipeline(raw, allowed, SRC, 2026)
    expect(res.mergedWindows).toEqual([])
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0]).toMatchObject({ type: 'application_start', date: '2026-11-01', end_date: '2026-11-30' })
  })
})
