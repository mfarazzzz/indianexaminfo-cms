/**
 * MediaEditor.tsx — Media library manager. REQ-014.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const MediaTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/MediaTab').then(m => ({ default: m.MediaTab }))
)

export default function MediaEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/4 mb-4" /><div className="h-48 bg-slate-100 rounded" /></div>}>
      <MediaTab entityId={entityId} />
    </React.Suspense>
  )
}
