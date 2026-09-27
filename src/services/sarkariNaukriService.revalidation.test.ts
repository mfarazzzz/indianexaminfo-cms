/**
 * sarkariNaukriService.revalidation.test.ts — L5 wiring proof.
 *
 * Proves that a vacancy save enqueues the correct frontend cache tags and,
 * after the 4s debounce, the batched revalidator POSTs them to
 * `${frontend_url}/api/revalidate` with the `x-revalidate-token` header —
 * the exact wire format the frontend's /api/revalidate route accepts.
 *
 * All Supabase calls and fetch are mocked — no network, no DB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({
  db: { from: vi.fn() },
}))

import { db } from '@/lib/supabase/client'
import { updateSarkariNaukri } from './sarkariNaukriService'
import { getPendingTagCount } from '@/lib/revalidation/revalidationService'

const mockFrom = vi.mocked(db.from)

/** Awaitable fluent query-builder mock — every method returns the chain;
 *  awaiting the chain resolves to `result` (any terminal position). */
function chain(result: unknown): any {
  const c: any = {
    then: (onF: any, onR: any) => Promise.resolve(result).then(onF, onR),
    catch: (onR: any) => Promise.resolve(result).catch(onR),
  }
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'in', 'or',
    'order', 'limit', 'range', 'not', 'ilike', 'single', 'maybeSingle']) {
    c[m] = vi.fn(() => c)
  }
  return c
}

const FRONTEND_URL = 'http://localhost:3099'
const TOKEN = 'test-revalidate-token'

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
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('L5 — revalidation on Sarkari Naukri save', () => {
  it('updateSarkariNaukri POSTs the slug/state/global tags to /api/revalidate after the debounce', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'settings') {
        return chain({
          data: [
            { key: 'frontend_url', value: FRONTEND_URL },
            { key: 'revalidate_token', value: TOKEN },
          ],
          error: null,
        })
      }
      // sarkari_naukri UPDATE … .select() → one updated row
      return chain({ data: [row('test-vacancy-2026', 'bihar')], error: null })
    })

    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) => ({
      ok: true, status: 200, text: async () => '',
    }))
    vi.stubGlobal('fetch', fetchMock)

    await updateSarkariNaukri('11111111-1111-1111-1111-111111111111', { resultDate: '2026-10-01' })

    // Tags are queued synchronously (listing + detail + state) …
    expect(getPendingTagCount()).toBe(3)

    // … and flushed as one batched POST per tag after the 4s debounce.
    await vi.advanceTimersByTimeAsync(4_100)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const calledBodies = fetchMock.mock.calls.map(([, init]) => String(init?.body))
    expect(calledBodies).toContain(JSON.stringify({ tag: 'sarkari-naukri' }))
    expect(calledBodies).toContain(JSON.stringify({ tag: 'sarkari-naukri:test-vacancy-2026' }))
    expect(calledBodies).toContain(JSON.stringify({ tag: 'sarkari-naukri:state:bihar' }))
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe(`${FRONTEND_URL}/api/revalidate`)
      expect(init?.method).toBe('POST')
      expect((init?.headers as Record<string, string>)['x-revalidate-token']).toBe(TOKEN)
    }

    vi.unstubAllGlobals()
  })
})
