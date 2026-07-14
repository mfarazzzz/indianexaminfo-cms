/**
 * primitives.tsx — Reusable inspector UI primitives.
 *
 * InspectorSection, InspectorCard, InspectorWidget, InspectorAction,
 * InspectorNotice, InspectorMetric.
 *
 * All primitives are accessible and composable.
 */
import React from 'react'
import { cn } from '@/lib/utils'

// ── InspectorSection ──────────────────────────────────────────────────────────

export function InspectorSection({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('px-4 py-3 border-b last:border-b-0', className)} aria-label={title}>
      {title && (
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          {title}
        </h4>
      )}
      {children}
    </section>
  )
}

// ── InspectorCard ─────────────────────────────────────────────────────────────

export function InspectorCard({
  children,
  className,
  variant = 'default',
}: {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'error'
}) {
  const variantStyles = {
    default: 'bg-white border-slate-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-amber-50 border-amber-200',
    error:   'bg-red-50 border-red-200',
  }
  return (
    <div className={cn('rounded-md border p-3', variantStyles[variant], className)}>
      {children}
    </div>
  )
}

// ── InspectorMetric ───────────────────────────────────────────────────────────

export function InspectorMetric({
  label,
  value,
  suffix,
  variant = 'default',
}: {
  label: string
  value: string | number
  suffix?: string
  variant?: 'default' | 'success' | 'warning' | 'error'
}) {
  const colorMap = {
    default: 'text-slate-800',
    success: 'text-green-700',
    warning: 'text-amber-700',
    error:   'text-red-700',
  }
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={cn('text-sm font-medium', colorMap[variant])}>
        {value}{suffix && <span className="text-xs text-slate-400 ml-0.5">{suffix}</span>}
      </span>
    </div>
  )
}

// ── InspectorAction ───────────────────────────────────────────────────────────

export function InspectorAction({
  label,
  onClick,
  disabled,
  variant = 'secondary',
  icon,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  icon?: React.ReactNode
}) {
  const styles = {
    primary:   'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger:    'bg-red-600 text-white hover:bg-red-700',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors disabled:opacity-50',
        styles[variant]
      )}
    >
      {icon}
      {label}
    </button>
  )
}

// ── InspectorNotice ───────────────────────────────────────────────────────────

export function InspectorNotice({
  message,
  variant = 'info',
}: {
  message: string
  variant?: 'info' | 'warning' | 'error' | 'success'
}) {
  const styles = {
    info:    'bg-blue-50 text-blue-700 border-blue-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error:   'bg-red-50 text-red-700 border-red-200',
    success: 'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <div className={cn('rounded-md border px-3 py-2 text-xs', styles[variant])} role="alert">
      {message}
    </div>
  )
}

// ── InspectorWidget ───────────────────────────────────────────────────────────

export function InspectorWidget({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
      <div className="px-3 py-1.5 bg-slate-50 border-b">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}
