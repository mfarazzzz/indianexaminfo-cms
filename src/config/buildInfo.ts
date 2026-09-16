/**
 * Build stamp — the commit SHA and build time baked in at build (vite.config.ts).
 * Surfaced in the sidebar footer so "which commit is deployed?" is answerable in
 * one glance, without a route to remember or a pipeline archaeology session.
 */
export const BUILD_INFO = {
  /** Short commit SHA at build time, e.g. "a8df5bb". "unknown" if git was unavailable. */
  sha: typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "unknown",
  /** ISO timestamp of the build. */
  time: typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "",
  /** Relationship to origin/main at build time: clean | ahead | behind | dirty | unknown. */
  sync: typeof __BUILD_SYNC__ !== "undefined" ? __BUILD_SYNC__ : "unknown",
} as const;

/** Compact build time for display, e.g. "13 Sep 2026 14:32 UTC". Empty string if unknown. */
export function formatBuildTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "UTC", hour12: false,
  }) + " UTC";
}

/**
 * Human label + tone for the sync state. "clean" is the only state that means
 * "this build is exactly origin/main"; everything else is a caution.
 */
export function buildSyncLabel(sync: string): { text: string; ok: boolean } {
  switch (sync) {
    case "clean":  return { text: "matches origin/main", ok: true };
    case "ahead":  return { text: "ahead of origin/main", ok: false };
    case "behind": return { text: "behind origin/main (stale)", ok: false };
    case "dirty":  return { text: "built with uncommitted changes", ok: false };
    default:       return { text: "sync unknown", ok: false };
  }
}
