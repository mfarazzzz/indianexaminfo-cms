import React from 'react'
import type { HeadingContent } from '@/lib/blocks/schemas/headingSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'
import { cn } from '@/lib/utils'

const cls: Record<number, string> = {
  1: 'text-4xl font-bold', 2: 'text-3xl font-bold', 3: 'text-2xl font-semibold',
  4: 'text-xl font-semibold', 5: 'text-lg font-medium', 6: 'text-base font-medium',
}

export function HeadingRenderer({ content }: BlockRendererProps) {
  const { level = 2, text = '' } = content as HeadingContent
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements
  return <Tag className={cn('text-slate-900', cls[level])}>{text}</Tag>
}
