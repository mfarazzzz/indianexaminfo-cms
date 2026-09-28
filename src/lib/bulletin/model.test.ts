/**
 * model.test.ts — the bulletin's derivation rules, tested with fixtures only
 * (no React, no Supabase). These are the rules the home screen renders, so the
 * screen itself stays thin.
 */
import { describe, it, expect } from 'vitest'

import {
  assembleBulletin,
  buildTrafficIndex,
  chipForSignal,
  clicksForSignal,
  daysFromToday,
  isSnoozedActive,
  latestPeriodRows,
  sortSignalRows,
  trafficPath,
  verifyBlockers,
  type BulletinBundle,
  type BulletinEditorState,
  type BulletinSignal,
  type TrafficRow,
  type VerifyCandidate,
} from './model'
import { EMPTY_PENDING_FIXTURE, MOCK_BUNDLE } from './fixtures'

const TODAY = '2026-09-28'

const candidate = (over: Partial<VerifyCandidate>): VerifyCandidate => ({
  id: 'x', slug: 's', title: 'T', state: null,
  official_notification_url: 'https://ok.example', application_end_date: '2026-10-10',
  ...over,
})

const state = (over: Partial<BulletinEditorState>): BulletinEditorState => ({
  signal_key: 'k', assignee: null, status: 'open', snooze_until: null,
  note: null, updated_by: null, updated_at: null, ...over,
})

// ── traffic ──────────────────────────────────────────────────────────────────

describe('trafficPath + buildTrafficIndex', () => {
  it('reduces an exported URL to its path', () => {
    expect(trafficPath('https://www.indianexaminfo.com/sarkari-naukri/foo-2026')).toBe(
      'sarkari-naukri/foo-2026',
    )
    expect(trafficPath('https://www.indianexaminfo.com/board-exam/state/bihar/x/result/')).toBe(
      'board-exam/state/bihar/x/result',
    )
    expect(trafficPath('/news/foo?utm=1')).toBe('news/foo')
  })

  it('indexes every path segment and keeps the largest click count', () => {
    const index = buildTrafficIndex([
      { url: 'https://h/admission/management/ssc-cgl-2026/result', clicks: 100, period_start: 'a', period_end: 'b' },
      { url: 'https://h/admission/management/ssc-cgl-2026/admit-card', clicks: 340, period_start: 'a', period_end: 'b' },
    ])
    expect(index.get('ssc-cgl-2026')).toBe(340)
    expect(index.get('result')).toBe(100)
  })

  it('reads 0 for an entity with no traffic row', () => {
    const index = buildTrafficIndex(MOCK_BUNDLE.traffic)
    const signal = MOCK_BUNDLE.signals.find((s) => s.slug === 'nta-neet-ug-2026')!
    expect(clicksForSignal(signal, index)).toBe(0)
  })

  it('uses only the newest reporting period', () => {
    const rows: TrafficRow[] = [
      { url: 'https://h/sarkari-naukri/a', clicks: 9999, period_start: '2026-07-30', period_end: '2026-08-28' },
      { url: 'https://h/sarkari-naukri/a', clicks: 10, period_start: '2026-08-29', period_end: '2026-09-27' },
    ]
    const newest = latestPeriodRows(rows)
    expect(newest).toHaveLength(1)
    expect(newest[0].clicks).toBe(10)
    // The whole board inherits that rule: UP Police ranks at 900, not 9999.
    const board = assembleBulletin(MOCK_BUNDLE, { today: TODAY })
    const upPolice = board.comingUp.rows.find((r) => r.signal.slug === 'up-police-constable-2026')!
    expect(upPolice.clicks).toBe(900)
  })
})

// ── verification blockers (mirror of the applied trigger) ────────────────────

