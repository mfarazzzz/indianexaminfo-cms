/**
 * S2.1 — the options-aware extraction contract.
 *
 * Pins: confidence floor 0.7 + membership in the allowed list decide EVERY
 * dropdown; rejections leave the field EMPTY and FLAGGED with an optional
 * suggestedNewOption; legacy flat drafts (and pasted JSON) are enforced by
 * membership and never save an out-of-list slug.
 */
import { describe, expect, it } from 'vitest'
import {
  OPTION_CONFIDENCE_FLOOR,
  resolveOption,
  resolveDraftFields,
  enforceOptionsOnDraft,
  type AllowedOptions,
} from './extractionContract'
import { entityTypesForPillar } from './allowedOptions'

const allowed: AllowedOptions = {
  categories: [
    { slug: 'teaching-and-education', name: 'Teaching and Education' },
    { slug: 'engineering', name: 'Engineering' },
  ],
  regions: [{ slug: 'up', label: 'Uttar Pradesh' }, { slug: 'all-india', label: 'All India' }],
  entityTypes: ['exam', 'university-admission'],
  selectionModels: ['written-exam', 'merit-based', 'interview-based', 'internal-admission'],
}

describe('resolveOption — the 0.7 + membership rule (S2.1)', () => {
  it('accepts a listed option at/above the floor', () => {
    const r = resolveOption({ value: 'teaching-and-education', confidence: 0.9, sourceQuote: ' Diploma in Elementary Education' }, allowed.categories.map((c) => c.slug))
    expect(r).toMatchObject({ value: 'teaching-and-education', flagged: false })
  })

  it('exactly at the floor counts as confident', () => {
    expect(OPTION_CONFIDENCE_FLOOR).toBe(0.7)
    const r = resolveOption({ value: 'up', confidence: 0.7, sourceQuote: 'Uttar Pradesh' }, allowed.regions.map((x) => x.slug))
    expect(r.flagged).toBe(false)
  })

  it('below the floor: value is EMPTY, reason low_confidence', () => {
    const r = resolveOption({ value: 'teaching-and-education', confidence: 0.55, sourceQuote: 'x' }, ['teaching-and-education'])
    expect(r.value).toBe('')
    expect(r.flagged).toBe(true)
    expect(r.reason).toBe('low_confidence')
  })

  it('not in the list: value EMPTY, reason not_an_option, suggestion kept', () => {
    const r = resolveOption({ value: 'nursing', confidence: 0.9, sourceQuote: 'B.Sc Nursing admission', suggestedNewOption: 'nursing' }, allowed.categories.map((c) => c.slug))
    expect(r.value).toBe('')
    expect(r.reason).toBe('not_an_option')
    expect(r.suggestedNewOption).toBe('nursing')
  })

  it('empty value: flagged no_value, never a silent blank', () => {
    const r = resolveOption({ value: null, confidence: 0, sourceQuote: '' }, ['exam'])
    expect(r.flagged).toBe(true)
    expect(r.reason).toBe('no_value')
  })

  it('matching is case-insensitive on the VALUE and returns the canonical option', () => {
    const r = resolveOption({ value: 'Teaching-And-Education', confidence: 0.8, sourceQuote: 'q' }, ['teaching-and-education'])
    expect(r.value).toBe('teaching-and-education')
  })

  it('a display NAME is never accepted — only the slug value', () => {
    const r = resolveOption({ value: 'Teaching and Education', confidence: 0.95, sourceQuote: 'q' }, allowed.categories.map((c) => c.slug))
    expect(r.value).toBe('')
    expect(r.reason).toBe('not_an_option')
  })
})

describe('resolveDraftFields — every dropdown in one pass (S2.1)', () => {
  it('carries the choice REASON through for entityType/selectionModel', () => {
    const fields = resolveDraftFields(
      {
        categorySlug: { value: 'teaching-and-education', confidence: 0.95, sourceQuote: 'Diploma in Elementary Education' },
        selectionModel: { value: 'merit-based', confidence: 0.9, sourceQuote: 'admission on academic merit', reason: 'no written test; admission by state merit rank' },
        entityType: { value: 'university-admission', confidence: 0.85, sourceQuote: 'counselling by the state', reason: 'state counselling route' },
        region: { value: 'up', confidence: 0.99, sourceQuote: 'Uttar Pradesh' },
      },
      allowed,
    )
    expect(fields.categorySlug.value).toBe('teaching-and-education')
    expect(fields.selectionModel.reasonNote).toBe('no written test; admission by state merit rank')
    expect(fields.entityType.value).toBe('university-admission')
    expect(Object.values(fields).every((f) => !f.flagged)).toBe(true)
  })

  it('a field absent from the draft stays absent (skipped, not errored)', () => {
    const fields = resolveDraftFields({ categorySlug: { value: 'engineering', confidence: 0.8, sourceQuote: 'q' } }, allowed)
    expect(fields.categorySlug).toBeDefined()
    expect(fields.region).toBeUndefined()
  })
})

describe('enforceOptionsOnDraft — flat legacy + pasted-JSON path (S2.1)', () => {
  it('drops an out-of-list slug and reports it', () => {
    const { draft, flags } = enforceOptionsOnDraft({ name: 'X', categorySlug: 'teaching', entityType: 'university' }, allowed)
    expect('categorySlug' in draft).toBe(false) // the OLD stale slug — rejected
    expect('entityType' in draft).toBe(false)   // "university" is not in the registry vocabulary
    expect(flags.map((f) => f.field).sort()).toEqual(['categorySlug', 'entityType'])
    expect(flags.every((f) => f.reason === 'not_an_option')).toBe(true)
  })

  it('keeps valid values, normalising case; no flags', () => {
    const { draft, flags } = enforceOptionsOnDraft({ categorySlug: 'Teaching-and-Education', selectionModel: 'merit-based' }, allowed)
    expect(draft.categorySlug).toBe('teaching-and-education')
    expect(draft.selectionModel).toBe('merit-based')
    expect(flags).toEqual([])
  })

  it('leaves untouched fields alone (only the four dropdowns are policed)', () => {
    const { draft, flags } = enforceOptionsOnDraft({ name: 'UP D.El.Ed Admission 2026', vacancy: 5000 }, allowed)
    expect(draft.name).toBe('UP D.El.Ed Admission 2026')
    expect(flags).toEqual([])
  })
})

describe('entityTypesForPillar — pillar narrows the registry list (S2.1)', () => {
  it('entrance-exam offers the two legal choices', () => {
    expect(entityTypesForPillar('entrance-exam').sort()).toEqual(['exam', 'university-admission'])
  })
  it('a fixed pillar yields exactly its one type', () => {
    expect(entityTypesForPillar('board-exam')).toEqual(['board'])
    expect(entityTypesForPillar('university-exam')).toEqual(['university-exam'])
  })
  it('no pillar → the whole registry vocabulary', () => {
    expect(entityTypesForPillar()).toContain('recruitment')
  })
})
