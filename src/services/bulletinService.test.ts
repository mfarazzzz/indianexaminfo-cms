/**
 * bulletinService.test.ts — the service is the only module that touches the
 * database for the bulletin, so its three contracts are tested here with a
 * mocked Supabase client (no network, no DB):
 *
 *   1. a MISSING object (bulletin_signals / bulletin_editor_state are still
 *      proposals) degrades to an empty list + schemaPending, while a real
 *      permission denial still throws;
 *   2. a write is pre-checked for edit_any_post, upserts on signal_key, and a
 *      zero-row RLS refusal is reported as an error instead of a silent success;
 *   3. the verification queue read asks for exactly the columns the verify
 *      trigger inspects.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ db: { from: vi.fn() } }))

import { db } from '@/lib/supabase/client'
import { setCurrentPermissions } from '@/lib/auth/permissionGuard'
import { P } from '@/config/permissions'
import {
  assignBulletinSignal,
  fetchBulletinSignals,
  fetchEditorStates,
  fetchTraffic,
  fetchUnverifiedVacancies,
  isoDatePlusDays,
  loadBulletin,
  markDoneByHand,
  saveBulletinEditorState,
  snoozeBulletinSignal,
} from './bulletinService'

const mockFrom = vi.mocked(db.from)

interface Call {
  table: string
  method: string
  args: unknown[]
}

/**
 * Awaitable fluent query-builder mock. Every chained method returns the same
 * object, and the final await resolves `result`. Calls are recorded so a test
 * can assert what was sent.
 */
function chain(result: unknown, calls: Call[] = []): any {
  const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'is', 'in',
    'or', 'order', 'limit', 'range', 'not', 'ilike', 'single', 'maybeSingle']
  const c: any = {
    then: (onF: any, onR: any) => Promise.resolve(result).then(onF, onR),
    catch: (onR: any) => Promise.resolve(result).catch(onR),
  }
  for (const m of methods) {
    c[m] = vi.fn((...args: unknown[]) => {
      calls.push({ table: (c as any).__table, method: m, args })
      return c
    })
  }
  return c
}

const ok = (data: unknown) => ({ data, error: null })
const fail = (code: string, message: string) => ({ data: null, error: { code, message } })

beforeEach(() => {
  setCurrentPermissions([])
  mockFrom.mockReset()
})

// ── reads: graceful degradation ──────────────────────────────────────────────

describe('fetchBulletinSignals', () => {
  it('returns the view rows when the view exists', async () => {
    const rows = [{ signal_key: 'k', bucket: 'arrived' }]
    mockFrom.mockReturnValue(chain(ok(rows)))
    await expect(fetchBulletinSignals()).resolves.toEqual({ signals: rows, pending: false })
    expect(mockFrom).toHaveBeenCalledWith('bulletin_signals')
  })

  it('treats a missing view (PGRST205) as "not applied yet", not as an error', async () => {
    mockFrom.mockReturnValue(chain(fail('PGRST205', 'Could not find the view ... bulletin_signals in schema cache')))
    await expect(fetchBulletinSignals()).resolves.toEqual({ signals: [], pending: true })
  })

  it('treats undefined_table (42P01) the same way', async () => {
    mockFrom.mockReturnValue(chain(fail('42P01', 'relation public.bulletin_signals does not exist')))
    const out = await fetchBulletinSignals()
    expect(out.pending).toBe(true)
    expect(out.signals).toEqual([])
  })

  it('still raises a real permission denial', async () => {
    mockFrom.mockReturnValue(chain(fail('42501', 'permission denied for view bulletin_signals')))
    await expect(fetchBulletinSignals()).rejects.toThrow(/permission denied/)
  })

  it('asks only for the buckets the home board shows', async () => {
    const calls: Call[] = []
    const c = chain(ok([]), calls)
    mockFrom.mockImplementation((table: string) => { c.__table = table; return c })
    await fetchBulletinSignals()
    const inFilter = calls.find((x) => x.method === 'in')
    expect(inFilter?.args).toEqual(['bucket', ['arrived', 'upcoming', 'backlog']])
  })
})

