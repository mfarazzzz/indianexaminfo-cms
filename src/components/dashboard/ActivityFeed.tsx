/**
 * ActivityFeed — Dashboard module activity feed.
 * Shows recent module_filled/module_updated entries. (Req 8.3–8.6)
 */
import React from 'react'
import { RefreshCw, Activity } from 'lucide-react'
import { useActivityFeed } from '@/hooks/useActivityFeed'
import { timeAgo } from '@/lib/utils'

interface ActivityFeedProps {
  limit?: number
}

export function ActivityFeed({ limit = 25 }: ActivityFeedProps) {
  const { data: entries = [], isLoading, error, refetch } = useActivityFeed(limit)

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Module Activity</h2>
          <Activity size={16} className="text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="h-4 w-4 animate-pulse rounded bg-slate-100" />
              <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
        <p className="text-sm text-red-700">Failed to load activity feed</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Module Activity</h2>
        <Activity size={16} className="text-slate-400" />
      </div>
      <div className="divide-y divide-slate-100">
        {entries.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            No recent module activity yet.
          </p>
        ) : (
          entries.map(entry => (
            <div
              key={entry.id}
              className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                  entry.action === 'module_filled'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {entry.action === 'module_filled' ? 'filled' : 'updated'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 truncate">
                    <span className="font-medium">{entry.moduleType}</span>
                    {' on '}
                    <span className="font-medium">{entry.entityName}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    by {entry.actorName}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {timeAgo(entry.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
