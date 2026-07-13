/**
 * EntityListPage.tsx — Pillar-agnostic entity list.
 * Reads :pillar param from URL. When a new pillar is added to the DB,
 * this page handles it automatically — zero code change required.
 */
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Loader2 } from 'lucide-react'
import { useEntityListQuery } from '@/hooks/useEntityQuery'
import { WORKFLOW_STATUS_LABELS } from '@/types/entity'
import type { WorkflowStatus } from '@/types/entity'
import { cn } from '@/lib/utils'

const STATUS_DOT: Record<string, string> = {
  draft:     'bg-gray-300',
  review:    'bg-yellow-400',
  published: 'bg-green-500',
  archived:  'bg-red-400',
  hidden:    'bg-slate-400',
  deleted:   'bg-red-700',
}

export function EntityListPage() {
  const { pillar } = useParams<{ pillar?: string }>()
  const navigate   = useNavigate()

  const { data, isLoading, error } = useEntityListQuery({
    pillar,
    limit: 50,
  })

  const entities = data?.data ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600">
        Failed to load entities: {(error as Error).message}
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900 capitalize">
          {pillar ? pillar.replace(/-/g, ' ') : 'All Entities'}
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({data?.count ?? 0})
          </span>
        </h1>
        <button
          onClick={() => navigate(`/entities/${pillar ?? 'recruitment'}/new`)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Entity
        </button>
      </div>

      {entities.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No entities found.</p>
          <button
            onClick={() => navigate(`/entities/${pillar ?? 'recruitment'}/new`)}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            Create the first one →
          </button>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entities.map(entity => (
                <tr
                  key={entity.id}
                  onClick={() => navigate(`/entities/${entity.pillar ?? pillar}/${entity.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-xs">{entity.name}</p>
                    {entity.shortName && (
                      <p className="text-xs text-gray-400">{entity.shortName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500 capitalize">
                    {entity.entityType}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[entity.workflowStatus] ?? 'bg-gray-300')} />
                      <span className="text-gray-700">
                        {WORKFLOW_STATUS_LABELS[entity.workflowStatus as WorkflowStatus] ?? entity.workflowStatus}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">
                    {new Date(entity.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
