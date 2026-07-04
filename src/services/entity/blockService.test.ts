/**
 * blockService.test.ts — Unit tests for blockService.
 * All Supabase calls are mocked — no network required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ db: { from: vi.fn() } }))

import { db } from '@/lib/supabase/client'
import {
  listBlocks, createBlock, updateBlock, updateBlockVisibility,
  softDeleteBlock, reorderBlocks, duplicateBlock,
} from './blockService'

const mockFrom = vi.mocked(db.from)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeListChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select','eq','is','order','limit','single']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  chain.then = (resolve: (v: unknown) => void) => resolve(result)
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  return chain
}

function makeChain(terminal: unknown = { data: null, error: null }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select','insert','update','eq','is','order','limit','single']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(terminal)
  return chain
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'blk-1', module_id: 'mod-1', block_type: 'heading',
    display_order: 0, content: { type: 'heading', level: 2, text: 'Hello' },
    is_visible: true, created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z', deleted_at: null,
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

// ── listBlocks ────────────────────────────────────────────────────────────────

describe('listBlocks', () => {
  it('returns mapped ModuleBlock[] ordered by display_order', async () => {
    const rows = [makeRow({ display_order: 0 }), makeRow({ id: 'blk-2', display_order: 1 })]
    mockFrom.mockReturnValue(makeListChain({ data: rows, error: null }) as never)

    const result = await listBlocks('mod-1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('blk-1')
    expect(result[0].blockType).toBe('heading')
  })

  it('returns [] when no blocks exist', async () => {
    mockFrom.mockReturnValue(makeListChain({ data: [], error: null }) as never)
    expect(await listBlocks('mod-1')).toEqual([])
  })

  it('throws on DB error', async () => {
    mockFrom.mockReturnValue(makeListChain({ data: null, error: { message: 'DB error' } }) as never)
    await expect(listBlocks('mod-1')).rejects.toMatchObject({ message: 'DB error' })
  })
})

// ── createBlock ───────────────────────────────────────────────────────────────

describe('createBlock', () => {
  it('inserts correct columns and returns mapped block', async () => {
    const row = makeRow()
    const chain = makeChain({ data: row, error: null })
    mockFrom.mockReturnValue(chain as never)

    const result = await createBlock('mod-1', 'heading', { type: 'heading', level: 2, text: 'Hello' })
    expect(result.id).toBe('blk-1')
    expect(result.blockType).toBe('heading')
    expect(result.isVisible).toBe(true)
    const insertMock = chain.insert as ReturnType<typeof vi.fn>
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ module_id: 'mod-1', block_type: 'heading', is_visible: true })
    )
  })

  it('propagates DB error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'insert failed' } }) as never)
    await expect(createBlock('mod-1', 'heading', {})).rejects.toMatchObject({ message: 'insert failed' })
  })
})

// ── updateBlock ───────────────────────────────────────────────────────────────

describe('updateBlock', () => {
  it('updates content and returns mapped block', async () => {
    const newContent = { type: 'heading', level: 1, text: 'Updated' }
    const row = makeRow({ content: newContent })
    const chain = makeChain({ data: row, error: null })
    mockFrom.mockReturnValue(chain as never)

    const result = await updateBlock('blk-1', newContent)
    expect(result.content).toEqual(newContent)
    const updateMock = chain.update as ReturnType<typeof vi.fn>
    expect(updateMock).toHaveBeenCalledWith({ content: newContent })
  })

  it('propagates DB error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'update failed' } }) as never)
    await expect(updateBlock('blk-1', {})).rejects.toMatchObject({ message: 'update failed' })
  })
})

// ── updateBlockVisibility ─────────────────────────────────────────────────────

describe('updateBlockVisibility', () => {
  it('sets is_visible and returns mapped block', async () => {
    const row = makeRow({ is_visible: false })
    const chain = makeChain({ data: row, error: null })
    mockFrom.mockReturnValue(chain as never)

    const result = await updateBlockVisibility('blk-1', false)
    expect(result.isVisible).toBe(false)
    const updateMock = chain.update as ReturnType<typeof vi.fn>
    expect(updateMock).toHaveBeenCalledWith({ is_visible: false })
  })

  it('propagates DB error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'vis failed' } }) as never)
    await expect(updateBlockVisibility('blk-1', true)).rejects.toMatchObject({ message: 'vis failed' })
  })
})

// ── softDeleteBlock ───────────────────────────────────────────────────────────

describe('softDeleteBlock', () => {
  it('sets deleted_at to a valid ISO timestamp', async () => {
    const chain = makeChain()
    ;(chain.update as ReturnType<typeof vi.fn>).mockReturnValue({ eq: vi.fn(() => ({ error: null })) })
    mockFrom.mockReturnValue(chain as never)

    await softDeleteBlock('blk-1')
    const updateMock = chain.update as ReturnType<typeof vi.fn>
    const arg = (updateMock.mock.calls as unknown as Array<[Record<string,string>]>)[0][0]
    expect(arg.deleted_at).toBeDefined()
    expect(isNaN(new Date(arg.deleted_at).getTime())).toBe(false)
  })

  it('propagates DB error', async () => {
    const chain = makeChain()
    ;(chain.update as ReturnType<typeof vi.fn>).mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete failed' } })) })
    mockFrom.mockReturnValue(chain as never)
    await expect(softDeleteBlock('blk-1')).rejects.toMatchObject({ message: 'delete failed' })
  })
})

// ── reorderBlocks ─────────────────────────────────────────────────────────────

describe('reorderBlocks', () => {
  it('fires N updates with display_order = array index', async () => {
    const orderedIds = ['blk-3', 'blk-1', 'blk-2']
    const updateMock = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) }))
    mockFrom.mockReturnValue({ update: updateMock } as never)

    await reorderBlocks('mod-1', orderedIds)
    expect(updateMock).toHaveBeenCalledTimes(3)
    expect(updateMock).toHaveBeenNthCalledWith(1, { display_order: 0 })
    expect(updateMock).toHaveBeenNthCalledWith(2, { display_order: 1 })
    expect(updateMock).toHaveBeenNthCalledWith(3, { display_order: 2 })
  })
})

// ── duplicateBlock ────────────────────────────────────────────────────────────

describe('duplicateBlock', () => {
  it('creates new block with display_order = max+1 and isVisible=true', async () => {
    const sourceRow = makeRow({ display_order: 3 })
    const maxRow = [{ display_order: 3 }]
    const dupRow = makeRow({ id: 'blk-dup', display_order: 4 })

    // First call: fetch source block (single)
    const getChain = makeChain({ data: sourceRow, error: null })
    // Second call: get max display_order (list chain)
    const maxChain = makeListChain({ data: maxRow, error: null })
    // Third call: insert duplicate
    const insertChain = makeChain({ data: dupRow, error: null })

    mockFrom
      .mockReturnValueOnce(getChain as never)
      .mockReturnValueOnce(maxChain as never)
      .mockReturnValueOnce(insertChain as never)

    const result = await duplicateBlock('blk-1')
    expect(result.id).toBe('blk-dup')
    const insertMock = insertChain.insert as ReturnType<typeof vi.fn>
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ display_order: 4, is_visible: true })
    )
  })

  it('throws if source block not found', async () => {
    const getChain = makeChain({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(getChain as never)
    await expect(duplicateBlock('non-existent')).rejects.toBeDefined()
  })
})
