/**
 * vacancySlug.ts — the vacancy slug pattern AS IT ACTUALLY IS, measured on the live
 * corpus (read-only census on 2026-11-08: 361 rows, all published).
 *
 * THE MEASURED FACTS this file encodes (no guessing):
 *   361/361 slugs are lowercase kebab-case; 360/361 carry a 4-digit year
 *   (358 of them say "2026"); max length 53, mean 35.6; 0 over 60.
 *   131/361 END with the year; 229/361 have the year FOLLOWED BY MORE
 *   ({state}-{subject}-{year}-{locality}); 1/361 carries no year at all.
 *
 * The shape is, in the corpus's own words:
 *   {state-token}-{subject-slug}-{year}[-{locality}]
 * where the state token is what the corpus actually uses:
 *   uttar-pradesh → "up" (86 of 87 rows)      madhya-pradesh → "mp" (28 of 31)
 *   every OTHER state → its own slug IN FULL (andhra-pradesh 3/3, west-bengal 8/8,
 *   tamil-nadu 6/6, himachal-pradesh 1/1, chhattisgarh 8/10, rajasthan, bihar, …)
 *   all-india rows carry NO state token — they start with the BODY token
 *   (ssc, rrb, upsc, ibps, sbi, drdo, esic, …).
 *
 * A SECOND census on 2026-11-08 (the same live corpus, a per-state token count)
 * corrected two claims the first one made: the default is the state's FULL slug, not
 * the label's first word ("andhra-pradesh", not "andhra"; "west-bengal", not "west";
 * "tamil-nadu", not "tamil"), and the two ABBREVIATED states never carry the
 * spelled-out name as well ("up-police-constable-2026", never
 * "up-uttar-pradesh-police-constable-2026").
 *
 * WHY THE SUBJECT IS BUILT FROM THE TITLE'S OWN WORD ORDER: the corpus slugs mirror
 * their titles, minus the noise. "West Bengal Anganwadi 2026 South 24 Parganas – 720
 * Posts" → "west-bengal-anganwadi-2026-south-24-parganas"; "Bihar NHM Lab Technician
 * 2026 All Districts – 1,800 Posts" → "bihar-nhm-lab-technician-2026-all-districts".
 * A mechanical transform of the title therefore reproduces the corpus shape exactly.
 * The NOISE that is dropped is the post-count clause, the "via X" clause and the words
 * "recruitment / notification / notice / advertisement / online / apply".
 *
 * IMPORTANT — the corpus was written by HAND and is not perfectly consistent
 * ("rajasthan-gram-sevak-bharti-2026" keeps "bharti"; "cg-nhm-pharmacist-bharti-2026"
 * uses "cg" where 8 of 10 Chhattisgarh rows spell it out). So this module PROPOSES a
 * slug; the editor edits it. What it must never do is invent a shape the corpus does
 * not use — hence the state-token map above and the year-last placement.
 */

/**
 * The two states whose corpus token is an ABBREVIATION, not the state's own slug.
 * Every other state keeps its slug in full.
 */
export const STATE_TOKEN_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({
  "uttar-pradesh": "up",
  "madhya-pradesh": "mp",
});

