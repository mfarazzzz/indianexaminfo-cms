/**
 * timelineService.ts — CRUD for entity_timeline_event.
 *
 * Business rules:
 *  - resolvePublishState() enforces publish_at / status constraints before every write.
 *  - All DB access is isolated here; no React imports.
 */
import { db } from '@/lib/supabase/client'
import type { TimelineEvent } from '@/types/entity'
import type { TimelineEventInput } from '@/lib/validation/entitySchemas'

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): TimelineEvent {
  return {
    id:           r.id as string,
    entityId:     r.entity_id as string,
    stageKey:     r.stage_key as string | null,
    eventSubtype: r.event_subtype as string | null,
    title:        r.title as string,
    eventType:    r.event_type as string,
    eventDate:    r.event_date as string | null,
    eventTime:    r.event_time as string | null,
    description:  r.description as string | null,
    status:       (r.status as TimelineEvent['status']) ?? 'pending',
    badgeColor:   (r.badge_color as string) ?? 'blue',
    isHighlighted: (r.is_highlighted as boolean) ?? false,
    isFeatured:   (r.is_featured as boolean) ?? false,
    officialLink: r.official_link as string | null,
    pdfLink:      r.pdf_link as string | null,
    imageUrl:     r.image_url as string | null,
    visibility:   (r.visibility as TimelineEvent['visibility']) ?? 'public',
    displayOrder: (r.display_order as number) ?? 0,
    publishAt:    r.publish_at as string | null,
    createdAt:    r.created_at as string,
    updatedAt:    r.updated_at as string,
    deletedAt:    r.deleted_at as string | null,
  }
}

// ── Publish state resolver (business logic — not exported) ────────────────────

/**
 * Resolves the correct status and publish_at values from raw input.
 * Called by createTimelineEvent and updateTimelineEvent before writing to DB.
 *
 * Rules (R7 from requirements.md):
 *  - publishAt set and in the future → status='upcoming', publish_at=publishAt
 *  - publishAt set but not in the future → throw error
 *  - status='active', no publishAt → status='active', publish_at=null
 *  - status='cancelled' or 'postponed' → publish_at=null
 *  - all other cases → preserve status, publish_at=null
 */
function resolvePublishState(
  input: Partial<TimelineEventInput>
): { status: string; publish_at: string | null } {
  if (input.publishAt) {
    const publishDate = new Date(input.publishAt)
    if (publishDate <= new Date()) {
      throw new Error('Scheduled publish date must be in the future')
    }
    return { status: 'upcoming', publish_at: input.publishAt }
  }
  if (input.status === 'active') {
    return { status: 'active', publish_at: null }
  }
  if (input.status === 'cancelled' || input.status === 'postponed') {
    return { status: input.status, publish_at: null }
  }
  return { status: input.status ?? 'upcoming', publish_at: null }
}

// ── Ensure standard date rows exist (Req 1.2, 1.8) ───────────────────────────

import { STANDARD_DATE_TYPES, STANDARD_DATE_LABELS } from '@/types/entity'
import type { StandardDateType } from '@/types/entity'

/**
 * Ensures all standard Date_Type_Enum rows exist for an entity.
 * Creates placeholder rows (null event_date) for any missing standard types.
 * Idempotent: checks (entity_id, event_type) before inserting.
 */
