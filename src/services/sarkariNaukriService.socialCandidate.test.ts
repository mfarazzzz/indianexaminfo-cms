/**
 * sarkariNaukriService.socialCandidate.test.ts — owner batch 8, H3.
 *
 * A VACANCY that becomes published AND verified must leave exactly ONE Telegram draft
 * candidate behind. This file pins the four facts that make that true:
 *
 *   1. THE HOOK FIRES ONLY FOR A PUBLISHED + VERIFIED ROW. An unverified vacancy has
 *      not been checked against the official notification, so it must not be queued.
 *   2. THE EVENT IS ALWAYS "published", so the idempotency key
 *      (channel|source_type|source_id|event) is the same whether the vacancy was
 *      published first or verified first — one notice, one draft, one post.
 *   3. THE SOURCE TYPE IS "sarkari_naukri" — a value social_posts.source_type already
 *      accepts (free text, no CHECK constraint), so no migration is needed.
 *   4. THE HOOK NEVER BREAKS A SAVE. createCandidate is fire-and-forget: a social
 *      failure must not fail a publish or a verify.
 *
 * All Supabase calls are mocked — no network, no DB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { createCandidate } = vi.hoisted(() => ({ createCandidate: vi.fn(async () => undefined) }))

vi.mock('@/lib/supabase/client', () => ({
  db: { from: vi.fn(), functions: { invoke: vi.fn(async () => ({ data: null, error: null })) } },
}))
vi.mock('@/services/social/socialQueueService', () => ({ createCandidate }))

import { db } from '@/lib/supabase/client'
import { updateSarkariNaukri, verifySarkariNaukri } from './sarkariNaukriService'
import { setCurrentPermissions } from '@/lib/auth/permissionGuard'

const mockFrom = vi.mocked(db.from)

const ID = '11111111-1111-1111-1111-111111111111'

/** Awaitable fluent query-builder mock. */
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

/** A row as returned by UPDATE … SELECT '*'. */
function row(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    slug: 'up-swasthya-vibhag-ambulance-driver-2026',
    state: 'uttar-pradesh',
    recruitment_type: 'direct',
    title: 'UP Health Department 108 Ambulance Driver 2026 – 1,200 Posts',
    organization: '108 Ambulance Service UP',
    workflow_status: 'published',
    status: 'application-open',
    verified_at: '2026-11-08T09:00:00Z',
    application_end_date: '2026-12-15',
    vacancy_count: 1200,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-11-08T00:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  // The app-layer permission pre-check for publishing.
  setCurrentPermissions(['publish_post'])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('H3 — the vacancy candidate hook', () => {
  it('queues ONE candidate for a vacancy that is published AND verified', async () => {
    mockFrom.mockImplementation(() => chain({ data: [row()], error: null }))

    await updateSarkariNaukri(ID, { workflowStatus: 'published' })
    await vi.advanceTimersByTimeAsync(0)

    expect(createCandidate).toHaveBeenCalledTimes(1)
    expect(createCandidate).toHaveBeenCalledWith({
      source_type: 'sarkari_naukri',
      source_id: ID,
      event: 'published',
      page_url: '',
      slug: 'up-swasthya-vibhag-ambulance-driver-2026',
    })
  })

  it('queues NOTHING for a published row that is not verified', async () => {
    mockFrom.mockImplementation(() => chain({ data: [row({ verified_at: null })], error: null }))

    await updateSarkariNaukri(ID, { workflowStatus: 'published' })
    await vi.advanceTimersByTimeAsync(0)

    expect(createCandidate).not.toHaveBeenCalled()
  })

  it('queues NOTHING for an ordinary save that does not publish', async () => {
    mockFrom.mockImplementation(() => chain({ data: [row()], error: null }))

    await updateSarkariNaukri(ID, { resultDate: '2026-10-01' })
    await vi.advanceTimersByTimeAsync(0)

    expect(createCandidate).not.toHaveBeenCalled()
  })

  it('the VERIFY path queues the candidate when the row is already published', async () => {
    mockFrom.mockImplementation(() => chain({ data: [row()], error: null }))

    await verifySarkariNaukri(ID)
    await vi.advanceTimersByTimeAsync(0)

    expect(createCandidate).toHaveBeenCalledTimes(1)
    expect(createCandidate).toHaveBeenCalledWith(expect.objectContaining({
      source_type: 'sarkari_naukri',
      source_id: ID,
      event: 'published',
    }))
  })

  it('the publish act and the verify act use the SAME event, so they collapse onto one key', async () => {
    mockFrom.mockImplementation(() => chain({ data: [row()], error: null }))

    await updateSarkariNaukri(ID, { workflowStatus: 'published' })
    await verifySarkariNaukri(ID)
    await vi.advanceTimersByTimeAsync(0)

    // The mock is created with no declared parameters, so its call tuples are
    // typed as empty — read them through `unknown` rather than fighting the type.
    const calls = createCandidate.mock.calls as unknown as Array<
      [{ source_type: string; source_id: string; event: string }]
    >
    const events = calls.map((c) => c[0].event)
    expect(events).toEqual(['published', 'published'])
    // …which is what makes the key (channel|source_type|source_id|event) identical, and
    // therefore the queue hold ONE draft instead of two.
    const keys = calls.map(
      (c) => `telegram|${c[0].source_type}|${c[0].source_id}|${c[0].event}`,
    )
    expect(new Set(keys).size).toBe(1)
  })

  it('a rejected social call NEVER fails the save', async () => {
    createCandidate.mockRejectedValueOnce(new Error('network down') as never)
    mockFrom.mockImplementation(() => chain({ data: [row()], error: null }))

    // The hook is fire-and-forget: the save still resolves.
    await expect(updateSarkariNaukri(ID, { workflowStatus: 'published' })).resolves.toBeTruthy()
    await vi.advanceTimersByTimeAsync(0)
  })
})
