import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DownloadCardSchema, type DownloadCardContent } from '@/lib/blocks/schemas/downloadCardSchema'
import { FormField, inputCls } from '@/components/shared/form/FormField'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function DownloadCardEditor({ content, onChange }: BlockEditorProps) {
  const { register, watch, formState: { errors } } = useForm<DownloadCardContent>({
    resolver: zodResolver(DownloadCardSchema),
    defaultValues: (content as DownloadCardContent) ?? { type: 'download_card', downloadId: '' },
  })
  const notify = () => onChange({ type: 'download_card', downloadId: watch('downloadId') })
  return (
    <FormField label="Download ID (UUID)" required error={errors.downloadId?.message}
      hint="The ID of an existing EntityDownload record">
      <input className={inputCls} placeholder="00000000-0000-0000-0000-000000000000"
        {...register('downloadId', { onChange: notify })} />
    </FormField>
  )
}
