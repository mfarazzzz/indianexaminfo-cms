/**
 * R1.9 — Duplicate-slug friendly error test.
 *
 * Verifies that createEntranceExam throws a structured error with:
 *   - code: 'DUPLICATE_SLUG'
 *   - existingExam: { id, name, status }
 *   - message: parseable "DUPLICATE_SLUG::<id>::<name>::<status>" format
 *
 * The UI (EntranceExamEditorPage handleSave catch) reads these fields to
 * render a friendly toast with a link to the existing record.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ db: { from: (...args: any[]) => mockFrom(...args) } }))
vi.mock('@/services/moduleRegistryService', () => ({
  getModuleRegistry: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/revalidate', () => ({ revalidateExams: vi.fn().mockResolvedValue(undefined) }))

import { createEntranceExam, type NewExamInput } from './entranceExamService'

/** Build a chain where .select().eq().maybeSingle() resolves with the given data. */
function installSlugCheck(data: Record<string, unknown> | null) {
  const chain: Record<string, any> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error: null })
  mockFrom.mockReturnValue(chain)
}

const input: NewExamInput = {
  name: 'UP Deled Entrance',
  shortName: 'UP DELED',
  slug: 'up-deled-entrance',
  region: 'all-india',
  categoryId: 'cat-1',
  conductingBody: 'MEERUT UNIVERSITY',
  officialWebsite: 'https://updeled.gov.in',
  selectionModel: 'merit-based',
  firstEditionYear: 2026,
}

beforeEach(() => { vi.clearAllMocks() })

describe('createEntranceExam duplicate slug (R1.9)', () => {
  it('throws error with code DUPLICATE_SLUG and existingExam metadata', async () => {
    installSlugCheck({ id: 'ex-dup-1', name: 'UP Deled Entrance', workflow_status: 'published' })

    try {
      await createEntranceExam(input)
      expect.unreachable('should have thrown')
    } catch (err: any) {
      expect(err.code).toBe('DUPLICATE_SLUG')
      expect(err.existingExam).toEqual({
        id: 'ex-dup-1',
        name: 'UP Deled Entrance',
        status: 'published',
      })
    }
  })

  it('error message is parseable: DUPLICATE_SLUG::<id>::<name>::<status>', async () => {
    installSlugCheck({ id: 'ex-99', name: 'JEE Main 2026', workflow_status: 'draft' })

    await expect(createEntranceExam(input)).rejects.toThrow(
      /DUPLICATE_SLUG::ex-99::JEE Main 2026::draft/,
    )
  })

  it('null workflow_status on the existing row defaults to "draft" in the error', async () => {
    installSlugCheck({ id: 'ex-5', name: 'Old Exam', workflow_status: null })

    try {
      await createEntranceExam(input)
      expect.unreachable('should have thrown')
    } catch (err: any) {
      expect(err.existingExam.status).toBe('draft')
    }
  })

  it('does NOT throw when the slug is free (maybeSingle returns null)', async () => {
    // Slug check: null (no conflict). Then insert chain: succeed.
    let callCount = 0
    mockFrom.mockImplementation(() => {
      const chain: Record<string, any> = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.insert = vi.fn(() => chain)
      chain.update = vi.fn(() => chain)
      callCount++
      if (callCount === 1) {
        // First call: slug uniqueness check
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
      } else {
        // Subsequent calls: inserts
        chain.single = vi.fn().mockResolvedValue({
          data: { id: 'ex-new', slug: 'up-deled-entrance', name: 'UP Deled Entrance', pillar: 'entrance-exam', workflow_status: 'draft', created_at: '', updated_at: '' },
          error: null,
        })
      }
      return chain
    })

    // Should NOT throw DUPLICATE_SLUG
    await expect(createEntranceExam(input)).resolves.toBeDefined()
  })
})
