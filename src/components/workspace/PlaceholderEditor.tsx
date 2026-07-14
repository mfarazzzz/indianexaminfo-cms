/**
 * PlaceholderEditor.tsx — Phase 2 placeholder for all module editors.
 * Replaced incrementally in Phase 3 as real editors are implemented.
 */
import React from 'react'
import { FileText } from 'lucide-react'
import type { EditorProps } from './registry'

export default function PlaceholderEditor({ entityId }: EditorProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-8">
      <div className="rounded-full bg-slate-100 p-4 mb-4">
        <FileText className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-sm font-medium text-slate-700 mb-1">
        Module editor coming soon
      </h3>
      <p className="text-xs text-slate-400 max-w-xs">
        This editor will be implemented in Phase 3. The workspace shell is ready.
      </p>
    </div>
  )
}
