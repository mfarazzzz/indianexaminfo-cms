/**
 * HTMLEditor — Raw HTML input (feature-flagged).
 * Only rendered when VITE_ENABLE_HTML_BLOCK === 'true'.
 */
import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { HTMLSchema, type HTMLContent } from '@/lib/blocks/schemas/htmlSchema'
import { FormField, textareaCls } from '@/components/shared/form/FormField'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function HTMLEditor({ content, onChange }: BlockEditorProps) {
  const { register, watch } = useForm<HTMLContent>({
    resolver: zodResolver(HTMLSchema),
    defaultValues: (content as HTMLContent) ?? { type: 'html', raw: '' },
  })
  const notify = () => onChange({ type: 'html', raw: watch('raw') })
  return (
    <FormField label="Raw HTML" hint="Caution: only use trusted HTML content">
      <textarea rows={8} className={textareaCls + ' font-mono text-xs'}
        placeholder="<div>…</div>"
        {...register('raw', { onChange: notify })} />
    </FormField>
  )
}
