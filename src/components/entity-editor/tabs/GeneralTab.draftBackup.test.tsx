/**
 * GeneralTab.draftBackup.test.tsx — the owner-visible half of Phase T (batch 5).
 *
 * useDraftBackup.test.tsx proves the timing rules in isolation. This file proves the same rules
 * hold inside the REAL editor form, where they matter to the person using it:
 *
 *  1. a browser copy that is newer than the server row raises the prompt and is applied by NOBODY
 *     but the editor — the form still shows the server's text until "Restore" is clicked;
 *  2. "Restore" puts the text back and writes nothing to the database (the copy stays, because it
 *     has still not been saved);
 *  3. "Discard" answers the prompt for good — the copy is dropped now, not at TTL;
 *  4. typing stores the copy after the debounce WITHOUT any save call, and a successful
 *     "Save Changes" retires the copy, because the database has it.
 *
 * Nothing here mocks the backup module itself — it runs against real jsdom localStorage, the same
 * way the editor does in a browser.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditorUIProvider } from '@/contexts/EditorUIContext'
import { TimelineDatesProvider } from '@/contexts/TimelineDatesContext'

// ── Service + environment mocks ───────────────────────────────────────────────

vi.mock('@/services/entity/entityService', () => ({
  getEntityById: vi.fn(),
  createEntity:  vi.fn(),
  updateEntity:  vi.fn(),
}))
vi.mock('@/services/categoryService', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/services/entity/timelineService', () => ({ listTimeline: vi.fn().mockResolvedValue([]) }))
vi.mock('@/services/entity/vacancyService', () => ({ listVacancies: vi.fn().mockResolvedValue([]) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() }, Toaster: () => null }))
// The tab scopes the backup to the signed-in user; in the app it is always under AuthProvider.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user' }, isLoading: false, authExpired: false }),
}))

import { GeneralTab } from './GeneralTab'
import { getEntityById, updateEntity } from '@/services/entity/entityService'
import { loadDraftBackup, saveDraftBackup } from '@/lib/editing/draftBackup'
import type { Entity } from '@/types/entity'

const mockedGetEntityById = vi.mocked(getEntityById)
const mockedUpdateEntity  = vi.mocked(updateEntity)

const ENTITY_ID = 'entity-1'
const USER_ID   = 'test-user'
/** What the editor had typed before the tab died. */
const DRAFT_NAME = 'IBPS PO 2025 — the edit that never got saved'
/** What an editor types during the test itself. */
const TYPED_NAME = 'SSC CGL 2026 (edited, unsaved)'

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: ENTITY_ID, name: 'IBPS PO 2025', shortName: 'IBPS PO', slug: 'ibps-po-2025',
    conductingBody: 'IBPS', officialWebsite: 'https://ibps.in', categoryId: null, pillar: null,
    subType: 'exam', examLevel: null, examMode: null, applicationMode: null, examFrequency: null,
    workflowStatus: 'draft', isFeatured: false, priority: null, featuredUntil: null,
    tags: ['banking'], searchKeywords: ['ibps po 2025'], lang: 'en',
    createdAt: '2025-01-01T00:00:00Z',
    // The server's own last-saved stamp, a year old: anything this browser holds is newer.
    updatedAt: '2025-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  } as unknown as Entity
}

/** The shape the hook writes: the whole General form, exactly as watch() returns it. */
const draftFormValues = {
  name: DRAFT_NAME, shortName: 'IBPS PO', slug: 'ibps-po-2025', conductingBodyId: null,
  officialWebsite: 'https://ibps.in', categoryId: null, pillar: null, workflowStatus: 'draft',
  isFeatured: false, priority: null, featuredUntil: null, tags: ['banking'],
  searchKeywords: ['ibps po 2025'], lang: 'en', metadata: {},
}

function renderGeneralTab() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <EditorUIProvider defaultTab="general">
          <TimelineDatesProvider entityId={ENTITY_ID}>
            <GeneralTab entityId={ENTITY_ID} />
          </TimelineDatesProvider>
        </EditorUIProvider>
      </QueryClientProvider>,
    ),
  }
}

const storedDraft = () => loadDraftBackup<{ name?: string }>(ENTITY_ID, 'general', { userId: USER_ID })

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mockedGetEntityById.mockResolvedValue(makeEntity())
})

afterEach(() => {
  window.localStorage.clear()
})

