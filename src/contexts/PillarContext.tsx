/**
 * PillarContext — provides the active pillar list to all components in the
 * EntityEditorShell tree without prop drilling or per-component queries.
 *
 * The shell fetches pillars once via usePillars() and provides them here.
 * Components that need pillar data (GeneralTab, Sidebar, etc.) consume this
 * context instead of calling usePillars() individually — avoids duplicate
 * queries and fake-timer interference in tests.
 *
 * REQ-001: Database-driven pillars
 */
import React, { createContext, useContext } from 'react'
import type { Pillar } from '@/types/pillar'

interface PillarContextValue {
  pillars: Pillar[]
}

const PillarContext = createContext<PillarContextValue>({ pillars: [] })

export function PillarProvider({
  pillars,
  children,
}: {
  pillars: Pillar[]
  children: React.ReactNode
}) {
  return (
    <PillarContext.Provider value={{ pillars }}>
      {children}
    </PillarContext.Provider>
  )
}

/** Returns the pillar list from the nearest PillarProvider, or [] if none. */
export function usePillarContext(): Pillar[] {
  return useContext(PillarContext).pillars
}
