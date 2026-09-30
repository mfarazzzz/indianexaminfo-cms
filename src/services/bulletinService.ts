/**
 * bulletinService.ts — the ONLY place the bulletin reads from or writes to.
 *
 * Four objects are involved:
 *   • public.bulletin_signals      (PROPOSED step 3 — not promoted, not applied)
 *   • public.bulletin_editor_state (PROPOSED step 4 — not promoted, not applied)
 *   • public.page_traffic          (promoted 20260928042556 — applies on push)
 *   • public.sarkari_naukri        (live today; the verification queue)
 *
 * Because three of the four may not exist yet, every read degrades gracefully:
 * a missing relation is reported as `schemaPending` and yields an empty list
 * instead of throwing, so the route is reviewable before the DB objects are
 * promoted. A real permission denial (42501) is NOT swallowed — that is a
 * genuine problem the editor must see.
 *
 * Writes follow the house rule: assert the permission in the app layer first
 * (`edit_any_post`, which the table's INSERT/UPDATE policies require), then
 * `.select()` the affected key so a zero-row RLS refusal becomes a clear
 * NoEffectError instead of a fake success.
 */
import { db } from '@/lib/supabase/client';
import { assertPermission, assertAffected } from '@/lib/auth/permissionGuard';
import { P } from '@/config/permissions';
import type {
  BulletinBundle,
  BulletinEditorState,
  BulletinSignal,
  EditorStatus,
  ReaderReport,
  TrafficRow,
  VerifyCandidate,
} from '@/lib/bulletin/model';
import { todayIso } from '@/lib/bulletin/model';
import { listOpenPageReports } from '@/services/readerMessageService';

/** Rows per read. The view is date-windowed, so a few thousand rows is the realistic ceiling. */
const SIGNAL_LIMIT = 5000;
const TRAFFIC_LIMIT = 2000;
const VACANCY_LIMIT = 500;

/**
 * Postgres/PostgREST codes meaning "this object is not in the schema yet":
 *   42P01  undefined_table (raised by a direct query / RPC)
 *   PGRST205 `relation ... does not exist on the schema cache` (PostgREST)
 *   PGRST202 schema cache missing (the view was created after the cache loaded)
 */
function isMissingObject(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  const code = String(err?.code ?? '');
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202') return true;
  return /does not exist|not in the schema cache|relation .* not found|view .* not found/i
    .test(String(err?.message ?? ''));
}

/** Anything other than a missing object is a real failure and must surface. */
function rethrowUnlessMissing(error: unknown): void {
  if (isMissingObject(error)) return;
  throw error;
}

// ── Reads ────────────────────────────────────────────────────────────────────

export interface SignalsResult {
  signals: BulletinSignal[];
  /** True when bulletin_signals is not in the database yet. */
  pending: boolean;
}

/**
 * All signal rows the view returns. `bucket` comes from the view's own
 * `current_date` (server timezone UTC) — never recomputed client-side.
 */
export async function fetchBulletinSignals(): Promise<SignalsResult> {
  const { data, error } = await db
    .from('bulletin_signals')
    .select('*')
    .in('bucket', ['arrived', 'upcoming', 'backlog'])
    .order('event_date', { ascending: false })
    .limit(SIGNAL_LIMIT);

  if (error) {
    rethrowUnlessMissing(error);
    return { signals: [], pending: true };
  }
  return { signals: (data ?? []) as BulletinSignal[], pending: false };
}

export interface EditorStatesResult {
  states: BulletinEditorState[];
  /** True when bulletin_editor_state is not in the database yet. */
  pending: boolean;
}

export async function fetchEditorStates(): Promise<EditorStatesResult> {
  const { data, error } = await db
    .from('bulletin_editor_state')
    .select('*')
    .limit(SIGNAL_LIMIT);
  if (error) {
    rethrowUnlessMissing(error);
    return { states: [], pending: true };
  }
  return { states: (data ?? []) as BulletinEditorState[], pending: false };
}

/** Newest-period traffic only; an empty table is normal before the first import. */
export async function fetchTraffic(): Promise<TrafficRow[]> {
  const { data, error } = await db
    .from('page_traffic')
    .select('url, clicks, period_start, period_end')
    .order('period_end', { ascending: false })
    .order('clicks', { ascending: false })
    .limit(TRAFFIC_LIMIT);
  if (error) {
    rethrowUnlessMissing(error);
    return [];
  }
  return (data ?? []) as TrafficRow[];
}

/**
 * The verification queue: unverified sarkari_naukri rows, with the two columns
 * the applied verify trigger (20260927140000) checks. Ordering by traffic needs
 * page_traffic, which the caller joins in memory — the DB cannot join a view
 * that does not exist yet.
 */
