import React from 'react'
import type { GalleryContent } from '@/lib/blocks/schemas/gallerySchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function GalleryRenderer({ content }: BlockRendererProps) {
  const { images = [] } = content as GalleryContent
  if (images.length === 0) return <p className="text-sm text-slate-400 italic">No images added.</p>
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {images.map((img, i) => (
        <figure key={i} className="space-y-1">
          <img src={img.url} alt={img.alt} className="w-full rounded object-cover aspect-video" loading="lazy" />
          {img.caption && <figcaption className="text-xs text-slate-500">{img.caption}</figcaption>}
        </figure>
      ))}
    </div>
  )
}
