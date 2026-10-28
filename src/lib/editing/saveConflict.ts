/**
 * saveConflict.ts — save-conflict mapping (owner batch 4, CMS R2.5 increment 3 of 3).
 *
 * COMPLETELY INERT. Nothing imports it, and by the owner's batch-4 rule nothing may import it
 * until "R2.5 APPROVED". It exists so that when the save path grows a conflict prompt, the
 * DECISION (retry? reload? keep the draft? who is allowed to do this?) is one tested function
 * instead of three inline `if (error.code === …)` checks scattered across mutation callbacks —
 * which is exactly how the CMS ended up with `getErrorMessage` in lib/utils, `humanizeVerifyError`
 * in sarkariNaukriService and a 42501 special case in unifiedContentService saying slightly
 * different things about the same SQLSTATE.
 *
 * WHAT IT ANSWERS, and why each field is here:
 *  • kind / retryable — an editor should be told to retry only when retrying can possibly work.
 *    42501 (permission / RLS / a publish trigger raising on purpose) is NOT retryable; 40001 and
 *    40P01 are, and saying so is the difference between a quiet re-click and five angry ones.
 *  • keepsLocalWork — the answer to "will I lose what I typed?". A transient network failure
 *    means the editor's text is still in the box (and in the draft backup), so the right advice
 *    is "nothing was saved, try again", never "reload".
 *  • asksForReload — the answer to "the row is not what my screen says it is": the concurrent
 *    cases, where the editor must SEE the other person's version before deciding.
 *  • headline / detail — plain English, with the existing `getErrorMessage` as the source of the
 *    per-code sentence so the CMS keeps ONE wording per SQLSTATE (raw constraint names never
 *    reach an editor, per the A4 rule in lib/utils).
 *
 * The classification is driven by SQLSTATE and by the shapes Supabase's JS client actually
 * produces (`{ code, message }`, PostgREST `{ code: 'PGRST…' }`, and a bare
 * `TypeError: Failed to fetch` when the request never completed) — all measured shapes from this
 * repo's own tests, not invented ones.
 */
import { getErrorMessage } from "@/lib/utils";

export type ConflictKind =
  | "permission"      // 42501, or a trigger that raises on purpose (publish_post gating)
  | "duplicate"       // 23505
  | "missing-link"    // 23503
  | "rejected-value"  // 23514
  | "concurrent"      // 40001 / 40P01, or a precondition/etag mismatch
  | "readonly"        // 25006 (a replica, or the DB is mid-migration)
  | "transient"       // the request never completed: fetch failed, timeout, DNS, 5xx from the edge
  | "unknown";

export interface SaveConflict {
  kind: ConflictKind;
  /** SQLSTATE / PostgREST code when the error carried one — kept for the log line, never shown. */
  code: string | null;
  /** What to put in the toast/title. */
  headline: string;
  /** One sentence of plain explanation for the editor. */
  detail: string;
  /** Retrying the SAME save can succeed. */
  retryable: boolean;
  /** The editor's unsaved text is still safe (nothing was written). */
  keepsLocalWork: boolean;
  /** The screen may be showing a stale row — the editor should reload before trying again. */
  asksForReload: boolean;
}

export interface SaveConflictInput {
  error: unknown;
  /** The section's dirty-registry snapshot seq before the save started (editorDirty.ts). */
  dirtySeqBeforeSave?: number;
  /** The registry's seq now. Together with the two above this answers "did they keep typing?". */
  dirtySeqNow?: number;
  /** HTTP status, when the failure came back from PostgREST with one. */
  status?: number;
}

/** SQLSTATEs of the concurrency class: the write collided with another transaction. */
const CONCURRENT_CODES = new Set(["40001", "40P01"]);
const PERMISSION_CODES = new Set(["42501"]);
const READONLY_CODES = new Set(["25006"]);

/** Codes that carry an already-human sentence in lib/utils#getErrorMessage — the duplicate /
 * missing-link / rejected-value branches below are exactly these, which is why they can reuse
 * that mapping instead of writing a second one. */
const MAPPED_MESSAGE_CODES = ["23505", "23503", "23514", "42501"] as const;

/** Read `code` out of any of the shapes the client can hand back. */
function codeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const obj = error as Record<string, unknown>;
  for (const key of ["code", "sqlState", "state"]) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null) return "";
  const m = (error as Record<string, unknown>).message;
  return typeof m === "string" ? m : "";
}

/**
 * classify — the one decision table. Ordered most specific first: a code beats a message, and a
 * network-shaped error is only inferred from the message when no code is present at all.
 */
