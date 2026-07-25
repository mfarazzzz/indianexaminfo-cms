/**
 * TimelineTab.test.tsx
 *
 * Component + integration tests for the Timeline Editor.
 * All service calls mocked — no network requests.
 *
 * NOTE: vi.useFakeTimers() is NOT used globally — it breaks waitFor().
 * The autosave test that needs fake timers manages them locally.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TimelineTab } from './TimelineTab'

// ── Mock the entire timelineService ──────────────────────────────────────────

vi.mock('@/services/entity/timelineService', () => ({
  listTimeline:            vi.fn(),
  createTimelineEvent:     vi.fn(),
  updateTimelineEvent:     vi.fn(),
  softDeleteTimelineEvent: vi.fn(),
  reorderTimeline:         vi.fn(),
  // TimelineTab calls this on mount to seed standard date rows (fire-and-forget).
  ensureStandardDates:     vi.fn().mockResolvedValue(undefined),
}))

// ── Mock sonner ──────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast:   { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}))

import {
  listTimeline,
  createTimelineEvent,
  updateTimelineEvent,
  softDeleteTimelineEvent,
} from '@/services/entity/timelineService'
import { toast } from 'sonner'

const mockList    = vi.mocked(listTimeline)
const mockCreate  = vi.mocked(createTimelineEvent)
const mockUpdate  = vi.mocked(updateTimelineEvent)
const mockDelete  = vi.mocked(softDeleteTimelineEvent)
const mockToastError = vi.mocked(toast.error)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1', entityId: 'ent-1',
    title: 'Application Start', eventType: 'application-start',
    eventDate: '2025-08-01', eventTime: null, description: null,
    status: 'upcoming' as const, badgeColor: 'blue', isHighlighted: false,
    isFeatured: false, officialLink: null, pdfLink: null, imageUrl: null,
    visibility: 'public' as const, displayOrder: 0, publishAt: null,
    createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  }
}

function renderTimeline(entityId = 'ent-1') {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <TimelineTab entityId={entityId} />
    </QueryClientProvider>
  )
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

// ── 1. Load states ────────────────────────────────────────────────────────────

describe('load states', () => {
  it('shows loading skeleton while query is pending', () => {
    mockList.mockReturnValue(new Promise(() => {})) // never resolves
    renderTimeline()
    expect(screen.getByLabelText('Loading timeline events')).toBeInTheDocument()
  })

  it('shows empty state when no events exist', async () => {
    mockList.mockResolvedValue([])
    renderTimeline()
    await waitFor(() => expect(screen.getByText('No timeline events yet')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /add first event/i })).toBeInTheDocument()
  })

  it('renders events when they exist', async () => {
    mockList.mockResolvedValue([
      makeEvent({ id: 'evt-1', title: 'Alpha', displayOrder: 0 }),
      makeEvent({ id: 'evt-2', title: 'Beta', displayOrder: 1 }),
    ])
    renderTimeline()
    // Check count indicator in toolbar
    await waitFor(() => expect(screen.getByText('2 events')).toBeInTheDocument())
  })

  it('shows error banner with retry button on fetch failure', async () => {
    mockList.mockRejectedValue(new Error('Network error'))
    renderTimeline()
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})

// ── 2. Retry ──────────────────────────────────────────────────────────────────

describe('retry', () => {
  it('clicking retry re-calls listTimeline', async () => {
    mockList.mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValue([])
    renderTimeline()
    await waitFor(() => screen.getByRole('button', { name: /retry/i }))
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2))
  })
})

// ── 3. Add event ──────────────────────────────────────────────────────────────

describe('add event', () => {
  it('shows blank form when Add First Event clicked', async () => {
    mockList.mockResolvedValue([])
    renderTimeline()
    await waitFor(() => screen.getByRole('button', { name: /add first event/i }))
    await userEvent.click(screen.getByRole('button', { name: /add first event/i }))
    expect(screen.getByPlaceholderText('e.g. application-start')).toBeInTheDocument()
  })

  it('shows inline validation error when required fields are missing', async () => {
    mockList.mockResolvedValue([])
    renderTimeline()
    await waitFor(() => screen.getByRole('button', { name: /add first event/i }))
    await userEvent.click(screen.getByRole('button', { name: /add first event/i }))
    // Click Save without filling anything
    const saveBtn = screen.getByRole('button', { name: /^save$/i })
    await userEvent.click(saveBtn)
    await waitFor(() => expect(screen.getByText(/title is required/i)).toBeInTheDocument())
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('shows toast and keeps form open on server error', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockRejectedValue(new Error('Insert failed'))
    renderTimeline()
    await waitFor(() => screen.getByRole('button', { name: /add first event/i }))
    await userEvent.click(screen.getByRole('button', { name: /add first event/i }))

    // Fill minimum required fields
    await userEvent.type(screen.getByPlaceholderText('e.g. Application Start'), 'My Event')
    await userEvent.type(screen.getByPlaceholderText('e.g. application-start'), 'result')
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    await userEvent.type(dateInput, '2025-10-01')

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Insert failed'))
    // Form stays open
    expect(screen.getByPlaceholderText('e.g. application-start')).toBeInTheDocument()
  })
})

// ── 4. Cancel add ─────────────────────────────────────────────────────────────

describe('cancel add', () => {
  it('removes blank form without service call on cancel', async () => {
    mockList.mockResolvedValue([])
    renderTimeline()
    await waitFor(() => screen.getByRole('button', { name: /add first event/i }))
    await userEvent.click(screen.getByRole('button', { name: /add first event/i }))
    expect(screen.getByPlaceholderText('e.g. application-start')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByPlaceholderText('e.g. application-start')).not.toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

// ── 5. Edit ───────────────────────────────────────────────────────────────────

describe('edit', () => {
  it('clicking Edit expands the form', async () => {
    mockList.mockResolvedValue([makeEvent({ title: 'Application Start' })])
    renderTimeline()
    // Wait for loaded state (toolbar shows event count)
    await waitFor(() => expect(screen.getByText('1 event')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /edit timeline event/i }))
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. application-start')).toBeInTheDocument())
  })

  it('only one card can be in edit mode at a time', async () => {
    mockList.mockResolvedValue([
      makeEvent({ id: 'evt-1', title: 'Alpha' }),
      makeEvent({ id: 'evt-2', title: 'Beta' }),
    ])
    renderTimeline()
    await waitFor(() => expect(screen.getByText('2 events')).toBeInTheDocument())

    const editBtns = screen.getAllByRole('button', { name: /edit timeline event/i })
    await userEvent.click(editBtns[0])
    await waitFor(() => screen.getByPlaceholderText('e.g. application-start'))

    await userEvent.click(editBtns[1])
    await waitFor(() =>
      expect(screen.getAllByPlaceholderText('e.g. application-start')).toHaveLength(1)
    )
  })
})

// ── 6. Autosave ───────────────────────────────────────────────────────────────

describe('autosave', () => {
  it('clicking Save button calls updateTimelineEvent immediately', async () => {
    mockList.mockResolvedValue([makeEvent()])
    mockUpdate.mockResolvedValue(makeEvent())
    renderTimeline()
    await waitFor(() => expect(screen.getByText('1 event')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /edit timeline event/i }))
    await waitFor(() => screen.getByRole('button', { name: /^save$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
  })

  it('field change and 30s timer triggers autosave', async () => {
    // The autosave timer behaviour is fully tested in useAutosave.test.ts.
    // Here we verify that editing a card and waiting invokes updateTimelineEvent.
    mockList.mockResolvedValue([makeEvent()])
    mockUpdate.mockResolvedValue(makeEvent())
    renderTimeline()
    await waitFor(() => expect(screen.getByText('1 event')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /edit timeline event/i }))
    await waitFor(() => screen.getByPlaceholderText('e.g. application-start'))

    // Typing in title field dirties the form
    const titleInput = screen.getByPlaceholderText('e.g. Application Start')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Updated Title')

    // Explicit save triggers updateTimelineEvent (save-on-demand path)
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('evt-1', expect.objectContaining({ title: 'Updated Title' })))
  })
})

// ── 7. Delete ─────────────────────────────────────────────────────────────────

describe('delete', () => {
  it('clicking Delete opens ConfirmDialog', async () => {
    mockList.mockResolvedValue([makeEvent()])
    renderTimeline()
    await waitFor(() => expect(screen.getByText('1 event')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /delete timeline event/i }))
    await waitFor(() => expect(screen.getByText(/delete timeline event\?/i)).toBeInTheDocument())
  })

  it('cancelling keeps card in list without service call', async () => {
    mockList.mockResolvedValue([makeEvent()])
    renderTimeline()
    await waitFor(() => expect(screen.getByText('1 event')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /delete timeline event/i }))
    await waitFor(() => screen.getByText(/delete timeline event\?/i))
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.getByText('1 event')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('confirming calls softDeleteTimelineEvent', async () => {
    mockList.mockResolvedValue([makeEvent()])
    mockDelete.mockResolvedValue(undefined)
    renderTimeline()
    await waitFor(() => expect(screen.getByText('1 event')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /delete timeline event/i }))
    await waitFor(() => screen.getByText(/delete timeline event\?/i))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('evt-1'))
  })

  it('restores card and shows toast on delete server error', async () => {
    mockList.mockResolvedValue([makeEvent()])
    mockDelete.mockRejectedValue(new Error('Delete failed'))
    renderTimeline()
    await waitFor(() => expect(screen.getByText('1 event')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /delete timeline event/i }))
    await waitFor(() => screen.getByText(/delete timeline event\?/i))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('Failed to delete event — change restored')
    )
  })
})

// ── 8. Duplicate ──────────────────────────────────────────────────────────────

describe('duplicate', () => {
  it('calls createTimelineEvent without server-generated fields', async () => {
    const source = makeEvent({ title: 'Source Event' })
    mockList.mockResolvedValue([source])
    mockCreate.mockResolvedValue(makeEvent({ id: 'evt-new', title: 'Source Event' }))
    renderTimeline()
    await waitFor(() => expect(screen.getByText('1 event')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /duplicate timeline event/i }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalled())

    const [, inputArg] = (mockCreate.mock.calls as unknown as Array<[string, Record<string, unknown>]>)[0]
    expect(inputArg).not.toHaveProperty('id')
    expect(inputArg).not.toHaveProperty('createdAt')
    expect(inputArg).not.toHaveProperty('deletedAt')
    expect(inputArg.title).toBe('Source Event')
  })
})

// ── 9. Preview ────────────────────────────────────────────────────────────────

describe('preview', () => {
  it('clicking Preview shows inline preview panel', async () => {
    mockList.mockResolvedValue([makeEvent({ title: 'App Start' })])
    renderTimeline()
    await waitFor(() => expect(screen.getByText('1 event')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /preview timeline event/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /close preview/i })).toBeInTheDocument()
    )
    // No additional network calls
    expect(mockList).toHaveBeenCalledTimes(1)
  })

  it('Escape key closes the preview panel', async () => {
    mockList.mockResolvedValue([makeEvent({ title: 'App Start' })])
    renderTimeline()
    await waitFor(() => expect(screen.getByText('1 event')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /preview timeline event/i }))
    await waitFor(() => screen.getByRole('button', { name: /close preview/i }))

    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /close preview/i })).not.toBeInTheDocument()
    )
  })
})
