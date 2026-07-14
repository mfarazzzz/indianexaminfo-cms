/**
 * WorkspaceShell.tsx — The main Editorial Workspace layout.
 *
 * 5-region responsive layout:
 * ┌──────────────────────────────────────────────┐
 * │                Top Toolbar                    │
 * ├────────┬─────────────────────┬───────────────┤
 * │  Nav   │    Editor Area      │   Inspector   │
 * ├────────┴─────────────────────┴───────────────┤
 * │              Status Bar                       │
 * └──────────────────────────────────────────────┘
 *
 * All navigation is driven by MODULE_REGISTRY + templateSnapshot.moduleVisibility.
 * No hardcoded module logic lives here.
 */
import React, { Suspense, lazy, useMemo, useState, useCallback } from 'react'
import { Loader2, PanelLeftClose, PanelRightClose } from 'lucide-react'
import { useWorkspaceData, useWorkspaceNav } from './WorkspaceContext'
import { getModule, type WorkspaceModuleKey } from './registry'
import { ResizablePanel } from './ResizablePanel'
import { InspectorRouter } from './InspectorRouter'
import { cn } from '@/lib/utils'

// ── Sub-components (inline for Phase 2 — extracted in Phase 3+) ───────────────

function TopToolbar() {
  const { entity } = useWorkspaceData()
  const { workspaceState } = useWorkspaceNav()

  return (
    <header
      className="h-14 border-b bg-white px-4 flex items-center justify-between gap-4 shrink-0"
      role="banner"
      aria-label="Workspace toolbar"
    >
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-base font-semibold text-slate-900 truncate">
          {entity?.name ?? 'Loading...'}
        </h1>
        {entity?.workflowStatus && (
          <span className={cn(
            'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize',
            entity.workflowStatus === 'published' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' :
            entity.workflowStatus === 'review'    ? 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200' :
            'bg-gray-50 text-gray-600 ring-1 ring-gray-200'
          )}>
            {entity.workflowStatus === 'review' ? 'In Review' : entity.workflowStatus}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {workspaceState === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>}
        {workspaceState === 'saved' && <span className="text-green-600">Saved ✓</span>}
        {workspaceState === 'dirty' && <span className="text-amber-500">Unsaved changes</span>}
        {workspaceState === 'offline' && <span className="text-red-500">Offline</span>}
      </div>
    </header>
  )
}

function NavigationPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { enabledModules } = useWorkspaceData()
  const { activeModule, setActiveModule } = useWorkspaceNav()

  // Group modules by group
  const groups = useMemo(() => {
    const map = new Map<string, typeof enabledModules>()
    for (const mod of enabledModules) {
      const list = map.get(mod.group) ?? []
      list.push(mod)
      map.set(mod.group, list)
    }
    return map
  }, [enabledModules])

  const groupLabels: Record<string, string> = {
    identity: 'Identity',
    structured: 'Structured Data',
    content: 'Content',
    assets: 'Assets',
    workflow: 'Workflow',
  }

  return (
    <nav
      className="h-full w-full bg-white overflow-y-auto"
      aria-label="Module navigation"
      role="navigation"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Modules</span>
        <button onClick={onToggle} className="p-1 hover:bg-slate-100 rounded" aria-label="Collapse navigation">
          <PanelLeftClose className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>
      <div className="py-2">
        {Array.from(groups.entries()).map(([group, modules]) => (
          <div key={group} className="mb-3">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {groupLabels[group] ?? group}
            </p>
            {modules.map(mod => (
              <button
                key={mod.key}
                onClick={() => setActiveModule(mod.key)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left',
                  activeModule === mod.key
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
                aria-current={activeModule === mod.key ? 'page' : undefined}
              >
                <span className="truncate">{mod.label}</span>
                {mod.required && <span className="text-blue-400 text-xs" title="Required">*</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}

function EditorArea() {
  const { entityId } = useWorkspaceData()
  const { activeModule } = useWorkspaceNav()

  const moduleDef = getModule(activeModule)

  if (!moduleDef) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        Module not found
      </div>
    )
  }

  // Lazy load the editor for the active module
  const LazyEditor = useMemo(
    () => lazy(moduleDef.editor),
    [moduleDef]
  )

  return (
    <main
      className="flex-1 overflow-y-auto bg-slate-50"
      role="main"
      aria-label={`${moduleDef.label} editor`}
    >
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      }>
        <LazyEditor entityId={entityId} />
      </Suspense>
    </main>
  )
}

function InspectorPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className="h-full w-full bg-white overflow-y-auto"
      role="complementary"
      aria-label="Inspector panel"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Inspector</span>
        <button onClick={onToggle} className="p-1 hover:bg-slate-100 rounded" aria-label="Collapse inspector">
          <PanelRightClose className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>
      <InspectorRouter />
    </aside>
  )
}

function StatusBar() {
  const { workspaceState } = useWorkspaceNav()
  const { entity } = useWorkspaceData()

  return (
    <footer
      className="h-7 border-t bg-white px-4 flex items-center justify-between text-[11px] text-slate-400 shrink-0"
      role="contentinfo"
      aria-label="Workspace status"
    >
      <div className="flex items-center gap-3">
        <span className="capitalize">{workspaceState}</span>
        {entity?.updatedAt && (
          <span>Last saved: {new Date(entity.updatedAt).toLocaleTimeString()}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span>⌘K Search</span>
        <span>⌘S Save</span>
      </div>
    </footer>
  )
}

// ── Main Shell ────────────────────────────────────────────────────────────────

export function WorkspaceShell() {
  const { isLoading, isError } = useWorkspaceData()
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-slate-600">Failed to load content. Please try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-blue-600 hover:underline"
        >
          Reload
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopToolbar />
      <div className="flex flex-1 min-h-0">
        <ResizablePanel
          storageKey="workspace-nav"
          defaultWidth={224}
          minWidth={180}
          maxWidth={360}
          handleSide="right"
          collapsed={navCollapsed}
        >
          <NavigationPanel
            collapsed={false}
            onToggle={() => setNavCollapsed(true)}
          />
        </ResizablePanel>
        {navCollapsed && (
          <button
            onClick={() => setNavCollapsed(false)}
            className="h-full w-10 border-r bg-white flex items-center justify-center hover:bg-slate-50 shrink-0"
            aria-label="Expand navigation"
          >
            <PanelLeftClose className="h-4 w-4 text-slate-400 rotate-180" />
          </button>
        )}
        <EditorArea />
        {inspectorCollapsed && (
          <button
            onClick={() => setInspectorCollapsed(false)}
            className="h-full w-10 border-l bg-white flex items-center justify-center hover:bg-slate-50 shrink-0"
            aria-label="Expand inspector"
          >
            <PanelRightClose className="h-4 w-4 text-slate-400 rotate-180" />
          </button>
        )}
        <ResizablePanel
          storageKey="workspace-inspector"
          defaultWidth={288}
          minWidth={200}
          maxWidth={480}
          handleSide="left"
          collapsed={inspectorCollapsed}
        >
          <InspectorPanel
            collapsed={false}
            onToggle={() => setInspectorCollapsed(true)}
          />
        </ResizablePanel>
      </div>
      <StatusBar />
    </div>
  )
}
