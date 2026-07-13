import { describe, it, expect } from 'vitest'
import {
  EntityCreateSchema,
  TimelineEventSchema,
  EligibilitySchema,
  VacancyRowSchema,
  FeeSchema,
  ExamPatternStageSchema,
  SelectionStageSchema,
  SyllabusSubjectSchema,
  SEOSchema,
  LinkSchema,
  DownloadSchema,
  generateSlug,
} from './entitySchemas'

// ── generateSlug ──────────────────────────────────────────────────────────────

describe('generateSlug', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(generateSlug('IBPS PO 2025')).toBe('ibps-po-2025')
  })

  it('strips non-alphanumeric characters', () => {
    expect(generateSlug('SSC CGL (Tier-1)')).toBe('ssc-cgl-tier-1')
  })

  it('collapses multiple spaces into one hyphen', () => {
    expect(generateSlug('UPSC  Civil  Services')).toBe('upsc-civil-services')
  })

  it('truncates at 255 characters', () => {
    const long = 'a '.repeat(150)
    expect(generateSlug(long).length).toBeLessThanOrEqual(255)
  })

  it('returns empty string for non-alphanumeric input', () => {
    expect(generateSlug('!!!')).toBe('')
  })
})

// ── EntityCreateSchema ────────────────────────────────────────────────────────

