import React from 'react'
import type { ButtonContent } from '@/lib/blocks/schemas/buttonSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'
import { cn } from '@/lib/utils'

const styleMap: Record<string, string> = {
  primary:   'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-slate-600 text-white hover:bg-slate-700',
  outline:   'border border-blue-600 text-blue-600 hover:bg-blue-50',
}

export function ButtonRenderer({ content }: BlockRendererProps) {
  const { text = '', url = '#', style = 'primary' } = content as ButtonContent
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={cn('inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors', styleMap[style])}>
      {text}
    </a>
  )
}
