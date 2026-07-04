import React from 'react'
import type { DividerContent } from '@/lib/blocks/schemas/dividerSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function DividerRenderer({ content }: BlockRendererProps) {
  const { style = 'line' } = content as DividerContent
  if (style === 'space') return <div className="h-8" aria-hidden="true" />
  return <hr className="border-slate-200" />
}
