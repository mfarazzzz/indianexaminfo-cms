/**
 * S2.4 — review drawer logic.
 *
 * Pins the safety rules: Accept pre-checked ONLY where the current value is
 * empty AND confidence ≥ 0.7; facts with no form field are never auto-applied;
 * every row carries its source quote; the fill report counts honestly.
 */
import { describe, expect, it } from 'vitest'
import { buildReviewRows, summarizeFill, describeDateRow } from './noticeReview'
import type { StructuredExtraction } from '@/lib/ai/aiFillClient'

const extraction = (fields: Record<string, unknown>, dates: Record<string, unknown>[], issues: any[] = []): StructuredExtraction => ({
  content: { fields, dates },
  issues,
  provider: 'groq',
  model: 'test-model',
  template: 'NOTICE_EXTRACT_V1',
})

const categories = [{ slug: 'teaching-and-education', id: 'cat-teach' }]

describe('buildReviewRows — default Accept rule (S2.4)', () => {
  it('accepts by default only when current is empty AND confidence ≥ 0.7', () => {
    const rows = buildReviewRows(
      extraction(
        {
          shortName: { value: 'UP DELED', confidence: 0.95, sourceQuote: 'UP D.El.Ed' },
          conductingBody: { value: 'MEERUT UNIVERSITY', confidence: 0.9, sourceQuote: 'Merut University' },
          name: { value: 'UP D.El.Ed Admission 2026', confidence: 0.4, sourceQuote: 'admission 2026' },
        },
        [],
        [],
      ),
      { name: '', shortName: '', conductingBody: 'Already set' },
      categories,
      2026,
    )
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(byId.shortName.defaultAccept).toBe(true)   // empty + confident
    expect(byId.conductingBody.defaultAccept).toBe(false) // NOT empty
    expect(byId.name.defaultAccept).toBe(false)       // confidence below floor
    expect(byId.shortName.sourceQuote).toBe('UP D.El.Ed')
  })

  it('categorySlug resolves to the real categoryId through the slug lookup', () => {
    const rows = buildReviewRows(
      extraction({ categorySlug: { value: 'teaching-and-education', confidence: 0.9, sourceQuote: 'D.El.Ed' } }, [], []),
      { categoryId: '' },
      categories,
      2026,
    )
    const cat = rows.find((r) => r.id === 'categorySlug')!
    expect(cat.formPath).toBe('categoryId')
    expect(cat.formValue).toBe('cat-teach')
    expect(cat.noFieldYet).toBe(false)
  })

  it('a category the CMS does not have is flagged noFieldYet — never blind-written', () => {
    const rows = buildReviewRows(
      extraction({ categorySlug: { value: 'nursing', confidence: 0.9, sourceQuote: 'B.Sc Nursing' } }, [], []),
      { categoryId: '' },
      categories,
      2026,
    )
    const cat = rows.find((r) => r.id === 'categorySlug')!
    expect(cat.noFieldYet).toBe(true)
    expect(cat.defaultAccept).toBe(false)
  })

  it('fee / warnings / contacts / noticeReference appear as flagged rows with no apply target', () => {
    const rows = buildReviewRows(
      extraction(
        {
          fee: { value: '₹5,000 choice-filling fee', confidence: 0.9, sourceQuote: 'पाँच हजार रुपये' },
          warnings: { value: 'admission invalid without institute lock', confidence: 0.9, sourceQuote: 'lock' },
          contacts: { value: 'secretarypnp.up@gmail.com', confidence: 0.9, sourceQuote: 'ईमेल' },
          noticeReference: { value: 'डीएलएड 2026 / 530-5603 / 2026-27', confidence: 0.95, sourceQuote: 'संदर्भ' },
        },
        [],
        [],
      ),
      {},
      categories,
      2026,
    )
    expect(rows).toHaveLength(4)
    for (const r of rows) {
      expect(r.noFieldYet).toBe(true)
      expect(r.defaultAccept).toBe(false)
      expect(r.formPath).toBeUndefined()
    }
  })
})

