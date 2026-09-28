/**
 * BulletinPage.test.tsx — the bulletin home, rendered from mocked data only.
 *
 * Two levels are covered:
 *   • BulletinBoard with fixture bundles — the four sections, the chips, the
 *     row order, the empty states, the permission gate on the actions, and the
 *     binding visual rules from §f of the design doc;
 *   • BulletinPage through the router at /bulletin?mock=1, which is exactly how
 *     the screenshots were taken.
 *
 * No Supabase call is made: the client and the service module are mocked, and
 * the DEV mock path never enables the query.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'

import { BulletinBoard } from './BulletinBoard'
import { BulletinPage } from './BulletinPage'
import { createTestQueryClient } from '@/__tests__/helpers'
import { EMPTY_BUNDLE, type BulletinBundle } from '@/lib/bulletin/model'
import { EMPTY_PENDING_FIXTURE, MOCK_BUNDLE } from '@/lib/bulletin/fixtures'

vi.mock('@/lib/supabase/client', () => ({ db: { from: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/services/bulletinService', () => ({
  loadBulletin: vi.fn(async () => EMPTY_BUNDLE),
  assignBulletinSignal: vi.fn(),
  snoozeBulletinSignal: vi.fn(),
  markDoneByHand: vi.fn(),
}))

const auth = vi.hoisted(() => ({ permissions: [] as string[], id: 'user-1' }))
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: auth.id, email: 'e@x.in', profile: { name: 'Faraz', permissions: auth.permissions } },
    permissions: auth.permissions,
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refreshUser: vi.fn(),
  }),
}))

const bundleWith = (over: Partial<BulletinBundle>): BulletinBundle => ({
  ...EMPTY_BUNDLE, ...over,
})

function CaptureLocation() {
  const loc = useLocation()
  return <span data-testid="loc">{`${loc.pathname}${loc.search}`}</span>
}

/** Mount the board inside a router so row navigation is observable. */
function renderBoard(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/bulletin']}>
      <Routes>
        <Route path="/bulletin" element={ui} />
        <Route path="/exams/:id" element={<CaptureLocation />} />
        <Route path="/vacancies/:id" element={<CaptureLocation />} />
      </Routes>
    </MemoryRouter>,
  )
}

const region = (name: string) => screen.getByRole('region', { name })
const queue = (name: string) => within(region(name))
/** The rows of one queue, in DOM order. */
const rows = (name: string) =>
  Array.from(region(name).querySelectorAll('[data-row]')) as HTMLElement[]

beforeEach(() => {
  auth.permissions = []
  auth.id = 'user-1'
})

// ── the four sections, on the reviewed wireframe data ────────────────────────