/** True when the corpus abbreviates this state (the slug's own words are dropped). */
export function isAbbreviatedState(stateSlug?: string | null): boolean {
  const slug = (stateSlug ?? "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(STATE_TOKEN_OVERRIDES, slug);
}

/** All-India vacancies carry no state token — their slug starts with the body token. */
export const ALL_INDIA = "all-india";

/**
 * The corpus's state token for a region.
 *
 * The DEFAULT is the state's own slug IN FULL — the census says so: andhra-pradesh
 * 3/3, west-bengal 8/8, tamil-nadu 6/6, himachal-pradesh 1/1, chhattisgarh 8/10.
 * Only uttar-pradesh and madhya-pradesh are abbreviated ("up", "mp"), and those are
 * the STATE_TOKEN_OVERRIDES. `stateLabel` is the region label from the `regions`
 * table ("Uttar Pradesh", "West Bengal", …) and is used only when no region slug is
 * available at all.
 */
export function stateToken(stateSlug?: string | null, stateLabel?: string | null): string {
  const slug = (stateSlug ?? "").trim().toLowerCase();
  if (slug === ALL_INDIA) return "";
  if (!slug) {
    const label = (stateLabel ?? "").trim().toLowerCase();
    if (!label) return "";
    return (label.split(/\s+/)[0] ?? "").replace(/[^a-z0-9]/g, "");
  }
  const override = STATE_TOKEN_OVERRIDES[slug];
  if (override) return override;
  return slug;
}

/** Noise clauses and words that never survive into a corpus slug. */
const POST_COUNT_CLAUSE = /\s*[–—\-]\s*\d[\d,]*\s*(?:posts?|vacanc(?:y|ies)|positions?|vacancies)\s*$/i;
const VIA_CLAUSE = /\s+via\s+[^,–—-]*$/i;
const NOISE_WORDS = /\b(recruitment|recruitments?|notification|notifications?|notice|advertisement|advt|online|apply|apply\s*online|applications?)\b/gi;
/** The trailing document word — "… Recruitment 2026 Notification". */
const TRAILING_DOC_WORD = /\s+(recruitment|notification|notice|advertisement|advt)\s*$/i;

export interface SlugProposalInput {
  /** The vacancy title (the editor's own wording, or the extracted proposal). */
  title: string;
  /** The region slug ("uttar-pradesh", "all-india"). */
  state?: string | null;
  /** The region label ("Uttar Pradesh") — the default state-token rule reads it. */
  stateLabel?: string | null;
  /** The cycle year; appended when the title carries none. */
  year?: number | string | null;
  /** Hard cap (the corpus max is 53; 60 leaves room for a locality suffix). */
  maxLength?: number;
}

/** The subject part of a slug: the title minus the corpus's noise, kebab-cased.
 *  The YEAR STAYS WHERE THE TITLE PUTS IT — the corpus does the same
 *  ("west-bengal-anganwadi-2026-south-24-parganas"), so it is not moved to the end. */
export function vacancySubject(title: string): string {
  let t = (title ?? "").trim();
  t = t.replace(VIA_CLAUSE, "");
  t = t.replace(POST_COUNT_CLAUSE, "");
  t = t.replace(TRAILING_DOC_WORD, "");
  t = t.replace(NOISE_WORDS, " ");
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Propose a slug in the corpus's shape: {state-token}-{subject}-{year}.
 * The state token is prefixed only when the subject does not already start with it
 * (the corpus spells the state out in the title for most rows).
 */
export function proposeVacancySlug(input: SlugProposalInput): string {
  const max = input.maxLength ?? 60;
  const subject = vacancySubject(input.title ?? "");
  const stateSlug = (input.state ?? "").trim().toLowerCase();
  const token = stateToken(stateSlug, input.stateLabel);
  const year = String(input.year ?? "").trim();

  let parts: string[] = subject ? subject.split("-").filter(Boolean) : [];

  // 1. The corpus ABBREVIATES two states. When the title spells such a state out
  //    ("Uttar Pradesh Police Constable"), those words are DROPPED and the token
  //    stands in for them — the corpus never carries both forms (86 of 87 UP rows
  //    start "up-" and NONE starts "uttar-pradesh-"; the same for madhya-pradesh:
  //    28 of 31 start "mp-"). Measured on the live corpus 2026-11-08.
  if (isAbbreviatedState(stateSlug)) {
    const stateWords = stateSlug.split("-").filter(Boolean);
    if (stateWords.length && stateWords.every((w, i) => parts[i] === w)) {
      parts = parts.slice(stateWords.length);
    }
  }

  // 2. The state token goes FIRST, unless the title already leads with it. When the
  //    title carries the state somewhere else, those words are removed so the slug
  //    never repeats it ("bihar-nhm-lab-technician-bihar-2026" is not a shape the
  //    corpus uses).
  const tokenWords = token ? token.split("-").filter(Boolean) : [];
  if (tokenWords.length) {
    const leads = tokenWords.every((w, i) => parts[i] === w);
    if (!leads) {
      for (let i = 0; i + tokenWords.length <= parts.length; i++) {
        if (tokenWords.every((w, k) => parts[i + k] === w)) {
          parts = [...parts.slice(0, i), ...parts.slice(i + tokenWords.length)];
          break;
        }
      }
      parts = [...tokenWords, ...parts];
    }
  }

  if (year && !parts.includes(year)) parts = [...parts, year];

  let slug = parts.join("-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (slug.length > max) {
    slug = slug.slice(0, max);
    const cut = slug.lastIndexOf("-");
    if (cut > 0) slug = slug.slice(0, cut);
  }
  return slug;
}

/**
 * The slug shape check — used by the duplicate check and by the editor's warning.
 * A proposed slug must be lowercase kebab-case and carry no path characters.
 */
export function isVacancySlugShape(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test((slug ?? "").trim());
}
