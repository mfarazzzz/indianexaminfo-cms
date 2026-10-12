/**
 * S2.13(a) — provider reorder must fail LOUD, not silent.
 *
 * updateProviderPriorities rewrites priorities 1..n. Supabase returns a write /
 * RLS failure as a resolved { error } (never a rejection), so the service has to
 * inspect each result and throw — otherwise the panel keeps a stale optimistic
 * order and a reload quietly undoes it. No network: db is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ db: { from: (...a: any[]) => mockFrom(...a) } }))

import { updateProviderPriorities } from './aiProviderService'

// db.from('ai_providers').update(payload).eq('id', id) → awaited, returns { error }
function chain(errorFor: Record<string, string | null>, writes: Array<{ id: string; priority: number }>) {
  return {
    update(payload: { priority: number }) {
      return {
        eq(_col: string, id: string) {
          writes.push({ id, priority: payload.priority })
          const err = errorFor[id] ?? null
          return Promise.resolve(err ? { error: { message: err } } : { error: null })
        },
      }
    },
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('updateProviderPriorities (S2.13a)', () => {
  it('writes priorities 1..n in the given order when every update succeeds', async () => {
    const writes: Array<{ id: string; priority: number }> = []
    mockFrom.mockImplementation(() => chain({}, writes))
    await expect(updateProviderPriorities(['a', 'b', 'c'])).resolves.toBeUndefined()
    expect(writes).toEqual([{ id: 'a', priority: 1 }, { id: 'b', priority: 2 }, { id: 'c', priority: 3 }])
  })

  it('THROWS when a write returns an error (RLS/deny), so the caller can roll back', async () => {
    const writes: Array<{ id: string; priority: number }> = []
    // 'b' fails as Supabase would: a resolved { error }, not a rejection.
    mockFrom.mockImplementation(() => chain({ b: 'row-level security' }, writes))
    await expect(updateProviderPriorities(['a', 'b', 'c'])).rejects.toThrow(/Order not saved \(1\/3 writes failed\).*row-level security/)
    // It still attempted every row (caller refetches the true state).
    expect(writes.map((w) => w.id)).toEqual(['a', 'b', 'c'])
  })
})
