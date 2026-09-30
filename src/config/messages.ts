/**
 * messages.ts — the ONE shared vocabulary for reader messages
 * (S0-5 Part 3, owner decision 2026-09-30).
 *
 * Everything about status/source names, the "open" set, and human labels comes
 * from here: the Messages grid filters, the bulk actions, the detail-drawer
 * status picker, and the editor/bulletin "N open reader reports" hooks all read
 * these constants instead of scattering string literals.
 *
 * This MUST stay in lock-step with the database CHECK constraints in
 * supabase/proposed/reader_messages.sql and with the public submit-message edge
 * function (supabase/functions/submit-message). The table is only PROPOSED
 * today, so the enum was reshaped freely rather than migrated:
 *   • 'triage' was DROPPED — a separate stage is overkill for a 1-3 person team;
 *     'new' IS the triage queue.
 *   • 'wont_fix' (a genuine message we decline, e.g. unverifiable) is kept and is
 *     distinct from 'spam' (junk, purged after 30 days).
 *   • source 'report_sheet' was RENAMED to 'page_report'.
 * The edge function cannot import from src/, so it mirrors these values; the FE
 * parity test pins the client source/type to the same set.
 */

// ── Statuses ──────────────────────────────────────────────────────────────────
export const MESSAGE_STATUSES = [
  'new',
  'in_progress',
  'waiting_on_reader',
  'resolved',
  'wont_fix',
  'spam',
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/**
 * "Open" = still needs staff attention. The editor/bulletin hooks count exactly
 * these; resolved / wont_fix / spam are terminal and excluded.
 */
export const OPEN_STATUSES: readonly MessageStatus[] = [
  'new',
  'in_progress',
  'waiting_on_reader',
] as const;

export function isOpenStatus(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

// ── Sources ────────────────────────────────────────────────────────────────────
export const MESSAGE_SOURCES = ['contact_form', 'page_report'] as const;
export type MessageSource = (typeof MESSAGE_SOURCES)[number];

// ── Human labels ───────────────────────────────────────────────────────────────
export const STATUS_LABELS: Record<MessageStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  waiting_on_reader: 'Waiting on reader',
  resolved: 'Resolved',
  wont_fix: "Won't fix",
  spam: 'Spam',
};

export const SOURCE_LABELS: Record<MessageSource, string> = {
  contact_form: 'Contact form',
  page_report: 'Page report',
};