describe('BulletinBoard — mocked data', () => {
  it('renders the four sections of the reviewed design', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    expect(screen.getByText('Bulletin')).toBeInTheDocument()
    for (const name of ['Just arrived', 'Coming up', 'Verification queue', 'Backlog']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
  })

  it('states the UTC as-of date the buckets were computed against', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    expect(screen.getByText(/Mon 28 Sep 2026 · buckets are computed against this UTC date/))
      .toBeInTheDocument()
  })

  it('counts OPEN work — a snoozed and a done-by-hand row leave the count', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    expect(queue('Just arrived').getByText('2 items')).toBeInTheDocument()
    expect(queue('Just arrived').getByText('1 snoozed · 1 done-by-hand hidden')).toBeInTheDocument()
    expect(queue('Coming up').getByText('4 items')).toBeInTheDocument()
    expect(queue('Backlog').getByText('3 items')).toBeInTheDocument()
  })

  it('orders Coming up by traffic, highest first, missing traffic last', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    expect(rows('Coming up').map((r) => r.textContent)).toEqual([
      expect.stringContaining('SSC CGL 2026'),
      expect.stringContaining('UP Police Constable Recruitment 2026'),
      expect.stringContaining('IBPS PO Mains 2026'),
      expect.stringContaining('NEET UG 2026'),
    ])
  })

  it('sinks a snoozed row to the bottom and hides a done-by-hand row', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    const arrived = rows('Just arrived')
    expect(arrived).toHaveLength(3)                       // 4 signals − 1 done-by-hand
    expect(arrived[2].textContent).toContain('IBPS PO Prelims 2026')  // snoozed, last
    expect(arrived[2].textContent).toContain('snoozed')
    expect(queue('Just arrived').queryByText('Bihar Board Inter 2026')).not.toBeInTheDocument()
  })

  it('never shows a signal whose window has not opened', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    expect(screen.queryByText('CAT 2026')).not.toBeInTheDocument()
  })

  it('uses only the newest reporting period for the ranking', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    // The stale period row for UP Police carries 9999 clicks; the newest carries 900.
    expect(rows('Coming up')[1].textContent).toContain('900')
    expect(screen.queryByText('9,999')).not.toBeInTheDocument()
    expect(screen.getByText(/Search Console clicks for 2026-08-29 → 2026-09-27/)).toBeInTheDocument()
  })

  it('states what blocks Verify, in words an editor can act on', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    const q = queue('Verification queue')
    expect(q.getByText('fill application end date')).toBeInTheDocument()
    expect(q.getByText('fill official notification link')).toBeInTheDocument()
    expect(q.getByText('fill official notification link + application end date')).toBeInTheDocument()
    expect(q.getByText('nothing — ready to verify')).toBeInTheDocument()
    expect(q.getByText(/publish_post permission/)).toBeInTheDocument()
  })

  it('ranks the verification queue by clicks, 0 when the page has no traffic row', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    const q = rows('Verification queue')
    expect(q).toHaveLength(4)
    expect(q[0].textContent).toContain('Bihar MGNREGA Rozgar Sewak 2026')
    expect(within(q[0] as HTMLElement).getByText('72')).toBeInTheDocument()
    expect(q[1].textContent).toContain('Rajasthan Health Dept — Radiographer 2026')
    expect(within(q[1] as HTMLElement).getByText('47')).toBeInTheDocument()
    // The two rows with no page_traffic entry render an explicit 0, not a blank.
    expect(q[2].textContent).toContain('MP High Court — Junior Secretary 2026')
    expect(within(q[2] as HTMLElement).getByText('0')).toBeInTheDocument()
    expect(within(q[3] as HTMLElement).getByText('0')).toBeInTheDocument()
  })

  it('offers the backlog as a count with a show-all toggle', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    const q = queue('Backlog')
    expect(q.getByText('3 items')).toBeInTheDocument()
    expect(q.queryByText('UPSC CSE Prelims 2026')).not.toBeInTheDocument()
    fireEvent.click(q.getByText('show all'))
    expect(q.getByText('UPSC CSE Prelims 2026')).toBeInTheDocument()
    expect(rows('Backlog')).toHaveLength(3)
    fireEvent.click(q.getByText('hide all'))
    expect(q.queryByText('UPSC CSE Prelims 2026')).not.toBeInTheDocument()
  })
})

// ── empty states ─────────────────────────────────────────────────────────────

describe('BulletinBoard — empty states', () => {
  it('says so plainly when there is no work at all', () => {
    renderBoard(<BulletinBoard bundle={bundleWith({ asOf: '2026-09-28' })} canEdit={false} />)
    expect(queue('Just arrived').getByText('No signals have landed in their window today.')).toBeInTheDocument()
    expect(queue('Coming up').getByText('No signal windows open in the near future.')).toBeInTheDocument()
    expect(queue('Verification queue').getByText('Every vacancy page is verified.')).toBeInTheDocument()
    expect(queue('Just arrived').getByText('0 items')).toBeInTheDocument()
  })

  it('explains that the traffic numbers are absent until a CSV is imported', () => {
    renderBoard(<BulletinBoard bundle={bundleWith({ asOf: '2026-09-28' })} canEdit={false} />)
    expect(screen.getByText(/no page_traffic rows loaded yet — every count reads 0/))
      .toBeInTheDocument()
  })

  it('explains that the proposed DB objects are not applied yet', () => {
    renderBoard(<BulletinBoard bundle={EMPTY_PENDING_FIXTURE} canEdit={false} />)
    expect(screen.getByText(/not in this database yet/)).toBeInTheDocument()
    expect(screen.getByText(/supabase\/proposed\//)).toBeInTheDocument()
    expect(screen.queryByText(/Mocked data/)).not.toBeInTheDocument()
  })

  it('shows a loading line instead of a false empty state', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} loading />)
    expect(queue('Just arrived').getByText('Loading…')).toBeInTheDocument()
    expect(queue('Coming up').getByText('Loading…')).toBeInTheDocument()
  })
})

// ── the three editor actions and their gate ──────────────────────────────────

