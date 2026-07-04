import React from 'react'
import type { QuoteContent } from '@/lib/blocks/schemas/quoteSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function QuoteRenderer({ content }: BlockRendererProps) {
  const { text = '', attribution } = content as QuoteContent
  return (
    <blockquote className="border-l-4 border-blue-400 pl-4 py-1 space-y-1">
      <p className="text-slate-700 italic">"{text}"</p>
      {attribution && <footer className="text-xs text-slate-500">{attribution}</footer>}
    </blockquote>
  )
}
