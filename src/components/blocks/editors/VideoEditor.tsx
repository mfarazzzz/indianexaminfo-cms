import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { VideoSchema, type VideoContent } from '@/lib/blocks/schemas/videoSchema'
import { FormField, FieldGroup, inputCls } from '@/components/shared/form/FormField'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function VideoEditor({ content, onChange }: BlockEditorProps) {
  const { register, watch, formState: { errors } } = useForm<VideoContent>({
    resolver: zodResolver(VideoSchema),
    defaultValues: (content as VideoContent) ?? { type: 'video', url: '', provider: 'youtube' },
  })
  const notify = () => onChange({ type: 'video', url: watch('url'), provider: watch('provider'), caption: watch('caption') })
  return (
    <div className="space-y-3">
      <FieldGroup cols={2}>
        <FormField label="Video URL" required error={errors.url?.message}>
          <input type="url" className={inputCls} placeholder="https://…"
            {...register('url', { onChange: notify })} />
        </FormField>
        <FormField label="Provider">
          <select className={inputCls} {...register('provider', { onChange: notify })}>
            <option value="youtube">YouTube</option>
            <option value="vimeo">Vimeo</option>
            <option value="direct">Direct</option>
          </select>
        </FormField>
      </FieldGroup>
      <FormField label="Caption">
        <input className={inputCls} placeholder="Optional caption"
          {...register('caption', { onChange: notify })} />
      </FormField>
    </div>
  )
}