describe('BulletinBoard — editor actions', () => {
  it('shows Assign / Snooze 7d / Done by hand for a holder of edit_any_post', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit />)
    expect(rows('Just arrived')[0].textContent).toContain('Assign')
    expect(rows('Just arrived')[0].textContent).toContain('Snooze 7d')
    expect(rows('Just arrived')[0].textContent).toContain('Done by hand')
  })

  it('hides every action, including the column header, without edit_any_post', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    expect(screen.queryByText('Assign')).not.toBeInTheDocument()
    expect(screen.queryByText('Snooze 7d')).not.toBeInTheDocument()
    expect(screen.queryByText('Done by hand')).not.toBeInTheDocument()
    expect(screen.queryByText('Action')).not.toBeInTheDocument()
    // The only control left in a row is the link to the editor.
    expect(rows('Just arrived')[0].querySelectorAll('button')).toHaveLength(1)
  })

  it('reports the signal an action belongs to, keyed by the view signal_key', () => {
    const onAction = vi.fn()
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit onAction={onAction} />)
    const row = rows('Just arrived')[0]
    expect(row.textContent).toContain('Chhattisgarh Health Dept')
    fireEvent.click(within(row as HTMLElement).getByText('Snooze 7d'))
    expect(onAction).toHaveBeenCalledWith(
      'sarkari_naukri:11111111-1111-1111-1111-111111111101:admit_card:2026-09-26:admit_card_url',
      'snooze',
    )
  })

  it('disables the buttons of the row currently being written', () => {
    const busy = 'exam_editions:00000000-0000-0000-0000-0000000000e2:result:2026-09-27:result'
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit busyKey={busy} />)
    const row = rows('Just arrived').find((r) => r.textContent?.includes('SSC CHSL 2026'))!
    expect(within(row as HTMLElement).getByText('Assign')).toBeDisabled()
    expect(within(row as HTMLElement).getByText('Done by hand')).toBeDisabled()
  })

  it('a vacancy row opens the vacancy editor; an exam row opens the exam editor', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    fireEvent.click(rows('Coming up')[1])   // UP Police — sarkari_naukri signal
    expect(screen.getByTestId('loc')).toHaveTextContent('/vacancies/11111111-1111-1111-1111-111111111102')
  })

  it('every row also carries a named Open control for keyboard users', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit />)
    fireEvent.click(screen.getByRole('button', { name: 'Open SSC CGL 2026' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/exams/00000000-0000-0000-0000-000000000001')
  })

  it('an exam signal navigates to /exams/:exam_id', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    fireEvent.click(rows('Coming up')[0])   // SSC CGL — exam_editions signal
    expect(screen.getByTestId('loc')).toHaveTextContent('/exams/00000000-0000-0000-0000-000000000001')
  })

  it('a verification row opens the vacancy editor', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    fireEvent.click(rows('Verification queue')[0])
    expect(screen.getByTestId('loc')).toHaveTextContent('/vacancies/22222222-2222-2222-2222-222222222202')
  })
})

// ── the binding visual rules ─────────────────────────────────────────────────

describe('BulletinBoard — the binding visual rules', () => {
  it('uses no icons (no inline SVG, no img) and no emoji anywhere', () => {
    const { container } = renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit />)
    expect(container.querySelectorAll('svg').length).toBe(0)
    expect(container.querySelectorAll('img').length).toBe(0)
    expect(container.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('separates rows by one hairline and draws no box around a row or a list', () => {
    const { container } = renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit />)
    const lists = Array.from(container.querySelectorAll('div.divide-y'))
    expect(lists.length).toBeGreaterThanOrEqual(3)
    for (const list of lists) {
      expect(list.className).toContain('divide-slate-100')
      expect(list.className).not.toMatch(/rounded|shadow|border/)
    }
    for (const row of Array.from(container.querySelectorAll('[data-row]'))) {
      expect(row.className).not.toMatch(/border|rounded/)   // hover tint only
    }
  })

  it('left-aligns the date column', () => {
    const { container } = renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    const firstDate = container.querySelector('time')!
    expect(firstDate.closest('div')!.className).toContain('text-left')
  })

  it('gives every list a min width so a narrow window scrolls instead of dropping titles', () => {
    const { container } = renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit />)
    const lists = Array.from(container.querySelectorAll('div.divide-y'))
    expect(lists.length).toBeGreaterThanOrEqual(3)
    for (const list of lists) {
      expect(parseInt((list as HTMLElement).style.minWidth, 10)).toBeGreaterThanOrEqual(700)
    }
    // The entity track keeps a floor of its own; the flexible width is a max, not 0.
    const row = container.querySelector('[data-row]') as HTMLElement
    expect(row.style.gridTemplateColumns).toContain('minmax(180px,1fr)')
    expect(row.style.gridTemplateColumns).not.toContain('minmax(0,1fr)')
  })

  it('offers sorting only by date or traffic, and applying it re-orders the rows', () => {
    const { container } = renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    const headers = Array.from(container.querySelectorAll('button[aria-pressed]'))
      .map((b) => (b.textContent ?? '').replace(/[↑↓]/g, '').trim())
    expect(headers.length).toBeGreaterThan(0)
    expect(headers.every((h) => h === 'Date' || h === 'Traffic')).toBe(true)

    // Default is traffic (SSC CGL 1.2k first); switching to date puts 30 Sep first.
    expect(rows('Coming up')[0].textContent).toContain('SSC CGL 2026')
    fireEvent.click(screen.getAllByRole('button', { name: /^Date/ })[0])
    expect(rows('Coming up')[0].textContent).toContain('NEET UG 2026')
    fireEvent.click(screen.getAllByRole('button', { name: /^Date/ })[0])   // toggles direction
    expect(rows('Coming up')[0].textContent).toContain('SSC CGL 2026')
  })

  it('restricts chips to the five-word hierarchy', () => {
    const { container } = renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit />)
    const chips = Array.from(container.querySelectorAll('[role="status"]'))
      .map((c) => (c.getAttribute('aria-label') ?? '').split(':')[0])
    const allowed = new Set(['live', 'empty', 'snoozed', 'done-by-hand', 'attention'])
    expect(chips.length).toBeGreaterThan(5)
    expect(chips.every((c) => allowed.has(c))).toBe(true)
  })

  it('keeps pillar and region as plain text, never a chip', () => {
    renderBoard(<BulletinBoard bundle={MOCK_BUNDLE} canEdit={false} />)
    const region = screen.getByText('sarkari-naukri · chhattisgarh')
    expect(region.getAttribute('role')).toBeNull()
    expect(region.tagName).toBe('SPAN')
  })
})

