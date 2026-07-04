import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DividerSchema, type DividerContent } from '@/lib/blocks/schemas/dividerSchema'
import { FormField, inputCls } from '@/components/shared/form/FormField'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function DividerEditor({ content, onChange }: BlockEditorProps) {
  const { register, watch } = useForm<DividerContent>({
    resolver: zodResolver(DividerSchema),
    defaultValues: (content as DividerContent) ?? { type: 'divider', style: 'line' },
  })
  const notify = () => onChange({ type: 'divider', style: watch('style') })
  return (
    <FormField label="Style">
      <select className={inputCls} {...register('style', { onChange: notify })}>
        <option value="line">Line</option>
        <option value="space">Space</option>
      </select>
    </FormField>
  )
}
