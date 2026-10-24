/**
 * featureFlags.ts — CMS feature flags (owner batch 2, Phase E).
 *
 * SOCIAL_QUEUE is OFF by default: the S7.1b schema is NOT applied and the edge
 * functions are NOT deployed, so the Social queue page, its nav item and the
 * publish/verify candidate hooks are all inert until the owner applies the schema and
 * flips this to true. A social failure must NEVER block publish or verify.
 */
export const FEATURE_FLAGS: Record<"SOCIAL_QUEUE", boolean> = {
  SOCIAL_QUEUE: false,
};

/** Read a flag without letting a typo silently disable a feature. */
export function flagOn(name: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[name] === true;
}
