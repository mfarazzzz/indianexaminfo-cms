/**
 * workspace/index.ts — Public API for the workspace module.
 */
export { WorkspaceShell } from './WorkspaceShell'
export { WorkspaceProvider, useWorkspaceData, useWorkspaceNav } from './WorkspaceContext'
export { initializeModuleRegistry } from './registerModules'
export { registerModule, getModule, getAllModules, hasModule } from './registry'
export type { WorkspaceModuleKey, ModuleDefinition, EditorProps, InspectorProps } from './registry'
