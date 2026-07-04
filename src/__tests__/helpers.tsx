/**
 * helpers.tsx — Shared test render utilities.
 *
 * Provides renderWithQuery so every test file gets a fresh QueryClient
 * without boilerplate. Consistent retry/gcTime config prevents test leakage.
 */
import React from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Renders `ui` inside a fresh QueryClientProvider.
 *
 * @param ui - The React element to render.
 * @param queryClient - Optional pre-populated QueryClient (e.g. to seed cache).
 *                      Defaults to a new client with retry=0 and gcTime=0.
 */
export function renderWithQuery(
  ui: React.ReactElement,
  queryClient?: QueryClient
): RenderResult {
  const qc = queryClient ?? new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
  )
}

/** Creates a fresh QueryClient with consistent test defaults. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}
