/**
 * modules.tsx — All module-specific inspector components.
 *
 * Each inspector is a compact component using inspector primitives.
 * They use existing services/hooks only — no duplicated logic.
 */
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { entityKeys, healthKeys } from '@/lib/queryKeys'
import { computeEntityHealth } from '@/services/entity/healthService'
import { listTimeline } from '@/services/entity/timelineService'
import { getSeo } from '@/services/entity/seoService'
import { listLinks } from '@/services/entity/linkService'
import { listRelationships } from '@/services/entity/relationshipService'
import { listAmendments } from '@/services/entity/amendmentService'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import {
  InspectorSection, InspectorMetric, InspectorNotice,
  InspectorCard, InspectorWidget,
} from './primitives'

// ── Shared Props ──────────────────────────────────────────────────────────────

interface Props { entityId: string; moduleKey: string }

// ── General Inspector ─────────────────────────────────────────────────────────

export function GeneralInspector({ entityId }: Props) {
  const { data: entity } = useEntityQuery(entityId)
  if (!entity) return null
  return (
    <InspectorSection title="Entity Info">
      <InspectorMetric label="Status" value={entity.workflowStatus} />
      <InspectorMetric label="Pillar" value={entity.pillar ?? '—'} />
      <InspectorMetric label="Type" value={entity.entityType} />
      <InspectorMetric label="Language" value={entity.lang} />
    </InspectorSection>
  )
}

// ── Timeline Inspector ────────────────────────────────────────────────────────

export function TimelineInspector({ entityId }: Props) {
  const { data: events = [] } = useQuery({
    queryKey: entityKeys.timeline(entityId),
    queryFn: () => listTimeline(entityId),
    staleTime: 3 * 60_000,
  })
  const upcoming = events.filter(e => e.status === 'upcoming' || e.status === 'pending').length
  const active = events.filter(e => e.status === 'active').length
  const postponed = events.filter(e => e.status === 'postponed').length
  return (
    <>
      <InspectorSection title="Timeline Summary">
        <InspectorMetric label="Total Events" value={events.length} />
        <InspectorMetric label="Upcoming" value={upcoming} variant={upcoming > 0 ? 'warning' : 'default'} />
        <InspectorMetric label="Active" value={active} variant="success" />
        {postponed > 0 && <InspectorMetric label="Postponed" value={postponed} variant="error" />}
      </InspectorSection>
      {events.length === 0 && (
        <InspectorSection>
          <InspectorNotice message="No timeline events yet. Add dates to track the lifecycle." variant="info" />
        </InspectorSection>
      )}
    </>
  )
}

// ── SEO Inspector ─────────────────────────────────────────────────────────────

export function SEOInspector({ entityId }: Props) {
  const { data: seo } = useQuery({
    queryKey: entityKeys.seo(entityId),
    queryFn: () => getSeo(entityId),
    staleTime: 5 * 60_000,
  })
  const titleLen = seo?.seoTitle?.length ?? 0
  const descLen = seo?.metaDescription?.length ?? 0
  return (
    <InspectorSection title="SEO Status">
      <InspectorMetric
        label="Title"
        value={titleLen}
        suffix="/60"
        variant={titleLen === 0 ? 'error' : titleLen > 60 ? 'warning' : 'success'}
      />
      <InspectorMetric
        label="Description"
        value={descLen}
        suffix="/160"
        variant={descLen === 0 ? 'error' : descLen > 160 ? 'warning' : 'success'}
      />
      <InspectorMetric
        label="Keywords"
        value={(seo?.focusKeywords ?? []).length}
        variant={(seo?.focusKeywords ?? []).length === 0 ? 'warning' : 'success'}
      />
      <InspectorMetric
        label="OG Image"
        value={seo?.ogImage ? '✓' : '✗'}
        variant={seo?.ogImage ? 'success' : 'warning'}
      />
    </InspectorSection>
  )
}

// ── Links Inspector ───────────────────────────────────────────────────────────

export function LinksInspector({ entityId }: Props) {
  const { data: links = [] } = useQuery({
    queryKey: entityKeys.links(entityId),
    queryFn: () => listLinks(entityId),
    staleTime: 3 * 60_000,
  })
  const active = links.filter(l => l.status === 'active').length
  return (
    <InspectorSection title="Official Links">
      <InspectorMetric label="Total" value={links.length} />
      <InspectorMetric label="Active" value={active} variant="success" />
      <InspectorMetric label="Inactive" value={links.length - active} variant={links.length - active > 0 ? 'warning' : 'default'} />
    </InspectorSection>
  )
}

