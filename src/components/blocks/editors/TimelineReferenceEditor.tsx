import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { TimelineReferenceSchema, type TimelineReferenceContent } from '@/lib/blocks/schemas/timelineReferenceSchema'
import { FormField, textareaCls } from '@/components/shared/form/FormField'
import type { BlockEditorProps } from '@/lib/blocks/blockRegistry'

export function TimelineReferenceEditor({ content, onChange }: BlockEditorProps) {
  const c = (content as TimelineReferenceContent) ?? { type: 'timeline', eventIds: [] }
  const { register, watch } = useForm<TimelineReferenceContent>({
    resolver: zodResolver(TimelineReferenceSchema),
    defaultValues: c,
  })
  const notify = () => {
    const raw = watch('eventIds' as never) as unknown
    const ids = typeof raw === 'string'
      ? (raw as string).split('\n').map((s: string) => s.trim()).filter(Boolean)
      : (Array.isArray(raw) ? raw : [])
    onChange({ type: 'timeline', eventIds: ids })
  }
  return (
    <FormField label="Event IDs (one per line)"
      hint="Enter the IDs of timeline events to reference, one ID per line">
      <textarea rows={4} className={textareaCls}
        defaultValue={(c.eventIds ?? []).join('\n')}
        {...register('eventIds', { onChange: notify })} />
    </FormField>
  )
}
