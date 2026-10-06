/**
 * noticeMatch.ts — S2.5: before a NEW record, check whether the notice
 * actually belongs to an exam that already exists.
 *
 * The failure this prevents: every Phase-3 / extension / allotment notice
 * becoming its own record ("UP D.El.Ed Phase-3 2026") while the cycle record
 * sits behind. One record per cycle, many notices (domain ref (a)). When a
 * likely match is found the editor asks the human:
 *   "This notice looks like it belongs to <name> (<status>).
 *    Open it and review the changes there?"
 * and the extraction is CARRIED to that record (never re-pasted).
 *
 * Matching is deliberately dumb and explainable: short-name agreement, name
 * token overlap, conducting-body agreement, edition year. No embeddings —
 * every point scored can be shown next to the question it answered.
 */
import { getEntranceExams } from "@/services/entranceExamService";

/** sessionStorage key: the raw notice text carried to an existing record when
 *  the editor chose "Open it and review the changes there" (S2.5). */
export const NOTICE_HANDOFF_KEY = "s2.notice-handoff";

export interface NoticeFact {
  name?: string;
  shortName?: string;
  conductingBody?: string;
  year?: number;
}

export interface ExamCandidate {
  id: string;
  name: string;
  shortName: string;
  conductingBody: string;
  workflowStatus?: string;
}

export interface LikelyMatch {
  exam: ExamCandidate;
  score: number;   // 0–1
  reasons: string[];
}

/** Above this, we ask the editor to review on the existing record. */
export const MATCH_THRESHOLD = 0.55;

const norm = (s: string | undefined | null): string => (s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string): string[] => norm(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t));
const STOP = new Set(["the", "and", "for", "of", "exam", "test", "entrance", "admission", "central", "state"]);

export function scoreCandidate(candidate: ExamCandidate, fact: NoticeFact): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const cShort = norm(candidate.shortName);
  const nShort = norm(fact.shortName);
  // Spacing/punctuation variants must not hide an agreement: "UP D.El.Ed" and
  // "UP DELED" collapse to the same key.
  const cShortFlat = cShort.replace(/ /g, "");
  const nShortFlat = nShort.replace(/ /g, "");
  const cNameFlat = norm(candidate.name).replace(/ /g, "");
  if (cShortFlat && nShortFlat) {
    if (cShortFlat === nShortFlat) { score += 0.5; reasons.push(`same short name (${candidate.shortName})`); }
    else if (cShortFlat.includes(nShortFlat) || nShortFlat.includes(cShortFlat)) { score += 0.35; reasons.push("short names overlap"); }
    else if (cNameFlat && (cNameFlat.includes(nShortFlat) || nShortFlat.includes(cShortFlat))) { score += 0.25; reasons.push("short name appears in the record name"); }
  } else if (nShortFlat && cNameFlat.includes(nShortFlat)) {
    score += 0.3; reasons.push("short name appears in the record name");
  }

  const cNameToks = new Set(tokens(candidate.name));
  const nNameToks = tokens(fact.name ?? "");
  if (nNameToks.length && cNameToks.size) {
    const shared = nNameToks.filter((t) => cNameToks.has(t)).length;
    const frac = shared / Math.max(4, nNameToks.length); // 4 meaningful tokens ≈ full name
    score += Math.min(0.35, frac * 0.35);
    if (shared >= 2) reasons.push(`${shared} name words in common`);
  }

  const cBody = norm(candidate.conductingBody);
  const nBody = norm(fact.conductingBody);
  if (cBody && nBody && (cBody.includes(nBody) || nBody.includes(cBody) || cBody === nBody)) {
    score += 0.2;
    reasons.push(`same conducting body (${candidate.conductingBody})`);
  }

  if (fact.year && norm(candidate.name).includes(String(fact.year))) {
    score += 0.1;
    reasons.push(`same year (${fact.year})`);
  }

  return { score: Math.min(1, score), reasons };
}

/** Best candidate over a list, or null when nothing clears the threshold. */
export function pickLikelyMatch(candidates: ExamCandidate[], fact: NoticeFact): LikelyMatch | null {
  let best: LikelyMatch | null = null;
  for (const c of candidates) {
    const { score, reasons } = scoreCandidate(c, fact);
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { exam: c, score, reasons };
    }
  }
  return best;
}

/**
 * Search the live records the way a person would: by short name token and by
 * conducting body, within the pillar. Cheap (two indexed ILIKE queries) and
 * honest about what it looked at.
 */
export async function findLikelyExamMatch(fact: NoticeFact, pillar: string, year?: number): Promise<LikelyMatch | null> {
  const searchTerms = [norm(fact.shortName), tokens(fact.name ?? "").slice(0, 2).join(" "), norm(fact.conductingBody)]
    .map((s) => s.trim())
    .filter((s) => s.replace(/ /g, "").length >= 4); // "a b"-style junk never searches
  if (searchTerms.length === 0) return null;

  const seen = new Map<string, ExamCandidate>();
  for (const term of searchTerms.slice(0, 3)) {
    try {
      const list = await getEntranceExams({ search: term, pillar: pillar as never });
      for (const e of list) {
        seen.set(e.id, { id: e.id, name: e.name, shortName: e.shortName ?? "", conductingBody: e.conductingBody ?? "", workflowStatus: (e as { workflowStatus?: string }).workflowStatus });
      }
    } catch {
      // A failed read must NOT silently answer "no match" — that invites a
      // duplicate record. Report unknown by returning null only when we truly
      // have no candidates; callers treat null + thrown console as "ask human".
      console.warn("[noticeMatch] search failed for term:", term);
    }
  }
  return pickLikelyMatch([...seen.values()], { ...fact, year: year ?? fact.year });
}
