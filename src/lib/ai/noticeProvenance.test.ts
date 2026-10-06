/**
 * S2.6 — the notice as a document: provenance shape + reference handling.
 *
 * Pins: fill_source/notice/report/field_quotes/pending_documents per the
 * a1_ai_fill_options.sql convention; verified:false and published_by_ai:false
 * ALWAYS; runs history capped; a referenced notice becomes a document
 * reference row, never a "Notification Release" timeline row.
 */
import { describe, expect, it } from 'vitest'
import { buildNoticeAiMetadata } from './noticeProvenance'
import { buildReviewRows } from '@/components/entrance-exams/noticeReview'
import type { ReviewRow } from '@/components/entrance-exams/noticeReview'
import type { StructuredExtraction } from '@/lib/ai/aiFillClient'

const row = (over: Partial<ReviewRow>): ReviewRow => ({
  id: 'x', label: 'X', kind: 'field', current: '', proposed: 'p',
  sourceQuote: 'q', confidence: 0.9, defaultAccept: true, noFieldYet: false, ...over,
})

describe('buildNoticeAiMetadata — the a1 convention (S2.6)', () => {
  const meta = buildNoticeAiMetadata(undefined, {
    sourceType: 'pasted_text',
    noticeReference: 'डीएलएड 2026 / 530-5603 / 2026-27',
    provider: 'groq', model: 'llama-3.3-70b-versatile', template: 'NOTICE_EXTRACT_V1',
    report: { proposed: 2, defaultAccepted: 2, flagged: 0, noFieldYet: 0, lowConfidence: [], missingOptions: [] },
    issues: [],
    acceptedRows: [row({ id: 'name', proposed: 'UP D.El.Ed Admission 2026', sourceQuote: 'उपलब्धता' })],
    documentReferences: [{ label: 'Counselling notice', date: '2026-08-07', sourceQuote: 'पूर्व प्रकाशित विज्ञप्ति दिनांक 07.08.2026' }],
  }, '2026-10-06T04:00:00Z')

  it('records source, reference, template and quotes', () => {
    expect(meta).toMatchObject({
      fill_source: 'pasted_text',
      notice: { reference: 'डीएलएड 2026 / 530-5603 / 2026-27', date: null },
      extracted_at: '2026-10-06T04:00:00Z',
      template: 'NOTICE_EXTRACT_V1',
      provider: 'groq',
      verified: false,
      published_by_ai: false,
    })
    expect((meta.field_quotes as Record<string, string>).name).toBe('उपलब्धता')
  })

  it('pending_documents carries the attachment proposal + the referenced notice', () => {
    const docs = meta.pending_documents as Record<string, unknown>[]
    expect(docs[0].kind).toBe('notice_attachment')
    expect(docs[1]).toMatchObject({ kind: 'document_reference', label: 'Counselling notice', date: '2026-08-07' })
  })

  it('merges over previous metadata and caps runs at 10, newest last', () => {
    let acc: Record<string, unknown> = {}
    for (let i = 0; i < 12; i++) {
      acc = buildNoticeAiMetadata(acc, {
        sourceType: 'pasted_text', provider: 'p', model: 'm', template: 't',
        report: { proposed: 0, defaultAccepted: 0, flagged: 0, noFieldYet: 0, lowConfidence: [], missingOptions: [] },
        issues: [], acceptedRows: [],
      }, `2026-10-06T0${i}:00:00Z`)
    }
    expect((acc.runs as unknown[]).length).toBe(10)
    // The loop passes i=0..11 verbatim; the newest (i=11) is last.
    expect((acc.runs as Record<string, unknown>[])[9].extracted_at).toBe('2026-10-06T011:00:00Z')
    expect(acc.verified).toBe(false)
  })
})

describe('buildReviewRows — referenced notices never become date rows (S2.6)', () => {
  it('a "references" entry becomes a proposal row, not a timeline row', () => {
    const ext = {
      content: {
        fields: {},
        dates: [],
        references: [{
          label: 'Previously published counselling notice',
          dateText: '07.08.2026',
          confidence: 0.9,
          sourceQuote: 'पूर्व प्रकाशित विज्ञप्ति दिनांक 07.08.2026',
        }],
      },
      issues: [], provider: 'groq', model: 'm', template: 'NOTICE_EXTRACT_V1',
    } as unknown as StructuredExtraction
    const rows = buildReviewRows(ext, {}, [], 2026)
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.kind).toBe('proposal')
    expect(r.documentReference).toMatchObject({ label: 'Previously published counselling notice', date: '2026-08-07' })
    expect(r.formPath).toBeUndefined()
    expect(r.row).toBeUndefined()
  })
})