describe('verifyBlockers — the same two preconditions trg_sarkari_verify enforces', () => {
  it('names both missing fields when nothing is filled', () => {
    expect(verifyBlockers(candidate({ official_notification_url: null, application_end_date: null })))
      .toEqual(['official notification link', 'application end date'])
  })

  it('names only the end date when the link is present', () => {
    expect(verifyBlockers(candidate({ application_end_date: null }))).toEqual(['application end date'])
  })

  it('names only the link when the end date is present', () => {
    expect(verifyBlockers(candidate({ official_notification_url: null }))).toEqual(['official notification link'])
  })

  it('treats a link without an http(s) scheme as missing, like the trigger does', () => {
    expect(verifyBlockers(candidate({ official_notification_url: 'www.uppolice.gov.in' })))
      .toEqual(['official notification link'])
    expect(verifyBlockers(candidate({ official_notification_url: 'ftp://uppolice.gov.in' })))
      .toEqual(['official notification link'])
    expect(verifyBlockers(candidate({ official_notification_url: '   ' })))
      .toEqual(['official notification link'])
  })

  it('blocks nothing once both are set', () => {
    expect(verifyBlockers(candidate({}))).toEqual([])
  })
})

// ── editor state ─────────────────────────────────────────────────────────────

describe('snooze and done-by-hand rules', () => {
  it('keeps a snooze in force until its date, then the work is open again', () => {
    expect(isSnoozedActive(state({ status: 'snoozed', snooze_until: '2026-10-05' }), TODAY)).toBe(true)
    expect(isSnoozedActive(state({ status: 'snoozed', snooze_until: TODAY }), TODAY)).toBe(true)
    expect(isSnoozedActive(state({ status: 'snoozed', snooze_until: '2026-09-20' }), TODAY)).toBe(false)
    expect(isSnoozedActive(state({ status: 'snoozed', snooze_until: null }), TODAY)).toBe(false)
  })

  it('ranks the editor action above the content signal in the chip', () => {
    const s = { has_content: true } as BulletinSignal
    expect(chipForSignal(s, state({ status: 'done-by-hand' }), TODAY)).toBe('done-by-hand')
    expect(chipForSignal(s, state({ status: 'snoozed', snooze_until: '2026-10-05' }), TODAY)).toBe('snoozed')
    expect(chipForSignal(s, undefined, TODAY)).toBe('live')
    expect(chipForSignal({ ...s, has_content: false }, undefined, TODAY)).toBe('empty')
  })

  it('daysFromToday is signed and null-safe', () => {
    expect(daysFromToday('2026-10-02', TODAY)).toBe(4)
    expect(daysFromToday('2026-09-26', TODAY)).toBe(-2)
    expect(daysFromToday('2026-09-28', TODAY)).toBe(0)
    expect(daysFromToday(null, TODAY)).toBeNull()
  })
})

// ── assembly ─────────────────────────────────────────────────────────────────

describe('assembleBulletin — empty states', () => {
  const empty: BulletinBundle = {
    ...EMPTY_PENDING_FIXTURE,
    signals: [], editorStates: [], traffic: [], unverifiedVacancies: [],
  }
  const board = assembleBulletin(empty, { today: TODAY })

  it('renders every section with zero rows instead of failing', () => {
    expect(board.justArrived.rows).toEqual([])
    expect(board.comingUp.rows).toEqual([])
    expect(board.backlog.rows).toEqual([])
    expect(board.backlog.count).toBe(0)
    expect(board.verificationQueue).toEqual([])
  })

  it('reports no traffic period when page_traffic is empty', () => {
    expect(board.trafficPeriod).toBeNull()
  })
})

