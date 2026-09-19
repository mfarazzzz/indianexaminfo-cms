/**
 * permissionGuard.ts — non-React access to the current user's permission slugs.
 *
 * The DB is the authoritative gate (RLS + publish triggers). This module is the
 * APP-LAYER pre-check so service functions (which can't call React hooks) can fail
 * fast with a clear message BEFORE hitting a raw Postgres 42501, and so a control
 * that would be denied never silently no-ops.
 *
 * AuthContext calls setCurrentPermissions() whenever the user loads/changes; the
 * service layer calls hasPermission()/assertPermission(). This is a cache of what
 * the server already enforces — never the sole gate.
 */

let currentPermissions: readonly string[] = [];

/** Called by AuthContext on every user load/refresh/sign-out. */
export function setCurrentPermissions(perms: readonly string[]): void {
  currentPermissions = perms ?? [];
}

/** True if the current user holds the given permission slug. */
export function hasPermission(slug: string): boolean {
  return currentPermissions.includes(slug);
}

/** Error thrown when an app-layer permission pre-check fails. */
export class PermissionError extends Error {
  constructor(slug: string, action?: string) {
    super(
      action
        ? `You don't have permission to ${action} (requires "${slug}").`
        : `You don't have the required permission ("${slug}").`
    );
    this.name = "PermissionError";
  }
}

/** Throw PermissionError unless the current user holds `slug`. */
export function assertPermission(slug: string, action?: string): void {
  if (!hasPermission(slug)) throw new PermissionError(slug, action);
}

/**
 * A write (UPDATE/DELETE) that returns no error but affects ZERO rows under RLS is
 * almost always a permission refusal, not a real success — the row exists but the
 * user's policy didn't match, so Postgres silently touched nothing. The DB stays the
 * authority (we did NOT pre-check and skip the call); we inspect the RESULT and, when
 * nothing changed, raise a clear message instead of letting the UI report success.
 *
 * Pass the affected rows the write returned (from a chained `.select()`), the id that
 * was targeted, and a human action label. Throws NoEffectError when zero rows changed.
 */
export class NoEffectError extends Error {
  constructor(action: string) {
    super(
      `You don't have permission to ${action}, or it no longer exists. ` +
      `If you believe you should be able to do this, ask an administrator to check your role.`
    );
    this.name = "NoEffectError";
  }
}

/** Throw NoEffectError if a write returned zero affected rows. */
export function assertAffected(affected: unknown[] | null | undefined, action: string): void {
  if (!affected || affected.length === 0) throw new NoEffectError(action);
}
