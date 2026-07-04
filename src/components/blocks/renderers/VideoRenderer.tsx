import React from 'react'
import type { VideoContent } from '@/lib/blocks/schemas/videoSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

function toEmbedUrl(url: string, provider: string): string {
  if (provider === 'youtube') {
    const id = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1]
    return id ? `https://www.youtube.com/embed/${id}` : url
  }
  if (provider === 'vimeo') {
    const id = url.match(/vimeo\.com\/(\d+)/)?.[1]
    return id ? `https://player.vimeo.com/video/${id}` : url
  }
  return url
}

export function VideoRenderer({ content }: BlockRendererProps) {
  const { url = '', provider = 'direct', caption } = content as VideoContent
  if (provider === 'direct') {
    return (
      <figure className="space-y-1">
        <video src={url} controls className="w-full rounded-md" />
        {caption && <figcaption className="text-xs text-slate-500 text-center">{caption}</figcaption>}
      </figure>
    )
  }
  return (
    <figure className="space-y-1">
      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
        <iframe src={toEmbedUrl(url, provider)} title={caption ?? 'video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen className="absolute inset-0 w-full h-full rounded-md" />
      </div>
      {caption && <figcaption className="text-xs text-slate-500 text-center">{caption}</figcaption>}
    </figure>
  )
}