describe('fetchEditorStates / fetchTraffic', () => {
  it('reports the editor-state table as pending when it does not exist', async () => {
    mockFrom.mockReturnValue(chain(fail('PGRST205', 'Could not find the table bulletin_editor_state in schema cache')))
    await expect(fetchEditorStates()).resolves.toEqual({ states: [], pending: true })
  })

  it('returns editor-state rows when the table exists', async () => {
    const rows = [{ signal_key: 'k', status: 'snoozed', snooze_until: '2026-10-05' }]
    mockFrom.mockReturnValue(chain(ok(rows)))
    const out = await fetchEditorStates()
    expect(out.pending).toBe(false)
    expect(out.states).toEqual(rows)
  })

  it('an un-imported page_traffic is simply no traffic, not an error', async () => {
    mockFrom.mockReturnValue(chain(fail('42P01', 'relation "public.page_traffic" does not exist')))
    await expect(fetchTraffic()).resolves.toEqual([])
  })
})

describe('fetchUnverifiedVacancies', () => {
  it('reads the columns the verify trigger checks, filtered to verified_at IS NULL', async () => {
    const calls: Call[] = []
    const c = chain(ok([{
      id: 'v1', slug: 'up-swasthya-vibhag-ambulance-driver-2026', title: 'UP Swasthya',
      state: 'uttar-pradesh', official_notification_url: null, application_end_date: null,
    }]), calls)
    mockFrom.mockImplementation((table: string) => { c.__table = table; return c })

    const out = await fetchUnverifiedVacancies()
    expect(mockFrom).toHaveBeenCalledWith('sarkari_naukri')
    expect(calls.find((x) => x.method === 'select')?.args[0])
      .toBe('id, slug, title, state, official_notification_url, application_end_date')
    expect(calls.find((x) => x.method === 'is')?.args).toEqual(['verified_at', null])
    expect(out[0].slug).toBe('up-swasthya-vibhag-ambulance-driver-2026')
    expect(out[0].official_notification_url).toBeNull()
  })

  it('a real error on a live table is raised, never hidden', async () => {
    mockFrom.mockReturnValue(chain(fail('42501', 'permission denied for table sarkari_naukri')))
    await expect(fetchUnverifiedVacancies()).rejects.toThrow(/permission denied/)
  })
})

describe('loadBulletin', () => {
  it('marks the board pending while the proposed objects are missing', async () => {
    // sarkari_naukri is a live table: it answers, the proposed objects do not.
    mockFrom.mockImplementation((table: string) => chain(
      table === 'sarkari_naukri'
        ? ok([{ id: 'v1', slug: 'x', title: 'X', state: null, official_notification_url: null, application_end_date: null }])
        : fail('PGRST205', 'Could not find the relation in schema cache'),
    ))
    const bundle = await loadBulletin(new Date('2026-09-28T04:00:00Z'))
    expect(bundle.schemaPending).toBe(true)
    expect(bundle.signals).toEqual([])
    expect(bundle.unverifiedVacancies).toHaveLength(1)
    expect(bundle.asOf).toBe('2026-09-28')
  })

  it('is not pending once the view and the table both answer', async () => {
    mockFrom.mockReturnValue(chain(ok([])))
    const bundle = await loadBulletin(new Date('2026-09-28T04:00:00Z'))
    expect(bundle.schemaPending).toBe(false)
    expect(bundle.unverifiedVacancies).toEqual([])
  })
})

// ── writes ───────────────────────────────────────────────────────────────────

