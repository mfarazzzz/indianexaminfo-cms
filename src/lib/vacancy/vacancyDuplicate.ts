/**
 * vacancyDuplicate.ts — "is this vacancy one we already have?".
 *
 * The corpus has 361 rows and a hand-written title for each, so a pasted notice
 * often lands on top of a row that already exists. Creating a near-duplicate would
 * split the clicks between two URLs and dilute the page we already rank. So the
 * quick-add flow CHECKS BEFORE IT CREATES: an exact slug match, and a near-match on
 * the title's MEANING (its content words), are both surfaced — and the editor is
 * pointed at the existing row instead of a second copy.
 *
 * PURE: the comparison lives here (and is unit-tested); the query lives in
 * sarkariNaukriService.findVacancyDuplicates.
 */

/**
 * Words that carry no identity: the document words, the job words and the year.
 * They are dropped BEFORE comparing, so "UP Anganwadi Recruitment 2026" and
 * "UP Anganwadi Bharti 2026" are the same job, while "SSC CGL 2026" and
 * "SSC CHSL 2026" are not.
 */
export const VACANCY_TITLE_STOPWORDS: ReadonlySet<string> = new Set([
  "recruitment", "recruitments", "recruit", "notification", "notifications",
  "notice", "bharti", "vacancy", "vacancies", "apply", "application",
  "applications", "online", "post", "posts", "job", "jobs", "government",
  "govt", "new", "latest", "various", "staff", "advt", "advertisement",
  "declared", "out", "sarai", "sarkari", "for", "the", "and", "of", "in",
]);

/** The content words of a title, lowercased, de-duplicated, years dropped. */
export function vacancyTitleTokens(title: string): string[] {
  const seen = new Set<string>();
  for (const raw of (title ?? "").toLowerCase().split(/[^a-z0-9]+/)) {
    const t = raw.trim();
    if (!t) continue;
    if (/^20\d{2}$/.test(t)) continue;
    if (VACANCY_TITLE_STOPWORDS.has(t)) continue;
    seen.add(t);
  }
  return Array.from(seen);
}

export interface DuplicateVerdict {
  duplicate: boolean;
  /** 0..1 — the best of Jaccard and containment over the content words. */
  score: number;
  /** How many content words the two titles share. */
  shared: number;
}

/**
 * Two titles are the same job when they share at least TWO content words and the
 * overlap is at least 0.8 — either as a Jaccard score (same size, same words) or
 * as containment (one title's words are inside the other's, e.g. a district
 * variant of an all-state notice).
 */
export function vacancyTitleVerdict(a: string, b: string): DuplicateVerdict {
  const ta = new Set(vacancyTitleTokens(a));
  const tb = new Set(vacancyTitleTokens(b));
  if (ta.size === 0 || tb.size === 0) return { duplicate: false, score: 0, shared: 0 };
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const union = ta.size + tb.size - shared;
  const jaccard = union > 0 ? shared / union : 0;
  const containment = shared / Math.min(ta.size, tb.size);
  const score = Math.max(jaccard, containment);
  return { duplicate: shared >= 2 && score >= 0.8, score, shared };
}

/** The words a DB query may look for: the longest content words of the title. */
export function distinctiveTitleTokens(title: string, max = 3): string[] {
  return vacancyTitleTokens(title)
    .filter((t) => t.length >= 3)
    .sort((x, y) => y.length - x.length)
    .slice(0, max);
}
