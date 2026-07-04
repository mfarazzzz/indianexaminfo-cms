/**
 * EditorUIContext — Shared UI state for the EntityEditorShell.
 * Tracks dirty tabs and bulk selection without a Zustand dependency.
 */
import React, {
  createContext, useContext, useReducer, useCallback
} from 'react'

interface EditorUIState {
  activeTab: string
  dirtyTabs: Set<string>
  bulkSelected: Set<string>
}

type EditorUIAction =
  | { type: 'SET_TAB';          tab: string }
  | { type: 'MARK_DIRTY';       tab: string }
  | { type: 'CLEAR_DIRTY';      tab: string }
  | { type: 'CLEAR_ALL_DIRTY' }
  | { type: 'TOGGLE_BULK';      id: string }
  | { type: 'SELECT_ALL_BULK';  ids: string[] }
  | { type: 'CLEAR_BULK' }

function reducer(state: EditorUIState, action: EditorUIAction): EditorUIState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab }
    case 'MARK_DIRTY': {
      const next = new Set(state.dirtyTabs); next.add(action.tab)
      return { ...state, dirtyTabs: next }
    }
    case 'CLEAR_DIRTY': {
      const next = new Set(state.dirtyTabs); next.delete(action.tab)
      return { ...state, dirtyTabs: next }
    }
    case 'CLEAR_ALL_DIRTY':
      return { ...state, dirtyTabs: new Set() }
    case 'TOGGLE_BULK': {
      const next = new Set(state.bulkSelected)
      next.has(action.id) ? next.delete(action.id) : next.add(action.id)
      return { ...state, bulkSelected: next }
    }
    case 'SELECT_ALL_BULK':
      return { ...state, bulkSelected: new Set(action.ids) }
    case 'CLEAR_BULK':
      return { ...state, bulkSelected: new Set() }
    default:
      return state
  }
}

interface EditorUIContextValue {
  state: EditorUIState
  setActiveTab: (tab: string) => void
  markDirty: (tab: string) => void
  clearDirty: (tab: string) => void
  clearAllDirty: () => void
  toggleBulk: (id: string) => void
  selectAllBulk: (ids: string[]) => void
  clearBulk: () => void
  isTabDirty: (tab: string) => boolean
}

const EditorUIContext = createContext<EditorUIContextValue | null>(null)

export function EditorUIProvider({
  children,
  defaultTab = 'general',
}: {
  children: React.ReactNode
  defaultTab?: string
}) {
  const [state, dispatch] = useReducer<React.Reducer<EditorUIState, EditorUIAction>>(reducer, {
    activeTab: defaultTab,
    dirtyTabs: new Set(),
    bulkSelected: new Set(),
  })

  const setActiveTab  = useCallback((tab: string) => dispatch({ type: 'SET_TAB', tab }), [])
  const markDirty     = useCallback((tab: string) => dispatch({ type: 'MARK_DIRTY', tab }), [])
  const clearDirty    = useCallback((tab: string) => dispatch({ type: 'CLEAR_DIRTY', tab }), [])
  const clearAllDirty = useCallback(() => dispatch({ type: 'CLEAR_ALL_DIRTY' }), [])
  const toggleBulk    = useCallback((id: string) => dispatch({ type: 'TOGGLE_BULK', id }), [])
  const selectAllBulk = useCallback((ids: string[]) => dispatch({ type: 'SELECT_ALL_BULK', ids }), [])
  const clearBulk     = useCallback(() => dispatch({ type: 'CLEAR_BULK' }), [])
  const isTabDirty    = useCallback((tab: string) => state.dirtyTabs.has(tab), [state.dirtyTabs])

  return (
    <EditorUIContext.Provider value={{
      state, setActiveTab, markDirty, clearDirty, clearAllDirty,
      toggleBulk, selectAllBulk, clearBulk, isTabDirty,
    }}>
      {children}
    </EditorUIContext.Provider>
  )
}

export function useEditorUI() {
  const ctx = useContext(EditorUIContext)
  if (!ctx) throw new Error('useEditorUI must be used within EditorUIProvider')
  return ctx
}
