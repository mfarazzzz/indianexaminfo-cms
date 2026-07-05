/**
 * ModulesTab.test.tsx — Component tests for ModulesTab.
 * All service calls mocked. Uses renderWithQuery helper.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithQuery } from '@/__tests__/helpers'
import { makeModule } from '@/__tests__/fixtures'
import { ModulesTab } from './ModulesTab'

vi.mock('@/services/entity/moduleService', () => ({
  listModules:      vi.fn(),
  createModule:     vi.fn(),
  updateModule:     vi.fn(),
  softDeleteModule: vi.fn(),
  reorderModules:   vi.fn(),
  publishModule:    vi.fn(),
  duplicateModule:  vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import {
  listModules, createModule, softDeleteModule,
} from '@/services/entity/moduleService'

const mockList   = vi.mocked(listModules)
const mockCreate = vi.mocked(createModule)
const mockDelete = vi.mocked(softDeleteModule)

beforeEach(() => vi.clearAllMocks())

describe('ModulesTab — load states', () => {
  it('shows loading skeleton while query is pending', () => {
    mockList.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<ModulesTab entityId="ent-1" />)
    expect(screen.getByLabelText('Loading modules')).toBeInTheDocument()
  })

  it('shows empty state when no modules exist', async () => {
    mockList.mockResolvedValue([])
    renderWithQuery(<ModulesTab entityId="ent-1" />)
    await waitFor(() => expect(screen.getByText('No modules yet')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /add first module/i })).toBeInTheDocument()
  })

  it('renders module count when modules exist', async () => {
    mockList.mockResolvedValue([
      makeModule({ id: 'mod-1', moduleType: 'overview' }),
      makeModule({ id: 'mod-2', moduleType: 'faq' }),
    ])
    renderWithQuery(<ModulesTab entityId="ent-1" />)
    await waitFor(() => expect(screen.getByText('2 modules')).toBeInTheDocument())
  })

  it('shows error banner + retry on fetch failure', async () => {
    mockList.mockRejectedValue(new Error('Network error'))
    renderWithQuery(<ModulesTab entityId="ent-1" />)
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})

describe('ModulesTab — create module', () => {
  it('clicking Add Module shows inline create form', async () => {
    mockList.mockResolvedValue([])
    renderWithQuery(<ModulesTab entityId="ent-1" />)
    await waitFor(() => screen.getByRole('button', { name: /add first module/i }))
    await userEvent.click(screen.getByRole('button', { name: /add module/i }))
    expect(screen.getByPlaceholderText('e.g. overview')).toBeInTheDocument()
  })

  it('submits form and calls createModule', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockResolvedValue(makeModule({ id: 'new', moduleType: 'overview' }))
    renderWithQuery(<ModulesTab entityId="ent-1" />)
    await waitFor(() => screen.getByRole('button', { name: /add first module/i }))
    await userEvent.click(screen.getAllByRole('button', { name: /add module/i })[0])

    const input = screen.getByPlaceholderText('e.g. overview')
    await userEvent.type(input, 'overview')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(
      'ent-1', expect.objectContaining({ moduleType: 'overview' })
    ))
  })

  it('shows inline error when duplicate-type error occurs', async () => {
    mockList.mockResolvedValue([])
    mockCreate.mockRejectedValue(new Error('A sub-title is required'))
    renderWithQuery(<ModulesTab entityId="ent-1" />)
    await waitFor(() => screen.getByRole('button', { name: /add first module/i }))
    await userEvent.click(screen.getAllByRole('button', { name: /add module/i })[0])
    await userEvent.type(screen.getByPlaceholderText('e.g. overview'), 'overview')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(screen.getByText(/sub-title/i)).toBeInTheDocument())
    // Form stays open
    expect(screen.getByPlaceholderText('e.g. overview')).toBeInTheDocument()
  })

  it('cancel hides create form without service call', async () => {
    mockList.mockResolvedValue([])
    renderWithQuery(<ModulesTab entityId="ent-1" />)
    await waitFor(() => screen.getByRole('button', { name: /add first module/i }))
    await userEvent.click(screen.getAllByRole('button', { name: /add module/i })[0])
    expect(screen.getByPlaceholderText('e.g. overview')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByPlaceholderText('e.g. overview')).not.toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('ModulesTab — delete module', () => {
  it('clicking Delete opens ConfirmDialog', async () => {
    mockList.mockResolvedValue([makeModule({ id: 'mod-1', moduleType: 'overview' })])
    renderWithQuery(<ModulesTab entityId="ent-1" />)
    await waitFor(() => expect(screen.getByText('1 module')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /delete module/i }))
    await waitFor(() => expect(screen.getByText(/delete module\?/i)).toBeInTheDocument())
  })

  it('confirming calls softDeleteModule', async () => {
    mockList.mockResolvedValue([makeModule({ id: 'mod-1', moduleType: 'overview' })])
    mockDelete.mockResolvedValue(undefined)
    renderWithQuery(<ModulesTab entityId="ent-1" />)
    await waitFor(() => expect(screen.getByText('1 module')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /delete module/i }))
    await waitFor(() => screen.getByText(/delete module\?/i))
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('mod-1'))
  })

  it('cancelling keeps module in list', async () => {
    mockList.mockResolvedValue([makeModule({ id: 'mod-1', moduleType: 'overview' })])
    renderWithQuery(<ModulesTab entityId="ent-1" />)
    await waitFor(() => expect(screen.getByText('1 module')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /delete module/i }))
    await waitFor(() => screen.getByText(/delete module\?/i))
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.getByText('1 module')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
