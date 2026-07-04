import React from 'react'
import type { FAQContent } from '@/lib/blocks/schemas/faqSchema'
import type { BlockRendererProps } from '@/lib/blocks/blockRegistry'

export function FAQRenderer({ content }: BlockRendererProps) {
  const { faqs = [] } = content as FAQContent
  if (faqs.length === 0) return <p className="text-sm text-slate-400 italic">No FAQ items.</p>
  return (
    <dl className="space-y-4">
      {faqs.map((item, i) => (
        <div key={i} className="space-y-1">
          <dt className="text-sm font-semibold text-slate-900">{item.q}</dt>
          <dd className="text-sm text-slate-600 pl-3">{item.a}</dd>
        </div>
      ))}
    </dl>
  )
}
