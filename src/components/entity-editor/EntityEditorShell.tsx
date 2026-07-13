/**
 * EntityEditorShell.tsx — Template-snapshot-driven editor shell.
 *
 * M3.8: Replaces hardcoded EDITOR_TABS array with TAB_REGISTRY map.
 * Tabs are determined at runtime from entity.templateSnapshot.moduleVisibility.
 * Adding a new tab = register it in TAB_REGISTRY + enable in a template. Zero code
 * changes to this file.
 */
import React, { lazy, Suspense, useCallback, useState, useMemo } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Loader2, Clock, AlertCircle, ShieldCheck } from 'lucide-react'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import { useEditorUI } from '@/contexts/EditorUIContext'
import { WORKFLOW_STATUS_LABELS } from '@/types/entity'
import type { WorkflowStatus } from '@/types/entity'
import type { ModuleVisibilityConfig } from '@/types/lifecycle-template'
import { cn } from '@/lib/utils'

// ── TAB_REGISTRY — registered tabs (not rendered until enabled by snapshot) ──
// Add new tabs here; enabling them in a template's moduleVisibility makes them appear.
const TAB_REGISTRY = new Map<string, { label: string; Component: React.LazyExoticComponent<React.ComponentType<{ entityId: string }>> }>([
  ['general',           { label: 'General',           Component: lazy(() => import('./tabs/GeneralTab').then(m => ({ default: m.GeneralTab }))) }],
  ['overview',          { label: 'Overview',          Component: lazy(() => import('./tabs/OverviewTab').then(m => ({ default: m.OverviewTab }))) }],
  ['timeline',          { label: 'Timeline',          Component: lazy(() => import('./tabs/TimelineTab').then(m => ({ default: m.TimelineTab }))) }],
  ['eligibility',       { label: 'Eligibility',       Component: lazy(() => import('./tabs/EligibilityTab').then(m => ({ default: m.EligibilityTab }))) }],
  ['vacancy',           { label: 'Vacancy',           Component: lazy(() => import('./tabs/VacancyTab').then(m => ({ default: m.VacancyTab }))) }],
  ['fee',               { label: 'Fee',               Component: lazy(() => import('./tabs/FeeTab').then(m => ({ default: m.FeeTab }))) }],
  ['exam_pattern',      { label: 'Exam Pattern',      Component: lazy(() => import('./tabs/ExamPatternTab').then(m => ({ default: m.ExamPatternTab }))) }],
  ['selection_process', { label: 'Selection Process', Component: lazy(() => import('./tabs/SelectionProcessTab').then(m => ({ default: m.SelectionProcessTab }))) }],
  ['syllabus',          { label: 'Syllabus',          Component: lazy(() => import('./tabs/SyllabusTab').then(m => ({ default: m.SyllabusTab }))) }],
  ['modules',           { label: 'Content Modules',   Component: lazy(() => import('./tabs/ModulesTab').then(m => ({ default: m.ModulesTab }))) }],
  ['downloads',         { label: 'Downloads',         Component: lazy(() => import('./tabs/DownloadsTab').then(m => ({ default: m.DownloadsTab }))) }],
  ['links',             { label: 'Official Links',    Component: lazy(() => import('./tabs/LinksTab').then(m => ({ default: m.LinksTab }))) }],
  ['media',             { label: 'Media',             Component: lazy(() => import('./tabs/MediaTab').then(m => ({ default: m.MediaTab }))) }],
  ['seo',               { label: 'SEO',               Component: lazy(() => import('./tabs/SEOTab').then(m => ({ default: m.SEOTab }))) }],
  ['publishing',        { label: 'Publishing',        Component: lazy(() => import('./tabs/PublishingTab').then(m => ({ default: m.PublishingTab }))) }],
  ['relationships',     { label: 'Relationships',     Component: lazy(() => import('./tabs/RelationshipsTab').then(m => ({ default: m.RelationshipsTab }))) }],
  ['amendments',        { label: 'Amendments',        Component: lazy(() => import('./tabs/AmendmentsSection').then(m => ({ default: m.AmendmentsSection }))) }],
])

// ── Status badge styles ───────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-gray-50 text-gray-600 ring-1 ring-gray-200',
  review:    'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
  published: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  archived:  'bg-red-50 text-red-700 ring-1 ring-red-200',
  hidden:    'bg-slate-50 text-slate-500 ring-1 ring-slate-200',
  deleted:   'bg-red-100 text-red-800 ring-1 ring-red-300',
}

// ── Skeleton / error fallback ─────────────────────────────────────────────────
function TabSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-2/3" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-32 bg-gray-200 rounded" />
    </div>
  )
}

function TabErrorFallback({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="p-8 flex flex-col items-center gap-3 text-center">
      <AlertCircle className="h-8 w-8 text-red-400" />
      <p className="text-sm text-gray-600">Failed to load <strong>{label}</strong></p>
      <button onClick={onRetry} className="text-sm text-blue-600 hover:underline">Retry</button>
    </div>
  )
}

