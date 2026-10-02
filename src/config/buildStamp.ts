/**
 * buildStamp.ts — the pure formatter behind the CMS <meta name="build"> tag.
 *
 * The commit SHA / sync / build-time are captured at build by vite.config.ts
 * (mirroring the frontend's gitStamp) and injected into index.html by the
 * `build-stamp` Vite plugin via transformIndexHtml, so "which commit is live?"
 * is answerable from view-source with no login — the same check the frontend
 * root layout supports. Kept free of the `__BUILD_*__` define globals so it can
 * be imported by the Node-side build config AND unit-tested directly.
 */
export interface BuildStampParts {
  sha?: string;
  sync?: string;
  time?: string;
}

/**
 * One-line meta content, e.g. "905b1e3 clean 2026-10-01T01:22:00.000Z".
 * Degrades to "dev" when there is no usable commit SHA (git unavailable, e.g.
 * a tarball deploy) so the tag is never an empty/confusing string.
 */
export function formatBuildStampContent(stamp: BuildStampParts): string {
  const sha = (stamp?.sha ?? "").trim();
  if (!sha || sha === "unknown") return "dev";
  const sync = (stamp?.sync ?? "").trim() || "unknown";
  const time = (stamp?.time ?? "").trim();
  return [sha, sync, time].filter(Boolean).join(" ");
}
