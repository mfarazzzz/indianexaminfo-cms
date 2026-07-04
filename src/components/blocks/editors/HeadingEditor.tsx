import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { HeadingSchema, type HeadingContent } from '@/lib/blocks/schemas/headingSchema'
import { FormField, inputCls } from '@/components/shared/form/FormField'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function HeadingEditor({ content, onChange }: BlockEditorProps) {
  const { register, watch } = useForm<HeadingContent>({
    resolver: zodResolver(HeadingSchema),
    defaultValues: (content as HeadingContent) ?? { type: 'heading', level: 2, text: '' },
  })
  const notify = () => onChange({ type: 'heading', level: watch('level'), text: watch('text') })
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Level">
          <select className={inputCls} {...register('level', { valueAsNumber: true, onChange: notify })}>
            {[1,2,3,4,5,6].map(l => <option key={l} value={l}>H{l}</option>)}
          </select>
        </FormField>
        <FormField label="Text">
          <input className={inputCls} placeholder="Heading text…" {...register('text', { onChange: notify })} />
        </FormField>
      </div>
    </div>
  )
}
