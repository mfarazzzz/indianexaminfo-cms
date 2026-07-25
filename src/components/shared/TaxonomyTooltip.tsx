/**
 * TaxonomyTooltip — Info icon with hover/focus tooltip for taxonomy fields.
 * Loads content from settings/config, hides if content unavailable. (Req 10.1–10.5)
 */
import React, { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase/client'

interface TaxonomyTooltipProps {
  fieldKey: string
}

/** Fetch taxonomy tooltips from settings table (cached indefinitely) */
function useTaxonomyTooltips() {
  return useQuery<Record<string, string>>({
    queryKey: ['settings', 'taxonomy_tooltips'],
    queryFn: async () => {
      const { data, error } = await db
        .from('settings')
        .select('value')
        .eq('key', 'taxonomy_tooltips')
        .single()
      if (error || !data) return {}
      return (data.value as Record<string, string>) ?? {}
    },
    staleTime: Infinity,
  })
}

export function TaxonomyTooltip({ fieldKey }: TaxonomyTooltipProps) {
  const { data: tooltips } = useTaxonomyTooltips()
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const content = tooltips?.[fieldKey]

  // Don't render if no content available
  if (!content) return null

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsVisible(true)
  }

  const hide = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(false), 300)
  }

  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex items-center justify-center rounded-full p-0.5 text-slate-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        aria-label={`Information about ${fieldKey}`}
        aria-describedby={`tooltip-${fieldKey}`}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {isVisible && (
        <div
          id={`tooltip-${fieldKey}`}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg"
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-white" />
        </div>
      )}
    </span>
  )
}