export async function fetchUnverifiedVacancies(): Promise<VerifyCandidate[]> {
  const { data, error } = await db
    .from('sarkari_naukri')
    .select('id, slug, title, state, official_notification_url, application_end_date')
    .is('verified_at', null)
    .order('updated_at', { ascending: false })
    .limit(VACANCY_LIMIT);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    slug: String(r.slug ?? ''),
    title: (r.title as string | null) ?? null,
    state: (r.state as string | null) ?? null,
    official_notification_url: (r.official_notification_url as string | null) ?? null,
    application_end_date: (r.application_end_date as string | null) ?? null,
  }));
}

/**
 * Open page reports for the bulletin "Reader reports" section (P3-2). reader_
 * messages is a PROPOSED, not-yet-applied table, and its SELECT policy is
 * handle_messages — so a missing table or a non-holder (RLS returns 0 rows)
 * must degrade to an empty list, exactly like the other pending objects. Any
 * real error other than a missing object still surfaces.
 */
export async function fetchOpenReaderReports(): Promise<ReaderReport[]> {
  try {
    const rows = await listOpenPageReports(50);
    return rows.map((r) => ({
      id: r.id,
      ref_number: r.refNumber,
      page_title: r.pageTitle,
      reason: r.reason,
      created_at: r.createdAt,
    }));
  } catch (err) {
    rethrowUnlessMissing(err);
    return [];
  }
}

/** One read of everything the bulletin home needs. */
export async function loadBulletin(now: Date = new Date()): Promise<BulletinBundle> {
  const [signals, editorStates, traffic, unverifiedVacancies, readerReports] = await Promise.all([
    fetchBulletinSignals(),
    fetchEditorStates(),
    fetchTraffic(),
    fetchUnverifiedVacancies(),
    fetchOpenReaderReports(),
  ]);
  return {
    signals: signals.signals,
    editorStates: editorStates.states,
    traffic,
    unverifiedVacancies,
    readerReports,
    // The board can only show real work once BOTH the signal view and the
    // editor-state table exist. A missing/empty page_traffic only means the
    // ranking numbers read 0, so it does not set this flag.
    schemaPending: signals.pending || editorStates.pending,
    asOf: todayIso(now),
  };
}

// ── Writes (bulletin_editor_state) ───────────────────────────────────────────

export interface EditorStateInput {
  signalKey: string;
  status: EditorStatus;
  /** Required by the DB CHECK when status = 'snoozed'. */
  snoozeUntil?: string | null;
  assignee?: string | null;
  note?: string | null;
  /** The signed-in user; stored as updated_by. */
  actorId: string;
}

/** ISO date `days` from today — the default snooze horizon. */
export function isoDatePlusDays(days: number, from: Date = new Date()): string {
  const d = new Date(from.getTime() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Upsert one editor-state row. RLS: read = edit_own_post/edit_any_post,
 * insert/update = edit_any_post, and there is NO delete policy — so an editor
 * can never clear a row through the API, only move it between open, snoozed
 * and done-by-hand.
 */
export async function saveBulletinEditorState(input: EditorStateInput): Promise<void> {
  assertPermission(P.EDIT_ANY_POST, 'record bulletin work state');

  if (input.status === 'snoozed' && !input.snoozeUntil) {
    throw new Error('A snoozed signal needs a snooze-until date.');
  }

  const row = {
    signal_key: input.signalKey,
    assignee: input.assignee ?? null,
    status: input.status,
    snooze_until: input.status === 'snoozed' ? input.snoozeUntil ?? null : null,
    note: input.note ?? null,
    updated_by: input.actorId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('bulletin_editor_state')
    .upsert(row, { onConflict: 'signal_key' })
    .select('signal_key');

  if (error) throw error;
  assertAffected(data, 'record bulletin work state');
}

/** Assign a signal to a user without changing its status. */
export async function assignBulletinSignal(signalKey: string, userId: string): Promise<void> {
  await saveBulletinEditorState({
    signalKey, status: 'open', assignee: userId, actorId: userId,
  });
}

/** Snooze a signal (default 7 days) — it stays visible with the ◐ chip. */
export async function snoozeBulletinSignal(
  signalKey: string,
  actorId: string,
  days = 7,
): Promise<string> {
  const snoozeUntil = isoDatePlusDays(days);
  await saveBulletinEditorState({ signalKey, status: 'snoozed', snoozeUntil, actorId });
  return snoozeUntil;
}

/** Mark a signal handled by hand — it leaves the open-work lists. */
export async function markDoneByHand(
  signalKey: string,
  actorId: string,
  note?: string,
): Promise<void> {
  await saveBulletinEditorState({ signalKey, status: 'done-by-hand', note, actorId });
}
