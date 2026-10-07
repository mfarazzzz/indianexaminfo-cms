/**
 * S2.4 / S2.10 — review drawer logic.
 *
 * Two things are pinned here:
 *  • buildReviewRows MAPS a PipelineResult to review rows — Accept pre-checked
 *    ONLY where current is empty AND confidence ≥ 0.7 AND the pipeline did not
 *    flag the item; facts with no form slot are never auto-applied; every row
 *    carries its source quote.
 *  • the DERIVATION (Hindi window, S2.2a gate) now happens in postProcessExtraction
 *    and flows straight into buildReviewRows — the ONE code path the editor uses.
 */
import { describe, expect, it } from 'vitest'
import { buildReviewRows, summarizeFill, describeDateRow } from './noticeReview'
import type { ReviewCurrentValues, CategoryLookup } from './noticeReview'
import { postProcessExtraction, type PipelineResult, type PipelineField, type PipelineDateRow } from '@/lib/ai/noticePipeline'
import type { AllowedOptions } from '@/lib/ai/extractionContract'

const categories: CategoryLookup[] = [{ slug: 'teaching-and-education', id: 'cat-teach' }]

/** A PipelineField for hand-built mapping tests. */
const pf = (value: string, confidence: number, sourceQuote = 'q', flagged = false, flagReason?: string): PipelineField =>
  ({ value, confidence, sourceQuote, flagged, flagReason })

/** A hand-built PipelineResult (fields only) for pure mapping tests. */
const resultWithFields = (fields: Record<string, PipelineField>): PipelineResult =>
  ({ fields, rows: [], references: [], rejected: [], warnings: [], mergedWindows: [] })

/** A one-field PipelineDateRow good enough for mapping tests. */
const dateRow = (over: Partial<PipelineDateRow>): PipelineDateRow =>
  ({ label: 'X', date: '2026-10-05', type: 'counselling', kind: 'choice_filling', isUrgent: true, state: 'confirmed', verified: false, source_quote: 'q', confidence: 0.9, ...over })

/** Run the real pipeline over a server-shaped extraction (single code path). */
const allowed: AllowedOptions = {
  categories: [{ slug: 'teaching-and-education', name: 'Teaching and Education' }], regions: [{ slug: 'up', label: 'Uttar Pradesh' }],
  entityTypes: ['exam', 'university-admission'],
  selectionModels: ['written-exam', 'merit-based', 'interview-based', 'internal-admission'],
}
const pipe = (fields: Record<string, unknown>, dates: unknown[], source: string, sel: string | null = null): PipelineResult =>
  postProcessExtraction({ fields, dates } as Record<string, unknown>, allowed, source, 2026, sel)

describe('buildReviewRows — default Accept rule (S2.4)', () => {
  it('accepts by default only when current is empty AND confidence ≥ 0.7', () => {
    const rows = buildReviewRows(
      resultWithFields({
        shortName: pf('UP DELED', 0.95, 'UP D.El.Ed'),
        conductingBody: pf('MEERUT UNIVERSITY', 0.9, 'Merut University'),
        name: pf('UP D.El.Ed Admission 2026', 0.4, 'admission 2026'),
      }),
      { name: '', shortName: '', conductingBody: 'Already set' } as ReviewCurrentValues,
      categories,
    )
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(byId.shortName.defaultAccept).toBe(true)      // empty + confident
    expect(byId.conductingBody.defaultAccept).toBe(false) // NOT empty
    expect(byId.name.defaultAccept).toBe(false)           // confidence below floor
    expect(byId.shortName.sourceQuote).toBe('UP D.El.Ed')
  })

  it('a FLAGGED field is never default-accepted and carries its flagReason', () => {
    const rows = buildReviewRows(
      resultWithFields({
        eligibility: pf('State Rank 01 to 1,52,202 not yet allotted', 0.9, 'समस्त आवंटित अभ्यर्थी', true, 'source quote reads "आवंटित अभ्यर्थी" (allotted) without a negation'),
      }),
      {} as ReviewCurrentValues,
      categories,
    )
    const el = rows.find((r) => r.id === 'eligibility')!
    expect(el.defaultAccept).toBe(false)
    expect(el.flagReason).toContain('आवंटित अभ्यर्थी')
  })

  it('categorySlug resolves to the real categoryId through the slug lookup', () => {
    const rows = buildReviewRows(resultWithFields({ categorySlug: pf('teaching-and-education', 0.9, 'D.El.Ed') }), { categoryId: '' } as ReviewCurrentValues, categories)
    const cat = rows.find((r) => r.id === 'categorySlug')!
    expect(cat.formPath).toBe('categoryId')
    expect(cat.formValue).toBe('cat-teach')
    expect(cat.noFieldYet).toBe(false)
  })

  it('a category the CMS does not have is flagged noFieldYet — never blind-written', () => {
    const rows = buildReviewRows(resultWithFields({ categorySlug: pf('nursing', 0.9, 'B.Sc Nursing') }), { categoryId: '' } as ReviewCurrentValues, categories)
    const cat = rows.find((r) => r.id === 'categorySlug')!
    expect(cat.noFieldYet).toBe(true)
    expect(cat.defaultAccept).toBe(false)
  })

  it('fee / warnings / contacts / noticeReference appear as flagged rows with no apply target', () => {
    const rows = buildReviewRows(
      resultWithFields({
        fee: pf('₹5,000 choice-filling fee', 0.9, 'पाँच हजार'),
        warnings: pf('admission invalid without institute lock', 0.9, 'lock'),
        contacts: pf('secretarypnp.up@gmail.com', 0.9, 'ईमेल'),
        noticeReference: pf('डीएलएड 2026 / 530-5603 / 2026-27', 0.95, 'संदर्भ'),
      }),
      {} as ReviewCurrentValues,
      categories,
    )
    expect(rows).toHaveLength(4)
    for (const r of rows) {
      expect(r.noFieldYet).toBe(true)
      expect(r.defaultAccept).toBe(false)
      expect(r.formPath).toBeUndefined()
    }
  })
})

