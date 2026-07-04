import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertSchema, type AlertContent } from '@/lib/blocks/schemas/alertSchema'
import { FormField, FieldGroup, inputCls, textareaCls } from '@/components/shared/form/FormField'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function AlertEditor({ content, onChange }: BlockEditorProps) {
  const { register, watch } = useForm<AlertContent>({
    resolver: zodResolver(AlertSchema),
    defaultValues: (content as AlertContent) ?? { type: 'alert_box', variant: 'info', title: '', body: '' },
  })
  const notify = () => onChange({ type: 'alert_box', variant: watch('variant'), title: watch('title'), body: watch('body') })
  return (
    <div className="space-y-3">
      <FieldGroup cols={2}>
        <FormField label="Variant">
          <select className={inputCls} {...register('variant', { onChange: notify })}>
            {['info','warning','error','success'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </FormField>
        <FormField label="Title" required>
          <input className={inputCls} placeholder="Alert title" {...register('title', { onChange: notify })} />
        </FormField>
      </FieldGroup>
      <FormField label="Body" required>
        <textarea rows={2} className={textareaCls} placeholder="Alert body text…"
          {...register('body', { onChange: notify })} />
      </FormField>
    </div>
  )
}
