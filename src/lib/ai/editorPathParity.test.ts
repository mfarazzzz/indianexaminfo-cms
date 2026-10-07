/**
 * S2.10.4 — the editor path and the golden path are the SAME path.
 *
 * Before S2.10 the editor ran buildReviewRows over the raw server object with a
 * duplicate toProposedRow, so none of the pipeline guarantees applied to what
 * the owner actually used. These tests mock the exact editor sequence
 * (generateStructured result → postProcessExtraction → buildReviewRows) and pin
 * that its output equals the pipeline / expected.json row-for-row.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseNoticeAnswer, postProcessExtraction } from './noticePipeline'
import type { AllowedOptions } from './extractionContract'
import { buildReviewRows } from '@/components/entrance-exams/noticeReview'

const FIX = (name: string) => resolve(__dirname, `./__fixtures__/up-deled-2026-phase3/${name}`)
const pastedText = readFileSync(FIX("pasted.txt"), 'utf8').replace(/\r\n/g, '\n')
const recording = JSON.parse(readFileSync(FIX("model.responses.json"), 'utf8')) as { raw: string }
const expected = JSON.parse(readFileSync(FIX("expected.json"), 'utf8'))

const allowed: AllowedOptions = {
  categories: [
    { slug: 'teaching-and-education', name: 'Teaching and Education' },
    { slug: 'engineering', name: 'Engineering' },
    { slug: 'management', name: 'Management' },
  ],
  regions: [{ slug: 'up', label: 'Uttar Pradesh' }, { slug: 'all-india', label: 'All India' }],
  entityTypes: ['exam', 'university-admission'],
  selectionModels: ['written-exam', 'merit-based', 'interview-based', 'internal-admission'],
}

// The server returns the model's object; generateStructured hands back
// `content`. The editor feeds THAT object straight to postProcessExtraction —
// the same function the golden test drives with the raw string.
describe('editor path parity — buildReviewRows equals the pipeline (S2.10)', () => {
  const serverValidated = parseNoticeAnswer(recording.raw)
  const result = postProcessExtraction(serverValidated, allowed, pastedText, 2026)
  const rows = buildReviewRows(result, {}, [])

  it('produces date rows byte-identical to the pipeline result', () => {
    const dateRows = rows.filter((r) => r.kind === 'date').map((r) => r.row)
    expect(dateRows).toEqual(result.rows) // mapping introduced no re-derivation
  })

  it('and those rows equal expected.json, row for row', () => {
    const dateRows = rows.filter((r) => r.kind === 'date').map((r) => r.row)
    expect(dateRows).toEqual(expected.dates)
    expect(dateRows).toHaveLength(4)
  })

  it('field values shown to the editor equal expected.json', () => {
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(byId.name.proposed).toBe(expected.name.value)
    expect(byId.selectionModel.proposed).toBe(expected.selectionModel.value)
    expect(byId.categorySlug.proposed).toBe(expected.categorySlug.value)
    // utm stripped before display (see the dedicated test below).
    expect(byId.officialWebsite.proposed).toBe('https://updeled.gov.in/')
  })

  it('the page-2 distribution stray NEVER reaches the editor as a date row', () => {
    expect(rows.some((r) => r.kind === 'date' && r.label.includes('Principals notification'))).toBe(false)
    expect(result.rejected.some((r) => r.label === 'Principals notification (all DIETs)')).toBe(true)
  })
})

describe('editor path — verbatim quote + URL hygiene reach the review (S2.10)', () => {
  it('a utm/tracking URL is stripped before display', () => {
    const result = postProcessExtraction(
      { fields: { officialWebsite: { value: 'https://updeled.gov.in/?utm_source=chatgpt.com', confidence: 0.9, sourceQuote: 'updeled.gov.in' } }, dates: [] } as Record<string, unknown>,
      allowed,
      'website updeled.gov.in/?utm_source=chatgpt.com',
      2026,
    )
    const rows = buildReviewRows(result, {}, [])
    const site = rows.find((r) => r.id === 'officialWebsite')!
    expect(site.proposed).toBe('https://updeled.gov.in/')
    expect(site.proposed).not.toContain('utm')
  })

  it('a date row whose quote is not verbatim is flagged and not default-accepted', () => {
    const result = postProcessExtraction(
      { fields: {}, dates: [{ label: 'Result', dateText: '01.12.2026', type: 'result', kind: 'result', confidence: 0.95, sourceQuote: 'INVENTED LINE NOT IN NOTICE' }] } as Record<string, unknown>,
      allowed,
      'result declared later',
      2026,
    )
    const rows = buildReviewRows(result, {}, [])
    const date = rows.find((r) => r.kind === 'date')!
    expect(date.flagReason).toContain('verbatim')
    expect(date.defaultAccept).toBe(false)
  })
})
