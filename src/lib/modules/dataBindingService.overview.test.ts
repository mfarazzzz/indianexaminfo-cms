/**
 * dataBindingService.overview.test.ts — S1 item 5: the Overview auto template.
 *
 * Pins the fixes to the sentence the template used to write as "It is a exam.":
 *  - a/an article is chosen from the category display name;
 *  - the category clause is OMITTED entirely when the record has no category;
 *  - the DISPLAY name (categories.name, verbatim — correct casing, "&" survives) is used,
 *    with a title-cased slug only as the legacy fallback.
 */
import { describe, it, expect } from 'vitest'
import { generateOverviewAuto, indefiniteArticle } from './dataBindingService'
import type { ExamIdentity } from '@/services/entranceExamService'

function exam(overrides: Partial<ExamIdentity> = {}): ExamIdentity {
  return {
    id: 'ex-1',
    slug: 'up-dled-2026-phase-3',
    name: 'UP D.ElEd 2026 Phase 3',
    shortName: 'UP DLED',
    pillar: 'entrance-exam' as ExamIdentity['pillar'],
    region: 'all-india',
    category: 'teacher-education',
    categoryName: 'Teacher Education',
    subcategory: '',
    categoryId: 'cat-1',
    subcategoryId: null,
    entityType: 'exam',
    selectionModel: 'merit-based' as ExamIdentity['selectionModel'],
    conductingBody: 'MEERUT UNIVERSITY',
    officialWebsite: 'https://example.ac.in',
    cycleFrequency: 'annual',
    selectionProcess: [],
    tags: [],
    searchKeywords: [],
    seoTitle: null,
    seoDescription: null,
    isFeatured: false,
    workflowStatus: 'draft',
    isPublished: false,
    isVerified: false,
    faqs: [],
    currentEditionId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as ExamIdentity
}

describe('indefiniteArticle', () => {
  it('uses "an" before a vowel sound spelt with a vowel letter', () => {
    expect(indefiniteArticle('Engineering & Technology')).toBe('an')
    expect(indefiniteArticle('entrance exam')).toBe('an')
  })
  it('uses "a" elsewhere', () => {
    expect(indefiniteArticle('Teacher Education')).toBe('a')
    expect(indefiniteArticle('Police Recruitment')).toBe('a')
  })
})

describe('generateOverviewAuto — the category sentence (S1 item 5)', () => {
  it('writes the display name with correct casing and the right article — never "a exam"', () => {
    const out = generateOverviewAuto(exam(), null) as { body: string }
    expect(out.body).toContain('It is a Teacher Education exam.')
    expect(out.body).not.toMatch(/\ba (?:exam|  exam)\b/)
  })

  it('keeps an ampersand in the category name verbatim', () => {
    const out = generateOverviewAuto(
      exam({ category: 'engineering-technology', categoryName: 'Engineering & Technology' }),
      null,
    ) as { body: string }
    expect(out.body).toContain('It is an Engineering & Technology exam.')
    expect(out.body).not.toContain('&amp;')
  })

  it('OMITS the category clause when the record has no category', () => {
    const out = generateOverviewAuto(exam({ category: '', categoryName: '' }), null) as { body: string }
    expect(out.body).not.toContain('It is')
    expect(out.body).toContain('is conducted by <strong>MEERUT UNIVERSITY</strong>. Current status')
  })

  it('falls back to a title-cased slug for legacy rows whose join carried no name', () => {
    const out = generateOverviewAuto(exam({ categoryName: '' }), null) as { body: string }
    expect(out.body).toContain('It is a Teacher Education exam.')
  })
})