describe('buildReviewRows — date rows via the pipeline (S2.10 one path)', () => {
  it('the Hindi window parses end_date/end_time/time_text through postProcessExtraction and maps to a row', () => {
    const src = 'चयन पूर्ण करण 05.10.2026 (अपराह्न) से 07.10.2026 सायं 06:00 बजे'
    const result = pipe(
      { selectionModel: { value: 'merit-based', confidence: 0.9, sourceQuote: 'no test' } },
      [{ label: 'Choice Filling Phase-3', dateText: '05.10.2026 (अपराह्न) से 07.10.2026 सायं 06:00 बजे', type: 'counselling', kind: 'choice_filling', phase: 'Phase-3', rank_batch: '1–1,52,202', audience: 'candidate', confidence: 0.9, sourceQuote: 'चयन पूर्ण करण' }],
      src,
    )
    const rows = buildReviewRows(result, {} as ReviewCurrentValues, categories)
    const date = rows.find((r) => r.kind === 'date')!
    expect(date.row).toMatchObject({
      date: '2026-10-05', end_date: '2026-10-07', end_time: '18:00', time_text: 'afternoon',
      type: 'counselling', kind: 'choice_filling', phase: 'Phase-3', verified: false, state: 'confirmed',
    })
    expect(date.defaultAccept).toBe(true)
    expect(describeDateRow(date.row!)).toContain('→ 2026-10-07')
    expect(describeDateRow(date.row!)).toContain('end 18:00 IST')
  })

  it('a date whose quote is NOT verbatim in the source is flagged and not default-accepted', () => {
    const result = pipe({}, [{ label: 'Allotment', dateText: '08.10.2026', type: 'counselling', kind: 'allotment', confidence: 0.95, sourceQuote: 'THIS QUOTE IS INVENTED' }], 'seat allotment on 08.10.2026')
    const rows = buildReviewRows(result, {} as ReviewCurrentValues, categories)
    const date = rows.find((r) => r.kind === 'date')!
    expect(date.flagReason).toContain('verbatim')
    expect(date.defaultAccept).toBe(false)
  })

  it('an unparseable dateText yields NO row and is reported as rejected', () => {
    const result = pipe({}, [{ label: 'X', dateText: 'no date here', type: 'other', kind: 'other', confidence: 0.9, sourceQuote: 'q' }], 'q')
    const rows = buildReviewRows(result, {} as ReviewCurrentValues, categories)
    expect(rows.filter((r) => r.kind === 'date')).toHaveLength(0)
    expect(result.rejected.length).toBe(1)
  })
})

describe('buildReviewRows — S2.2a status-safety gate through the pipeline', () => {
  const rankDates = [{ label: 'State Rank Release', dateText: '10.08.2026', type: 'merit_list', kind: 'rank_release', confidence: 0.9, sourceQuote: 'राज्य रैंक' }]
  const src = 'राज्य रैंक 10.08.2026 को जारी'

  it('a merit-based PROPOSAL gates the rank row to type "other" even though the model said merit_list', () => {
    const result = pipe({ selectionModel: { value: 'merit-based', confidence: 0.9, sourceQuote: 'no test' } }, rankDates, src)
    const date = buildReviewRows(result, {} as ReviewCurrentValues, categories).find((r) => r.kind === 'date')!
    expect(date.row!.type).toBe('other')
    expect(date.row!.kind).toBe('rank_release')
  })

  it('a written-exam record keeps merit_list for the same row', () => {
    const result = pipe({}, rankDates, src, 'written-exam')
    const date = buildReviewRows(result, {} as ReviewCurrentValues, categories).find((r) => r.kind === 'date')!
    expect(date.row!.type).toBe('merit_list')
  })
})

describe('summarizeFill — the report on top of the drawer', () => {
  it('counts proposed/accepted/flagged and lists reasons', () => {
    const result = resultWithFields({ shortName: pf('AB', 0.9), fee: pf('₹5,000', 0.9) })
    const rows = buildReviewRows(result, {} as ReviewCurrentValues, categories)
    const report = summarizeFill(rows, [
      { field: 'region', reason: 'low_confidence', detail: 'x' },
      { field: 'categorySlug', reason: 'not_an_option', detail: 'y' },
    ])
    expect(report.proposed).toBe(2)
    expect(report.defaultAccepted).toBe(1)
    expect(report.noFieldYet).toBe(1)
    expect(report.missingOptions.some((m) => m.includes('categorySlug'))).toBe(true)
    expect(report.lowConfidence).toContain('region')
  })
})
