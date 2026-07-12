import React, { lazy, Suspense, useCallback, useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Loader2, Clock, AlertCircle } from 'lucide-react'
import { useEntityQuery } from '@/hooks/useEntityQuery'
import { useEditorUI } from '@/contexts/EditorUIContext'
import { WORKFLOW_STATUS_LABELS } from '@/types/entity'
import type { WorkflowStatus } from '@/types/entity'
import { cn } from '@/lib/utils'

// ── Lazy tab components ───────────────────────────────────────────────────────
const GeneralTab          = lazy(() => import('./tabs/GeneralTab').then(m => ({ default: m.GeneralTab })))
const OverviewTab         = lazy(() => import('./tabs/OverviewTab').then(m => ({ default: m.OverviewTab })))
const TimelineTab         = lazy(() => import('./tabs/TimelineTab').then(m => ({ default: m.TimelineTab })))
const EligibilityTab      = lazy(() => import('./tabs/EligibilityTab').then(m => ({ default: m.EligibilityTab })))
const VacancyTab          = lazy(() => import('./tabs/VacancyTab').then(m => ({ default: m.VacancyTab })))
const FeeTab              = lazy(() => import('./tabs/FeeTab').then(m => ({ default: m.FeeTab })))
const ExamPatternTab      = lazy(() => import('./tabs/ExamPatternTab').then(m => ({ default: m.ExamPatternTab })))
const SelectionProcessTab = lazy(() => import('./tabs/SelectionProcessTab').then(m => ({ default: m.SelectionProcessTab })))
const SyllabusTab         = lazy(() => import('./tabs/SyllabusTab').then(m => ({ default: m.SyllabusTab })))
const ModulesTab          = lazy(() => import('./tabs/ModulesTab').then(m => ({ default: m.ModulesTab })))
const DownloadsTab        = lazy(() => import('./tabs/DownloadsTab').then(m => ({ default: m.DownloadsTab })))
const LinksTab            = lazy(() => import('./tabs/LinksTab').then(m => ({ default: m.LinksTab })))
const MediaTab            = lazy(() => import('./tabs/MediaTab').then(m => ({ default: m.MediaTab })))
const SEOTab              = lazy(() => import('./tabs/SEOTab').then(m => ({ default: m.SEOTab })))
const PublishingTab       = lazy(() => import('./tabs/PublishingTab').then(m => ({ default: m.PublishingTab })))

// ── Tab config — ordered per R2.6 ────────────────────────────────────────────
const EDITOR_TABS = [
  { id: 'general',    label: 'General',           Component: GeneralTab },
  { id: 'overview',   label: 'Overview',          Component: OverviewTab },
  { id: 'timeline',   label: 'Timeline',          Component: TimelineTab },
  { id: 'eligibility',label: 'Eligibility',       Component: EligibilityTab },
  { id: 'vacancy',    label: 'Vacancy',           Component: VacancyTab },
  { id: 'fee',        label: 'Fee',               Component: FeeTab },
  { id: 'pattern',    label: 'Exam Pattern',      Component: ExamPatternTab },
  { id: 'selection',  label: 'Selection Process', Component: SelectionProcessTab },
  { id: 'syllabus',   label: 'Syllabus',          Component: SyllabusTab },
  { id: 'modules',    label: 'Content Modules',   Component: ModulesTab },
  { id: 'downloads',  label: 'Downloads',         Component: DownloadsTab },
  { id: 'links',      label: 'Official Links',    Component: LinksTab },
  { id: 'media',      label: 'Media',             Component: MediaTab },
  { id: 'seo',        label: 'SEO',               Component: SEOTab },
  { id: 'publishing', label: 'Publishing',        Component: PublishingTab },
] as const

type TabId = typeof EDITOR_TABS[number]['id']

const STATUS_STYLES: Record<string, string> = {
  draft:        'bg-gray-50 text-gray-600 ring-1 ring-gray-200',
  in_review:    'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
  seo_review:   'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  legal_review: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  scheduled:    'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  published:    'bg-green-50 text-green-700 ring-1 ring-green-200',
  archived:     'bg-red-50 text-red-700 ring-1 ring-red-200',
}

// ── Error boundary per tab ────────────────────────────────────────────────────
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
      <button onClick={onRetry}
        className="text-sm text-blue-600 hover:underline">Retry</button>
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
  const [pendingTab, setPendingTab] = useState<TabId | null>(null)

  const { data: entity, isLoading } = useEntityQuery(entityId)

  const handleTabChange = useCallback((newTab: string) => {
    if (isTabDirty(state.activeTab)) {
      setPendingTab(newTab as TabId)
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
      {/* Persistent header */}
      <div className="border-b bg-white px-6 py-3 flex items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-semibold text-slate-900 truncate">
            {entity?.name ?? 'New Exam'}
          </h1>
          <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize', statusStyle)}>
            {WORKFLOW_STATUS_LABELS[status as WorkflowStatus] ?? status}
          </span>
        </div>
        {entity?.updatedAt && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
            <Clock className="h-3.5 w-3.5" />
            {new Date(entity.updatedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs.Root
        value={state.activeTab}
        onValueChange={handleTabChange}
        className="flex flex-col flex-1 min-h-0"
      >
        {/* Tab list — horizontally scrollable */}
        <div className="border-b bg-white px-2 shrink-0 overflow-x-auto">
          <Tabs.List className="flex h-auto">
            {EDITOR_TABS.map(tab => (
              <Tabs.Trigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  'relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                  'text-slate-500 hover:text-slate-800',
                  'data-[state=active]:text-blue-700',
                  'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5',
                  'after:bg-transparent data-[state=active]:after:bg-blue-600',
                  isTabDirty(tab.id) && 'text-amber-600 data-[state=active]:text-amber-700'
                )}
              >
                {tab.label}
                {isTabDirty(tab.id) && (
                  <span className="ml-1 text-amber-500 text-xs">●</span>
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {EDITOR_TABS.map(({ id, label, Component }) => (
            <Tabs.Content key={id} value={id} className="h-full outline-none">
              <TabErrorBoundary label={label}>
                <Suspense fallback={<TabSkeleton />}>
                  {entityId
                    ? <Component entityId={entityId} />
                    : id === 'general'
                      ? <Component entityId="" />
                      : (
                        <div className="p-8 text-center text-sm text-gray-400">
                          Save the exam first to edit this section.
                        </div>
                      )
                  }
                </Suspense>
              </TabErrorBoundary>
            </Tabs.Content>
          ))}
        </div>
      </Tabs.Root>

      {/* Unsaved-changes confirmation modal */}
      <AlertDialog.Root open={!!pendingTab} onOpenChange={(o) => { if (!o) setPendingTab(null) }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/40 z-50 animate-in fade-in-0" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
            <AlertDialog.Title className="text-base font-semibold text-slate-900">
              Unsaved changes
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-slate-600">
              You have unsaved changes in the current tab. Do you want to discard them or keep editing?
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <button
                  onClick={() => setPendingTab(null)}
                  className="rounded px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 transition-colors">
                  Keep Editing
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={handleDiscard}
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
