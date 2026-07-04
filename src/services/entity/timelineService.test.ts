/**
 * timelineService.test.ts
 * Unit tests for timelineService — all Supabase calls mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ db: { from: vi.fn() } }))

import { db } from '@/lib/supabase/client'
import {
  listTimeline,
  createTimelineEvent,
  updateTimelineEvent,
  softDeleteTimelineEvent,
  reorderTimeline,
} from './timelineService'

const mockFrom = vi.mocked(db.from)

// ── Chain-safe fluent mock (same pattern as entityService.test.ts) ────────────

function makeChain(terminal: unknown = { data: null, error: null }) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select','insert','update','delete','eq','neq','is','in',
    'ilike','order','limit','single','maybeSingle',
  ]
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(terminal)
  ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(terminal)
  // select returns the chain itself so chained .eq().is() work
  ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  return chain
}

/** Minimal valid TimelineEvent row from DB */
function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1', entity_id: 'ent-1',
    title: 'Application Start', event_type: 'application-start',
    event_date: '2025-08-01', event_time: null,
    description: null, status: 'upcoming',
    badge_color: 'blue', is_highlighted: false, is_featured: false,
    official_link: null, pdf_link: null, image_url: null,
    visibility: 'public', display_order: 0, publish_at: null,
    created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

// ── listTimeline ──────────────────────────────────────────────────────────────

/** Makes a chain where awaiting the chain itself resolves with the given value */
function makeListChain(resolveValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select','eq','is','order','limit']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  // Make the chain itself thenable (await chain → resolveValue)
  chain.then = (resolve: (v: unknown) => void) => resolve(resolveValue)
  return chain
}

describe('listTimeline', () => {
  it('returns mapped TimelineEvent[] in display_order order', async () => {
    const rows = [makeRow({ display_order: 0 }), makeRow({ id: 'evt-2', display_order: 1 })]
    mockFrom.mockReturnValue(makeListChain({ data: rows, error: null }) as never)

    const result = await listTimeline('ent-1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('evt-1')
    expect(result[0].title).toBe('Application Start')
    expect(result[1].id).toBe('evt-2')
  })

  it('returns [] when no events exist', async () => {
    mockFrom.mockReturnValue(makeListChain({ data: [], error: null }) as never)

    const result = await listTimeline('ent-1')
    expect(result).toEqual([])
  })

  it('throws when DB returns an error', async () => {
    mockFrom.mockReturnValue(makeListChain({ data: null, error: { message: 'DB error' } }) as never)

    await expect(listTimeline('ent-1')).rejects.toMatchObject({ message: 'DB error' })
  })
})

// ── createTimelineEvent ───────────────────────────────────────────────────────

describe('createTimelineEvent', () => {
  const validInput = {
    title: 'Application Start', eventType: 'application-start',
    eventDate: '2025-08-01', status: 'upcoming' as const,
    badgeColor: 'blue' as const, isHighlighted: false, isFeatured: false,
    visibility: 'public' as const, displayOrder: 0,
  }

  it('inserts correct columns and returns mapped event', async () => {
    const row = makeRow()
    const chain = makeChain({ data: row, error: null })
    mockFrom.mockReturnValue(chain as never)

    const result = await createTimelineEvent('ent-1', validInput)
    expect(result.id).toBe('evt-1')
    expect(result.title).toBe('Application Start')
    const insertMock = chain.insert as ReturnType<typeof vi.fn>
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ entity_id: 'ent-1', title: 'Application Start', status: 'upcoming' })
    )
  })

  it('throws before DB call when publishAt is in the past', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain as never)
    const insertMock = chain.insert as ReturnType<typeof vi.fn>

    await expect(
      createTimelineEvent('ent-1', { ...validInput, publishAt: '2020-01-01T00:00:00Z' })
    ).rejects.toThrow('Scheduled publish date must be in the future')

    expect(insertMock).not.toHaveBeenCalled()
  })

  it('propagates DB error', async () => {
    const chain = makeChain({ data: null, error: { message: 'insert failed' } })
    mockFrom.mockReturnValue(chain as never)

    await expect(createTimelineEvent('ent-1', validInput)).rejects.toMatchObject({ message: 'insert failed' })
  })
})