describe('assembleBulletin — the reviewed wireframe', () => {
  const board = assembleBulletin(MOCK_BUNDLE, { today: TODAY })

  it('counts OPEN work: a snoozed and a done-by-hand row leave the count', () => {
    expect(board.justArrived.openCount).toBe(2)     // 4 arrived − 1 snoozed − 1 done
    expect(board.justArrived.snoozedCount).toBe(1)
    expect(board.justArrived.doneCount).toBe(1)
    expect(board.comingUp.openCount).toBe(4)
  })

  it('hides done-by-hand rows and sinks snoozed rows to the bottom', () => {
    const keys = board.justArrived.rows.map((r) => r.signal.slug)
    expect(keys).not.toContain('bihar-board-inter-2026')     // done-by-hand
    expect(keys).toContain('chhattisgarh-health-ambulance-driver-2026')
    expect(keys[keys.length - 1]).toBe('ibps-po-2026')        // snoozed, last
    expect(board.justArrived.rows[board.justArrived.rows.length - 1].chip).toBe('snoozed')
  })

  it('sorts Coming up by traffic by default, missing traffic last', () => {
    expect(board.comingUp.rows.map((r) => r.clicks)).toEqual([1200, 900, 640, 0])
  })

  it('sorts Coming up by date ascending when the mode is date', () => {
    const byDate = assembleBulletin(MOCK_BUNDLE, { today: TODAY, sort: { mode: 'date', direction: 'asc' } })
    expect(byDate.comingUp.rows.map((r) => r.signal.event_date))
      .toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-04'])
    // The same direction applies to every queue — it is one control, not per section.
    expect(byDate.justArrived.rows.map((r) => r.signal.event_date))
      .toEqual(['2026-09-26', '2026-09-27', '2026-09-25'])   // the snoozed row stays last
  })

  it('honours the direction in both modes', () => {
    const newestFirst = assembleBulletin(MOCK_BUNDLE, { today: TODAY, sort: { mode: 'date', direction: 'desc' } })
    expect(newestFirst.comingUp.rows.map((r) => r.signal.event_date))
      .toEqual(['2026-10-04', '2026-10-02', '2026-10-01', '2026-09-30'])
    const fewestFirst = assembleBulletin(MOCK_BUNDLE, { today: TODAY, sort: { mode: 'traffic', direction: 'asc' } })
    expect(fewestFirst.comingUp.rows.map((r) => r.clicks)).toEqual([0, 640, 900, 1200])
  })

  it('never shows a future signal on the board', () => {
    const allSlugs = [
      ...board.justArrived.rows, ...board.comingUp.rows, ...board.backlog.rows,
    ].map((r) => r.signal.slug)
    expect(allSlugs).not.toContain('cat-2026')
  })

  it('surfaces the backlog as a count with its own rows', () => {
    expect(board.backlog.count).toBe(3)
    expect(board.backlog.rows).toHaveLength(3)
    // The expired snooze is open work again, so it is not marked snoozed.
    const upsc = board.backlog.rows.find((r) => r.signal.slug === 'upsc-cse-2026')!
    expect(upsc.chip).toBe('empty')
    expect(upsc.open).toBe(true)
  })

  it('ranks the verification queue by clicks, 0 when the entity has no traffic row', () => {
    expect(board.verificationQueue.map((r) => r.clicks)).toEqual([72, 47, 0, 0])
    expect(board.verificationQueue[0].vacancy.slug).toBe('bihar-mgnrega-rozgar-sewak-2026')
    expect(board.verificationQueue.map((r) => r.blockers)).toEqual([
      ['application end date'],
      [],
      ['official notification link'],
      ['official notification link', 'application end date'],
    ])
    expect(board.verificationQueue.map((r) => r.chip))
      .toEqual(['attention', 'empty', 'attention', 'attention'])
  })

  it('states the period the traffic numbers come from', () => {
    expect(board.trafficPeriod).toEqual({ start: '2026-08-29', end: '2026-09-27' })
  })
})

describe('sortSignalRows', () => {
  const board = assembleBulletin(MOCK_BUNDLE, { today: TODAY })
  const rows = board.comingUp.rows

  it('never falls back to insertion order — a tie still breaks on date then key', () => {
    const tied = rows.map((r) => ({ ...r, clicks: 5 }))
    const out = sortSignalRows(tied, { mode: 'traffic', direction: 'asc' })
    expect(out.map((r) => r.signal.event_date)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-04'])
  })

  it('reverses cleanly when the direction toggles', () => {
    const asc = sortSignalRows(rows, { mode: 'date', direction: 'asc' }).map((r) => r.signal.event_date)
    const desc = sortSignalRows(rows, { mode: 'date', direction: 'desc' }).map((r) => r.signal.event_date)
    expect(desc).toEqual([...asc].reverse())
  })
})
