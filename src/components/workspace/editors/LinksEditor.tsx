/**
 * LinksEditor.tsx — Official links manager. REQ-014.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const LinksTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/LinksTab').then(m => ({ default: m.LinksTab }))
)

export default function LinksEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/4 mb-4" /><div className="h-32 bg-slate-100 rounded" /></div>}>
      <LinksTab entityId={entityId} />
    </React.Suspense>
  )
}
