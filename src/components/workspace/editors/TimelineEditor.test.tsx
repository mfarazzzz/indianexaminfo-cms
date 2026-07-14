/**
 * TimelineEditor.test.tsx — Tests for the Timeline Builder UI.
 *
 * Covers: event rendering, status badges, lifecycle violation display,
 * calendar view, filters, empty states, accessibility.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/services/entity/timelineService', () => ({
  listTimeline: vi.fn(),
  createTimelineEvent: vi.fn(),
  updateTimelineEvent: vi.fn(),
  softDeleteTimelineEvent: vi.fn(),
  reorderTimeline: vi.fn(),
  evaluateEntityRules: vi.fn(),
}))

import TimelineEditor from './TimelineEditor'
import { listTimeline, evaluateEntityRules } from '@/services/entity/timelineService'
import type { TimelineEvent } from '@/types/entity'

const mockList = vi.mocked(listTimeline)
const mockRules = vi.mocked(evaluateEntityRules)

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'evt-1', entityId: 'e1', title: 'Application Start', eventType: 'application-start',
    eventDate: '2026-04-01', eventTime: null, description: null,
    status: 'upcoming', badgeColor: 'blue', isHighlighted: false, isFeatured: false,
    officialLink: null, pdfLink: null, imageUrl: null, visibility: 'public',
    stageKey: 'application', eventSubtype: null, publishAt: null, displayOrder: 0,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deletedAt: null,
    ...overrides,
  }
}

function renderEditor(entityId = 'e1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TimelineEditor entityId={entityId} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('TimelineEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue([])
    mockRules.mockResolvedValue([])
  })

  it('shows empty state when no events exist', async () => {
    renderEditor()
    expect(await screen.findByText(/No timeline events yet/)).toBeInTheDocument()
  })

  it('renders event cards with title and date', async () => {
    mockList.mockResolvedValue([
      makeEvent({ id: 'e1', title: 'Notification Released', eventDate: '2026-03-15' }),
      makeEvent({ id: 'e2', title: 'Application Open', eventDate: '2026-04-01' }),
    ])
    renderEditor()
    expect(await screen.findByText('Notification Released')).toBeInTheDocument()
    expect(screen.getByText('Application Open')).toBeInTheDocument()
  })

  it('displays status badges on event cards', async () => {
    mockList.mockResolvedValue([
      makeEvent({ id: 'e1', title: 'Exam Date', status: 'postponed' }),
    ])
    renderEditor()
    const badges = await screen.findAllByText('Postponed')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('displays Scheduled badge when event has publishAt', async () => {
    mockList.mockResolvedValue([
      makeEvent({ id: 'e1', title: 'Future Event', publishAt: '2026-12-01T00:00:00Z' }),
    ])
    renderEditor()
    expect(await screen.findByText('Scheduled')).toBeInTheDocument()
  })

  it('shows lifecycle rule violation on affected event', async () => {
    mockList.mockResolvedValue([
      makeEvent({ id: 'e1', title: 'Exam', stageKey: 'exam' }),
    ])
    mockRules.mockResolvedValue([
      {
        rule: { ruleType: 'must_follow', subjectStage: 'exam', objectStage: 'application', errorMessage: 'Exam must follow Application', severity: 'error' },
        severity: 'error',
        message: 'Exam must follow Application',
      },
    ])
    renderEditor()
    // Multiple instances: one in event card, one in banner
    const violations = await screen.findAllByText('Exam must follow Application')
    expect(violations.length).toBeGreaterThanOrEqual(1)
  })

  it('shows rule violations banner for blocking errors', async () => {
    mockList.mockResolvedValue([makeEvent()])
    mockRules.mockResolvedValue([
      { rule: { ruleType: 'must_follow', subjectStage: 'a', objectStage: 'b', errorMessage: 'Error!', severity: 'error' }, severity: 'error', message: 'Error!' },
    ])
    renderEditor()
    expect(await screen.findByText('Lifecycle rule violations')).toBeInTheDocument()
  })

  it('filters events by status', async () => {
    mockList.mockResolvedValue([
      makeEvent({ id: 'e1', title: 'Upcoming Event', status: 'upcoming' }),
      makeEvent({ id: 'e2', title: 'Active Event', status: 'active' }),
    ])
    renderEditor()
    await screen.findByText('Upcoming Event')

    const filter = screen.getByLabelText('Filter by status')
    fireEvent.change(filter, { target: { value: 'active' } })

    expect(screen.queryByText('Upcoming Event')).not.toBeInTheDocument()
    expect(screen.getByText('Active Event')).toBeInTheDocument()
  })

  it('switches between list and calendar views', async () => {
    mockList.mockResolvedValue([makeEvent({ eventDate: '2026-04-15' })])
    renderEditor()
    await screen.findByText('Application Start')

    // Find the calendar radio button by aria-checked state
    const radios = screen.getAllByRole('radio')
    const calendarRadio = radios.find(r => r.getAttribute('aria-checked') === 'false')
    if (calendarRadio) fireEvent.click(calendarRadio)

    // Calendar should show month navigation
    expect(screen.getByText(/Next →/)).toBeInTheDocument()
  })

  it('shows timeline summary with counts', async () => {
    mockList.mockResolvedValue([
      makeEvent({ id: 'e1', status: 'upcoming' }),
      makeEvent({ id: 'e2', status: 'active' }),
      makeEvent({ id: 'e3', status: 'active' }),
    ])
    renderEditor()
    expect(await screen.findByText('3 events')).toBeInTheDocument()
    expect(screen.getByText('1 upcoming')).toBeInTheDocument()
    expect(screen.getByText('2 active')).toBeInTheDocument()
  })

  it('has accessible list role', async () => {
    mockList.mockResolvedValue([makeEvent()])
    renderEditor()
    await screen.findByText('Application Start')
    expect(screen.getByRole('list', { name: 'Timeline events' })).toBeInTheDocument()
  })
})
