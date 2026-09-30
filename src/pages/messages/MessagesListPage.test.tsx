/**
 * MessagesListPage.test.tsx — the P3-1 grid rules, rendered from a mocked
 * service only (no Supabase). Every assertion pins a line of the owner brief:
 * counts per status above the grid, the full column set, server-side sort and
 * 50-per-page pagination, per-column filters + global search, inline status /
 * assignee edits, multi-select bulk actions, the manage_settings export gate,
 * and the deep-link contract used by the editor/bulletin hooks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { MessagesListPage } from './MessagesListPage'
import type { ReaderMessage } from '@/services/readerMessageService'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const svc = vi.hoisted(() => ({
  listReaderMessages: vi.fn(),
  statusCounts: vi.fn(),
  exportReaderMessagesCsv: vi.fn(),
  exportReaderMessagesXlsx: vi.fn(),
  updateStatus: vi.fn(),
  updateAssignee: vi.fn(),
  bulkUpdateStatus: vi.fn(),
  bulkAssign: vi.fn(),
  listNotes: vi.fn(async () => []),
  listEvents: vi.fn(async () => []),
  addNote: vi.fn(),
  updatePriority: vi.fn(),
  deleteReaderMessage: vi.fn(),
}))
vi.mock('@/services/readerMessageService', () => svc)

vi.mock('@/services/userService', () => ({
  getUserProfiles: vi.fn(async () => [
    { id: 'u1', name: 'Faraz', email: 'faraz@x.in' },
    { id: 'u2', name: 'Asha', email: 'asha@x.in' },
  ]),
}))

const auth = vi.hoisted(() => ({ permissions: [] as string[], id: 'user-1' }))
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: auth.id, email: 'e@x.in', profile: { name: 'Faraz', permissions: auth.permissions } },
    permissions: auth.permissions,
    isLoading: false,
    signIn: vi.fn(), signOut: vi.fn(), refreshUser: vi.fn(),
  }),
}))
vi.mock('@/hooks/usePermission', () => ({
  usePermission: (perm: string) => auth.permissions.includes(perm),
}))

const message = (over: Partial<ReaderMessage> = {}): ReaderMessage => ({
  id: 'm1', refNumber: 'IEI-AAAAA', source: 'page_report',
  category: 'report_error', reason: 'wrong_last_date',
  message: 'The last date shown is wrong, please fix.',
  senderName: 'Ravi', senderEmail: 'ravi@example.com', senderPhone: '+919876543210',
  pageUrl: 'https://www.indianexaminfo.com/sarkari-naukri/up-police-2026',
  pageTitle: 'UP Police Constable Recruitment 2026',
  entityType: 'sarkari_naukri', entityId: 'e-1',
  consent: true, status: 'new', assignee: null, assigneeName: null,
  priority: 'normal', createdAt: '2026-09-27T10:30:00Z', ...over,
})

function renderPage(entry = '/messages') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/messages" element={<MessagesListPage />} />
        <Route path="/vacancies/:id" element={<div>vacancy editor</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.permissions = ['handle_messages']
  svc.listReaderMessages.mockResolvedValue({ data: [message()], count: 1 })
  svc.statusCounts.mockResolvedValue({
    new: 3, in_progress: 1, waiting_on_reader: 0,
    resolved: 5, wont_fix: 0, spam: 2,
  })
  svc.updateStatus.mockResolvedValue(undefined)
  svc.updateAssignee.mockResolvedValue(undefined)
  svc.bulkUpdateStatus.mockResolvedValue({ done: 1, failed: 0 })
  svc.bulkAssign.mockResolvedValue({ done: 1, failed: 0 })
  svc.exportReaderMessagesCsv.mockResolvedValue(undefined)
  svc.exportReaderMessagesXlsx.mockResolvedValue(undefined)
  localStorage.clear()
})

describe('MessagesListPage — counts and columns', () => {
  it('shows the per-status counts above the grid', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('New: 3')).toBeInTheDocument())
    expect(screen.getByText('Spam: 2')).toBeInTheDocument()
    // Open = new + in_progress + waiting_on_reader = 4
    expect(screen.getByText('Open: 4')).toBeInTheDocument()
  })

  it('renders the full spec column set as rows, not cards', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('IEI-AAAAA')).toBeInTheDocument())
    for (const header of [
      'Date / time', 'Ref', 'Category', 'Reason', 'Page', 'Message',
      'Name', 'Email', 'Phone', 'Status', 'Assignee', 'Source',
    ]) {
      expect(screen.getByRole('columnheader', { name: new RegExp(header) })).toBeInTheDocument()
    }
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('links the page column to the reported page', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('IEI-AAAAA')).toBeInTheDocument())
    const link = screen.getByRole('link', { name: 'UP Police Constable Recruitment 2026' })
    expect(link).toHaveAttribute('href', 'https://www.indianexaminfo.com/sarkari-naukri/up-police-2026')
  })
})

describe('MessagesListPage — server-side sort and pagination', () => {
  it('asks the server for created_at desc by default, 50 per page', async () => {
    renderPage()
    await waitFor(() => expect(svc.listReaderMessages).toHaveBeenCalled())
    expect(svc.listReaderMessages).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0, sortCol: 'createdAt', sortDir: 'desc' }),
    )
  })

  it('re-queries with the clicked sort column', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('IEI-AAAAA')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^Ref/ }))
    await waitFor(() => expect(svc.listReaderMessages).toHaveBeenCalledWith(
      expect.objectContaining({ sortCol: 'refNumber' }),
    ))
  })

  it('pages with offset 50 on Next', async () => {
    svc.listReaderMessages.mockResolvedValue({
      data: Array.from({ length: 50 }, (_, i) => message({ id: `m${i}`, refNumber: `IEI-${i}` })),
      count: 120,
    })
    renderPage()
    await waitFor(() => expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(svc.listReaderMessages).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 50 }),
    ))
  })
})

describe('MessagesListPage — inline and bulk edits', () => {
  it('edits status inline through the service (which writes the event)', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('IEI-AAAAA')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Status for IEI-AAAAA'), { target: { value: 'in_progress' } })
    await waitFor(() => expect(svc.updateStatus).toHaveBeenCalledWith('m1', 'in_progress'))
  })

  it('edits assignee inline', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('IEI-AAAAA')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Assignee for IEI-AAAAA'), { target: { value: 'u2' } })
    await waitFor(() => expect(svc.updateAssignee).toHaveBeenCalledWith('m1', 'u2'))
  })

  it('multi-selects rows and marks them spam in one bulk action', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('IEI-AAAAA')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Select row'))
    fireEvent.click(await screen.findByRole('button', { name: 'Mark spam' }))
    await waitFor(() => expect(svc.bulkUpdateStatus).toHaveBeenCalledWith(['m1'], 'spam'))
  })

  it('bulk-assigns the selection', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('IEI-AAAAA')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Select row'))
    fireEvent.change(await screen.findByLabelText('Bulk assign'), { target: { value: 'u1' } })
    await waitFor(() => expect(svc.bulkAssign).toHaveBeenCalledWith(['m1'], 'u1'))
  })
})

describe('MessagesListPage — filters and deep links', () => {
  it('sends the global search to the server', async () => {
    renderPage()
    await waitFor(() => expect(svc.listReaderMessages).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Global search'), { target: { value: 'ravi@example.com' } })
    await waitFor(() => expect(svc.listReaderMessages).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'ravi@example.com' }),
    ))
  })

  it('filters by category, source and date range', async () => {
    renderPage()
    await waitFor(() => expect(svc.listReaderMessages).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: 'report_error' } })
    fireEvent.change(screen.getByLabelText('Filter by source'), { target: { value: 'page_report' } })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } })
    await waitFor(() => expect(svc.listReaderMessages).toHaveBeenLastCalledWith(
      expect.objectContaining({
        category: 'report_error', source: 'page_report', dateFrom: '2026-09-01T00:00:00.000Z',
      }),
    ))
  })

  it('honours the editor deep-link: entity_id + status=open', async () => {
    renderPage('/messages?entity_id=e-1&status=open')
    await waitFor(() => expect(svc.listReaderMessages).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'e-1', statuses: ['new', 'in_progress', 'waiting_on_reader'] }),
    ))
  })

  it('honours the bulletin deep-link: ?ref= pre-fills the search', async () => {
    renderPage('/messages?ref=IEI-AAAAA')
    await waitFor(() => expect(svc.listReaderMessages).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'IEI-AAAAA' }),
    ))
  })
})

describe('MessagesListPage — export gate', () => {
  it('shows both download buttons only for manage_settings holders', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('IEI-AAAAA')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument()
    auth.permissions = ['handle_messages', 'manage_settings']
    renderPage()
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Download CSV' })).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Download XLSX' })).toBeInTheDocument()
  })

  it('exports the current filtered + sorted view without the page window', async () => {
    auth.permissions = ['handle_messages', 'manage_settings']
    renderPage()
    await waitFor(() => expect(screen.getByText('IEI-AAAAA')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Download XLSX' }))
    await waitFor(() => expect(svc.exportReaderMessagesXlsx).toHaveBeenCalledWith(
      expect.objectContaining({ sortCol: 'createdAt', sortDir: 'desc' }),
    ))
    const opts = svc.exportReaderMessagesXlsx.mock.calls[0][0]
    expect(opts.limit).toBeUndefined()
    expect(opts.offset).toBeUndefined()
  })
})

describe('MessagesListPage — row click opens the panel', () => {
  it('opens the detail drawer with the reply template and editor link', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('IEI-AAAAA')).toBeInTheDocument())
    fireEvent.click(screen.getByText('The last date shown is wrong, please fix.'))
    const reply = await screen.findByRole('link', { name: 'Reply by email' })
    expect(reply.getAttribute('href')).toContain('mailto:ravi@example.com')
    expect(decodeURIComponent(reply.getAttribute('href')!)).toContain('reference: IEI-AAAAA')
    expect(screen.getByRole('link', { name: 'Open in editor' })).toHaveAttribute('href', '/vacancies/e-1')
  })
})
