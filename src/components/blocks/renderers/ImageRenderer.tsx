import React from 'react'
import type { ImageContent } from '@/lib/blocks/schemas/imageSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function ImageRenderer({ content }: BlockRendererProps) {
  const { url, alt = '', caption } = content as ImageContent
  return (
    <figure className="space-y-1">
      <img src={url} alt={alt} className="w-full rounded-md object-cover" loading="lazy" />
      {caption && <figcaption className="text-xs text-slate-500 text-center">{caption}</figcaption>}
    </figure>
  )
}
