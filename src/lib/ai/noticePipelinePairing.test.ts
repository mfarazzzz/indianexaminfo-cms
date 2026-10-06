/**
 * S2.9 — window pairing: the deterministic safety net under the DATE RULES.
 *
 * A model that splits one window into a start row and an end/deadline row is
 * corrected by the pipeline itself: same base kind + neighbourhood → ONE row
 * (date + end_date + end_time). Different kinds never merge; different phases
 * never merge — a Phase-2 window and a Phase-3 window are separate events even
 * when the model lists them side by side.
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

describe('pairWindowRows via runNoticePipeline — merge cases', () => {
  it('pairs <kind>_start + <kind>_end from the same section into one window row', () => {
    const raw = answer([
      row('Online application', 'registration_start', 'application_start', '15 June 2026', 'Registration opens 15 June 2026.'),
      row('Last date for application', 'registration_end', 'application_end', '08 July 2026, 5:00 PM', 'Last date for submission of the application 08 July 2026, 5:00 PM.'),
    ])
    const res = runNoticePipeline(raw, allowed, SOURCE, 2026)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0]).toMatchObject({
      kind: 'registration_start',
      date: '2026-06-15',
      end_date: '2026-07-08',
      end_time: '17:00',
    })
    expect(res.mergedWindows).toHaveLength(1)
    expect(res.mergedWindows[0]).toContain('registration_start')
  })

  it('pairs a start row with a same-kind deadline row (both Phase-3)', () => {
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

describe('pairWindowRows — non-merge cases', () => {
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
    // P2 pair merges (same phase, within the adjacency window); the P3 row
    // keeps its own phase and is never absorbed into the P2 window.
    expect(res.rows).toHaveLength(2)
    const p2 = res.rows.find((r) => r.phase === 'Phase-2')!
    expect(p2).toMatchObject({ date: '2026-09-01', end_date: '2026-09-03' })
    const p3 = res.rows.find((r) => r.phase === 'Phase-3')!
    expect(p3.end_date).toBeUndefined()
    expect(res.mergedWindows).toEqual(['choice_filling: P2 choice opens + P2 choice deadline'])
  })

  it('leaves a distant pair alone (quotes more than 3 lines apart are different sections)', () => {
    const src = [
      'Registration opens 15 June 2026.',
      'unrelated line',
      'unrelated line',
      'unrelated line',
      'unrelated line',
      'Last date for submission 08 July 2026.',
    ].join('\n')
    const raw = answer([
      row('Opens', 'registration_start', 'application_start', '15 June 2026', 'Registration opens 15 June 2026.'),
      row('Closes', 'registration_end', 'application_end', '08 July 2026', 'Last date for submission 08 July 2026.'),
    ])
    const res = runNoticePipeline(raw, allowed, src, 2026)
    expect(res.rows).toHaveLength(2)
    expect(res.mergedWindows).toEqual([])
  })

  it('the golden recording is untouched by pairing (no start/end pairs inside it)', async () => {
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