describe('GeneralTab — the unsaved-draft prompt', () => {
  it('offers the browser copy but applies nothing on its own', async () => {
    saveDraftBackup(ENTITY_ID, 'general', draftFormValues, { userId: USER_ID })

    renderGeneralTab()
    // The server row lands first (the prompt is raised on mount, before it) — assert both coexist,
    // so "nothing is applied on its own" is measured against the loaded form rather than an empty one.
    await waitFor(() => expect(screen.getByDisplayValue('IBPS PO 2025')).toBeInTheDocument())
    await waitFor(() =>
      expect(screen.getByText('Restore unsaved changes?')).toBeInTheDocument(),
    )

    // The server text is still what is on screen — restoring is a choice, never automatic…
    expect(screen.getByDisplayValue('IBPS PO 2025')).toBeInTheDocument()
    expect(screen.queryByDisplayValue(DRAFT_NAME)).toBeNull()
    // …and discarding was not assumed either: the copy is still in storage, unanswered.
    expect(storedDraft()?.value.name).toBe(DRAFT_NAME)
    expect(mockedUpdateEntity).not.toHaveBeenCalled()
  })

  it('"Restore" puts the text back and still writes nothing to the database', async () => {
    saveDraftBackup(ENTITY_ID, 'general', draftFormValues, { userId: USER_ID })

    renderGeneralTab()
    await waitFor(() => screen.getByText('Restore unsaved changes?'))

    await userEvent.click(screen.getByRole('button', { name: /^restore$/i }))

    await waitFor(() => expect(screen.getByDisplayValue(DRAFT_NAME)).toBeInTheDocument())
    expect(screen.queryByText('Restore unsaved changes?')).toBeNull()
    expect(mockedUpdateEntity).not.toHaveBeenCalled()
    // The restored text has not reached the database, so the copy must still be there.
    expect(storedDraft()?.value.name).toBe(DRAFT_NAME)
  })

  it('"Discard" drops the copy now instead of leaving it for another day', async () => {
    saveDraftBackup(ENTITY_ID, 'general', draftFormValues, { userId: USER_ID })

    renderGeneralTab()
    await waitFor(() => screen.getByText('Restore unsaved changes?'))

    await userEvent.click(screen.getByRole('button', { name: /^discard$/i }))

    await waitFor(() => expect(screen.queryByText('Restore unsaved changes?')).toBeNull())
    expect(storedDraft()).toBeNull()
    expect(screen.getByDisplayValue('IBPS PO 2025')).toBeInTheDocument()
    expect(mockedUpdateEntity).not.toHaveBeenCalled()
  })

  it('is silent when this browser holds nothing newer than the server row', async () => {
    renderGeneralTab()
    await waitFor(() => screen.getByDisplayValue('IBPS PO 2025'))

    expect(screen.queryByText('Restore unsaved changes?')).toBeNull()
    expect(storedDraft()).toBeNull()
  })

  it('a quiet typing pause is backed up in the browser without any save call', async () => {
    renderGeneralTab()
    await waitFor(() => screen.getByDisplayValue('IBPS PO 2025'))

    const nameInput = screen.getByDisplayValue('IBPS PO 2025')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, TYPED_NAME)

    // The quiet window is 1200ms and it re-arms, so under CI load an early write may hold a
    // partial string; what the editor is entitled to rely on is that the copy CONVERGES on the
    // text on screen. Nothing reaches the database on this path.
    await waitFor(() => expect(storedDraft()?.value.name).toBe(TYPED_NAME), { timeout: 8000 })
    expect(mockedUpdateEntity).not.toHaveBeenCalled()
  })

  it('a successful "Save Changes" retires the browser copy', async () => {
    renderGeneralTab()
    await waitFor(() => screen.getByDisplayValue('IBPS PO 2025'))

    const nameInput = screen.getByDisplayValue('IBPS PO 2025')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, TYPED_NAME)
    await waitFor(() => expect(storedDraft()?.value.name).toBe(TYPED_NAME), { timeout: 8000 })

    mockedUpdateEntity.mockResolvedValue(makeEntity({ name: TYPED_NAME }))
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))
    })

    await waitFor(() => expect(mockedUpdateEntity).toHaveBeenCalledTimes(1))
    // The server has the text now, so the extra copy is spent.
    await waitFor(() => expect(storedDraft()).toBeNull())
  })
})
