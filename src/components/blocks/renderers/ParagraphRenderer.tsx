import React from 'react'
import type { ParagraphContent } from '@/lib/blocks/schemas/paragraphSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function ParagraphRenderer({ content }: BlockRendererProps) {
  const { html = '' } = content as ParagraphContent
  return (
    <div
      className="prose prose-slate max-w-none text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
