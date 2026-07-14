/**
 * OverviewEditor.tsx — Rich text overview sections editor. REQ-012.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const OverviewTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/OverviewTab').then(m => ({ default: m.OverviewTab }))
)

export default function OverviewEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/3 mb-4" /><div className="h-64 bg-slate-100 rounded" /></div>}>
      <OverviewTab entityId={entityId} />
    </React.Suspense>
  )
}