// ── the route, exactly as screenshotted ──────────────────────────────────────

describe('BulletinPage at /bulletin?mock=1', () => {
  function renderPage(entry: string) {
    const qc = createTestQueryClient()
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <QueryClientProvider client={qc}>
          <Routes>
            <Route path="/bulletin" element={<BulletinPage />} />
            <Route path="*" element={<CaptureLocation />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    )
  }

  it('loads the fixtures and labels itself as mocked', async () => {
    auth.permissions = ['edit_any_post', 'edit_own_post']
    renderPage('/bulletin?mock=1')
    await waitFor(() => expect(screen.getByText('SSC CGL 2026')).toBeInTheDocument())
    expect(screen.getByText(/Mocked data \(\?mock=1\)/)).toBeInTheDocument()
    expect(screen.getByText('Bulletin')).toBeInTheDocument()
    expect(screen.getByText(/dashboard is still the default screen/)).toBeInTheDocument()
  })

  it('never shows the mock banner without the flag', async () => {
    auth.permissions = ['edit_own_post']
    renderPage('/bulletin')
    await waitFor(() => expect(screen.getByText('Bulletin')).toBeInTheDocument())
    expect(screen.queryByText(/Mocked data/)).not.toBeInTheDocument()
  })

  it('hides the actions for a user without edit_any_post, even in mock mode', async () => {
    auth.permissions = ['edit_own_post']
    renderPage('/bulletin?mock=1')
    await waitFor(() => expect(screen.getByText('SSC CGL 2026')).toBeInTheDocument())
    expect(screen.queryByText('Snooze 7d')).not.toBeInTheDocument()
  })

  it('snoozing and done-by-hand in mock mode re-render the board without any DB write', async () => {
    const { snoozeBulletinSignal, assignBulletinSignal, markDoneByHand } =
      await import('@/services/bulletinService')
    auth.permissions = ['edit_any_post']
    renderPage('/bulletin?mock=1')
    await waitFor(() => expect(screen.getByText('SSC CHSL 2026')).toBeInTheDocument())

    // Done by hand takes the row out of Just arrived: 2 open → 1, and the
    // footnote counts the hidden row instead.
    const chslRow = () =>
      (Array.from(document.querySelectorAll('[data-row]')) as HTMLElement[])
        .find((r) => r.textContent?.includes('SSC CHSL 2026'))!
    fireEvent.click(within(chslRow() as HTMLElement).getByText('Done by hand'))
    await waitFor(() => expect(chslRow()).toBeUndefined())
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Just arrived' }).textContent)
        .toContain('1 snoozed · 2 done-by-hand hidden'),
    )

    // Snooze the other open row of the same queue; the chip becomes ◐ snoozed.
    const cgRow = () =>
      (Array.from(document.querySelectorAll('[data-row]')) as HTMLElement[])
        .find((r) => r.textContent?.includes('Chhattisgarh Health Dept'))!
    fireEvent.click(within(cgRow() as HTMLElement).getByText('Snooze 7d'))
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Just arrived' }).textContent)
        .toContain('0 items'),
    )
    expect(within(cgRow() as HTMLElement).getByText('snoozed')).toBeInTheDocument()

    expect(vi.mocked(snoozeBulletinSignal)).not.toHaveBeenCalled()
    expect(vi.mocked(assignBulletinSignal)).not.toHaveBeenCalled()
    expect(vi.mocked(markDoneByHand)).not.toHaveBeenCalled()
  })
})
