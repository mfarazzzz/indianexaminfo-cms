import React from 'react'
import { Download } from 'lucide-react'
import type { DownloadCardContent } from '@/lib/blocks/schemas/downloadCardSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function DownloadCardRenderer({ content }: BlockRendererProps) {
  const { downloadId = '' } = content as DownloadCardContent
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <Download className="h-5 w-5 text-blue-600 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">Download</p>
        <p className="text-xs text-slate-400 truncate">ID: {downloadId}</p>
      </div>
    </div>
  )
}
