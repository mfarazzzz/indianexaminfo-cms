/**
 * WorkspaceContext.tsx — Split context for the Editorial Workspace.
 *
 * Two contexts to prevent unnecessary re-renders:
 * - WorkspaceDataContext: entity, snapshot, enabledModules (changes rarely)
 * - WorkspaceNavContext: activeModule, workspace state (changes on navigation)
 *
 * Changing the active module does NOT re-render entity data consumers.
 * Background entity refetches do NOT re-render navigation consumers.
 */
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Entity } from '@/types/entity'
import type { TemplateConfiguration, ModuleVisibilityConfig } from '@/types/lifecycle-template'
import { getAllModules, hasModule, type WorkspaceModuleKey, type ModuleDefinition } from './registry'

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkspaceState =
  | 'initializing'
  | 'loading'
  | 'ready'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'error'

export interface EnabledModule {
  key: WorkspaceModuleKey
  label: string
  icon: string
  group: string
  order: number
  required: boolean
  definition: ModuleDefinition
}

// ── Data Context (entity + snapshot + enabled modules) ────────────────────────

interface WorkspaceDataValue {
  entityId: string
  entity: Entity | null
  snapshot: TemplateConfiguration | null
  enabledModules: EnabledModule[]
  isLoading: boolean
  isError: boolean
}

const WorkspaceDataContext = createContext<WorkspaceDataValue>({
  entityId: '',
  entity: null,
  snapshot: null,
  enabledModules: [],
  isLoading: true,
  isError: false,
})

// ── Nav Context (active module + workspace state) ─────────────────────────────

interface WorkspaceNavValue {
  activeModule: WorkspaceModuleKey
  setActiveModule: (key: WorkspaceModuleKey) => void
  workspaceState: WorkspaceState
  setWorkspaceState: (state: WorkspaceState) => void
}

const WorkspaceNavContext = createContext<WorkspaceNavValue>({
  activeModule: 'general',
  setActiveModule: () => {},
  workspaceState: 'initializing',
  setWorkspaceState: () => {},
})

// ── Provider ──────────────────────────────────────────────────────────────────

interface WorkspaceProviderProps {
  entityId: string
  entity: Entity | null
  isLoading: boolean
  isError: boolean
  children: React.ReactNode
}

export function WorkspaceProvider({
  entityId,
  entity,
  isLoading,
  isError,
  children,
}: WorkspaceProviderProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(
    isLoading ? 'loading' : isError ? 'error' : 'ready'
  )

  // ── Derive snapshot and enabled modules ───────────────────────────────────
  const snapshot = entity?.templateSnapshot ?? null

  const enabledModules = useMemo<EnabledModule[]>(() => {
    const visibility = snapshot?.moduleVisibility
    if (!visibility) {
      // No snapshot yet — show only general
      const genDef = getAllModules().find(m => m.key === 'general')
      if (!genDef) return []
      return [{ key: 'general', label: genDef.label, icon: genDef.icon, group: genDef.group, order: 1, required: true, definition: genDef }]
    }

    const result: EnabledModule[] = []
    for (const [key, cfg] of Object.entries(visibility) as [string, ModuleVisibilityConfig][]) {
      if (!cfg.enabled) continue
      if (!hasModule(key)) continue
      const def = getAllModules().find(m => m.key === key)
      if (!def) continue
      result.push({
        key: key as WorkspaceModuleKey,
        label: def.label,
        icon: def.icon,
        group: def.group,
        order: cfg.displayOrder,
        required: cfg.required,
        definition: def,
      })
    }
    return result.sort((a, b) => a.order - b.order)
  }, [snapshot])

  // ── Active module from URL ────────────────────────────────────────────────
  const urlModule = searchParams.get('module') ?? 'general'
  const activeModule: WorkspaceModuleKey = (
    hasModule(urlModule) && enabledModules.some(m => m.key === urlModule)
      ? urlModule as WorkspaceModuleKey
      : enabledModules[0]?.key ?? 'general'
  )

  const setActiveModule = useCallback((key: WorkspaceModuleKey) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('module', key)
      return next
    }, { replace: true })
  }, [setSearchParams])

  // ── Memoized context values ───────────────────────────────────────────────
  const dataValue = useMemo<WorkspaceDataValue>(() => ({
    entityId,
    entity,
    snapshot,
    enabledModules,
    isLoading,
    isError,
  }), [entityId, entity, snapshot, enabledModules, isLoading, isError])

  const navValue = useMemo<WorkspaceNavValue>(() => ({
    activeModule,
    setActiveModule,
    workspaceState,
    setWorkspaceState,
  }), [activeModule, setActiveModule, workspaceState, setWorkspaceState])

  return (
    <WorkspaceDataContext.Provider value={dataValue}>
      <WorkspaceNavContext.Provider value={navValue}>
        {children}
      </WorkspaceNavContext.Provider>
    </WorkspaceDataContext.Provider>
  )
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Entity data, snapshot, and enabled modules. Changes rarely. */
export function useWorkspaceData(): WorkspaceDataValue {
  return useContext(WorkspaceDataContext)
}

/** Active module and workspace state. Changes on navigation. */
export function useWorkspaceNav(): WorkspaceNavValue {
  return useContext(WorkspaceNavContext)
}
