/**
 * providerModelBadges.ts — S2.13(b) pure helpers behind the AI Providers panel's
 * model management, kept out of the component so they can be unit-tested.
 *
 * The whole point of S2.13(b): the model dropdown used to be a hard-coded list,
 * so a silently retired id (gemini-2.5-flash) could sit in production and fail
 * every call until someone fixed it by SQL. These helpers turn that around —
 * suggestions come from the provider's LIVE list, the owner can type anything,
 * and two honest badges flag trouble using only data the panel already has.
 */

/** True when we have a live list AND the row's model is not in it. An absent or
 *  empty list means "never fetched", so we must NOT cry retired. */
export function modelLooksRetired(model: string, liveIds: string[] | null | undefined): boolean {
  if (!liveIds || liveIds.length === 0) return false;
  return !liveIds.includes(model);
}

/** "Never succeeded": the health columns the Edge Function writes say a row has
 *  no recorded success (last_used_at is set only on a successful call) yet its
 *  last error was a missing/retired model (404 / model_not_found / does not
 *  exist). Uses only ai_providers fields — no extra query. */
export function neverSucceeded(row: { lastUsedAt?: string | null; lastError?: string | null }): boolean {
  return !row.lastUsedAt && !!row.lastError && /404|model_not_found|does not exist/i.test(row.lastError);
}

/** Combobox suggestions: the live ids when we have them, else the hard-coded
 *  PROVIDER_MODELS values as a fallback (the live list is best, not mandatory). */
export function modelSuggestions(
  liveIds: string[] | null | undefined,
  fallback: readonly { value: string }[],
): string[] {
  if (liveIds && liveIds.length > 0) return liveIds;
  return fallback.map((m) => m.value);
}
