/**
 * entityService.test.ts
 *
 * Unit tests for the entity service layer.
 * All Supabase calls are mocked — no network required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSlug } from '@/lib/validation/entitySchemas'

// ── generateSlug tests (pure function — no mock needed) ──────────────────────

describe('generateSlug (utility)', () => {
  it('converts name to lowercase hyphenated slug', () => {
    expect(generateSlug('IBPS PO 2025')).toBe('ibps-po-2025')
  })

  it('strips special characters', () => {
    expect(generateSlug('SSC (CGL) Tier-I')).toBe('ssc-cgl-tier-i')
  })

  it('collapses consecutive whitespace', () => {
    expect(generateSlug('UPSC  Civil  Services')).toBe('upsc-civil-services')
  })

  it('truncates at 255 characters', () => {
    const result = generateSlug('a '.repeat(200))
    expect(result.length).toBeLessThanOrEqual(255)
  })

  it('returns empty string for all-special-char input', () => {
    expect(generateSlug('!!!')).toBe('')
  })
})

// ── Mocked entityService tests ────────────────────────────────────────────────

// Mock the db client before importing the service
vi.mock('@/lib/supabase/client', () => ({
  db: {
    from: vi.fn(),
  },
}))

// Also mock all satellite services imported by entityService (for getEntityFull)
vi.mock('./timelineService', () => ({ listTimeline: vi.fn(() => Promise.resolve([])) }))
vi.mock('./moduleService',   () => ({ listModules:  vi.fn(() => Promise.resolve([])) }))
vi.mock('./seoService',      () => ({ getSeo:        vi.fn(() => Promise.resolve(null)) }))
vi.mock('./eligibilityService', () => ({ getEligibility: vi.fn(() => Promise.resolve(null)) }))
vi.mock('./vacancyService',  () => ({ listVacancies: vi.fn(() => Promise.resolve([])) }))
vi.mock('./feeService',      () => ({ getFee:        vi.fn(() => Promise.resolve(null)) }))
vi.mock('./examPatternService', () => ({ listExamPattern: vi.fn(() => Promise.resolve([])) }))
vi.mock('./selectionService',   () => ({ listSelectionStages: vi.fn(() => Promise.resolve([])) }))
vi.mock('./syllabusService',    () => ({ listSyllabus: vi.fn(() => Promise.resolve([])) }))
vi.mock('./downloadService',    () => ({ listDownloads: vi.fn(() => Promise.resolve([])) }))
vi.mock('./linkService',        () => ({ listLinks:    vi.fn(() => Promise.resolve([])) }))

import { db } from '@/lib/supabase/client'
import {
  getEntityById,
  listEntities,
  softDeleteEntity,
  checkEntitySlug,
} from './entityService'

const mockFrom = vi.mocked(db.from)

/** Creates a fluent Supabase query builder mock */
function makeQueryMock(resolveValue: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'is', 'in', 'ilike', 'lt', 'lte', 'gte',
    'order', 'limit', 'single', 'maybeSingle',
  ]
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  // terminal methods resolve with the mock value
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(resolveValue)
  ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(resolveValue)
  // non-terminal methods return the chain (with spread to simulate count)
  const selectMock = chain.select as ReturnType<typeof vi.fn>
  selectMock.mockReturnValue({ ...chain, data: (resolveValue as { data?: unknown })?.data ?? null, error: null, count: 1 })
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getEntityById', () => {
  it('returns null when entity not found', async () => {
    const q = makeQueryMock({ data: null, error: null })
    mockFrom.mockReturnValue(q as never)
    const result = await getEntityById('non-existent-id')
    expect(result).toBeNull()
  })

  it('maps a DB row to Entity shape', async () => {
    const row = {
      id: 'abc123',
      entity_type: 'exam',
      slug: 'ibps-po-2025',
      name: 'IBPS PO 2025',
      short_name: 'IBPS PO',
      conducting_body: 'IBPS',
      official_website: 'https://ibps.in',
      category_id: null,
      pillar: 'sarkari-naukri',
      sub_type: 'exam',
      exam_level: 'national',
      exam_mode: 'online',
      application_mode: 'online',
      exam_frequency: 'annual',
      workflow_status: 'draft',
      is_featured: false,
      priority: null,
      featured_until: null,
      tags: ['banking'],
      search_keywords: [],
      scheduled_publish_at: null,
      published_at: null,
      published_by: null,
      lang: 'en',
      metadata: {},
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      created_by: null,
      updated_by: null,
      deleted_at: null,
    }
    // single() resolves with { data: row, error: null }
    const q: Record<string, unknown> = {}
    const methods = ['select','eq','is','single']
    methods.forEach(m => { q[m] = vi.fn(() => q) })
    ;(q.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: row, error: null })
    mockFrom.mockReturnValue(q as never)

    const entity = await getEntityById('abc123')
    expect(entity).not.toBeNull()
    expect(entity?.id).toBe('abc123')
    expect(entity?.name).toBe('IBPS PO 2025')
    expect(entity?.workflowStatus).toBe('draft')
    expect(entity?.tags).toEqual(['banking'])
    expect(entity?.deletedAt).toBeNull()
  })
})

describe('softDeleteEntity', () => {
  it('sets deleted_at on the row', async () => {
    const updateMock = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }))
    mockFrom.mockReturnValue({ update: updateMock } as never)

    await softDeleteEntity('abc123')

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) })
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calledWith = (updateMock.mock.calls as unknown as Array<[Record<string, string>]>)[0][0]
    // deleted_at should be a valid ISO timestamp
    expect(() => new Date(calledWith.deleted_at)).not.toThrow()
  })
})

describe('checkEntitySlug', () => {
  it('returns true when slug is available (no rows found)', async () => {
    const q: Record<string, unknown> = {}
    const methods = ['select','eq','is','neq']
    methods.forEach(m => { q[m] = vi.fn(() => q) })
    // Simulate: data = [] (no conflict)
    Object.defineProperty(q, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    })
    mockFrom.mockReturnValue(q as never)

    const available = await checkEntitySlug('ibps-po-2025', 'sarkari-naukri')
    expect(available).toBe(true)
  })
})