describe('saveBulletinEditorState', () => {
  const allowed = () => setCurrentPermissions([P.EDIT_OWN_POST, P.EDIT_ANY_POST])

  it('refuses before touching the network without edit_any_post', async () => {
    setCurrentPermissions([P.EDIT_OWN_POST])
    await expect(saveBulletinEditorState({
      signalKey: 'k', status: 'open', actorId: 'u1',
    })).rejects.toThrow(/edit_any_post/)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('upserts on signal_key and reads the affected row back', async () => {
    allowed()
    const calls: Call[] = []
    const c = chain(ok([{ signal_key: 'k' }]), calls)
    mockFrom.mockImplementation((table: string) => { c.__table = table; return c })

    await saveBulletinEditorState({
      signalKey: 'k', status: 'snoozed', snoozeUntil: '2026-10-05', actorId: 'u1',
    })

    expect(mockFrom).toHaveBeenCalledWith('bulletin_editor_state')
    const upsert = calls.find((x) => x.method === 'upsert')!
    expect(upsert.args[0]).toMatchObject({
      signal_key: 'k', status: 'snoozed', snooze_until: '2026-10-05',
      updated_by: 'u1', assignee: null, note: null,
    })
    expect(upsert.args[1]).toEqual({ onConflict: 'signal_key' })
    expect(calls.some((x) => x.method === 'select')).toBe(true)
  })

  it('clears snooze_until for statuses that must not carry it', async () => {
    allowed()
    const calls: Call[] = []
    const c = chain(ok([{ signal_key: 'k' }]), calls)
    mockFrom.mockImplementation((table: string) => { c.__table = table; return c })

    await saveBulletinEditorState({
      signalKey: 'k', status: 'done-by-hand', snoozeUntil: '2026-10-05', actorId: 'u1',
    })
    expect(calls.find((x) => x.method === 'upsert')!.args[0]).toMatchObject({
      status: 'done-by-hand', snooze_until: null,
    })
  })

  it('refuses a snooze with no date — the DB CHECK would reject it anyway', async () => {
    allowed()
    await expect(saveBulletinEditorState({
      signalKey: 'k', status: 'snoozed', actorId: 'u1',
    })).rejects.toThrow(/snooze-until/)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('turns a zero-row RLS refusal into an error instead of a silent success', async () => {
    allowed()
    mockFrom.mockReturnValue(chain(ok([])))
    await expect(saveBulletinEditorState({
      signalKey: 'k', status: 'open', actorId: 'u1',
    })).rejects.toThrow(/permission/i)
  })

  it('surfaces a write error (missing table included)', async () => {
    allowed()
    mockFrom.mockReturnValue(chain(fail('PGRST202', 'Could not find the table public.bulletin_editor_state')))
    await expect(saveBulletinEditorState({
      signalKey: 'k', status: 'open', actorId: 'u1',
    })).rejects.toThrow(/bulletin_editor_state/)
  })
})

describe('action helpers', () => {
  beforeEach(() => setCurrentPermissions([P.EDIT_ANY_POST]))

  const upsertPayload = () => {
    const calls: Call[] = []
    const c = chain(ok([{ signal_key: 'k' }]), calls)
    mockFrom.mockImplementation((table: string) => { c.__table = table; return c })
    return calls
  }

  it('assign writes status open with the actor as assignee', async () => {
    const calls = upsertPayload()
    await assignBulletinSignal('k', 'u1')
    expect(calls.find((x) => x.method === 'upsert')!.args[0]).toMatchObject({
      status: 'open', assignee: 'u1', updated_by: 'u1',
    })
  })

  it('snooze returns and stores the date 7 days out', async () => {
    const calls = upsertPayload()
    const until = await snoozeBulletinSignal('k', 'u1', 7)
    expect(until).toBe(isoDatePlusDays(7))
    expect(calls.find((x) => x.method === 'upsert')!.args[0]).toMatchObject({
      status: 'snoozed', snooze_until: until,
    })
  })

  it('done-by-hand stores the note when one is given', async () => {
    const calls = upsertPayload()
    await markDoneByHand('k', 'u1', 'published by phone')
    expect(calls.find((x) => x.method === 'upsert')!.args[0]).toMatchObject({
      status: 'done-by-hand', note: 'published by phone',
    })
  })
})
