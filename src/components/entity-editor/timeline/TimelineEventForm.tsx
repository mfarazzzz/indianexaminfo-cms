/**
 * TimelineEventForm — Inline edit form for a single timeline event.
 *
 * Presentation-only: no business logic, no Supabase, no service calls.
 * Validation via Zod (TimelineEventSchema). Errors via FormField.
 */
import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Switch from '@radix-ui/react-switch'
import { Loader2 } from 'lucide-react'
import { TimelineEventSchema, type TimelineEventInput } from '@/lib/validation/entitySchemas'
import {
  FormField,
  FieldGroup,
  inputCls,
  textareaCls,
} from '@/components/shared/form/FormField'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['upcoming','active','passed','postponed','cancelled'] as const
const BADGE_OPTIONS  = ['blue','green','yellow','orange','red','grey'] as const
const VIS_OPTIONS    = ['public','logged_in','admin'] as const

export interface TimelineEventFormProps {
  defaultValues?: Partial<TimelineEventInput>
  onSubmit: (data: TimelineEventInput) => void | Promise<unknown>
  onCancel: () => void
  onScheduleAutosave: () => void
  isSubmitting: boolean
}

export function TimelineEventForm({
  defaultValues,
  onSubmit,
  onCancel,
  onScheduleAutosave,
  isSubmitting,
}: TimelineEventFormProps) {
  const {
    register, handleSubmit, control,
    formState: { errors },
  } = useForm<TimelineEventInput>({
    resolver: zodResolver(TimelineEventSchema),
    defaultValues: {
      status: 'upcoming', badgeColor: 'blue', visibility: 'public',
      isHighlighted: false, isFeatured: false, displayOrder: 0,
      ...defaultValues,
    },
  })

  // Escape → cancel (save-on-close handled by caller)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  // Ctrl+S / Cmd+S → immediate save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSubmit(onSubmit)()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleSubmit, onSubmit])

  const autosave = () => onScheduleAutosave()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">

      {/* Row 1: Title + Event Type */}
      <FieldGroup cols={2}>
        <FormField label="Title" required error={errors.title?.message}>
          <input className={inputCls} placeholder="e.g. Application Start"
            {...register('title', { onChange: autosave })} />
        </FormField>
        <FormField label="Event Type" required error={errors.eventType?.message}>
          <input className={inputCls} placeholder="e.g. application-start"
            {...register('eventType', { onChange: autosave })} />
        </FormField>
      </FieldGroup>

      {/* Row 2: Date + Time */}
      <FieldGroup cols={2}>
        <FormField label="Date" required error={errors.eventDate?.message}>
          <input type="date" className={inputCls}
            {...register('eventDate', { onChange: autosave })} />
        </FormField>
        <FormField label="Time" error={errors.eventTime?.message}>
          <input type="time" className={inputCls}
            {...register('eventTime', { onChange: autosave })} />
        </FormField>
      </FieldGroup>

      {/* Row 3: Status + Badge Color */}
      <FieldGroup cols={2}>
        <FormField label="Status">
          <select className={inputCls} {...register('status', { onChange: autosave })}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Badge Color">
          <select className={inputCls} {...register('badgeColor', { onChange: autosave })}>
            {BADGE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormField>
      </FieldGroup>

      {/* Description */}
      <FormField label="Description" error={errors.description?.message}>
        <textarea rows={3} className={textareaCls} placeholder="Brief description…"
          {...register('description', { onChange: autosave })} />
      </FormField>

      {/* Row 4: Links */}
      <FieldGroup cols={2}>
        <FormField label="Official Link" error={errors.officialLink?.message}>
          <input type="url" className={inputCls} placeholder="https://…"
            {...register('officialLink', { onChange: autosave })} />
        </FormField>
        <FormField label="PDF Link" error={errors.pdfLink?.message}>
          <input type="url" className={inputCls} placeholder="https://…"
            {...register('pdfLink', { onChange: autosave })} />
        </FormField>
      </FieldGroup>

      {/* Row 5: Visibility + Display Order */}
      <FieldGroup cols={2}>
        <FormField label="Visibility">
          <select className={inputCls} {...register('visibility', { onChange: autosave })}>
            {VIS_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </FormField>
        <FormField label="Display Order" error={errors.displayOrder?.message}>
          <input type="number" className={inputCls}
            {...register('displayOrder', { valueAsNumber: true, onChange: autosave })} />
        </FormField>
      </FieldGroup>

      {/* Row 6: Switches */}
      <div className="flex items-center gap-8">
        <Controller name="isHighlighted" control={control} render={({ field }) => (
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <Switch.Root checked={field.value ?? false} onCheckedChange={v => { field.onChange(v); autosave() }}
              className={cn('relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors',
                field.value ? 'bg-blue-600' : 'bg-slate-200')}>
              <Switch.Thumb className={cn('block h-4 w-4 rounded-full bg-white shadow transition-transform',
                field.value ? 'translate-x-4' : 'translate-x-0')} />
            </Switch.Root>
            Highlighted
          </label>
        )} />
        <Controller name="isFeatured" control={control} render={({ field }) => (
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <Switch.Root checked={field.value ?? false} onCheckedChange={v => { field.onChange(v); autosave() }}
              className={cn('relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors',
                field.value ? 'bg-blue-600' : 'bg-slate-200')}>
              <Switch.Thumb className={cn('block h-4 w-4 rounded-full bg-white shadow transition-transform',
                field.value ? 'translate-x-4' : 'translate-x-0')} />
            </Switch.Root>
            Featured
          </label>
        )} />
      </div>

      {/* Publish At */}
      <FormField label="Schedule Publish At" hint="Must be a future date/time">
        <input type="datetime-local" className={inputCls}
          {...register('publishAt', { onChange: autosave })} />
      </FormField>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t">
        <button type="submit" disabled={isSubmitting}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 transition-colors">
          Cancel
        </button>
      </div>

    </form>
  )
}
