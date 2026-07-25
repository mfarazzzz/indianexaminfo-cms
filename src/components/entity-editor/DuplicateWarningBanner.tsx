/**
 * DuplicateWarningBanner — Shows fuzzy-match warnings during entity creation.
 * Non-blocking advisory: lists up to 5 matches with links. (Req 5.2–5.6)
 */
import React from 'react'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { useDuplicateCheck } from '@/hooks/useDuplicateCheck'
import { timeAgo } from '@/lib/utils'

interface DuplicateWarningBannerProps {
  name: string
  conductingBodyId: string | null
  /** Only show during creation, not when editing existing */
  enabled?: boolean
}

export function DuplicateWarningBanner({
  name,
  conductingBodyId,
  enabled = true,
}: DuplicateWarningBannerProps) {
  const { data: matches = [] } = useDuplicateCheck(name, conductingBodyId, enabled)

  if (matches.length === 0) return null

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-3" role="alert">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-800">
            Similar exam{matches.length > 1 ? 's' : ''} found
          </p>
          <p className="text-xs text-yellow-700 mt-0.5">
            Are you sure you want to create a new exam? These existing ones look similar:
          </p>
        </div>
      </div>

      <ul className="space-y-2 ml-7">
        {matches.map(match => (
          <li key={match.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-800 font-medium truncate">{match.name}</p>
              <p className="text-xs text-slate-500">
                <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-slate-100 text-xs font-medium capitalize mr-1.5">
                  {match.workflowStatus}
                </span>
                {match.conductingBodyName && <span>{match.conductingBodyName} · </span>}
                Updated {timeAgo(match.updatedAt)}
                {match.updatedByName && <span> by {match.updatedByName}</span>}
              </p>
            </div>
            <a
              href={`/exams/${match.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Open & Edit
              <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        ))}
      </ul>

      <p className="text-xs text-yellow-600 ml-7">
        You can still create a new exam — this is just a heads-up to avoid duplicates.
      </p>
    </div>
  )
}
