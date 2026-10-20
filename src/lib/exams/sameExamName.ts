/**
 * sameExamName.ts — normalized-name-core comparison for the create-flow
 * SAME-EXAM soft warning (owner A.4). Pure, dependency-free, deterministic.
 *
 * The exact-Name and exact-Short-Name guards (entranceExamService) miss the
 * real duplicates we found: "UPSC Combined Medical Services" vs "UPSC Combined
 * Medical Services CMS Examination 2026", or "UGC NET (National Eligibility
 * Test)" vs "UGC National Eligibility Test 2026" — same exam, different
 * surface string. This compares the IDENTITY CORE of two names: lowercase,
 * punctuation dropped, bare years/numbers dropped, and the owner's stop-words
 * (exam / recruitment / online / examination + a few connectors) removed, then
 * one core is a match if it is a SUBSET of the other (≥ 3 tokens).
 *
 * It is a NON-BLOCKING signal only. A false positive costs the editor one
 * dismissible warning; a missed duplicate costs two competing public pages.
 */

/** Words that carry no exam identity — removed before comparing cores. */
export const NAME_STOPWORDS: ReadonlySet<string> = new Set([
  "exam", "exams", "examination", "examinations",
  "recruit", "recruitment", "recruitments",
  "online", "and", "of", "the", "for", "a", "an", "s",
]);

/**
 * Reduce a name to its identity core: a de-duplicated token array. Keeps Latin
 * letters/digits and Devanagari; drops punctuation, bare numeric tokens (years
 * like 2026, or "Group 4") and the stop-words above.
 */
export function examNameCore(name: string): string[] {
  const tokens = (name ?? "")
    .toLowerCase()
    // keep Unicode letters (Latin + Devanagari) and numbers; every other char
    // (punctuation, &, spaces-as-separator) → space
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !/^\d+$/.test(t))          // bare numbers / years carry no identity
    .filter((t) => !NAME_STOPWORDS.has(t));
  return Array.from(new Set(tokens));
}

/**
 * True when two names share an exam identity core: the smaller core (≥ minTokens)
 * is a subset of the larger. minTokens guards against a 1–2 token name (e.g.
 * "PET") matching everything.
 */
export function isSameExamNameCore(a: string, b: string, minTokens = 3): boolean {
  const ca = examNameCore(a);
  const cb = examNameCore(b);
  if (!ca.length || !cb.length) return false;
  const [small, large] = ca.length <= cb.length ? [ca, cb] : [cb, ca];
  if (small.length < minTokens) return false;
  const set = new Set(large);
  return small.every((t) => set.has(t));
}
