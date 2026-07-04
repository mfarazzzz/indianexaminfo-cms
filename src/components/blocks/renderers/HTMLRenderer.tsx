/**
 * HTMLRenderer — feature-flagged raw HTML block renderer.
 * Only registered when VITE_ENABLE_HTML_BLOCK === 'true'.
 */
import React from 'react'
import type { HTMLContent } from '@/lib/blocks/schemas/htmlSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function HTMLRenderer({ content }: BlockRendererProps) {
  const { raw = '' } = content as HTMLContent
  return (
    /* eslint-disable-next-line react/no-danger -- trusted CMS-authored HTML */
    <div dangerouslySetInnerHTML={{ __html: raw }} />
  )
}
