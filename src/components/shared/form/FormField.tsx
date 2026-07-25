/**
 * FormField — Accessible label + input wrapper used by all editor tabs.
 *
 * Usage:
 *   <FormField label="Exam Name" required error={errors.name?.message}>
 *     <input ... />
 *   </FormField>
 */
import React from 'react'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: React.ReactNode
  /** Marks field as required with a red asterisk */
  required?: boolean
  /** Inline error message shown below the field */
  error?: string
  /** Helper text shown below the field (hidden when error is present) */
  hint?: string
  /** htmlFor — passed to <label>. Auto-derived from label if omitted. */
  htmlFor?: string
  className?: string
  children: React.ReactNode
}

export function FormField({
  label,
  required,
  error,
  hint,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
        )}
      </label>

      {children}

      {error ? (
        <FormError>{error}</FormError>
      ) : hint ? (
        <FormHint>{hint}</FormHint>
      ) : null}
    </div>
  )
}

// ── Sub-components (exported separately so they can be used standalone) ────────

export function FormHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-slate-400">{children}</p>
  )
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-xs text-red-500">
      {children}
    </p>
  )
}

/** Groups several FormField columns into a responsive grid */
export function FieldGroup({
  cols = 2,
  className,
  children,
}: {
  cols?: 1 | 2 | 3 | 4
  className?: string
  children: React.ReactNode
}) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[cols]

  return (
    <div className={cn('grid gap-4', gridCols, className)}>
      {children}
    </div>
  )
}

/** Section header used to separate logical groups within a tab */
export function SectionHeader({
  title,
  description,
  className,
}: {
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn('border-b pb-2', className)}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {description && (
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      )}
    </div>
  )
}

/** Visual divider between sections */
export function FormDivider({ className }: { className?: string }) {
  return <hr className={cn('border-slate-100', className)} />
}

/** Shared input class — use this on all <input> / <textarea> / <select> elements */
export const inputCls =
  'flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm ' +
  'text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export const textareaCls =
  'flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ' +
  'text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 resize-y'
