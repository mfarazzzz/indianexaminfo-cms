import React from 'react'
import type { RichTextContent } from '@/lib/blocks/schemas/richTextSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function RichTextRenderer({ content }: BlockRendererProps) {
  const { html = '' } = content as RichTextContent
  return (
    <div
      className="prose prose-slate max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
