/**
 * readerMessageService.ts — staff-side CRUD for `reader_messages` (S0-5 Part 3).
 * No React imports. Business logic only.
 *
 * CONTRACT (owner brief + supabase/proposed/reader_messages.sql):
 *   • The ONLY writer of new messages is the public `submit-message` edge
 *     function (service role). There is deliberately NO insert path here —
 *     RLS grants none, and adding one would be a silent lie about the write
 *     surface. Staff read/triage/annotate; they do not author reader messages.
 *   • read/update  = handle_messages
 *   • delete       = manage_settings  (enforced by RLS; the UI gates too)
 *   • export (CSV) = manage_settings  (UI gate; download of rows the caller can read)
 *   • every status/assignee/priority change writes a `contact_message_events`
 *     row (who + when); free-text notes live in `contact_message_notes`.
 *
 * actor/author id comes from the signed-in user (auth.uid()); RLS rejects an
 * event/note whose actor is not self, so we never accept a caller-supplied id.
 */
import { db, supabase } from '@/lib/supabase/client';

// ── Types ────────────────────────────────────────────────────────────────────

export type ReaderMessageSource = 'contact_form' | 'report_sheet';
export type ReaderMessageCategory =
  | 'report_error' | 'suggest_update' | 'general_question'
  | 'technical_problem' | 'advertising' | 'legal_removal';
export type ReaderMessageReason =
  | 'wrong_last_date' | 'broken_link' | 'wrong_eligibility'
  | 'missing_result' | 'other';
export type ReaderMessageStatus =
  | 'new' | 'triage' | 'in_progress' | 'resolved' | 'wont_fix';
export type ReaderMessagePriority = 'low' | 'normal' | 'high';

export interface ReaderMessage {
  id: string;
  refNumber: string;
  source: ReaderMessageSource;
  category: ReaderMessageCategory;
  reason: ReaderMessageReason | null;
  message: string;
  senderName: string | null;
  senderEmail: string | null;
  senderPhone: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  entityType: string | null;
  entityId: string | null;
  consent: boolean;
  status: ReaderMessageStatus;
  assignee: string | null;
  priority: ReaderMessagePriority;
  createdAt: string;
}

export interface MessageNote {
  id: string;
  messageId: string;
  authorId: string;
  authorName: string;
  note: string;
  createdAt: string;
}

