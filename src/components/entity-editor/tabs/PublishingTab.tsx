/**
 * PublishingTab.tsx — Content verification, health scoring, and publish gate.
 * Displays: last edited, last verified, health score, publish readiness.
 * "Mark as Verified" and workflow transition buttons live here.
 */
import { useState } from 'react'
import { ShieldCheck, ShieldAlert, Clock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import { useEntityHealth, usePublishReadiness } from '@/hooks/useEntityHealth'
import { verifyEntity, transitionWorkflow } from '@/services/entity/entityService'
import { useAuth } from '@/hooks/useAuth'
import { entityKeys } from '@/lib/queryKeys'
import { WORKFLOW_STATUS_LABELS, WORKFLOW_TRANSITIONS } from '@/types/entity'
import type { WorkflowStatus } from '@/types/entity'
import { cn } from '@/lib/utils'

interface PublishingTabProps { entityId: string }

// ── Health indicator ──────────────────────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium">{score}/100</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

// ── Verification status badge ─────────────────────────────────────────────────

const VERIFICATION_BADGE = {
  verified:  { icon: ShieldCheck,  cls: 'text-green-600 bg-green-50',  label: 'Verified' },
  unverified:{ icon: ShieldAlert,  cls: 'text-gray-500 bg-gray-50',    label: 'Never Verified' },
  overdue:   { icon: ShieldAlert,  cls: 'text-amber-600 bg-amber-50',  label: 'Verification Overdue' },
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function PublishingTab({ entityId }: PublishingTabProps) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)

  const { data: entity, isLoading } = useEntityQuery(entityId)
  const { data: health }            = useEntityHealth(entityId)
  const { data: readiness = [] }    = usePublishReadiness(entityId)

  // ── Verify mutation ───────────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: () => verifyEntity(entityId, user?.id ?? 'unknown'),
    onSuccess: () => {
      toast.success('Content marked as verified')
      qc.invalidateQueries({ queryKey: entityKeys.detail(entityId) })
      qc.invalidateQueries({ queryKey: ['health', entityId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ── Workflow transition mutation ───────────────────────────────────────────
  const transitionMutation = useMutation({
    mutationFn: (target: WorkflowStatus) =>
      transitionWorkflow(entityId, target, user?.id ?? 'unknown'),
    onSuccess: (updated) => {
      toast.success(`Status changed to ${WORKFLOW_STATUS_LABELS[updated.workflowStatus]}`)
      qc.invalidateQueries({ queryKey: entityKeys.detail(entityId) })
      qc.invalidateQueries({ queryKey: ['health', entityId] })
      setShowPublishConfirm(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading || !entity) {
    return <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>
  }

  const status = entity.workflowStatus
  const allowedTransitions = WORKFLOW_TRANSITIONS[status] ?? []
  const vStatus = health?.verificationStatus ?? 'unverified'
  const VerificationIcon = VERIFICATION_BADGE[vStatus].icon

  const isPublishBlocked = readiness.length > 0
  const canPublish = allowedTransitions.includes('published')

  return (
    <div className="p-6 max-w-2xl space-y-8">

      {/* ── Status & Transitions ── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Workflow Status</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Current:</span>
          <span className="px-2.5 py-1 rounded text-sm font-medium bg-blue-50 text-blue-700">
            {WORKFLOW_STATUS_LABELS[status as WorkflowStatus] ?? status}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {allowedTransitions.map(target => {
            const isPublish = target === 'published'
            if (isPublish && isPublishBlocked && !showPublishConfirm) {
              return (
                <button
                  key={target}
                  onClick={() => setShowPublishConfirm(true)}
                  className="text-sm px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700"
                >
                  Publish…
                </button>
              )
            }
            return (
              <button
                key={target}
                disabled={transitionMutation.isPending}
                onClick={() => transitionMutation.mutate(target)}
                className={cn(
                  'text-sm px-3 py-1.5 rounded transition-colors',
                  target === 'published' ? 'bg-green-600 text-white hover:bg-green-700' :
                  target === 'archived'  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' :
                  target === 'deleted'   ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                  'bg-blue-100 text-blue-700 hover:bg-blue-200'
                )}
              >
                {WORKFLOW_STATUS_LABELS[target] ?? target}
              </button>
            )
          })}
        </div>

        {/* Publish blocking issues */}
        {canPublish && showPublishConfirm && isPublishBlocked && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
            <p className="text-sm font-medium text-amber-800">Issues to resolve before publishing:</p>
            <ul className="space-y-1">
              {readiness.map((issue, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {issue}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => transitionMutation.mutate('published')}
                disabled={transitionMutation.isPending}
                className="text-sm px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700"
              >
                Publish anyway
              </button>
              <button onClick={() => setShowPublishConfirm(false)}
                className="text-sm px-3 py-1.5 rounded ring-1 ring-gray-200 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Timestamps ── */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900">Activity</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Last edited</p>
              <p className="font-medium text-gray-900">
                {entity.updatedAt ? new Date(entity.updatedAt).toLocaleString() : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <VerificationIcon className={cn('h-4 w-4 mt-0.5 shrink-0', VERIFICATION_BADGE[vStatus].cls.split(' ')[0])} />
            <div>
              <p className="text-xs text-gray-500">Last verified</p>
              <p className="font-medium text-gray-900">
                {entity.lastVerifiedAt
                  ? new Date(entity.lastVerifiedAt).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Verification ── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Content Verification</h2>
        <div className={cn('flex items-center gap-3 p-3 rounded-lg', VERIFICATION_BADGE[vStatus].cls)}>
          <VerificationIcon className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{VERIFICATION_BADGE[vStatus].label}</span>
        </div>
        <p className="text-xs text-gray-500">
          Verification confirms all dates, vacancies, and links match official sources.
          It is tracked separately from editing.
        </p>
        <button
          onClick={() => verifyMutation.mutate()}
          disabled={verifyMutation.isPending}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {verifyMutation.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <ShieldCheck className="h-4 w-4" />}
          Mark as Verified
        </button>
      </section>

      {/* ── Health Score ── */}
      {health && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Content Health</h2>
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <ScoreBar label="Completeness" score={health.completenessScore} />
            <ScoreBar label="SEO" score={health.seoScore} />
          </div>

          {health.missingRequiredModules.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600">Missing required modules:</p>
              {health.missingRequiredModules.map(m => (
                <div key={m} className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span className="capitalize">{m.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          )}

          {health.brokenLinkCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {health.brokenLinkCount} broken link{health.brokenLinkCount > 1 ? 's' : ''}
            </div>
          )}

          {health.hasPublishedAmendment && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600">
              <CheckCircle className="h-3.5 w-3.5" />
              Has published amendments (visible to readers)
            </div>
          )}

          {readiness.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle className="h-3.5 w-3.5" />
              Ready to publish
            </div>
          )}
        </section>
      )}
    </div>
  )
}