describe('EntityCreateSchema', () => {
  const valid = {
    name: 'IBPS PO 2025',
    shortName: 'IBPS PO',
    slug: 'ibps-po-2025',
    conductingBody: 'Institute of Banking Personnel Selection',
    workflowStatus: 'draft' as const,
    isFeatured: false,
    tags: [],
    searchKeywords: [],
    lang: 'en',
  }

  it('accepts a valid input', () => {
    const result = EntityCreateSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = EntityCreateSchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain('name')
  })

  it('rejects name over 200 characters', () => {
    const result = EntityCreateSchema.safeParse({ ...valid, name: 'x'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts empty conductingBody (field is now optional — FK conductingBodyId preferred)', () => {
    const result = EntityCreateSchema.safeParse({ ...valid, conductingBody: '' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid URL for officialWebsite', () => {
    const result = EntityCreateSchema.safeParse({ ...valid, officialWebsite: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('accepts null officialWebsite', () => {
    const result = EntityCreateSchema.safeParse({ ...valid, officialWebsite: null })
    expect(result.success).toBe(true)
  })

  it('rejects invalid workflowStatus', () => {
    const result = EntityCreateSchema.safeParse({ ...valid, workflowStatus: 'banana' })
    expect(result.success).toBe(false)
  })

  it('rejects priority outside 1–999', () => {
    const r1 = EntityCreateSchema.safeParse({ ...valid, priority: 0 })
    const r2 = EntityCreateSchema.safeParse({ ...valid, priority: 1000 })
    expect(r1.success).toBe(false)
    expect(r2.success).toBe(false)
  })

  it('rejects slug with uppercase letters', () => {
    const result = EntityCreateSchema.safeParse({ ...valid, slug: 'IBPS-PO' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with spaces', () => {
    const result = EntityCreateSchema.safeParse({ ...valid, slug: 'ibps po' })
    expect(result.success).toBe(false)
  })
})

// ── TimelineEventSchema ───────────────────────────────────────────────────────

describe('TimelineEventSchema', () => {
  const valid = {
    title: 'Application Start',
    eventType: 'application-start',
    eventDate: '2025-08-01',
  }

  it('accepts minimal valid input', () => {
    expect(TimelineEventSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects missing title', () => {
    const r = TimelineEventSchema.safeParse({ ...valid, title: '' })
    expect(r.success).toBe(false)
  })

  it('rejects missing eventDate', () => {
    const r = TimelineEventSchema.safeParse({ ...valid, eventDate: '' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const r = TimelineEventSchema.safeParse({ ...valid, eventDate: '01-08-2025' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid officialLink URL', () => {
    const r = TimelineEventSchema.safeParse({ ...valid, officialLink: 'not-a-url' })
    expect(r.success).toBe(false)
  })

  it('accepts null officialLink', () => {
    const r = TimelineEventSchema.safeParse({ ...valid, officialLink: null })
    expect(r.success).toBe(true)
  })
})

// ── EligibilitySchema ─────────────────────────────────────────────────────────

describe('EligibilitySchema', () => {
  it('accepts fully empty input', () => {
    expect(EligibilitySchema.safeParse({}).success).toBe(true)
  })

  it('rejects minAge > maxAge', () => {
    const r = EligibilitySchema.safeParse({ minAge: 30, maxAge: 25 })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toContain('minAge')
  })

  it('accepts minAge === maxAge', () => {
    const r = EligibilitySchema.safeParse({ minAge: 25, maxAge: 25 })
    expect(r.success).toBe(true)
  })

  it('accepts minAge < maxAge', () => {
    const r = EligibilitySchema.safeParse({ minAge: 18, maxAge: 35 })
    expect(r.success).toBe(true)
  })
})

// ── VacancyRowSchema ──────────────────────────────────────────────────────────

describe('VacancyRowSchema', () => {
  const valid = { category: 'total', label: 'Total', value: 100 }

  it('accepts valid row', () => {
    expect(VacancyRowSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects negative value', () => {
    expect(VacancyRowSchema.safeParse({ ...valid, value: -1 }).success).toBe(false)
  })

  it('rejects non-integer value', () => {
    expect(VacancyRowSchema.safeParse({ ...valid, value: 1.5 }).success).toBe(false)
  })

  it('accepts zero value', () => {
    expect(VacancyRowSchema.safeParse({ ...valid, value: 0 }).success).toBe(true)
  })
})

// ── FeeSchema ─────────────────────────────────────────────────────────────────

describe('FeeSchema', () => {
  it('accepts fully empty input', () => {
    expect(FeeSchema.safeParse({}).success).toBe(true)
  })

  it('rejects negative fee', () => {
    expect(FeeSchema.safeParse({ general: -1 }).success).toBe(false)
  })

  it('accepts zero fee (free exam)', () => {
    expect(FeeSchema.safeParse({ general: 0 }).success).toBe(true)
  })
})

// ── ExamPatternStageSchema ────────────────────────────────────────────────────

describe('ExamPatternStageSchema', () => {
  it('rejects missing stageName', () => {
    const r = ExamPatternStageSchema.safeParse({ stageName: '' })
    expect(r.success).toBe(false)
  })

  it('accepts valid stage', () => {
    const r = ExamPatternStageSchema.safeParse({
      stageName: 'Prelims',
      totalQuestions: 100,
      totalMarks: 100,
      negativeMarking: 0.25,
    })
    expect(r.success).toBe(true)
  })
})

// ── SyllabusSubjectSchema ─────────────────────────────────────────────────────

describe('SyllabusSubjectSchema', () => {
  it('rejects missing subjectName', () => {
    const r = SyllabusSubjectSchema.safeParse({ subjectName: '' })
    expect(r.success).toBe(false)
  })

  it('accepts valid subject', () => {
    const r = SyllabusSubjectSchema.safeParse({
      subjectName: 'Quantitative Aptitude',
      topics: ['Number System', 'Simplification'],
      weightagePercent: 25,
    })
    expect(r.success).toBe(true)
  })
})

// ── SEOSchema ─────────────────────────────────────────────────────────────────

describe('SEOSchema', () => {
  it('accepts empty SEO (all optional)', () => {
    expect(SEOSchema.safeParse({}).success).toBe(true)
  })

  it('allows seoTitle over 60 chars (warns, does not block)', () => {
    // R16.2: warn but don't block on length exceeded
    const r = SEOSchema.safeParse({ seoTitle: 'x'.repeat(61) })
    expect(r.success).toBe(true)
  })

  it('rejects invalid canonical URL', () => {
    const r = SEOSchema.safeParse({ canonicalUrl: 'not-a-url' })
    expect(r.success).toBe(false)
  })
})

// ── LinkSchema ────────────────────────────────────────────────────────────────

describe('LinkSchema', () => {
  const valid = { label: 'Apply Online', url: 'https://ibps.in/apply' }

  it('accepts valid link', () => {
    expect(LinkSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects missing label', () => {
    expect(LinkSchema.safeParse({ ...valid, label: '' }).success).toBe(false)
  })

  it('rejects invalid URL', () => {
    expect(LinkSchema.safeParse({ ...valid, url: 'not-a-url' }).success).toBe(false)
  })
})
