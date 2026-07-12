/**
 * GeneralTab.focusBug.test.tsx
 *
 * Regression tests for the browser-tab-switch unsaved-data-loss bug.
 *
 * What we are testing
 * ───────────────────
 * 1. Form seeds correctly from server data on first load.
 * 2. Typed edits survive a simulated window blur → focus cycle.
 * 3. Background refetch (query invalidation) while form is dirty does NOT
 *    call reset() and does NOT overwrite the unsaved values.
 * 4. Three consecutive query invalidations do not reset the form.
 * 5. Auth/session refresh (global invalidation) does not reset the form.
 * 6. Autosave timer fires after 30 s even when the tab was hidden.
 * 7. Autosave does not fire before 30 s because of focus events.
 * 8. After an explicit save, the form re-seeds once from server data, then
 *    guards against subsequent background refetches again.
 *
 * Implementation notes
 * ────────────────────
 * • vi.useFakeTimers() is NOT used globally — it breaks waitFor().
 *   Tests that need fake timers manage them locally with try/finally.
 * • The entity query cache is pre-seeded before render to avoid async
 *   load races in tests that immediately need the form populated.
 * • Both `name` and `shortName` have the value "IBPS PO", so we select
 *   the name field by its input name attribute, not by display value.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditorUIProvider } from '@/contexts/EditorUIContext'
import { entityKeys } from '@/lib/queryKeys'

// ── Service mocks ─────────────────────────────────────────────────────────────

vi.mock('@/services/entity/entityService', () => ({
  getEntityById: vi.fn(),
  createEntity:  vi.fn(),
  updateEntity:  vi.fn(),
}))

vi.mock('@/services/categoryService', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
}))

vi.mock('sonner', () => ({
  toast:   { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import { GeneralTab } from './GeneralTab'
import { getEntityById, updateEntity } from '@/services/entity/entityService'

const mockGetEntityById = vi.mocked(getEntityById)
const mockUpdateEntity  = vi.mocked(updateEntity)

// ── Fixtures ──────────────────────────────────────────────────────────────────

import type { Entity } from '@/types/entity'

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id:               'entity-1',
    entityType:       'exam',
    name:             'IBPS PO',
    shortName:        'IBPS PO',
    slug:             'ibps-po',
    conductingBody:   'IBPS',
    officialWebsite:  'https://ibps.in',
    categoryId:       null,
    pillar:           'sarkari-naukri',
    subType:          'exam',
    examLevel:        'national',
    examMode:         'online',
    applicationMode:  'online',
    examFrequency:    'annual',
    workflowStatus:   'draft',
    isFeatured:       false,
    priority:         null,
    featuredUntil:    null,
    tags:             [],
    searchKeywords:   [],
    lang:             'en',
    metadata:         {},
    createdAt:        '2025-01-01T00:00:00Z',
    updatedAt:        '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

/** Creates a fresh QueryClient with editor-safe defaults matching production. */
function createQc() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry:                false,
        gcTime:               0,
        refetchOnWindowFocus: false,
        refetchOnMount:       true,
      },
      mutations: { retry: false },
    },
  })
}

/**
 * Creates a QueryClient that already has the entity detail in cache.
 * This prevents async load races in tests that need the form immediately.
 */
function createSeededQc(entity = makeEntity()) {
  const qc = createQc()
  qc.setQueryData(entityKeys.detail('entity-1'), entity)
  return qc
}

/** Renders GeneralTab with all required providers. */
function renderGeneralTab(entityId: string, qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <EditorUIProvider defaultTab="general">
        <GeneralTab entityId={entityId} />
      </EditorUIProvider>
    </QueryClientProvider>
  )
}

/** Returns the Exam Name input by its field name attribute. */
function getNameInput() {
  return document.querySelector<HTMLInputElement>('input[name="name"]')!
}

/** Returns the Slug input by its field name attribute. */
function getSlugInput() {
  return document.querySelector<HTMLInputElement>('input[name="slug"]')!
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockGetEntityById.mockResolvedValue(makeEntity())
  mockUpdateEntity.mockResolvedValue(makeEntity())
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── 1. Initial seed ───────────────────────────────────────────────────────────

describe('initial seed', () => {
  it('populates the name field from server data', () => {
    const qc = createSeededQc()
    renderGeneralTab('entity-1', qc)
    expect(getNameInput().value).toBe('IBPS PO')
  })

  it('populates the slug field from server data', () => {
    const qc = createSeededQc()
    renderGeneralTab('entity-1', qc)
    expect(getSlugInput().value).toBe('ibps-po')
  })

  it('calls getEntityById when entity is not in cache', async () => {
    const qc = createQc()
    renderGeneralTab('entity-1', qc)
    await waitFor(() => expect(mockGetEntityById).toHaveBeenCalledWith('entity-1'))
  })
})

// ── 2. Browser tab blur → focus (core regression) ────────────────────────────

describe('browser tab focus cycle does not discard unsaved edits', () => {
  it('typed value survives a simulated window blur + focus cycle', async () => {
    const user = userEvent.setup()
    const qc = createSeededQc()
    renderGeneralTab('entity-1', qc)

    // Make sure the form is seeded
    expect(getNameInput().value).toBe('IBPS PO')

    // User types a new name — unsaved edit
    await user.clear(getNameInput())
    await user.type(getNameInput(), 'IBPS PO 2026 EDITED')
    expect(getNameInput().value).toBe('IBPS PO 2026 EDITED')

    // Simulate browser tab losing focus
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('blur'))
    })

    // Simulate browser tab regaining focus
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })

    // Edited value must still be present
    expect(getNameInput().value).toBe('IBPS PO 2026 EDITED')
  })

  it('background refetch (query invalidation) while form is dirty does NOT reset the form', async () => {
    const user = userEvent.setup()
    const qc = createSeededQc()
    renderGeneralTab('entity-1', qc)

    await user.clear(getNameInput())
    await user.type(getNameInput(), 'My Edited Name')
    expect(getNameInput().value).toBe('My Edited Name')

    // Simulate what happens when the query is invalidated (reconnect, auth refresh, etc.)
    await act(async () => {
      await qc.invalidateQueries({ queryKey: entityKeys.detail('entity-1') })
    })

    // The seedRef guard in GeneralTab must prevent reset() from firing
    expect(getNameInput().value).toBe('My Edited Name')
  })
})

