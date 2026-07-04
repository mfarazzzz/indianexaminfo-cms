import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ButtonSchema, type ButtonContent } from '@/lib/blocks/schemas/buttonSchema'
import { FormField, FieldGroup, inputCls } from '@/components/shared/form/FormField'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function ButtonEditor({ content, onChange }: BlockEditorProps) {
  const { register, watch, formState: { errors } } = useForm<ButtonContent>({
    resolver: zodResolver(ButtonSchema),
    defaultValues: (content as ButtonContent) ?? { type: 'button', text: '', url: '', style: 'primary' },
  })
  const notify = () => onChange({ type: 'button', text: watch('text'), url: watch('url'), style: watch('style') })
  return (
    <div className="space-y-3">
      <FieldGroup cols={2}>
        <FormField label="Button Text" required error={errors.text?.message}>
          <input className={inputCls} placeholder="Click here" {...register('text', { onChange: notify })} />
        </FormField>
        <FormField label="Style">
          <select className={inputCls} {...register('style', { onChange: notify })}>
            {['primary','secondary','outline'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormField>
      </FieldGroup>
      <FormField label="URL" required error={errors.url?.message}>
        <input type="url" className={inputCls} placeholder="https://…" {...register('url', { onChange: notify })} />
      </FormField>
    </div>
  )
}