describe('buildReviewRows — date rows use the S2.2/S2.3 contract', () => {
  it('parses the Hindi window into the full row and describes it', () => {
    const rows = buildReviewRows(
      extraction({}, [
        {
          label: 'Choice Filling Phase-3', dateText: '05.10.2026 (अपराह्न) से 07.10.2026 सायं 06:00 बजे',
          type: 'counselling', kind: 'choice_filling', phase: 'Phase-3', rank_batch: '1–1,52,202',
          audience: 'candidate', confidence: 0.9, sourceQuote: 'चयन पूर्ण करण',
        },
      ], []),
      {},
      categories,
      2026,
    )
    const date = rows.find((r) => r.kind === 'date')!
    expect(date.row).toMatchObject({
      label: 'Choice Filling Phase-3',
      date: '2026-10-05',
      end_date: '2026-10-07',
      end_time: '18:00',
      time_text: 'afternoon',
      type: 'counselling',
      kind: 'choice_filling',
      phase: 'Phase-3',
      rank_batch: '1–1,52,202',
      audience: 'candidate',
      verified: false,
      state: 'confirmed',
    })
    expect(date.defaultAccept).toBe(true) // confident date → offered
    expect(describeDateRow(date.row!)).toContain('→ 2026-10-07')
    expect(describeDateRow(date.row!)).toContain('end 18:00 IST')
  })

  it('an unparseable or empty dateText yields NO row (nothing blank is proposed)', () => {
    const rows = buildReviewRows(
      extraction({}, [{ label: 'X', dateText: 'no date here', type: 'other', kind: 'other', confidence: 0.9, sourceQuote: 'q' }], []),
      {}, categories, 2026,
    )
    expect(rows.filter((r) => r.kind === 'date')).toHaveLength(0)
  })
})

describe('buildReviewRows — S2.2a status-safety gate on applied rows', () => {
  const rankDates = [
    { label: 'State Rank Release', dateText: '10.08.2026', type: 'merit_list', kind: 'rank_release', confidence: 0.9, sourceQuote: 'राज्य रैंक' },
  ]

  it('a merit-based PROPOSAL gates the rank row to type "other" even though the model said merit_list', () => {
    const rows = buildReviewRows(
      extraction({ selectionModel: { value: 'merit-based', confidence: 0.9, sourceQuote: 'no test' } }, rankDates, []),
      {}, categories, 2026,
    )
    const date = rows.find((r) => r.kind === 'date')!
    expect(date.row!.type).toBe('other')
    expect(date.row!.kind).toBe('rank_release')
  })

  it('a written-exam record keeps merit_list for the same row', () => {
    const rows = buildReviewRows(extraction({}, rankDates, []), { selectionModel: 'written-exam' }, categories, 2026)
    const date = rows.find((r) => r.kind === 'date')!
    expect(date.row!.type).toBe('merit_list')
  })

  it('an empty (server-rejected) selection-model proposal falls back to the current model', () => {
    const rows = buildReviewRows(
      extraction({ selectionModel: { value: '', confidence: 0.4, sourceQuote: 'x' } }, rankDates, []),
      { selectionModel: 'written-exam' }, categories, 2026,
    )
    const date = rows.find((r) => r.kind === 'date')!
    expect(date.row!.type).toBe('merit_list') // current model governs, not the rejected proposal
  })

  it('internal-admission gates too', () => {
    const rows = buildReviewRows(extraction({}, rankDates, []), { selectionModel: 'internal-admission' }, categories, 2026)
    expect(rows.find((r) => r.kind === 'date')!.row!.type).toBe('other')
  })
})

describe('summarizeFill — the report on top of the drawer', () => {
  it('counts proposed/accepted/flagged and lists reasons', () => {
    const rows = buildReviewRows(
      extraction(
        {
          shortName: { value: 'AB', confidence: 0.9, sourceQuote: 'q' },
          fee: { value: '₹5,000', confidence: 0.9, sourceQuote: 'q' },
        },
        [],
        [
          { field: 'region', reason: 'low_confidence', detail: 'confidence 0.4 is below 0.7' },
          { field: 'categorySlug', reason: 'not_an_option', detail: '"nursing" is not in the CMS list' },
        ],
      ),
      {}, categories, 2026,
    )
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