export async function ensureStandardDates(entityId: string): Promise<void> {
  // Fetch existing event_types for this entity
  const { data: existing, error: fetchErr } = await db
    .from('entity_timeline_event')
    .select('event_type')
    .eq('entity_id', entityId)
    .is('deleted_at', null)
    .in('event_type', [...STANDARD_DATE_TYPES])
  if (fetchErr) throw fetchErr

  const existingTypes = new Set((existing ?? []).map((r: { event_type: string }) => r.event_type))

  // Determine which standard types are missing
  const missing = STANDARD_DATE_TYPES.filter(t => !existingTypes.has(t))
  if (missing.length === 0) return

  // Insert placeholder rows
  const rows = missing.map((eventType, idx) => ({
    entity_id: entityId,
    title: STANDARD_DATE_LABELS[eventType as StandardDateType],
    event_type: eventType,
    event_date: null,
    status: 'upcoming',
    badge_color: 'blue',
    is_highlighted: false,
    is_featured: false,
    visibility: 'public',
    display_order: idx,
  }))

  const { error: insertErr } = await db
    .from('entity_timeline_event')
    .insert(rows)
  if (insertErr) throw insertErr
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listTimeline(entityId: string): Promise<TimelineEvent[]> {
  const { data, error } = await db
    .from('entity_timeline_event')
    .select('*')
    .eq('entity_id', entityId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
    .order('event_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createTimelineEvent(
  entityId: string,
  input: TimelineEventInput
): Promise<TimelineEvent> {
  const { status, publish_at } = resolvePublishState(input)
  const { data, error } = await db
    .from('entity_timeline_event')
    .insert({
      entity_id:    entityId,
      title:        input.title,
      event_type:   input.eventType,
      event_date:   input.eventDate,
      event_time:   input.eventTime ?? null,
      description:  input.description ?? null,
      status,
      badge_color:  input.badgeColor ?? 'blue',
      is_highlighted: input.isHighlighted ?? false,
      is_featured:  input.isFeatured ?? false,
      official_link: input.officialLink ?? null,
      pdf_link:     input.pdfLink ?? null,
      visibility:   input.visibility ?? 'public',
      display_order: input.displayOrder ?? 0,
      publish_at,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateTimelineEvent(
  id: string,
  input: Partial<TimelineEventInput>
): Promise<TimelineEvent> {
  const { status, publish_at } = resolvePublishState(input)
  const fieldMap: Record<string, string> = {
    title: 'title', eventType: 'event_type', eventDate: 'event_date',
    eventTime: 'event_time', description: 'description',
    badgeColor: 'badge_color', isHighlighted: 'is_highlighted',
    isFeatured: 'is_featured', officialLink: 'official_link',
    pdfLink: 'pdf_link', visibility: 'visibility',
    displayOrder: 'display_order',
  }
  const updates: Record<string, unknown> = { status, publish_at }
  for (const [k, col] of Object.entries(fieldMap)) {
    if ((input as Record<string, unknown>)[k] !== undefined) {
      updates[col] = (input as Record<string, unknown>)[k]
    }
  }
  const { data, error } = await db
    .from('entity_timeline_event')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

// ── Soft delete ───────────────────────────────────────────────────────────────

export async function softDeleteTimelineEvent(id: string): Promise<void> {
  const { error } = await db
    .from('entity_timeline_event')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Reorder ───────────────────────────────────────────────────────────────────

export async function reorderTimeline(
  entityId: string,
  orderedIds: string[]
): Promise<void> {
  // TODO: replace with batch RPC for scale (see ARCHITECTURE.md §6.5)
  await Promise.all(
    orderedIds.map((id, idx) =>
      db
        .from('entity_timeline_event')
        .update({ display_order: idx })
        .eq('id', id)
        .eq('entity_id', entityId)
    )
  )
}

// ── Lifecycle Rule Evaluation (REQ-005) ───────────────────────────────────────

import type { LifecycleRule, TemplateConfiguration } from '@/types/lifecycle-template'
import type { TimelineEvent as TEvent } from '@/types/entity'

export interface LifecycleRuleViolation {
  rule: LifecycleRule
  severity: 'error' | 'warning'
  message: string
}

/**
 * Evaluates all lifecycle rules from the entity's template snapshot against
 * the current timeline events. Called on every timeline event save.
 *
 * REQ-005.2: severity='error' blocks the save. severity='warning' allows it.
 * REQ-005.4: Only evaluates rules against events with a real event_date.
 *
 * This is a pure evaluation function — no DB calls, no side effects.
 */
export function evaluateLifecycleRules(
  rules: LifecycleRule[],
  allEvents: TEvent[]
): LifecycleRuleViolation[] {
  if (!rules || rules.length === 0) return []

  // Build a map of stageKey → event_date (only events with confirmed dates)
  const stageDates = new Map<string, Date>()
  for (const ev of allEvents) {
    if (ev.stageKey && ev.eventDate) {
      const existing = stageDates.get(ev.stageKey)
      const evDate = new Date(ev.eventDate)
      // If multiple events for the same stage, use the earliest date
      if (!existing || evDate < existing) {
        stageDates.set(ev.stageKey, evDate)
      }
    }
  }

  const violations: LifecycleRuleViolation[] = []

  for (const rule of rules) {
    const subjectDate = stageDates.get(rule.subjectStage)
    const objectDate = stageDates.get(rule.objectStage)

    // REQ-005.4: Only evaluate against confirmed dates (both must exist)
    if (!subjectDate || !objectDate) continue

    let violated = false

    switch (rule.ruleType) {
      case 'must_follow':
        // subjectStage date must be AFTER objectStage date
        violated = subjectDate <= objectDate
        break

      case 'cannot_precede':
        // subjectStage date must NOT be BEFORE objectStage date
        violated = subjectDate < objectDate
        break

      case 'requires':
        // If subjectStage has a date, objectStage must also have a date
        // (we already checked both exist, so this only fires if objectDate is missing
        //  — which we already filtered out. So 'requires' with both dates = no violation)
        violated = false
        break

      case 'minimum_gap': {
        // Days between objectStage and subjectStage must be >= minimumDays
        const daysBetween = (subjectDate.getTime() - objectDate.getTime()) / 86_400_000
        violated = daysBetween < (rule.minimumDays ?? 0)
        break
      }

      case 'maximum_gap': {
        // Days between objectStage and subjectStage must be <= maximumDays
        const daysBetween = (subjectDate.getTime() - objectDate.getTime()) / 86_400_000
        violated = daysBetween > (rule.maximumDays ?? Infinity)
        break
      }
    }

    if (violated) {
      violations.push({
        rule,
        severity: rule.severity ?? 'warning',
        message: rule.errorMessage,
      })
    }
  }

  return violations
}

/**
 * Evaluates lifecycle rules for a specific entity by loading its snapshot
 * and all timeline events. Used by timeline save operations.
 */
export async function evaluateEntityRules(
  entityId: string
): Promise<LifecycleRuleViolation[]> {
  const { getSnapshot } = await import('../template/snapshotService')

  const [snapshot, events] = await Promise.all([
    getSnapshot(entityId),
    listTimeline(entityId),
  ])

  if (!snapshot?.lifecycleRules) return []

  return evaluateLifecycleRules(snapshot.lifecycleRules, events)
}