// ── 3. Multiple background refetches ─────────────────────────────────────────

describe('repeated background refetches during an editing session', () => {
  it('form value is unchanged after 3 consecutive query invalidations', async () => {
    const user = userEvent.setup()
    const qc = createSeededQc()
    renderGeneralTab('entity-1', qc)

    await user.clear(getNameInput())
    await user.type(getNameInput(), 'Persistent Edit')

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await qc.invalidateQueries({ queryKey: entityKeys.detail('entity-1') })
      })
    }

    expect(getNameInput().value).toBe('Persistent Edit')
  })
})

// ── 4. Auth / session refresh ─────────────────────────────────────────────────

describe('auth/session refresh does not discard unsaved edits', () => {
  it('form value survives a global query invalidation (TOKEN_REFRESHED simulation)', async () => {
    const user = userEvent.setup()
    const qc = createSeededQc()
    renderGeneralTab('entity-1', qc)

    await user.clear(getNameInput())
    await user.type(getNameInput(), 'Auth Refresh Test')

    // Global invalidation (simulates an auth state change handler invalidating all queries)
    await act(async () => {
      qc.invalidateQueries()
    })

    expect(getNameInput().value).toBe('Auth Refresh Test')
  })
})

// ── 5. Autosave during focus cycle ────────────────────────────────────────────
//
// We test the autosave timer here using fake timers managed locally.
// The cache is pre-seeded so the form is ready synchronously.
// We use fireEvent.change instead of userEvent.type to avoid userEvent's
// internal async scheduling conflicting with fake timers.

describe('autosave during browser focus cycle', () => {
  it('autosave fires after 30 s even if the user was on another tab', async () => {
    // Activate fake timers BEFORE rendering so all setTimeout calls are captured
    vi.useFakeTimers()
    try {
      const qc = createSeededQc()
      renderGeneralTab('entity-1', qc)

      // Form is synchronously seeded from cache — no async wait needed
      expect(getNameInput().value).toBe('IBPS PO')

      // Trigger onChange (which calls scheduleAutosave) — fake timers capture the setTimeout
      act(() => {
        fireEvent.change(getNameInput(), { target: { value: 'Autosave Test Value' } })
      })

      // Simulate tab switch away
      act(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      // Advance past the 30-second autosave debounce
      await act(async () => { vi.advanceTimersByTime(31_000) })

      // updateEntity should have been called by the autosave hook
      expect(mockUpdateEntity).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('autosave does NOT fire before 30 s because of focus/blur events', () => {
    const qc = createSeededQc()
    renderGeneralTab('entity-1', qc)

    act(() => {
      fireEvent.change(getNameInput(), { target: { value: 'IBPS PO extra' } })
    })

    vi.useFakeTimers()
    try {
      // Focus/blur events within 30 s must not trigger autosave
      act(() => { window.dispatchEvent(new Event('blur')) })
      act(() => { window.dispatchEvent(new Event('focus')) })
      act(() => { vi.advanceTimersByTime(15_000) })

      expect(mockUpdateEntity).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

// ── 6. Re-seed after explicit save ────────────────────────────────────────────

describe('form re-seeds once after explicit save, then guards again', () => {
  it('after save: accepts updated server data once, then blocks subsequent refetches', async () => {
    const savedEntity = makeEntity({ name: 'IBPS PO SAVED', slug: 'ibps-po-saved' })
    mockUpdateEntity.mockResolvedValue(savedEntity)
    mockGetEntityById.mockResolvedValue(savedEntity)

    // Pre-seed with original entity so the form opens immediately
    const qc = createSeededQc(makeEntity())
    renderGeneralTab('entity-1', qc)

    const user = userEvent.setup()

    // Confirm initial state
    expect(getNameInput().value).toBe('IBPS PO')

    // Edit and save
    await user.clear(getNameInput())
    await user.type(getNameInput(), 'IBPS PO SAVED')

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    // Post-save: mutation calls updateEntity then invalidates the query.
    // The next server response (savedEntity) should re-seed the form.
    await waitFor(() => expect(getNameInput().value).toBe('IBPS PO SAVED'), { timeout: 10_000 })
    await waitFor(() => expect(getSlugInput().value).toBe('ibps-po-saved'), { timeout: 10_000 })

    // Now edit again — subsequent invalidations must NOT overwrite
    await user.clear(getNameInput())
    await user.type(getNameInput(), 'Post-Save Unsaved Edit')

    await act(async () => {
      await qc.invalidateQueries({ queryKey: entityKeys.detail('entity-1') })
    })

    expect(getNameInput().value).toBe('Post-Save Unsaved Edit')
  })
})
