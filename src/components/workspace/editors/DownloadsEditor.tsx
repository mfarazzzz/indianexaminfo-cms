/**
 * DownloadsEditor.tsx — Download records manager. REQ-014.
 */
import React from 'react'
import type { EditorProps } from '../registry'

const DownloadsTab = React.lazy(() =>
  import('@/components/entity-editor/tabs/DownloadsTab').then(m => ({ default: m.DownloadsTab }))
)

export default function DownloadsEditor({ entityId }: EditorProps) {
  return (
    <React.Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/4 mb-4" /><div className="h-32 bg-slate-100 rounded" /></div>}>
      <DownloadsTab entityId={entityId} />
    </React.Suspense>
  )
}
