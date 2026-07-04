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
    title:        r.title as string,
    eventType:    r.event_type as string,
    eventDate:    r.event_date as string,
    eventTime:    r.event_time as string | null,
    description:  r.description as string | null,
    status:       r.status as TimelineEvent['status'],
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
