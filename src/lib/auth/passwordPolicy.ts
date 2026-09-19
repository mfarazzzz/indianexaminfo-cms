/**
 * passwordPolicy.ts — single source of truth for the CMS minimum password standard.
 *
 * IMPORTANT (server-side enforcement): the truly server-side gate for password
 * length/complexity lives in Supabase GoTrue Auth settings
 * (Authentication → Policies: minimum length + required characters). This module
 * mirrors that standard on the client so the user gets a clear message at entry;
 * `supabase.auth.updateUser({ password })` will itself reject a password that
 * violates the GoTrue-configured minimum, which is what makes it server-enforced.
 *
 * Keep MIN_LENGTH here in sync with the GoTrue "Minimum password length" setting.
 */
export const PASSWORD_MIN_LENGTH = 10;

export interface PasswordCheck {
  ok: boolean;
  errors: string[];
}

/**
 * Validate a candidate password against the CMS standard:
 * - at least PASSWORD_MIN_LENGTH characters
 * - at least one letter and one number
 * Returns every failing rule so the form can list them.
 */
export function checkPassword(pw: string): PasswordCheck {
  const errors: string[] = [];
  if (pw.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (!/[A-Za-z]/.test(pw)) {
    errors.push("Include at least one letter.");
  }
  if (!/[0-9]/.test(pw)) {
    errors.push("Include at least one number.");
  }
  return { ok: errors.length === 0, errors };
}
