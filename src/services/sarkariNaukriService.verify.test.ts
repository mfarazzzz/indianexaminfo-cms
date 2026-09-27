/**
 * sarkariNaukriService.verify.test.ts — M3.
 *
 * Proves that a DB-trigger refusal is surfaced to the editor in plain words
 * (never a raw Postgres string), for the three guarded reasons: missing link,
 * missing end date, no permission. Also proves verifySarkariNaukri throws an
 * Error (not the raw PostgREST object) so callers can read `.message` directly.
 *
 * All Supabase calls are mocked — no network, no DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ db: { from: vi.fn() } }))

import { db } from '@/lib/supabase/client'
import { humanizeVerifyError, verifySarkariNaukri } from './sarkariNaukriService'

const mockFrom = vi.mocked(db.from)

/** Awaitable fluent query-builder mock resolving to `result`. */
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

describe('humanizeVerifyError — trigger refusals in plain words', () => {
  it('maps the missing official-notification-link guard', () => {
    const out = humanizeVerifyError({
      message: 'Cannot verify: official_notification_url must be an http(s) URL',
      code: 'P0001',
    })
    expect(out).toMatch(/official notification link/i)
    expect(out).not.toMatch(/official_notification_url/) // no raw column name
  })

  it('maps the missing application-end-date guard', () => {
    const out = humanizeVerifyError({
      message: 'Cannot verify: application_end_date must be set',
      code: 'P0001',
    })
    expect(out).toMatch(/application end date/i)
    expect(out).not.toMatch(/application_end_date/)
  })

  it('maps the permission guard by message', () => {
    const out = humanizeVerifyError({
      message: 'permission denied: verifying requires the publish_post permission',
      code: 'P0001',
    })
    expect(out).toMatch(/permission/i)
  })

  it('maps the permission guard by SQLSTATE 42501 alone', () => {
    const out = humanizeVerifyError({ message: '', code: '42501' })
    expect(out).toMatch(/publish_post permission|permission/i)
  })

  it('falls back to the raw message for an unknown error', () => {
    expect(humanizeVerifyError({ message: 'some other failure' })).toBe('some other failure')
  })

  it('never returns an empty string', () => {
    expect(humanizeVerifyError(null).length).toBeGreaterThan(0)
  })
})

describe('verifySarkariNaukri — surfaces a plain-words Error on refusal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws an Error carrying the humanized trigger message', async () => {
    mockFrom.mockImplementation(() => chain({
      data: null,
      error: { message: 'Cannot verify: application_end_date must be set', code: 'P0001', details: '', hint: '' },
    }))

    await expect(verifySarkariNaukri('11111111-1111-1111-1111-111111111111')).rejects.toBeInstanceOf(Error)
    await expect(verifySarkariNaukri('x')).rejects.toThrow(/application end date/i)
  })
})
