/**
 * moduleService.test.ts — Unit tests for moduleService.
 * All Supabase calls are mocked — no network required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ db: { from: vi.fn() } }))

import { db } from '@/lib/supabase/client'
import {
  listModules, getModuleById, createModule, updateModule,
  softDeleteModule, reorderModules, publishModule, duplicateModule,
} from './moduleService'

const mockFrom = vi.mocked(db.from)

// ── Chain helpers (same pattern as timelineService.test.ts) ──────────────────

function makeListChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select','eq','is','order','limit','insert','update','single','head']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  chain.then = (resolve: (v: unknown) => void) => resolve(result)
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  return chain
}

function makeChain(terminal: unknown = { data: null, error: null }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select','insert','update','eq','is','neq','limit','single','order','head']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(terminal)
  return chain
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mod-1', entity_id: 'ent-1', module_type: 'overview',
    sub_title: null, display_order: 0, workflow_status: 'draft',
    is_featured: false, tags: [], scheduled_publish_at: null,
    published_at: null, published_by: null,
    seo_override_title: null, seo_override_desc: null, metadata: {},
    created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    created_by: null, updated_by: null, deleted_at: null,
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

// ── listModules ───────────────────────────────────────────────────────────────

describe('listModules', () => {
  it('returns mapped EntityModule[] ordered by display_order', async () => {
    const rows = [makeRow({ display_order: 0 }), makeRow({ id: 'mod-2', display_order: 1 })]
    mockFrom.mockReturnValue(makeListChain({ data: rows, error: null }) as never)

    const result = await listModules('ent-1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('mod-1')
    expect(result[0].moduleType).toBe('overview')
  })

  it('returns [] when no modules exist', async () => {
    mockFrom.mockReturnValue(makeListChain({ data: [], error: null }) as never)
    const result = await listModules('ent-1')
    expect(result).toEqual([])
  })

  it('throws on DB error', async () => {
    mockFrom.mockReturnValue(makeListChain({ data: null, error: { message: 'DB error' } }) as never)
    await expect(listModules('ent-1')).rejects.toMatchObject({ message: 'DB error' })
  })
})

// ── createModule ──────────────────────────────────────────────────────────────

describe('createModule', () => {
  const validInput = {
    moduleType: 'overview', displayOrder: 0, workflowStatus: 'draft' as const,
    isFeatured: false, tags: [],
  }

  it('inserts correct columns and returns mapped module (no existing)', async () => {
    const existingChain = makeChain()
    existingChain.then = (r: (v: unknown) => void) => r({ data: [], error: null })
    const insertChain = makeChain({ data: makeRow(), error: null })

    mockFrom
      .mockReturnValueOnce(existingChain as never)   // duplicate-check query
      .mockReturnValueOnce(insertChain as never)     // insert

    const result = await createModule('ent-1', validInput)
    expect(result.id).toBe('mod-1')
    expect(result.workflowStatus).toBe('draft')
  })

  it('throws duplicate-type error when same type exists and no subTitle', async () => {
    const existingChain = makeChain()
    existingChain.then = (r: (v: unknown) => void) => r({ data: [{ id: 'existing' }], error: null })
    mockFrom.mockReturnValue(existingChain as never)

    await expect(createModule('ent-1', validInput)).rejects.toThrow(
      'A sub-title is required to distinguish this module from existing modules of the same type.'
    )
  })

  it('throws duplicate-type error when subTitle is empty string', async () => {
    const existingChain = makeChain()
    existingChain.then = (r: (v: unknown) => void) => r({ data: [{ id: 'existing' }], error: null })
    mockFrom.mockReturnValue(existingChain as never)

    await expect(createModule('ent-1', { ...validInput, subTitle: '' })).rejects.toThrow(
      'A sub-title is required'
    )
  })

  it('propagates DB insert error', async () => {
    const existingChain = makeChain()
    existingChain.then = (r: (v: unknown) => void) => r({ data: [], error: null })
    const insertChain = makeChain({ data: null, error: { message: 'insert failed' } })
    mockFrom
      .mockReturnValueOnce(existingChain as never)
      .mockReturnValueOnce(insertChain as never)

    await expect(createModule('ent-1', validInput)).rejects.toMatchObject({ message: 'insert failed' })
  })
})

// ── updateModule ──────────────────────────────────────────────────────────────

describe('updateModule', () => {
  it('updates provided fields and returns mapped module', async () => {
    const row = makeRow({ sub_title: 'New Sub' })
    const chain = makeChain({ data: row, error: null })
    mockFrom.mockReturnValue(chain as never)

    const result = await updateModule('mod-1', { subTitle: 'New Sub' })
    expect(result.subTitle).toBe('New Sub')
    const updateMock = chain.update as ReturnType<typeof vi.fn>
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ sub_title: 'New Sub' }))
  })

  it('propagates DB error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'update error' } }) as never)
    await expect(updateModule('mod-1', { subTitle: 'x' })).rejects.toMatchObject({ message: 'update error' })
  })
})

// ── publishModule ─────────────────────────────────────────────────────────────

describe('publishModule', () => {
  it('sets workflow_status, published_at, published_by', async () => {
    const row = makeRow({ workflow_status: 'published', published_at: '2025-01-01T00:00:00Z', published_by: 'user-1' })
    const chain = makeChain({ data: row, error: null })
    mockFrom.mockReturnValue(chain as never)

    const result = await publishModule('mod-1', 'user-1')
    expect(result.workflowStatus).toBe('published')
    expect(result.publishedBy).toBe('user-1')
    const updateMock = chain.update as ReturnType<typeof vi.fn>
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflow_status: 'published', published_by: 'user-1' })
    )
  })

  it('propagates DB error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'publish failed' } }) as never)
    await expect(publishModule('mod-1', 'user-1')).rejects.toMatchObject({ message: 'publish failed' })
  })
})

// ── softDeleteModule ──────────────────────────────────────────────────────────

describe('softDeleteModule', () => {
  it('sets deleted_at to a valid ISO timestamp', async () => {
    const chain = makeChain()
    ;(chain.update as ReturnType<typeof vi.fn>).mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockFrom.mockReturnValue(chain as never)

    await softDeleteModule('mod-1')
    const updateMock = chain.update as ReturnType<typeof vi.fn>
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) })
    )
    const arg = (updateMock.mock.calls as unknown as Array<[Record<string,string>]>)[0][0]
    expect(() => new Date(arg.deleted_at)).not.toThrow()
    expect(isNaN(new Date(arg.deleted_at).getTime())).toBe(false)
  })

  it('propagates DB error', async () => {
    const chain = makeChain()
    ;(chain.update as ReturnType<typeof vi.fn>).mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete failed' } })) })
    mockFrom.mockReturnValue(chain as never)
    await expect(softDeleteModule('mod-1')).rejects.toMatchObject({ message: 'delete failed' })
  })
})

// ── reorderModules ────────────────────────────────────────────────────────────

describe('reorderModules', () => {
  it('fires N updates with display_order = array index', async () => {
    const orderedIds = ['mod-3', 'mod-1', 'mod-2']
    const updateMock = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) }))
    mockFrom.mockReturnValue({ update: updateMock } as never)

    await reorderModules('ent-1', orderedIds)
    expect(updateMock).toHaveBeenCalledTimes(3)
    expect(updateMock).toHaveBeenNthCalledWith(1, { display_order: 0 })
    expect(updateMock).toHaveBeenNthCalledWith(2, { display_order: 1 })
    expect(updateMock).toHaveBeenNthCalledWith(3, { display_order: 2 })
  })
})

// ── duplicateModule ───────────────────────────────────────────────────────────

describe('duplicateModule', () => {
  it('inserts new row with draft status and returns mapped module', async () => {
    const sourceRow = makeRow({ workflow_status: 'published', published_at: '2025-01-01T00:00:00Z', published_by: 'user-1' })
    const dupRow = makeRow({ id: 'mod-dup', workflow_status: 'draft', display_order: 1 })

    // getModuleById call (single)
    const getChain = makeChain({ data: sourceRow, error: null })
    // count call
    const countChain = makeChain()
    countChain.then = (r: (v: unknown) => void) => r({ count: 1, error: null })
    // insert call
    const insertChain = makeChain({ data: dupRow, error: null })

    mockFrom
      .mockReturnValueOnce(getChain as never)      // getModuleById
      .mockReturnValueOnce(countChain as never)    // count query
      .mockReturnValueOnce(insertChain as never)   // insert

    const result = await duplicateModule('mod-1')
    expect(result.id).toBe('mod-dup')
    expect(result.workflowStatus).toBe('draft')

    const insertMock = insertChain.insert as ReturnType<typeof vi.fn>
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_status: 'draft',
        published_at: null,
        published_by: null,
      })
    )
  })

  it('throws if source module not found', async () => {
    const getChain = makeChain({ data: null, error: null })
    mockFrom.mockReturnValue(getChain as never)
    await expect(duplicateModule('non-existent')).rejects.toThrow('Module not found')
  })
})
