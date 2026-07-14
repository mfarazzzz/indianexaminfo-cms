/**
 * PublishingEditor.test.tsx — Tests for the Publish Center.
 *
 * Covers: checklist generation, workflow transition visibility,
 * publish gate blocking, health integration, lifecycle validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// Mock services
vi.mock('@/services/entity/entityService', () => ({
  getEntityById: vi.fn(),
  transitionWorkflow: vi.fn(),
  verifyEntity: vi.fn(),
}))
vi.mock('@/services/entity/healthService', () => ({
  computeEntityHealth: vi.fn(),
}))
vi.mock('@/services/entity/timelineService', () => ({
  evaluateEntityRules: vi.fn(),
  listTimeline: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/services/entity/revisionService', () => ({
  listRevisions: vi.fn(),
}))

import PublishingEditor from './PublishingEditor'
import { getEntityById } from '@/services/entity/entityService'
import { computeEntityHealth } from '@/services/entity/healthService'
import { evaluateEntityRules } from '@/services/entity/timelineService'
import { listRevisions } from '@/services/entity/revisionService'
import type { Entity } from '@/types/entity'
import type { EntityHealth } from '@/types/entity-health'

const mockGetEntity = vi.mocked(getEntityById)
const mockHealth = vi.mocked(computeEntityHealth)
const mockRules = vi.mocked(evaluateEntityRules)
const mockRevisions = vi.mocked(listRevisions)

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'pub-test-1', entityType: 'exam', slug: 'test', name: 'Test',
    workflowStatus: 'draft', isFeatured: false, tags: [], searchKeywords: [],
    lang: 'en', metadata: {}, templateSnapshot: {} as any,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Entity
}

function makeHealth(overrides: Partial<EntityHealth> = {}): EntityHealth {
  return {
    entityId: 'pub-test-1', completenessScore: 80, seoScore: 90,
    verificationStatus: 'verified', lastVerifiedAt: '2026-06-01',
    brokenLinkCount: 0, missingRequiredModules: [],
    hasPublishedAmendment: false, translationCoverage: {},
    publishReadiness: [],
    ...overrides,
  }
}

function renderEditor(entityId = 'pub-test-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PublishingEditor entityId={entityId} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PublishingEditor — Publish Center', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEntity.mockResolvedValue(makeEntity())
    mockHealth.mockResolvedValue(makeHealth())
    mockRules.mockResolvedValue([])
    mockRevisions.mockResolvedValue([])
  })

  it('renders the Publishing Status section with current status', async () => {
    renderEditor()
    expect(await screen.findByText('Draft')).toBeInTheDocument()
  })

  it('shows all checklist items as "pass" when everything is healthy', async () => {
    renderEditor()
    // Wait for health data to load
    expect(await screen.findByText('SEO complete')).toBeInTheDocument()
    expect(screen.getByText('Required modules completed')).toBeInTheDocument()
    expect(screen.getByText('Content verified')).toBeInTheDocument()
    expect(screen.getByText('No lifecycle rule violations')).toBeInTheDocument()
    expect(screen.getByText('No broken links')).toBeInTheDocument()
  })

  it('shows error checklist items when SEO is missing', async () => {
    mockHealth.mockResolvedValue(makeHealth({
      publishReadiness: ['SEO title is missing', 'Meta description is missing'],
    }))
    renderEditor()
    expect(await screen.findByText('SEO title missing')).toBeInTheDocument()
    expect(screen.getByText('Meta description missing')).toBeInTheDocument()
  })

  it('shows warning for expired verification', async () => {
    mockHealth.mockResolvedValue(makeHealth({ verificationStatus: 'overdue' }))
    renderEditor()
    expect(await screen.findByText('Verification expired (90+ days)')).toBeInTheDocument()
  })

  it('shows lifecycle rule violations in checklist', async () => {
    mockRules.mockResolvedValue([
      { rule: { ruleType: 'must_follow', subjectStage: 'exam', objectStage: 'application', errorMessage: 'Exam must follow Application', severity: 'error' }, severity: 'error', message: 'Exam must follow Application' },
    ])
    renderEditor()
    expect(await screen.findByText(/1 lifecycle rule violation/)).toBeInTheDocument()
  })

  it('blocks publish button when checklist has errors', async () => {
    mockHealth.mockResolvedValue(makeHealth({
      publishReadiness: ['SEO title is missing'],
    }))
    mockGetEntity.mockResolvedValue(makeEntity({ workflowStatus: 'review' }))
    renderEditor()
    expect(await screen.findByText('Publishing is blocked until all errors are resolved.')).toBeInTheDocument()
  })

  it('shows allowed workflow transitions as action buttons', async () => {
    mockGetEntity.mockResolvedValue(makeEntity({ workflowStatus: 'draft' }))
    renderEditor()
    expect(await screen.findByText('Submit for Review')).toBeInTheDocument()
  })

  it('shows Publish button for review state', async () => {
    mockGetEntity.mockResolvedValue(makeEntity({ workflowStatus: 'review' }))
    renderEditor()
    expect(await screen.findByText('Publish')).toBeInTheDocument()
    expect(screen.getByText('Revert to Draft')).toBeInTheDocument()
  })

  it('renders revision history', async () => {
    mockRevisions.mockResolvedValue([
      { id: 'r1', versionNumber: 1, comment: null, createdBy: null, createdAt: '2026-06-01T00:00:00Z' },
    ])
    renderEditor()
    expect(await screen.findByText('v1')).toBeInTheDocument()
  })

  it('shows empty revision state when no revisions exist', async () => {
    renderEditor()
    expect(await screen.findByText(/No revisions yet/)).toBeInTheDocument()
  })
})
