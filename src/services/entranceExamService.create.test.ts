/**
 * entranceExamService.create.test.ts — S1 item 4: NO SILENT DEFAULTS ON CREATE.
 *
 * Pins the owner rule:
 *  1. New ENTRANCE records start as DRAFT — publishing is an explicit editor action,
 *     never a side effect of create (the old code hard-coded workflow_status "published").
 *  2. selectionModel is REQUIRED with no default — a blank throws instead of silently
 *     writing "written-exam".
 *  3. categoryId is REQUIRED for the entrance pillar — starred (*) in the editor but
 *     previously saved `|| null`, stranding records with no public URL.
 *  4. Other pillars routed through this shared create are NOT changed yet (report-only).
 * All Supabase calls are mocked — no network required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ db: { from: vi.fn() } }))
vi.mock('@/services/moduleRegistryService', () => ({
  getModuleRegistry: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/revalidate', () => ({ revalidateExams: vi.fn().mockResolvedValue(undefined) }))

import { db } from '@/lib/supabase/client'
import { createEntranceExam, type NewExamInput } from './entranceExamService'

const mockFrom = vi.mocked(db.from)

/** Chain whose terminal reads resolve; captures the insert payload per table. */
function installChains(opts: { examRow?: Record<string, unknown> }) {
  const inserted: Record<string, Record<string, unknown>> = {}
  mockFrom.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit']) chain[m] = vi.fn(() => chain)
    chain.insert = vi.fn((payload: Record<string, unknown>) => {
      inserted[table] = payload
      return chain
    })
    chain.update = chain.insert
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    chain.single = vi.fn().mockResolvedValue(
      table === 'exams'
        ? { data: opts.examRow ?? {}, error: null }
        : { data: { id: 'ed-1', exam_id: 'ex-1', created_at: '', updated_at: '' }, error: null },
    )
    return chain as never
  })
  return inserted
}

const baseInput: NewExamInput = {
  name: 'UP D.ElEd 2026 Phase 3',
  shortName: 'UP DLED PHASE 3',
  region: 'all-india',
  categoryId: 'cat-teacher-education',
  conductingBody: 'MEERUT UNIVERSITY',
  officialWebsite: 'https://example.ac.in',
  selectionModel: 'merit-based',
  firstEditionYear: 2026,
}

const examRow = {
  id: 'ex-1',
  slug: 'up-dled-2026-phase-3',
  name: 'UP D.ElEd 2026 Phase 3',
  short_name: 'UP DLED PHASE 3',
  pillar: 'entrance-exam',
  workflow_status: 'draft',
  cat: { slug: 'teacher-education', name: 'Teacher Education' },
}

beforeEach(() => {
  vi.clearAllMocks()
  installChains({ examRow })
})

describe('createEntranceExam — no publish-on-create for the entrance pillar', () => {
  it('inserts workflow_status "draft" (publishing is an explicit editor action)', async () => {
    const inserted = installChains({ examRow })
    await createEntranceExam(baseInput)
    expect(inserted.exams.workflow_status).toBe('draft')
  })

  it('surfaces categories.name on the created identity (breadcrumb/template authority)', async () => {
    const result = await createEntranceExam(baseInput)
    expect(result.exam.categoryName).toBe('Teacher Education')
  })
})

describe('createEntranceExam — selectionModel is required, no default', () => {
  it('throws instead of silently writing "written-exam"', async () => {
    const inserted = installChains({ examRow })
    await expect(
      createEntranceExam({ ...baseInput, selectionModel: '' as never }),
    ).rejects.toThrow(/Selection model is required/)
    expect(inserted.exams).toBeUndefined() // nothing was written
  })

  it('writes the chosen selection model verbatim', async () => {
    const inserted = installChains({ examRow })
    await createEntranceExam(baseInput)
    expect(inserted.exams.selection_model).toBe('merit-based')
  })
})

describe('createEntranceExam — categoryId is required for the entrance pillar', () => {
  it('throws when the entrance create carries no category (no public URL otherwise)', async () => {
    const inserted = installChains({ examRow })
    await expect(
      createEntranceExam({ ...baseInput, categoryId: '' as never }),
    ).rejects.toThrow(/Category is required/)
    expect(inserted.exams).toBeUndefined()
  })

  it('every pillar starts as draft on create (R0.12: publishing is always an explicit editor action)', async () => {
    const inserted = installChains({ examRow })
    await createEntranceExam({ ...baseInput, pillar: 'government-exam', categoryId: '' as never })
    // R0.12 (2026-10-04): non-entrance pillars also start as draft, not published.
    expect(inserted.exams.workflow_status).toBe('draft')
    // Non-entrance pillars do NOT require a category (that rule stays entrance-only).
    expect(inserted.exams.category_id).toBeNull()
  })
})