// ── updateTimelineEvent ───────────────────────────────────────────────────────

describe('updateTimelineEvent', () => {
  it('updates only provided fields', async () => {
    const row = makeRow({ title: 'Updated' })
    const chain = makeChain({ data: row, error: null })
    mockFrom.mockReturnValue(chain as never)

    const result = await updateTimelineEvent('evt-1', { title: 'Updated' })
    expect(result.title).toBe('Updated')
    const updateMock = chain.update as ReturnType<typeof vi.fn>
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated' })
    )
  })

  it('sets publish_at=null when status=active', async () => {
    const row = makeRow({ status: 'active', publish_at: null })
    const chain = makeChain({ data: row, error: null })
    mockFrom.mockReturnValue(chain as never)

    await updateTimelineEvent('evt-1', { status: 'active' })
    const updateMock = chain.update as ReturnType<typeof vi.fn>
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', publish_at: null })
    )
  })

  it('sets publish_at=null when status=cancelled', async () => {
    const row = makeRow({ status: 'cancelled', publish_at: null })
    const chain = makeChain({ data: row, error: null })
    mockFrom.mockReturnValue(chain as never)

    await updateTimelineEvent('evt-1', { status: 'cancelled' })
    const updateMock = chain.update as ReturnType<typeof vi.fn>
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', publish_at: null })
    )
  })

  it('propagates DB error', async () => {
    const chain = makeChain({ data: null, error: { message: 'update failed' } })
    mockFrom.mockReturnValue(chain as never)

    await expect(updateTimelineEvent('evt-1', { title: 'x' })).rejects.toMatchObject({ message: 'update failed' })
  })
})

// ── softDeleteTimelineEvent ───────────────────────────────────────────────────

describe('softDeleteTimelineEvent', () => {
  it('calls update with a valid ISO deleted_at timestamp', async () => {
    const chain = makeChain()
    const eqMock = vi.fn(() => ({ error: null }))
    ;(chain.update as ReturnType<typeof vi.fn>).mockReturnValue({ eq: eqMock })
    mockFrom.mockReturnValue(chain as never)

    await softDeleteTimelineEvent('evt-1')

    const updateMock = chain.update as ReturnType<typeof vi.fn>
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) })
    )
    const args = (updateMock.mock.calls as unknown as Array<[Record<string, string>]>)[0][0]
    expect(() => new Date(args.deleted_at)).not.toThrow()
    expect(isNaN(new Date(args.deleted_at).getTime())).toBe(false)
  })

  it('propagates DB error', async () => {
    const chain = makeChain()
    ;(chain.update as ReturnType<typeof vi.fn>).mockReturnValue({
      eq: vi.fn(() => ({ error: { message: 'delete failed' } })),
    })
    mockFrom.mockReturnValue(chain as never)

    await expect(softDeleteTimelineEvent('evt-1')).rejects.toMatchObject({ message: 'delete failed' })
  })
})

// ── reorderTimeline ───────────────────────────────────────────────────────────

describe('reorderTimeline', () => {
  it('fires exactly N updates with display_order = array index', async () => {
    const orderedIds = ['evt-3', 'evt-1', 'evt-2']
    const updateMock = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) }))
    mockFrom.mockReturnValue({ update: updateMock } as never)

    await reorderTimeline('ent-1', orderedIds)

    expect(updateMock).toHaveBeenCalledTimes(3)
    expect(updateMock).toHaveBeenNthCalledWith(1, { display_order: 0 })
    expect(updateMock).toHaveBeenNthCalledWith(2, { display_order: 1 })
    expect(updateMock).toHaveBeenNthCalledWith(3, { display_order: 2 })
  })
})