// ── Relationships Inspector ───────────────────────────────────────────────────

export function RelationshipsInspector({ entityId }: Props) {
  const { data: rels = [] } = useQuery({
    queryKey: entityKeys.relationships?.(entityId) ?? ['relationships', entityId],
    queryFn: () => listRelationships(entityId),
    staleTime: 5 * 60_000,
  })
  const outgoing = rels.filter(r => r.direction === 'outgoing').length
  const incoming = rels.filter(r => r.direction === 'incoming').length
  return (
    <InspectorSection title="Relationships">
      <InspectorMetric label="Outgoing" value={outgoing} />
      <InspectorMetric label="Incoming" value={incoming} />
      <InspectorMetric label="Total" value={rels.length} />
    </InspectorSection>
  )
}

// ── Amendments Inspector ──────────────────────────────────────────────────────

export function AmendmentsInspector({ entityId }: Props) {
  const { data: amendments = [] } = useQuery({
    queryKey: ['amendments', 'list', entityId],
    queryFn: () => listAmendments(entityId),
    staleTime: 3 * 60_000,
  })
  const published = amendments.filter(a => a.workflowStatus === 'published').length
  return (
    <InspectorSection title="Amendments">
      <InspectorMetric label="Total" value={amendments.length} />
      <InspectorMetric label="Published" value={published} variant={published > 0 ? 'success' : 'default'} />
      <InspectorMetric label="Draft" value={amendments.length - published} />
    </InspectorSection>
  )
}

// ── Publishing Inspector ──────────────────────────────────────────────────────

export function PublishingInspector({ entityId }: Props) {
  const { data: health } = useQuery({
    queryKey: healthKeys.entity(entityId),
    queryFn: () => computeEntityHealth(entityId),
    staleTime: 2 * 60_000,
  })
  if (!health) return null
  const ready = health.publishReadiness.length === 0
  return (
    <InspectorSection title="Publish Readiness">
      {ready ? (
        <InspectorNotice message="All publish gates passed. Ready to publish." variant="success" />
      ) : (
        <div className="space-y-1">
          {health.publishReadiness.map((issue, i) => (
            <InspectorNotice key={i} message={issue} variant="error" />
          ))}
        </div>
      )}
    </InspectorSection>
  )
}

// ── Health Inspector ──────────────────────────────────────────────────────────

export function HealthInspector({ entityId }: Props) {
  const { data: health } = useQuery({
    queryKey: healthKeys.entity(entityId),
    queryFn: () => computeEntityHealth(entityId),
    staleTime: 2 * 60_000,
  })
  if (!health) return null
  return (
    <>
      <InspectorSection title="Health Scores">
        <InspectorMetric label="Completeness" value={health.completenessScore} suffix="%" variant={health.completenessScore >= 80 ? 'success' : 'warning'} />
        <InspectorMetric label="SEO" value={health.seoScore} suffix="%" variant={health.seoScore >= 80 ? 'success' : 'warning'} />
        <InspectorMetric label="Broken Links" value={health.brokenLinkCount} variant={health.brokenLinkCount > 0 ? 'error' : 'success'} />
      </InspectorSection>
      <InspectorSection title="Verification">
        <InspectorMetric label="Status" value={health.verificationStatus} variant={health.verificationStatus === 'verified' ? 'success' : 'error'} />
      </InspectorSection>
    </>
  )
}

// ── Verification Inspector ────────────────────────────────────────────────────

export function VerificationInspector({ entityId }: Props) {
  const { data: entity } = useEntityQuery(entityId)
  if (!entity) return null
  const daysAgo = entity.lastVerifiedAt
    ? Math.round((Date.now() - new Date(entity.lastVerifiedAt).getTime()) / 86_400_000)
    : null
  return (
    <InspectorSection title="Verification Status">
      <InspectorMetric label="Last Verified" value={daysAgo !== null ? `${daysAgo}d ago` : 'Never'} variant={daysAgo === null || daysAgo > 90 ? 'error' : daysAgo > 60 ? 'warning' : 'success'} />
    </InspectorSection>
  )
}

// ── Simple placeholder inspectors for modules without special data ─────────────

export function SimpleInspector({ moduleKey }: Props) {
  return (
    <InspectorSection title="Module">
      <InspectorMetric label="Active" value={moduleKey.replace(/_/g, ' ')} />
      <p className="text-xs text-slate-400 mt-2">No additional context available for this module.</p>
    </InspectorSection>
  )
}
