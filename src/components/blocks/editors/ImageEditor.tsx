import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImageSchema, type ImageContent } from '@/lib/blocks/schemas/imageSchema'
import { FormField, FieldGroup, inputCls } from '@/components/shared/form/FormField'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function ImageEditor({ content, onChange }: BlockEditorProps) {
  const { register, watch, formState: { errors } } = useForm<ImageContent>({
    resolver: zodResolver(ImageSchema),
    defaultValues: (content as ImageContent) ?? { type: 'image', url: '', alt: '' },
  })
  const notify = () => onChange({ type: 'image', url: watch('url'), alt: watch('alt'), caption: watch('caption') })
  return (
    <div className="space-y-3">
      <FormField label="Image URL" required error={errors.url?.message}>
        <input type="url" className={inputCls} placeholder="https://…" {...register('url', { onChange: notify })} />
      </FormField>
      <FieldGroup cols={2}>
        <FormField label="Alt text" required error={errors.alt?.message}>
          <input className={inputCls} placeholder="Describe the image" {...register('alt', { onChange: notify })} />
        </FormField>
        <FormField label="Caption">
          <input className={inputCls} placeholder="Optional caption" {...register('caption', { onChange: notify })} />
        </FormField>
      </FieldGroup>
    </div>
  )
}
