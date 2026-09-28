/**
 * sarkariNaukriService.revalidation.test.ts — L5 wiring proof.
 *
 * Proves that a vacancy save enqueues the correct frontend cache tags and,
 * after the 4s debounce, sends each one to the `revalidate-frontend` Edge
 * Function — and NOT to the frontend directly. The revalidation token is a
 * secret, so the test also fails if any query ever asks settings for
 * `revalidate_token` or if the browser calls the frontend itself.
 *
 * All Supabase calls and fetch are mocked — no network, no DB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** Hoisted so the vi.mock factory below (which Vitest moves to the top of the
 *  file) can reference it without hitting a TDZ error. */
const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(
    async (_fn: string, _opts?: { body?: unknown }) => ({
      data: { ok: true, status: 200, type: 'tag' },
      error: null,
    }),
  ),
}))

vi.mock('@/lib/supabase/client', () => ({
  db: { from: vi.fn(), functions: { invoke } },
}))

import { db } from '@/lib/supabase/client'
import { updateSarkariNaukri } from './sarkariNaukriService'
import { getPendingTagCount } from '@/lib/revalidation/revalidationService'

const mockFrom = vi.mocked(db.from)

/** Every filter argument the code passed to the query builder, so the test can
 *  assert on what was asked for, not only on what came back. */
const sentFilterArgs: unknown[] = []

/** Awaitable fluent query-builder mock — every method returns the chain;
 *  awaiting the chain resolves to `result` (any terminal position). */
function chain(result: unknown): any {
  const c: any = {
    then: (onF: any, onR: any) => Promise.resolve(result).then(onF, onR),
    catch: (onR: any) => Promise.resolve(result).catch(onR),
  }
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'in', 'or',
    'order', 'limit', 'range', 'not', 'ilike', 'single', 'maybeSingle']) {
    c[m] = vi.fn((...args: unknown[]) => {
      sentFilterArgs.push(...args)
      return c
    })
  }
  return c
}

// A minimal sarkari_naukri row as returned by UPDATE … SELECT '*'.
function row(slug: string, state: string | null) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    slug,
    state,
    recruitment_type: 'direct',
    title: 'Test Vacancy',
    organization: 'TEST ORG',
    workflow_status: 'published',
    status: 'application-open',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-26T00:00:00Z',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  sentFilterArgs.length = 0
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('L5 — revalidation on Sarkari Naukri save', () => {
  it('updateSarkariNaukri sends the slug/state/global tags to the revalidate-frontend function after the debounce', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'settings') {
        // Only the "is revalidation configured?" switch is read. No token.
        return chain({
          data: [{ key: 'frontend_url', value: 'http://localhost:3099' }],
          error: null,
        })
      }
      // sarkari_naukri UPDATE … .select() → one updated row
      return chain({ data: [row('test-vacancy-2026', 'bihar')], error: null })
    })

    // Any direct call to the frontend would be the old, secret-carrying path.
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }))
    vi.stubGlobal('fetch', fetchMock)

    await updateSarkariNaukri('11111111-1111-1111-1111-111111111111', { resultDate: '2026-10-01' })

    // Tags are queued synchronously (listing + detail + state) …
    expect(getPendingTagCount()).toBe(3)

    // … and flushed one tag at a time after the 4s debounce.
    await vi.advanceTimersByTimeAsync(4_100)

    const bodies = invoke.mock.calls.map(([, opts]) => opts?.body)
    expect(invoke).toHaveBeenCalledTimes(3)
    expect(bodies).toContainEqual({ tag: 'sarkari-naukri' })
    expect(bodies).toContainEqual({ tag: 'sarkari-naukri:test-vacancy-2026' })
    expect(bodies).toContainEqual({ tag: 'sarkari-naukri:state:bihar' })
    for (const [fn] of invoke.mock.calls) expect(fn).toBe('revalidate-frontend')

    // The browser never calls the frontend, and never asks for the token.
    expect(fetchMock).not.toHaveBeenCalled()
    expect(JSON.stringify(sentFilterArgs)).not.toContain('revalidate_token')

    vi.unstubAllGlobals()
  })
})