export interface MessageEvent {
  id: string;
  messageId: string;
  actorId: string | null;
  actorName: string;
  event: 'created' | 'status_changed' | 'assignee_changed' | 'priority_changed';
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface ListOpts {
  status?: string;
  category?: string;
  source?: string;
  priority?: string;
  assignee?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ── Row mapper ─────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): ReaderMessage {
  return {
    id:           r.id as string,
    refNumber:    r.ref_number as string,
    source:       r.source as ReaderMessageSource,
    category:     r.category as ReaderMessageCategory,
    reason:       (r.reason as ReaderMessageReason) ?? null,
    message:      r.message as string,
    senderName:   (r.sender_name as string) ?? null,
    senderEmail:  (r.sender_email as string) ?? null,
    senderPhone:  (r.sender_phone as string) ?? null,
    pageUrl:      (r.page_url as string) ?? null,
    pageTitle:    (r.page_title as string) ?? null,
    entityType:   (r.entity_type as string) ?? null,
    entityId:     (r.entity_id as string) ?? null,
    consent:      Boolean(r.consent),
    status:       r.status as ReaderMessageStatus,
    assignee:     (r.assignee as string) ?? null,
    priority:     r.priority as ReaderMessagePriority,
    createdAt:    r.created_at as string,
  };
}

/** Resolve auth.users ids to display names from public.user_profiles. */
async function namesFor(ids: (string | null)[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;
  const { data } = await db
    .from('user_profiles')
    .select('id, name')
    .in('id', uniq);
  for (const p of data ?? []) map.set((p as any).id, (p as any).name ?? '');
  return map;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listReaderMessages(
  opts: ListOpts = {}
): Promise<{ data: ReaderMessage[]; count: number }> {
  let q = db
    .from('reader_messages')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (opts.status)   q = q.eq('status', opts.status);
  if (opts.category) q = q.eq('category', opts.category);
  if (opts.source)   q = q.eq('source', opts.source);
  if (opts.priority) q = q.eq('priority', opts.priority);
  if (opts.assignee) q = q.eq('assignee', opts.assignee);
  if (opts.search) {
    // ilike across the human reference, the message body, and the sender email
    const s = `%${opts.search}%`;
    q = q.or(`ref_number.ilike.${s},message.ilike.${s},sender_email.ilike.${s},sender_name.ilike.${s}`);
  }
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);
  else if (opts.limit) q = q.limit(opts.limit);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: (data ?? []).map((r: any) => mapRow(r)), count: count ?? 0 };
}

// ── Notes ──────────────────────────────────────────────────────────────────────

export async function listNotes(messageId: string): Promise<MessageNote[]> {
  const { data, error } = await db
    .from('contact_message_notes')
    .select('*')
    .eq('message_id', messageId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const names = await namesFor(rows.map((r) => r.author_id as string));
  return rows.map((r) => ({
    id:         r.id as string,
    messageId:  r.message_id as string,
    authorId:   r.author_id as string,
    authorName: names.get(r.author_id as string) ?? 'Unknown',
    note:       r.note as string,
    createdAt:  r.created_at as string,
  }));
}

export async function addNote(messageId: string, note: string): Promise<void> {
  const trimmed = note.trim();
  if (trimmed.length < 1) throw new Error('Note cannot be empty.');
  if (trimmed.length > 2000) throw new Error('Note is too long (max 2000 characters).');
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) throw new Error('Not signed in.');
  const { error } = await db
    .from('contact_message_notes')
    .insert({ message_id: messageId, author_id: uid, note: trimmed });
  if (error) throw error;
}

// ── Events (history) ────────────────────────────────────────────────────────────

export async function listEvents(messageId: string): Promise<MessageEvent[]> {
  const { data, error } = await db
    .from('contact_message_events')
    .select('*')
    .eq('message_id', messageId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const names = await namesFor(rows.map((r) => (r.actor_id as string) ?? null));
  return rows.map((r) => ({
    id:         r.id as string,
    messageId:  r.message_id as string,
    actorId:    (r.actor_id as string) ?? null,
    actorName:  r.actor_id ? (names.get(r.actor_id as string) ?? 'Unknown') : 'System',
    event:      r.event as MessageEvent['event'],
    oldValue:   (r.old_value as string) ?? null,
    newValue:   (r.new_value as string) ?? null,
    createdAt:  r.created_at as string,
  }));
}

async function writeEvent(
  messageId: string,
  event: MessageEvent['event'],
  oldValue: string | null,
  newValue: string | null,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) throw new Error('Not signed in.');
  const { error } = await db
    .from('contact_message_events')
    .insert({ message_id: messageId, actor_id: uid, event, old_value: oldValue, new_value: newValue });
  if (error) throw error;
}

// ── Field updates (each writes an event) ────────────────────────────────────────

export async function updateStatus(id: string, status: ReaderMessageStatus): Promise<void> {
  const { data, error } = await db
    .from('reader_messages').select('status').eq('id', id).single();
  if (error) throw error;
  const oldStatus = (data as Record<string, unknown>).status as string;
  const { error: updErr } = await db
    .from('reader_messages').update({ status }).eq('id', id);
  if (updErr) throw updErr;
  if (oldStatus !== status) await writeEvent(id, 'status_changed', oldStatus, status);
}

export async function updatePriority(id: string, priority: ReaderMessagePriority): Promise<void> {
  const { data, error } = await db
    .from('reader_messages').select('priority').eq('id', id).single();
  if (error) throw error;
  const oldPriority = (data as Record<string, unknown>).priority as string;
  const { error: updErr } = await db
    .from('reader_messages').update({ priority }).eq('id', id);
  if (updErr) throw updErr;
  if (oldPriority !== priority) await writeEvent(id, 'priority_changed', oldPriority, priority);
}

export async function updateAssignee(id: string, assignee: string | null): Promise<void> {
  const { data, error } = await db
    .from('reader_messages').select('assignee').eq('id', id).single();
  if (error) throw error;
  const oldAssignee = (data as Record<string, unknown>).assignee as string | null;
  const { error: updErr } = await db
    .from('reader_messages').update({ assignee }).eq('id', id);
  if (updErr) throw updErr;
  if ((oldAssignee ?? null) !== (assignee ?? null)) {
    const names = await namesFor([oldAssignee, assignee]);
    await writeEvent(
      id, 'assignee_changed',
      oldAssignee ? (names.get(oldAssignee) ?? oldAssignee) : null,
      assignee ? (names.get(assignee) ?? assignee) : null,
    );
  }
}

// ── Delete (manage_settings only — RLS + UI gate) ───────────────────────────────

export async function deleteReaderMessage(id: string): Promise<void> {
  const { error } = await db.from('reader_messages').delete().eq('id', id);
  if (error) throw error;
}

// ── CSV export (manage_settings UI gate) ────────────────────────────────────────

const CSV_COLUMNS: Array<[keyof ReaderMessage, string]> = [
  ['refNumber', 'ref'], ['createdAt', 'created_at'], ['source', 'source'],
  ['category', 'category'], ['reason', 'reason'], ['status', 'status'],
  ['priority', 'priority'], ['senderName', 'sender_name'],
  ['senderEmail', 'sender_email'], ['senderPhone', 'sender_phone'],
  ['pageUrl', 'page_url'], ['pageTitle', 'page_title'],
  ['message', 'message'],
];

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a CSV string from rows (RFC 4180 quoting). Kept pure so it is unit-
 * testable without a DOM or a download side effect.
 */
export function buildCsv(rows: ReaderMessage[]): string {
  const header = CSV_COLUMNS.map(([, label]) => csvEscape(label)).join(',');
  const body = rows.map((r) =>
    CSV_COLUMNS.map(([key]) => csvEscape(r[key])).join(','),
  );
  return [header, ...body].join('\r\n');
}

/** Fetch all rows matching the current filters and trigger a browser download. */
export async function exportReaderMessagesCsv(opts: ListOpts = {}): Promise<void> {
  // Export is unbounded by the page limit — pull in pages up to a sane ceiling.
  const all: ReaderMessage[] = [];
  const pageSize = 500;
  const maxRows = 10000;
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data } = await listReaderMessages({ ...opts, limit: pageSize, offset });
    all.push(...data);
    if (data.length < pageSize) break;
  }
  const csv = buildCsv(all);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reader-messages-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
