import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { QuoteSchema, type QuoteContent } from '@/lib/blocks/schemas/quoteSchema'
import { FormField, textareaCls, inputCls } from '@/components/shared/form/FormField'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function QuoteEditor({ content, onChange }: BlockEditorProps) {
  const { register, watch } = useForm<QuoteContent>({
    resolver: zodResolver(QuoteSchema),
    defaultValues: (content as QuoteContent) ?? { type: 'quote', text: '' },
  })
  const notify = () => onChange({ type: 'quote', text: watch('text'), attribution: watch('attribution') })
  return (
    <div className="space-y-3">
      <FormField label="Quote text" required>
        <textarea rows={3} className={textareaCls} placeholder="Inspiring words…"
          {...register('text', { onChange: notify })} />
      </FormField>
      <FormField label="Attribution">
        <input className={inputCls} placeholder="— Author Name" {...register('attribution', { onChange: notify })} />
      </FormField>
    </div>
  )
}
