import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ParagraphSchema, type ParagraphContent } from '@/lib/blocks/schemas/paragraphSchema'
import { FormField, textareaCls } from '@/components/shared/form/FormField'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function ParagraphEditor({ content, onChange }: BlockEditorProps) {
  const { register, watch } = useForm<ParagraphContent>({
    resolver: zodResolver(ParagraphSchema),
    defaultValues: (content as ParagraphContent) ?? { type: 'paragraph', html: '' },
  })
  const notify = () => onChange({ type: 'paragraph', html: watch('html') })
  return (
    <FormField label="Content">
      <textarea rows={4} className={textareaCls} placeholder="Paragraph text…"
        {...register('html', { onChange: notify })} />
    </FormField>
  )
}
