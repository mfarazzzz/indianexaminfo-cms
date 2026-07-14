/**
 * inspectorRegistry.ts — Typed Inspector Registry.
 *
 * Every workspace module can register an inspector definition with:
 * - component (lazy-loaded)
 * - widgets (reusable metric/action cards)
 * - validation cards
 * - health cards
 *
 * InspectorRouter resolves from this registry. No switch statements anywhere.
 */
import type { ComponentType } from 'react'
import type { WorkspaceModuleKey } from '../registry'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InspectorWidgetDef {
  key: string
  label: string
  component: ComponentType<{ entityId: string }>
  order: number
}

export interface InspectorActionDef {
  key: string
  label: string
  icon?: string
  variant: 'primary' | 'secondary' | 'danger'
  handler: string // action key resolved at runtime
  order: number
}

export interface InspectorDefinition {
  /** Module key this inspector belongs to */
  moduleKey: WorkspaceModuleKey
  /** Main inspector component — receives entityId + moduleKey */
  component: ComponentType<{ entityId: string; moduleKey: string }>
  /** Optional metric widgets shown above the main content */
  widgets: InspectorWidgetDef[]
  /** Optional action buttons */
  actions: InspectorActionDef[]
}

// ── Registry ──────────────────────────────────────────────────────────────────

const inspectorRegistry = new Map<WorkspaceModuleKey, InspectorDefinition>()

export function registerInspector(def: InspectorDefinition): void {
  inspectorRegistry.set(def.moduleKey, def)
}

export function getInspector(key: WorkspaceModuleKey): InspectorDefinition | undefined {
  return inspectorRegistry.get(key)
}

export function hasInspector(key: string): boolean {
  return inspectorRegistry.has(key as WorkspaceModuleKey)
}

export function getAllInspectors(): InspectorDefinition[] {
  return Array.from(inspectorRegistry.values())
}
