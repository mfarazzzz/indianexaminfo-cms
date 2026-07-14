/**
 * HealthEditor.tsx — Content health dashboard. REQ-020.
 *
 * Visualizes the computed health score from healthService.
 * No backend calls — delegates to useEntityHealth hook.
 */
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { computeEntityHealth } from '@/services/entity/healthService'
import { healthKeys } from '@/lib/queryKeys'
import type { EditorProps } from '../registry'
import { cn } from '@/lib/utils'

function ScoreBar({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
  const pct = Math.round((score / max) * 100)
  const color = pct >= 85 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-500 font-mono">{score}/{max}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function HealthEditor({ entityId }: EditorProps) {
  const { data: health, isLoading, isError, refetch } = useQuery({
    queryKey: healthKeys.entity(entityId),
    queryFn: () => computeEntityHealth(entityId),
    staleTime: 2 * 60_000,
    enabled: !!entityId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </div>
    )
  }

  if (isError || !health) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="h-6 w-6 text-red-400" />
        <p className="text-sm text-slate-600">Failed to load health data</p>
        <button onClick={() => refetch()} className="text-sm text-blue-600 hover:underline">Retry</button>
      </div>
    )
  }

  const overall = Math.round((health.completenessScore + health.seoScore) / 2)
  const overallColor = overall >= 85 ? 'text-green-600' : overall >= 60 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Overall Score */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-white border">
        <div className={cn('text-3xl font-bold', overallColor)}>{overall}</div>
        <div>
          <p className="text-sm font-medium text-slate-800">Content Health Score</p>
          <p className="text-xs text-slate-400">
            {health.verificationStatus === 'verified' ? 'Verified' :
             health.verificationStatus === 'overdue' ? 'Verification overdue' : 'Not yet verified'}
          </p>
        </div>
        {health.verificationStatus === 'verified' && <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto" />}
        {health.verificationStatus === 'overdue' && <AlertCircle className="h-5 w-5 text-red-400 ml-auto" />}
      </div>

      {/* Score Breakdown */}
      <div className="space-y-4 p-4 rounded-lg bg-white border">
        <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Activity className="h-4 w-4" /> Score Breakdown
        </h3>
        <ScoreBar label="Completeness" score={health.completenessScore} />
        <ScoreBar label="SEO" score={health.seoScore} />
      </div>

      {/* Issues */}
      {health.publishReadiness.length > 0 && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-100 space-y-2">
          <h3 className="text-sm font-medium text-red-700">Publish Blockers</h3>
          <ul className="space-y-1">
            {health.publishReadiness.map((issue, i) => (
              <li key={i} className="text-xs text-red-600 flex items-start gap-2">
                <span className="mt-0.5">•</span>{issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Broken Links */}
      {health.brokenLinkCount > 0 && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
          <p className="text-sm text-amber-700">
            {health.brokenLinkCount} broken link{health.brokenLinkCount > 1 ? 's' : ''} detected
          </p>
        </div>
      )}

      {/* Missing Modules */}
      {health.missingRequiredModules.length > 0 && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 space-y-1">
          <p className="text-sm font-medium text-amber-700">Required modules without content:</p>
          <ul className="text-xs text-amber-600">
            {health.missingRequiredModules.map(m => (
              <li key={m} className="capitalize">{m.replace(/_/g, ' ')}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
