/**
 * fixtures.ts — Shared test fixture factories.
 *
 * Each factory returns a structurally complete, valid record with all required
 * fields defaulted. Override any field by passing a partial object.
 *
 * All defaults pass their corresponding Zod schema validation.
 */
import type { EntityModule, ModuleBlock, TimelineEvent } from '@/types/entity'

// ── makeModule ────────────────────────────────────────────────────────────────

let moduleCounter = 0

export function makeModule(overrides: Partial<EntityModule> = {}): EntityModule {
  const id = overrides.id ?? `module-${++moduleCounter}`
  return {
    id,
    entityId:          'entity-1',
    moduleType:        'overview',
    subTitle:          null,
    displayOrder:      0,
    workflowStatus:    'draft',
    isFeatured:        false,
    tags:              [],
    scheduledPublishAt: null,
    publishedAt:       null,
    publishedBy:       null,
    seoOverrideTitle:  null,
    seoOverrideDesc:   null,
    metadata:          {},
    createdAt:         '2025-01-01T00:00:00Z',
    updatedAt:         '2025-01-01T00:00:00Z',
    createdBy:         null,
    updatedBy:         null,
    deletedAt:         null,
    ...overrides,
    id,
  }
}

// ── makeBlock ─────────────────────────────────────────────────────────────────

let blockCounter = 0

export function makeBlock(overrides: Partial<ModuleBlock> = {}): ModuleBlock {
  const id = overrides.id ?? `block-${++blockCounter}`
  return {
    id,
    moduleId:     'module-1',
    blockType:    'heading',
    displayOrder: 0,
    content:      { type: 'heading', level: 2, text: 'Test Heading' },
    isVisible:    true,
    createdAt:    '2025-01-01T00:00:00Z',
    updatedAt:    '2025-01-01T00:00:00Z',
    deletedAt:    null,
    ...overrides,
    id,
  }
}

// ── makeTimelineEvent ─────────────────────────────────────────────────────────

let eventCounter = 0

export function makeTimelineEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  const id = overrides.id ?? `event-${++eventCounter}`
  return {
    id,
    entityId:     'entity-1',
    title:        'Application Start',
    eventType:    'application-start',
    eventDate:    '2025-08-01',
    eventTime:    null,
    description:  null,
    status:       'upcoming',
    badgeColor:   'blue',
    isHighlighted: false,
    isFeatured:   false,
    officialLink: null,
    pdfLink:      null,
    imageUrl:     null,
    visibility:   'public',
    displayOrder: 0,
    publishAt:    null,
    createdAt:    '2025-01-01T00:00:00Z',
    updatedAt:    '2025-01-01T00:00:00Z',
    deletedAt:    null,
    ...overrides,
    id,
  }
}
