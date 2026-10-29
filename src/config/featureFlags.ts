/**
 * featureFlags.ts — CMS feature flags (owner batch 2, Phase E).
 *
 * SOCIAL_QUEUE is ON as of owner batch 5 (P3). The two facts this flag existed to guard are
 * now both true and were verified before the flip:
 *   • the S7.1b schema is applied (migration 20261028171123_social_queue — 5 social tables,
 *     9 policies, kill_switch/dry_run both true, 0 posts);
 *   • social-candidate and social-publish are deployed with verify_jwt=true (v2 each, bundled
 *     with their ../_shared/social.ts sibling — see supabase/functions/bundleLayout.test.ts).
 * What the flag still does while ON: the /social route and its nav item exist, and the
 * publish/verify hooks fire a fire-and-forget candidate call that can never block or fail a
 * save. Nothing posts: social-publish returns before claiming anything while kill_switch is
 * on, and only writes to the log while dry_run is on.
 *
 * This is a SOURCE constant, not an environment variable — changing it requires a CMS rebuild
 * (Vite inlines it at build time). The owner's standing rule: no automated UI/deploy by me.
 */
export const FEATURE_FLAGS: Record<"SOCIAL_QUEUE", boolean> = {
  SOCIAL_QUEUE: true,
};

/** Read a flag without letting a typo silently disable a feature. */
export function flagOn(name: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[name] === true;
}