class TabErrorBoundary extends React.Component<
  { label: string; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { label: string; children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError)
      return <TabErrorFallback label={this.props.label} onRetry={() => this.setState({ hasError: false })} />
    return this.props.children
  }
}

// ── Shell ─────────────────────────────────────────────────────────────────────
interface EntityEditorShellProps { entityId: string | null }

export function EntityEditorShell({ entityId }: EntityEditorShellProps) {
  const { state, setActiveTab, isTabDirty, clearDirty } = useEditorUI()
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  const { data: entity, isLoading } = useEntityQuery(entityId)

  // ── Derive enabled tabs from template_snapshot.moduleVisibility ──────────────
  // This is the key M3.8 change: zero hardcoded tab arrays.
  const enabledTabs = useMemo(() => {
    const visibility = entity?.templateSnapshot?.moduleVisibility
    if (!visibility) {
      // Before snapshot is loaded (new entity or no snapshot): show general only
      const entry = TAB_REGISTRY.get('general')
      return entry ? [{ key: 'general', ...entry, cfg: { enabled: true, required: true, displayOrder: 1 } as ModuleVisibilityConfig }] : []
    }
    return Object.entries(visibility)
      .filter(([, cfg]) => cfg.enabled)
      .sort((a, b) => a[1].displayOrder - b[1].displayOrder)
      .map(([key, cfg]) => {
        const entry = TAB_REGISTRY.get(key)
        if (!entry) return null
        return { key, ...entry, cfg }
      })
      .filter((tab): tab is NonNullable<typeof tab> => tab !== null)
  }, [entity?.templateSnapshot?.moduleVisibility])

  const handleTabChange = useCallback((newTab: string) => {
    if (isTabDirty(state.activeTab)) {
      setPendingTab(newTab)
    } else {
      setActiveTab(newTab)
    }
  }, [state.activeTab, isTabDirty, setActiveTab])

  const handleDiscard = useCallback(() => {
    if (pendingTab) {
      clearDirty(state.activeTab)
      setActiveTab(pendingTab)
      setPendingTab(null)
    }
  }, [pendingTab, state.activeTab, clearDirty, setActiveTab])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  const status = entity?.workflowStatus ?? 'draft'
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.draft

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-white px-6 py-3 flex items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-semibold text-slate-900 truncate">
            {entity?.name ?? 'New Entity'}
          </h1>
          <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize', statusStyle)}>
            {WORKFLOW_STATUS_LABELS[status as WorkflowStatus] ?? status}
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {/* Last verified indicator */}
          {entity?.lastVerifiedAt && (
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Verified {new Date(entity.lastVerifiedAt).toLocaleDateString()}</span>
            </div>
          )}
          {/* Last edited timestamp */}
          {entity?.updatedAt && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              {new Date(entity.updatedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Tabs — driven by template snapshot */}
      <Tabs.Root
        value={state.activeTab}
        onValueChange={handleTabChange}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="border-b bg-white px-2 shrink-0 overflow-x-auto">
          <Tabs.List className="flex h-auto">
            {enabledTabs.map(tab => (
              <Tabs.Trigger
                key={tab.key}
                value={tab.key}
                className={cn(
                  'relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                  'text-slate-500 hover:text-slate-800',
                  'data-[state=active]:text-blue-700',
                  'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5',
                  'after:bg-transparent data-[state=active]:after:bg-blue-600',
                  isTabDirty(tab.key) && 'text-amber-600 data-[state=active]:text-amber-700'
                )}
              >
                {tab.label}
                {tab.cfg.required && (
                  <span className="ml-1 text-blue-400 text-xs" title="Required">*</span>
                )}
                {isTabDirty(tab.key) && (
                  <span className="ml-1 text-amber-500 text-xs">●</span>
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50">
          {enabledTabs.map(({ key, label, Component }) => (
            <Tabs.Content key={key} value={key} className="h-full outline-none">
              <TabErrorBoundary label={label}>
                <Suspense fallback={<TabSkeleton />}>
                  {entityId
                    ? <Component entityId={entityId} />
                    : key === 'general'
                      ? <Component entityId="" />
                      : (
                        <div className="p-8 text-center text-sm text-gray-400">
                          Save the entity first to edit this section.
                        </div>
                      )
                  }
                </Suspense>
              </TabErrorBoundary>
            </Tabs.Content>
          ))}
        </div>
      </Tabs.Root>

      {/* Unsaved-changes modal */}
      <AlertDialog.Root open={!!pendingTab} onOpenChange={o => { if (!o) setPendingTab(null) }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50 animate-in fade-in-0" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <AlertDialog.Title className="text-base font-semibold text-slate-900">
              Unsaved changes
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-slate-600">
              You have unsaved changes in the current tab. Discard them?
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <button onClick={() => setPendingTab(null)}
                  className="rounded px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 transition-colors">
                  Keep Editing
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button onClick={handleDiscard}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors">
                  Discard Changes
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
