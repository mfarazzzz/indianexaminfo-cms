/**
 * registry.ts — Strongly-typed Workspace Module Registry
 *
 * The registry is the single source of truth for all workspace modules.
 * WorkspaceShell never contains module-specific logic. Adding a new module
 * requires ONLY: (1) register here, (2) implement the editor component.
 *
 * No switch statements. No hardcoded arrays. Fully plugin-driven.
 */
import type { ComponentType } from 'react'

// ── Module Key (compile-time enforced) ────────────────────────────────────────

export type WorkspaceModuleKey =
  | 'general'
  | 'overview'
  | 'timeline'
  | 'eligibility'
  | 'vacancy'
  | 'fee'
  | 'exam_pattern'
  | 'selection_process'
  | 'syllabus'
  | 'modules'
  | 'downloads'
  | 'links'
  | 'media'
  | 'seo'
  | 'publishing'
  | 'relationships'
  | 'amendments'
  | 'health'
  | 'verification'

// ── Module Group ──────────────────────────────────────────────────────────────

export type ModuleGroup = 'identity' | 'content' | 'structured' | 'assets' | 'workflow'

// ── Editor Props (every editor receives this) ─────────────────────────────────

export interface EditorProps {
  entityId: string
}

// ── Inspector Props ───────────────────────────────────────────────────────────

export interface InspectorProps {
  entityId: string
  moduleKey: WorkspaceModuleKey
}

// ── Module Definition (every module MUST provide all required fields) ──────────

export interface ModuleDefinition {
  /** Unique key — must match moduleVisibility key in template snapshot */
  key: WorkspaceModuleKey
  /** Display label in editorial language (never technical) */
  label: string
  /** Lucide icon name */
  icon: string
  /** Navigation grouping */
  group: ModuleGroup
  /** Display order within group (overridden by templateSnapshot.moduleVisibility.displayOrder) */
  defaultOrder: number
  /** Lazy-loaded editor component */
  editor: () => Promise<{ default: ComponentType<EditorProps> }>
  /** Lazy-loaded inspector component (null = use default inspector) */
  inspector: (() => Promise<{ default: ComponentType<InspectorProps> }>) | null
  /** Permission required to view this module (null = no restriction) */
  permission: string | null
  /** Whether this module supports the health widget in inspector */
  hasHealthWidget: boolean
}

// ── Registry ──────────────────────────────────────────────────────────────────

const registry = new Map<WorkspaceModuleKey, ModuleDefinition>()

/**
 * Register a workspace module. Called once per module at app initialization.
 * The registry enforces complete ModuleDefinition — TypeScript prevents
 * incomplete registrations at compile time.
 */
export function registerModule(def: ModuleDefinition): void {
  registry.set(def.key, def)
}

/**
 * Get a module definition. Returns undefined for unregistered keys.
 */
export function getModule(key: WorkspaceModuleKey): ModuleDefinition | undefined {
  return registry.get(key)
}

/**
 * Get all registered modules as an array.
 */
export function getAllModules(): ModuleDefinition[] {
  return Array.from(registry.values())
}

/**
 * Check if a module key is registered.
 */
export function hasModule(key: string): key is WorkspaceModuleKey {
  return registry.has(key as WorkspaceModuleKey)
}

/**
 * Get modules filtered by group, sorted by defaultOrder.
 */
export function getModulesByGroup(group: ModuleGroup): ModuleDefinition[] {
  return getAllModules()
    .filter(m => m.group === group)
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
}

// ── Placeholder Editor (used during Phase 2 — replaced in Phase 3) ────────────

export const PlaceholderEditor: ComponentType<EditorProps> = ({ entityId }) => {
  // Inline component — will be tree-shaken when real editors are registered
  return null
}
