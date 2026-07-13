import React, { useEffect, useRef, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Select from '@radix-ui/react-select'
import * as Switch from '@radix-ui/react-switch'
import { ChevronDown, Check, Loader2, RefreshCw, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { EntityCreateSchema, generateSlug } from '@/lib/validation/entitySchemas'
import type { EntityCreateInput } from '@/lib/validation/entitySchemas'
import { createEntity, updateEntity } from '@/services/entity/entityService'
import { getCategories } from '@/services/categoryService'
import { entityKeys, categoryKeys } from '@/lib/queryKeys'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import { useEditorUI } from '@/contexts/EditorUIContext'
import { useAutosave } from '@/hooks/useAutosave'
import {
  FormField as Field, FieldGroup, SectionHeader, inputCls,
} from '@/components/shared/form/FormField'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────
const PILLARS    = ['sarkari-naukri', 'entrance-exam', 'board-university'] as const
const SUB_TYPES  = ['exam', 'board', 'university', 'recruitment'] as const
const LEVELS     = ['national', 'state', 'university', 'board', 'district'] as const
const MODES      = ['online', 'offline', 'hybrid'] as const
const APP_MODES  = ['online', 'offline', 'both'] as const
const FREQS      = ['annual', 'biannual', 'irregular', 'monthly'] as const
const STATUSES   = ['draft','in_review','seo_review','legal_review','scheduled','published','archived'] as const

// ── Radix Select wrapper (local — will be promoted to shared in a later sprint) ──
function SimpleSelect({ value, onValueChange, placeholder, options, disabled }: {
  value?: string | null; onValueChange: (v: string) => void;
  placeholder?: string; options: { value: string; label: string }[]; disabled?: boolean
}) {
  return (
    <Select.Root value={value ?? ''} onValueChange={onValueChange} disabled={disabled}>
      <Select.Trigger className={cn(
        'flex h-9 w-full items-center justify-between rounded-md border border-slate-200',
        'bg-white px-3 text-sm text-slate-900',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        disabled && 'cursor-not-allowed opacity-50'
      )}>
        <Select.Value placeholder={placeholder ?? 'Select…'} />
        <Select.Icon><ChevronDown className="h-4 w-4 text-slate-400" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 overflow-hidden rounded-md border border-slate-100 bg-white shadow-lg">
          <Select.Viewport className="p-1">
            {options.map(opt => (
              <Select.Item key={opt.value} value={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-slate-700 outline-none hover:bg-blue-50 data-[state=checked]:text-blue-700">
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto">
                  <Check className="h-3.5 w-3.5 text-blue-600" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

// ── GeneralTab ────────────────────────────────────────────────────────────────
export function GeneralTab({ entityId }: { entityId: string }) {
  const qc = useQueryClient()
  const { markDirty, clearDirty } = useEditorUI()
  const isNew = !entityId

  const { data: entity } = useEntityQuery(entityId || null)

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors, isDirty },
  } = useForm<EntityCreateInput>({
    resolver: zodResolver(EntityCreateSchema),
    defaultValues: {
      name: '', shortName: '', slug: '', conductingBody: '', officialWebsite: '',
      categoryId: null, pillar: null, subType: 'exam', examLevel: null, examMode: null,
      applicationMode: null, examFrequency: null, workflowStatus: 'draft',
      isFeatured: false, priority: null, featuredUntil: null,
      tags: [], searchKeywords: [], lang: 'en',
    },
  })

  // Track whether we have populated the form from server data at least once.
  // We only reset on the FIRST successful load (seedRef.current === false) and
  // never again after that — background refetches must never overwrite unsaved
  // user edits. If the user explicitly saves, we set seedRef back to false so
  // the next confirmed server value is loaded cleanly.
  const seedRef = useRef(false)

  useEffect(() => {
    if (!entity) return
    if (seedRef.current) return // already seeded — do NOT overwrite dirty state

    seedRef.current = true
    reset({
      name: entity.name, shortName: entity.shortName ?? '',
      slug: entity.slug, conductingBody: entity.conductingBodyId ?? (entity as unknown as Record<string,string>).conductingBody ?? '',
      officialWebsite: entity.officialWebsite ?? '',
      categoryId: entity.categoryId, pillar: entity.pillar,
      subType: entity.subType ?? 'exam', examLevel: entity.examLevelId ?? null,
      examMode: entity.examModeId ?? null, applicationMode: entity.applicationModeId ?? null,
      examFrequency: entity.examFrequency, workflowStatus: entity.workflowStatus,
      isFeatured: entity.isFeatured, priority: entity.priority,
      featuredUntil: entity.featuredUntil ? entity.featuredUntil.slice(0, 10) : null,
      tags: entity.tags, searchKeywords: entity.searchKeywords, lang: entity.lang,
    })
  }, [entity, reset])

  useEffect(() => {
    if (isDirty) markDirty('general')
    else clearDirty('general')
  }, [isDirty, markDirty, clearDirty])

  const pillar   = watch('pillar')
  const name     = watch('name')
  const tags     = watch('tags')
  const keywords = watch('searchKeywords')

  const { data: categories = [] } = useQuery({
    queryKey: categoryKeys.byPillar(pillar ?? 'all'),
    queryFn: () => getCategories(pillar as never ?? undefined),
  })

  const mutation = useMutation({
    mutationFn: async (data: EntityCreateInput) =>
      isNew ? createEntity(data) : updateEntity(entityId, data),
    onSuccess: (saved) => {
      toast.success(isNew ? 'Exam created' : 'Saved')
      clearDirty('general')
      // Allow the next server response to re-seed the form with confirmed values.
      // This is the only place we intentionally accept a server overwrite.
      seedRef.current = false
      qc.invalidateQueries({ queryKey: entityKeys.detail(saved.id) })
      qc.invalidateQueries({ queryKey: entityKeys.lists() })
      if (isNew) window.history.replaceState({}, '', `/exams/${saved.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const onSubmit = handleSubmit((data) => mutation.mutate(data))

  // Stable autosave callback — uses a ref so the 30s timer always calls the
  // latest handleSubmit without creating a new function reference each render.
  const autosaveFnRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    autosaveFnRef.current = handleSubmit((data) => mutation.mutateAsync(data))
  })  // runs every render to keep ref current, but no dep array needed

  const stableAutosaveFn = useCallback(
    () => autosaveFnRef.current(),
    [] // stable reference — ref lookup happens inside
  )

  const { status: autosaveStatus, lastSaved, scheduleAutosave } = useAutosave(
    stableAutosaveFn,
    !isNew
  )

  const nameLen = name?.length ?? 0

  return (
    <form onSubmit={onSubmit} className="p-6 max-w-4xl mx-auto space-y-8">

      {/* Autosave indicator */}
      {!isNew && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          {autosaveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
          {autosaveStatus === 'saved'  && `Autosaved at ${lastSaved?.toLocaleTimeString()}`}
          {autosaveStatus === 'error'  && <span className="text-red-500">Autosave failed — retrying</span>}
          {autosaveStatus === 'idle'   && (lastSaved ? `Last saved ${lastSaved.toLocaleTimeString()}` : 'Not yet saved')}
        </div>
      )}

      {/* ── Identity ── */}
      <section className="space-y-4">
        <SectionHeader title="Identity" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="md:col-span-2">
            <Field label="Exam Name" required error={errors.name?.message}>
              <div className="relative">
                <input maxLength={200} placeholder="e.g. IBPS PO 2025"
                  className={inputCls} {...register('name')}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    register('name').onChange(e)
                    if (!entity?.slug) setValue('slug', generateSlug(e.target.value))
                    scheduleAutosave()
                  }} />
                <span className={cn(
                  'absolute right-3 top-1/2 -translate-y-1/2 text-xs',
                  nameLen > 190 ? 'text-red-500' : 'text-slate-400'
                )}>
                  {nameLen}/200
                </span>
              </div>
            </Field>
          </div>

          <Field label="Short Name" error={errors.shortName?.message}>
            <input placeholder="e.g. IBPS PO" className={inputCls} {...register('shortName')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { register('shortName').onChange(e); scheduleAutosave() }} />
          </Field>

          <Field label="Slug" hint="Auto-generated from name if left empty" error={errors.slug?.message}>
            <div className="flex gap-2">
              <input placeholder="ibps-po-2025" className={cn(inputCls, 'flex-1')} {...register('slug')}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { register('slug').onChange(e); scheduleAutosave() }} />
              <button type="button"
                onClick={() => { setValue('slug', generateSlug(name ?? ''), { shouldDirty: true }); scheduleAutosave() }}
                className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2">
                <RefreshCw className="h-3.5 w-3.5" /> Generate
              </button>
            </div>
          </Field>

          <Field label="Conducting Body" required error={errors.conductingBody?.message}>
            <input maxLength={200} placeholder="e.g. Institute of Banking Personnel Selection"
              className={inputCls} {...register('conductingBody')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { register('conductingBody').onChange(e); scheduleAutosave() }} />
          </Field>

          <Field label="Official Website" error={errors.officialWebsite?.message}>
            <input type="url" placeholder="https://ibps.in" className={inputCls} {...register('officialWebsite')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { register('officialWebsite').onChange(e); scheduleAutosave() }} />
          </Field>
        </div>
      </section>

      {/* ── Classification ── */}
      <section className="space-y-4">
        <SectionHeader title="Classification" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          <Field label="Pillar">
            <Controller name="pillar" control={control} render={({ field }) => (
              <SimpleSelect value={field.value} placeholder="Select pillar"
                options={PILLARS.map(p => ({ value: p, label: p }))}
                onValueChange={(v) => { field.onChange(v || null); setValue('categoryId', null); scheduleAutosave() }} />
            )} />
          </Field>

          <Field label="Category">
            <Controller name="categoryId" control={control} render={({ field }) => (
              <SimpleSelect value={field.value} placeholder={pillar ? 'Select category' : 'Select pillar first'}
                disabled={!pillar}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
                onValueChange={(v) => { field.onChange(v || null); scheduleAutosave() }} />
            )} />
          </Field>

          <Field label="Entity Type">
            <Controller name="subType" control={control} render={({ field }) => (
              <SimpleSelect value={field.value ?? 'exam'}
                options={SUB_TYPES.map(t => ({ value: t, label: t }))}
                onValueChange={(v) => { field.onChange(v); scheduleAutosave() }} />
            )} />
          </Field>

          <Field label="Exam Level">
            <Controller name="examLevel" control={control} render={({ field }) => (
              <SimpleSelect value={field.value} placeholder="Select level"
                options={LEVELS.map(l => ({ value: l, label: l }))}
                onValueChange={(v) => { field.onChange(v || null); scheduleAutosave() }} />
            )} />
          </Field>

          <Field label="Exam Mode">
            <Controller name="examMode" control={control} render={({ field }) => (
              <SimpleSelect value={field.value} placeholder="Select mode"
                options={MODES.map(m => ({ value: m, label: m }))}
                onValueChange={(v) => { field.onChange(v || null); scheduleAutosave() }} />
            )} />
          </Field>

          <Field label="Application Mode">
            <Controller name="applicationMode" control={control} render={({ field }) => (
              <SimpleSelect value={field.value} placeholder="Select"
                options={APP_MODES.map(m => ({ value: m, label: m }))}
                onValueChange={(v) => { field.onChange(v || null); scheduleAutosave() }} />
            )} />
          </Field>

          <Field label="Exam Frequency">
            <Controller name="examFrequency" control={control} render={({ field }) => (
              <SimpleSelect value={field.value} placeholder="Select frequency"
                options={FREQS.map(f => ({ value: f, label: f }))}
                onValueChange={(v) => { field.onChange(v || null); scheduleAutosave() }} />
            )} />
          </Field>

          <Field label="Workflow Status">
            <Controller name="workflowStatus" control={control} render={({ field }) => (
              <SimpleSelect value={field.value}
                options={STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
                onValueChange={(v) => { field.onChange(v); scheduleAutosave() }} />
            )} />
          </Field>
        </div>
      </section>

      {/* ── Visibility ── */}
      <section className="space-y-4">
        <SectionHeader title="Visibility & Priority" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">

          <Field label="Featured">
            <Controller name="isFeatured" control={control} render={({ field }) => (
              <div className="flex items-center gap-3 h-9">
                <Switch.Root
                  checked={field.value}
                  onCheckedChange={(v) => { field.onChange(v); scheduleAutosave() }}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                    field.value ? 'bg-blue-600' : 'bg-slate-200'
                  )}>
                  <Switch.Thumb className={cn(
                    'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform',
                    field.value ? 'translate-x-4' : 'translate-x-0'
                  )} />
                </Switch.Root>
                <span className="text-sm text-slate-600">
                  {field.value ? 'Featured' : 'Not featured'}
                </span>
              </div>
            )} />
          </Field>

          <Field label="Priority (1–999)" error={errors.priority?.message}>
            <input type="number" min={1} max={999} placeholder="e.g. 10"
              className={inputCls} {...register('priority', { valueAsNumber: true })}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { register('priority').onChange(e); scheduleAutosave() }} />
          </Field>

          <Field label="Featured Until" error={errors.featuredUntil?.message}>
            <input type="date" className={inputCls} {...register('featuredUntil')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { register('featuredUntil').onChange(e); scheduleAutosave() }} />
          </Field>
        </div>
      </section>

      {/* ── Tags ── */}
      <section className="space-y-4">
        <SectionHeader title="Tags & Keywords" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Tags" hint="Comma-separated values">
            <input placeholder="banking, ibps, po" className={inputCls}
              value={(tags ?? []).join(', ')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const vals = e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean)
                setValue('tags', vals, { shouldDirty: true })
                scheduleAutosave()
              }} />
          </Field>
          <Field label="Search Keywords" hint="Comma-separated values">
            <input placeholder="ibps po 2025, bank exam" className={inputCls}
              value={(keywords ?? []).join(', ')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const vals = e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean)
                setValue('searchKeywords', vals, { shouldDirty: true })
                scheduleAutosave()
              }} />
          </Field>
        </div>
      </section>

      {/* ── Submit ── */}
      <div className="flex items-center gap-3 pt-2 border-t">
        <button type="submit" disabled={mutation.isPending}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isNew ? 'Create Exam' : 'Save Changes'}
        </button>
        {isDirty && !mutation.isPending && (
          <span className="text-xs text-amber-600">You have unsaved changes</span>
        )}
      </div>

    </form>
  )
}
