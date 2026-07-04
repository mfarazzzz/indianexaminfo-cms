import React from 'react'
import { Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react'
import type { AlertContent } from '@/lib/blocks/schemas/alertSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'
import { cn } from '@/lib/utils'

const config = {
  info:    { cls: 'bg-blue-50 border-blue-200 text-blue-800',    Icon: Info },
  warning: { cls: 'bg-yellow-50 border-yellow-200 text-yellow-800', Icon: AlertTriangle },
  error:   { cls: 'bg-red-50 border-red-200 text-red-800',       Icon: XCircle },
  success: { cls: 'bg-green-50 border-green-200 text-green-800', Icon: CheckCircle },
}

export function AlertRenderer({ content }: BlockRendererProps) {
  const { variant = 'info', title = '', body = '' } = content as AlertContent
  const { cls, Icon } = config[variant] ?? config.info
  return (
    <div className={cn('flex gap-3 rounded-md border p-4', cls)}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        {title && <p className="text-sm font-semibold">{title}</p>}
        <p className="text-sm">{body}</p>
      </div>
    </div>
  )
}
