/**
 * PublishingEditor.tsx — The Publish Center.
 *
 * This is the editorial control center — NOT a simple publish button.
 * Integrates: workflow, verification, health, lifecycle rules, revisions.
 * Uses ONLY existing services. No business logic duplication.
 *
 * REQ-016: Editorial Workflow and Publication States
 */
import React, { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Rocket, ShieldCheck, Activity, GitBranch, AlertTriangle,
  CheckCircle2, XCircle, Clock, Loader2, RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { entityKeys, healthKeys } from '@/lib/queryKeys'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import { transitionWorkflow, verifyEntity } from '@/services/entity/entityService'
import { computeEntityHealth } from '@/services/entity/healthService'
import { listTimeline, evaluateEntityRules } from '@/services/entity/timelineService'
import { listRevisions } from '@/services/entity/revisionService'
import { WORKFLOW_TRANSITIONS, WORKFLOW_STATUS_LABELS, type WorkflowStatus } from '@/types/entity'
import type { EditorProps } from '../registry'
import { cn } from '@/lib/utils'

// ── Checklist Item Component ──────────────────────────────────────────────────

type ChecklistStatus = 'pass' | 'warning' | 'error'

function ChecklistItem({ label, status, detail }: { label: string; status: ChecklistStatus; detail?: string }) {
  const config = {
    pass:    { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    error:   { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  }[status]
  const Icon = config.icon

  return (
    <div className={cn('flex items-start gap-3 px-3 py-2 rounded-md', config.bg)} role="listitem">
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', config.color)} aria-hidden="true" />
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', config.color)}>{label}</p>
        {detail && <p className="text-xs text-slate-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}

// ── Section Component ─────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-white" aria-label={title}>
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-slate-50/50">
        <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <h3 className="text-sm font-medium text-slate-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

// ── Main Publish Center ───────────────────────────────────────────────────────

export default function PublishingEditor({ entityId }: EditorProps) {
  const qc = useQueryClient()
  const { data: entity } = useEntityQuery(entityId)

  // All data queries — parallel, cached, no duplicates
  const { data: health } = useQuery({
    queryKey: healthKeys.entity(entityId),
    queryFn: () => computeEntityHealth(entityId),
    staleTime: 2 * 60_000,
    enabled: !!entityId,
  })

  const { data: ruleViolations = [] } = useQuery({
    queryKey: [...entityKeys.timeline(entityId), 'rules'],
    queryFn: () => evaluateEntityRules(entityId),
    staleTime: 3 * 60_000,
    enabled: !!entityId,
  })

  const { data: revisions = [] } = useQuery({
    queryKey: entityKeys.revisions(entityId),
    queryFn: () => listRevisions(entityId),
    staleTime: 5 * 60_000,
    enabled: !!entityId,
  })

  // ── Workflow transition mutation ──────────────────────────────────────────
  const workflowMutation = useMutation({
    mutationFn: (targetStatus: WorkflowStatus) =>
      transitionWorkflow(entityId, targetStatus, 'current-user'),
    onSuccess: () => {
      toast.success('Status updated')
      qc.invalidateQueries({ queryKey: entityKeys.detail(entityId) })
      qc.invalidateQueries({ queryKey: healthKeys.entity(entityId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ── Verification mutation ─────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: () => verifyEntity(entityId, 'current-user'),
    onSuccess: () => {
      toast.success('Content verified')
      qc.invalidateQueries({ queryKey: entityKeys.detail(entityId) })
      qc.invalidateQueries({ queryKey: healthKeys.entity(entityId) })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ── Derived data ──────────────────────────────────────────────────────────
  const currentStatus = entity?.workflowStatus ?? 'draft'
  const allowedTransitions = WORKFLOW_TRANSITIONS[currentStatus] ?? []
  const errorViolations = ruleViolations.filter(v => v.severity === 'error')
  const warningViolations = ruleViolations.filter(v => v.severity === 'warning')

  // ── Publish Checklist ─────────────────────────────────────────────────────
  const checklist = useMemo(() => {
    if (!health) return []
    const items: { label: string; status: ChecklistStatus; detail?: string }[] = []

    // SEO
    const hasSeoTitle = !!health.publishReadiness.find(i => i.includes('SEO title'))
    const hasSeoDesc = !!health.publishReadiness.find(i => i.includes('Meta description'))
    if (!hasSeoTitle && !hasSeoDesc) {
      items.push({ label: 'SEO complete', status: 'pass' })
    } else {
      if (hasSeoTitle) items.push({ label: 'SEO title missing', status: 'error' })
      if (hasSeoDesc) items.push({ label: 'Meta description missing', status: 'error' })
    }

    // Required modules
    if (health.missingRequiredModules.length === 0) {
      items.push({ label: 'Required modules completed', status: 'pass' })
    } else {
      items.push({
        label: 'Required modules incomplete',
        status: 'error',
        detail: health.missingRequiredModules.map(m => m.replace(/_/g, ' ')).join(', '),
      })
    }

    // Verification
    if (health.verificationStatus === 'verified') {
      items.push({ label: 'Content verified', status: 'pass' })
    } else if (health.verificationStatus === 'overdue') {
      items.push({ label: 'Verification expired (90+ days)', status: 'warning' })
    } else {
      items.push({ label: 'Content not yet verified', status: 'warning' })
    }

    // Lifecycle rules
    if (errorViolations.length === 0) {
      items.push({ label: 'No lifecycle rule violations', status: 'pass' })
    } else {
      items.push({
        label: `${errorViolations.length} lifecycle rule violation${errorViolations.length > 1 ? 's' : ''}`,
        status: 'error',
        detail: errorViolations[0]?.message,
      })
    }
    if (warningViolations.length > 0) {
      items.push({
        label: `${warningViolations.length} lifecycle warning${warningViolations.length > 1 ? 's' : ''}`,
        status: 'warning',
        detail: warningViolations[0]?.message,
      })
    }

    // Broken links
    if (health.brokenLinkCount === 0) {
      items.push({ label: 'No broken links', status: 'pass' })
    } else {
      items.push({
        label: `${health.brokenLinkCount} broken link${health.brokenLinkCount > 1 ? 's' : ''}`,
        status: 'warning',
      })
    }

    // Health score
    const overall = Math.round((health.completenessScore + health.seoScore) / 2)
    if (overall >= 80) {
      items.push({ label: `Health score: ${overall}/100`, status: 'pass' })
    } else if (overall >= 50) {
      items.push({ label: `Health score: ${overall}/100`, status: 'warning' })
    } else {
      items.push({ label: `Health score: ${overall}/100 (below threshold)`, status: 'error' })
    }

    // Workflow state
    if (health.publishReadiness.find(i => i.includes('Review status'))) {
      items.push({ label: 'Must be in Review before publishing', status: 'error' })
    }

    return items
  }, [health, errorViolations, warningViolations])

  const hasBlockers = checklist.some(i => i.status === 'error')

  if (!entity) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* ── Publishing Status ─────────────────────────────────────────────── */}
      <Section title="Publishing Status" icon={Rocket}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {WORKFLOW_STATUS_LABELS[currentStatus]}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Last modified: {entity.updatedAt ? new Date(entity.updatedAt).toLocaleString() : '—'}
            </p>
          </div>
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            currentStatus === 'published' ? 'bg-green-100 text-green-700' :
            currentStatus === 'review'    ? 'bg-yellow-100 text-yellow-700' :
            'bg-slate-100 text-slate-600'
          )}>
            {currentStatus}
          </span>
        </div>
      </Section>

      {/* ── Publish Checklist ─────────────────────────────────────────────── */}
      <Section title="Publish Readiness" icon={CheckCircle2}>
        {checklist.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Computing checklist...
          </div>
        ) : (
          <div className="space-y-2" role="list" aria-label="Publish checklist">
            {checklist.map((item, i) => (
              <ChecklistItem key={i} {...item} />
            ))}
          </div>
        )}
        {hasBlockers && (
          <p className="mt-3 text-xs text-red-600 font-medium" role="alert">
            Publishing is blocked until all errors are resolved.
          </p>
        )}
      </Section>

      {/* ── Verification ──────────────────────────────────────────────────── */}
      <Section title="Verification" icon={ShieldCheck}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-700">
              {entity.lastVerifiedAt
                ? `Verified ${new Date(entity.lastVerifiedAt).toLocaleDateString()}`
                : 'Not yet verified'}
            </p>
          </div>
          <button
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {verifyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            Mark Verified
          </button>
        </div>
      </Section>

      {/* ── Health Summary ─────────────────────────────────────────────────── */}
      <Section title="Health Summary" icon={Activity}>
        {health ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-md bg-slate-50">
              <p className="text-2xl font-bold text-slate-800">{health.completenessScore}</p>
              <p className="text-[10px] text-slate-500 uppercase">Completeness</p>
            </div>
            <div className="text-center p-3 rounded-md bg-slate-50">
              <p className="text-2xl font-bold text-slate-800">{health.seoScore}</p>
              <p className="text-[10px] text-slate-500 uppercase">SEO</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Loading health data...</p>
        )}
      </Section>

      {/* ── Lifecycle Validation ───────────────────────────────────────────── */}
      {ruleViolations.length > 0 && (
        <Section title="Lifecycle Validation" icon={GitBranch}>
          <div className="space-y-2">
            {ruleViolations.map((v, i) => (
              <ChecklistItem
                key={i}
                label={v.message}
                status={v.severity === 'error' ? 'error' : 'warning'}
                detail={`${v.rule.subjectStage} → ${v.rule.objectStage}`}
              />
            ))}
          </div>
        </Section>
      )}

      {/* ── Revisions ─────────────────────────────────────────────────────── */}
      <Section title="Revision History" icon={Clock}>
        {revisions.length === 0 ? (
          <p className="text-xs text-slate-400">No revisions yet. Publishing creates the first revision.</p>
        ) : (
          <div className="space-y-2">
            {revisions.slice(0, 5).map(rev => (
              <div key={rev.id} className="flex items-center justify-between text-xs border-b last:border-0 pb-2 last:pb-0">
                <span className="font-medium text-slate-700">v{rev.versionNumber}</span>
                <span className="text-slate-400">{new Date(rev.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {revisions.length > 5 && (
              <p className="text-xs text-slate-400">{revisions.length - 5} more revision{revisions.length - 5 > 1 ? 's' : ''}...</p>
            )}
          </div>
        )}
      </Section>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <Section title="Actions" icon={RotateCcw}>
        <div className="flex flex-wrap gap-2">
          {allowedTransitions.map(target => {
            const isPublish = target === 'published'
            const blocked = isPublish && hasBlockers
            return (
              <button
                key={target}
                onClick={() => workflowMutation.mutate(target)}
                disabled={workflowMutation.isPending || blocked}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50',
                  isPublish
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : target === 'archived' || target === 'hidden'
                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                )}
                title={blocked ? 'Fix all checklist errors before publishing' : undefined}
              >
                {workflowMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
                {target === 'review' ? 'Submit for Review' :
                 target === 'published' ? 'Publish' :
                 target === 'archived' ? 'Archive' :
                 target === 'hidden' ? 'Hide' :
                 target === 'draft' ? 'Revert to Draft' :
                 target}
              </button>
            )
          })}
        </div>
        {allowedTransitions.length === 0 && (
          <p className="text-xs text-slate-400">No transitions available from current state.</p>
        )}
      </Section>
    </div>
  )
}