export function classifySaveError(input: SaveConflictInput): ConflictKind {
  const code = codeOf(input.error);
  const message = messageOf(input.error);
  const status = input.status;

  if (code && PERMISSION_CODES.has(code)) return "permission";
  if (code && READONLY_CODES.has(code)) return "readonly";
  if (code && CONCURRENT_CODES.has(code)) return "concurrent";
  if (code === "23505") return "duplicate";
  if (code === "23503") return "missing-link";
  if (code === "23514") return "rejected-value";
  // PostgREST surfaces a precondition/If-Match failure as 412 (the row moved under us).
  if (status === 412) return "concurrent";
  if (code && /^PGRST(102|404|00)$/.test(code)) return "unknown";

  // No SQLSTATE: the request itself did not complete. These are the exact strings this repo's
  // own tests and the browser produce (see services/bulletinService.test.ts, sarkariNaukriService).
  if (/failed to fetch|networkerror|err_[a-z_]*network|load failed|econnreset|etimedout|timed? ?out|timeout of \d+ms|enotfound|eai_again|could not connect/i.test(message)) {
    return "transient";
  }
  if (status !== undefined && status >= 500) return "transient";
  if (/row-level security|permission denied/i.test(message)) return "permission";
  if (/duplicate key value/i.test(message)) return "duplicate";
  return "unknown";
}

/**
 * describeSaveConflict — headline + detail + the three action flags.
 *
 * `keepsLocalWork` is derived, not asserted: for a transient failure nothing was written, so the
 * local text is the only copy; for a concurrent/permission failure the row exists and the
 * question is who wins, which is why those two say "reload" / "ask an approver" instead.
 */
export function describeSaveConflict(input: SaveConflictInput): SaveConflict {
  const kind = classifySaveError(input);
  const code = codeOf(input.error);
  const typed = kind === "concurrent" && input.dirtySeqBeforeSave !== undefined && input.dirtySeqNow !== undefined
    ? input.dirtySeqNow !== input.dirtySeqBeforeSave
    : false;

  const base = { kind, code, retryable: false, keepsLocalWork: false, asksForReload: false };

  switch (kind) {
    case "permission":
      return {
        ...base,
        headline: "You don't have permission for that change",
        detail: "Nothing was saved. This is a rights question, not a retry question — an editor or approver has to make this change (or grant the permission).",
        keepsLocalWork: true,   // the text is still in the box; retrying will not help but reloading would lose it
      };
    case "readonly":
      return {
        ...base,
        headline: "The database is not accepting writes right now",
        detail: "Nothing was saved — the CMS is pointed at a read-only database (a replica, or a migration in progress). Keep your text and try again once it is back.",
        retryable: true,
        keepsLocalWork: true,
      };
    case "concurrent":
      return {
        ...base,
        headline: "Someone else saved this record while you were editing",
        detail: typed
          ? "Your version is still on screen and it has changed since the save was attempted — copy anything you would lose before reloading, then reload and re-apply your change."
          : "Reload to see the current version; your screen may be showing an older one.",
        retryable: false,       // re-sending the same stale row is how the other person's work is lost
        keepsLocalWork: true,
        asksForReload: true,
      };
    case "duplicate":
    case "missing-link":
    case "rejected-value": {
      // Only these three codes are the ones lib/utils already explains in plain English; the
      // assertion keeps the switch and that list from drifting apart silently.
      const mapped = MAPPED_MESSAGE_CODES.includes(kind as (typeof MAPPED_MESSAGE_CODES)[number]);
      return {
        ...base,
        headline: kind === "duplicate" ? "That already exists" : kind === "missing-link" ? "A linked record is missing" : "A value was rejected",
        // One wording per SQLSTATE, from the mapping the rest of the CMS already uses — so this
        // never becomes a second place that has to be kept in sync.
        detail: mapped ? getErrorMessage(input.error) : (getErrorMessage(input.error) || "The server rejected this value."),
        keepsLocalWork: true,
        asksForReload: kind === "missing-link",
      };
    }
    case "transient":
      return {
        ...base,
        headline: "The save did not reach the server",
        detail: "Nothing was saved, and your text is still here. Check the connection and try again — this is a network failure, not a rejected change.",
        retryable: true,
        keepsLocalWork: true,
      };
    case "unknown":
    default:
      return {
        ...base,
        headline: "The save failed",
        detail: getErrorMessage(input.error) || "No explanation came back from the server. Nothing was saved.",
        // An unknown failure is treated as NOT retryable and NOT reload-worthy: the honest
        // advice is "your work is still on screen, tell someone what you saw".
        keepsLocalWork: true,
      };
  }
}
