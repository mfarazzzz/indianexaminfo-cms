/**
 * saveConflict.test.ts — the decision table of the (still inert) conflict mapping.
 *
 * The two properties worth more than the individual wordings are asserted explicitly:
 *  • retryable is TRUE only where retrying can work (a transient failure, a read-only DB) and
 *    FALSE for permission and concurrency, where a retry either spams the server or silently
 *    overwrites the other editor's row;
 *  • keepsLocalWork is TRUE everywhere — no branch may tell an editor that their text is gone,
 *    because none of these failures deletes anything.
 * Errors are the shapes this repo's own tests already use ({ code, message } from PostgREST, a
 * bare TypeError from a fetch that never completed, a numeric HTTP status).
 */
import { describe, it, expect } from "vitest";
import { classifySaveError, describeSaveConflict, type SaveConflictInput } from "./saveConflict";

const pg = (code: string, message: string) => ({ code, message, details: null, hint: null });

const CASES: Array<[string, unknown, Partial<SaveConflictInput> | undefined, string]> = [
  ["42501 RLS denial", pg("42501", "new row violates row-level security policy"), undefined, "permission"],
  ["42501 from a publish trigger", pg("42501", "You do not have permission to publish this record."), undefined, "permission"],
  ["23505 unique", pg("23505", 'duplicate key value violates unique constraint "exams_slug_key"'), undefined, "duplicate"],
  ["23505 on an edition cycle", pg("23505", 'duplicate key value violates unique constraint "uq_exam_edition_year_session"'), undefined, "duplicate"],
  ["23503 foreign key", pg("23503", 'insert or update on table "exam_syllabus_subjects" violates foreign key constraint'), undefined, "missing-link"],
  ["23514 check", pg("23514", 'new row violates check constraint "important_dates"'), undefined, "rejected-value"],
  ["40001 serializable", pg("40001", "could not serialize access due to concurrent update"), undefined, "concurrent"],
  ["40P01 deadlock", pg("40P01", "deadlock detected"), undefined, "concurrent"],
  ["25006 read-only", pg("25006", "cannot execute INSERT in a read-only transaction"), undefined, "readonly"],
  ["fetch never completed", new TypeError("Failed to fetch"), undefined, "transient"],
  ["socket reset", { message: "read ECONNRESET" }, undefined, "transient"],
  ["axios-style timeout", { message: "timeout of 15000ms exceeded" }, undefined, "transient"],
  ["DNS failure", { message: "getaddrinfo ENOTFOUND project.supabase.co" }, undefined, "transient"],
  ["5xx from the edge", { message: "Internal Server Error" }, { status: 503 }, "transient"],
  ["precondition / stale copy", { message: "If-Match failed" }, { status: 412 }, "concurrent"],
  ["PGRST102 malformed", pg("PGRST102", "invalid input syntax for type uuid"), undefined, "unknown"],
  ["anything else", { message: "something unexpected happened" }, undefined, "unknown"],
  ["a bare string", "boom", undefined, "unknown"],
  ["null", null, undefined, "unknown"],
];

describe("classifySaveError — one table, every shape the client can hand back", () => {
  it.each(CASES)("%s → %s", (_label, error, extra, expected) => {
    expect(classifySaveError({ error, ...(extra ?? {}) })).toBe(expected);
  });

  it("never invents a kind", () => {
    const kinds = new Set(["permission", "duplicate", "missing-link", "rejected-value", "concurrent", "readonly", "transient", "unknown"]);
    for (const [, error, extra] of CASES) {
      expect(kinds.has(classifySaveError({ error, ...(extra ?? {}) }))).toBe(true);
    }
  });
});

describe("describeSaveConflict — the flags a UI can act on", () => {
  it("only a transient or read-only failure is retryable", () => {
    expect(describeSaveConflict({ error: new TypeError("Failed to fetch") }).retryable).toBe(true);
    expect(describeSaveConflict({ error: pg("25006", "read-only") }).retryable).toBe(true);
    expect(describeSaveConflict({ error: pg("42501", "rls") }).retryable, "retry cannot grant a permission").toBe(false);
    expect(describeSaveConflict({ error: pg("40001", "concurrent update") }).retryable, "re-sending a stale row overwrites the other editor").toBe(false);
    expect(describeSaveConflict({ error: pg("23505", "duplicate") }).retryable).toBe(false);
  });

  it("no branch ever claims the editor's work is lost", () => {
    for (const [, error, extra] of CASES) {
      const out = describeSaveConflict({ error, ...(extra ?? {}) });
      expect(out.keepsLocalWork, `${out.kind} must keep keepsLocalWork true`).toBe(true);
    }
  });

  it("says RELOAD only where the screen may be stale", () => {
    expect(describeSaveConflict({ error: pg("40001", "concurrent update") }).asksForReload).toBe(true);
    expect(describeSaveConflict({ error: pg("23503", "foreign key") }).asksForReload).toBe(true);
    expect(describeSaveConflict({ error: new TypeError("Failed to fetch") }).asksForReload, "reloading would drop the only copy of the text").toBe(false);
    expect(describeSaveConflict({ error: pg("42501", "rls") }).asksForReload).toBe(false);
  });

  it("distinguishes 'you kept typing' from 'nothing else changed' in the concurrent case", () => {
    const quiet = describeSaveConflict({ error: pg("40001", "concurrent update"), dirtySeqBeforeSave: 3, dirtySeqNow: 3 });
    const typing = describeSaveConflict({ error: pg("40001", "concurrent update"), dirtySeqBeforeSave: 3, dirtySeqNow: 4 });
    expect(quiet.detail).not.toBe(typing.detail);
    expect(typing.detail).toMatch(/copy anything you would lose/i);
    expect(quiet.asksForReload).toBe(true);
    expect(typing.asksForReload).toBe(true);
  });

  it("reuses lib/utils#getErrorMessage's wording instead of writing a second one", () => {
    // src/lib/utils.pgErrors.test.ts pins these sentences; this module must agree with them.
    const dupe = describeSaveConflict({ error: pg("23505", 'duplicate key value violates unique constraint "uq_exam_edition_year_session"') });
    expect(dupe.detail).toBe("That cycle already exists for this exam. Open it instead of creating a duplicate.");
    const check = describeSaveConflict({ error: pg("23514", 'new row violates check constraint "important_dates"') });
    expect(check.detail).toMatch(/important dates is invalid/i);
  });

  it("carries the code for the log line and never shows a raw constraint name", () => {
    const out = describeSaveConflict({ error: pg("23505", 'duplicate key value violates unique constraint "exams_slug_key"') });
    expect(out.code).toBe("23505");
    expect(out.headline + out.detail).not.toMatch(/exams_slug_key|constraint "/);
  });

  it("an unknown failure still says nothing was saved", () => {
    const out = describeSaveConflict({ error: { message: "something unexpected happened" } });
    expect(out.kind).toBe("unknown");
    expect(out.headline).toBe("The save failed");
    expect(out.detail.length).toBeGreaterThan(10);
  });
});
