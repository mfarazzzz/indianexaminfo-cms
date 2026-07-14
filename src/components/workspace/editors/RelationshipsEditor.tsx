/**
 * RelationshipsEditor.tsx — Entity relationship manager. REQ-019/033.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const RelationshipsTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/RelationshipsTab').then(m => ({ default: m.RelationshipsTab }))
)

export default function RelationshipsEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/3 mb-4" /><div className="h-32 bg-slate-100 rounded" /></div>}>
      <RelationshipsTab entityId={entityId} />
    </React.Suspense>
  )
}
