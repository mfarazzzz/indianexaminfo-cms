/**
 * testContent.ts — CMS mirror of indianexaminfo-frontend/lib/testContent.ts.
 * MUST STAY IDENTICAL (same rule as sectionRegistry / normalizeUrl): the editor
 * and the public site must never disagree about what a reference TEST row is.
 *
 * Test identity is the slug prefix `zz-test-`. The editor uses this to (a) badge
 * test rows in every list so an editor can never mistake them for real content,
 * and (b) EXCLUDE them from the Needs-verification real counts, so the triage
 * backlog reflects only genuine records.
 */

export const TEST_SLUG_PREFIX = "zz-test-";
export const TEST_SLUG_LIKE = `${TEST_SLUG_PREFIX}%`;

export function isTestSlug(slug: string | null | undefined): boolean {
  return typeof slug === "string" && slug.trim().toLowerCase().startsWith(TEST_SLUG_PREFIX);
}

export function excludeTest<T extends { slug?: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((r) => !isTestSlug(r?.slug));
}
