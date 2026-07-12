/**
 * GeneralTab.test.tsx
 *
 * Regression tests for the form state-loss bug.
 *
 * Verifies that:
 *  - reset() only fires once on initial data load, never on background refetch
 *  - Tags and Keywords fields are controlled and survive re-renders
 *  - Saving re-seeds the form once from the new server response
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditorUIProvider } from '@/contexts/EditorUIContext'
import { GeneralTab } from './GeneralTab'
import * as entityService from '@/services/entity/entityService'
import type { Entity } from '@/types/entity'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/services/entity/entityService')
vi.mock('@/services/categoryService', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
}))

const mockedGetEntityById = vi.mocked(entityService.getEntityById)
const mockedUpdateEntity  = vi.mocked(entityService.updateEntity)

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id:               'entity-1',
    name:             'IBPS PO 2025',
    shortName:        'IBPS PO',
    slug:             'ibps-po-2025',
    conductingBody:   'IBPS',
    officialWebsite:  'https://ibps.in',
    categoryId:       null,
    pillar:           null,
    subType:          'exam',
    examLevel:        null,
    examMode:         null,
    applicationMode:  null,
    examFrequency:    null,
    workflowStatus:   'draft',
    isFeatured:       false,
    priority:         null,
    featuredUntil:    null,
    tags:             ['banking', 'ibps'],
    searchKeywords:   ['ibps po 2025'],
    lang:             'en',
    createdAt:        '2025-01-01T00:00:00Z',
    updatedAt:        '2025-01-01T00:00:00Z',
    deletedAt:        null,
    ...overrides,
  } as unknown as Entity
}

function renderGeneralTab(entityId = 'entity-1') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <EditorUIProvider defaultTab="general">
          <GeneralTab entityId={entityId} />
        </EditorUIProvider>
      </QueryClientProvider>
    ),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GeneralTab — seed-guard (bug regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('populates the form from the first successful server response', async () => {
    mockedGetEntityById.mockResolvedValue(makeEntity())

    renderGeneralTab()

    await waitFor(() =>
      expect(screen.getByDisplayValue('IBPS PO 2025')).toBeInTheDocument()
    )
    expect(screen.getByDisplayValue('ibps-po-2025')).toBeInTheDocument()
  })

  it('does NOT overwrite user edits when entity refetches with a new reference', async () => {
    mockedGetEntityById.mockResolvedValue(makeEntity())
    const { qc } = renderGeneralTab()

    await waitFor(() => screen.getByDisplayValue('IBPS PO 2025'))

    // User types a new name
    const nameInput = screen.getByDisplayValue('IBPS PO 2025')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'My Custom Exam Name')

    expect(screen.getByDisplayValue('My Custom Exam Name')).toBeInTheDocument()

    // Simulate a background refetch returning a new object reference — must NOT reset edits
    await act(async () => {
      qc.setQueryData(['entities', 'detail', 'entity-1'], makeEntity())
    })

    expect(screen.getByDisplayValue('My Custom Exam Name')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('IBPS PO 2025')).not.toBeInTheDocument()
  })

  it('Tags field is controlled — shows the form value, not a stale defaultValue', async () => {
    mockedGetEntityById.mockResolvedValue(makeEntity({ tags: ['banking', 'ibps'] }))
    renderGeneralTab()

    await waitFor(() =>
      expect(screen.getByDisplayValue('banking, ibps')).toBeInTheDocument()
    )
  })

  it('Search Keywords field is controlled — shows the form value', async () => {
    mockedGetEntityById.mockResolvedValue(makeEntity({ searchKeywords: ['ibps po 2025'] }))
    renderGeneralTab()

    await waitFor(() =>
      expect(screen.getByDisplayValue('ibps po 2025')).toBeInTheDocument()
    )
  })

  it('allows re-seeding after a deliberate save (seedRef resets to false)', async () => {
    const original = makeEntity({ name: 'Original Name' })
    const saved    = makeEntity({ name: 'Saved Name' })

    mockedGetEntityById
      .mockResolvedValueOnce(original)  // initial load
      .mockResolvedValueOnce(saved)     // post-save refetch

    mockedUpdateEntity.mockResolvedValue(saved)

    const { qc } = renderGeneralTab()

    await waitFor(() => screen.getByDisplayValue('Original Name'))

    // Click Save
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    // Simulate post-save invalidation + refetch resolving with confirmed server value
    await act(async () => {
      qc.setQueryData(['entities', 'detail', 'entity-1'], saved)
    })

    await waitFor(() =>
      expect(screen.getByDisplayValue('Saved Name')).toBeInTheDocument()
    )
  })
})
