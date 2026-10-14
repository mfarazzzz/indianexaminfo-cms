/**
 * noticePaste.ts — S2.14b helpers for an HTML-aware "paste the notice" box.
 *
 * Two jobs, both conservative:
 *  • extractAnchors(html) — pull {label, url} from the pasted page's <a href>s so
 *    the Important Links get REAL urls (a plain-text paste drops hrefs). The HTML
 *    is PARSED, never rendered. Nav links and javascript:/mailto:/tel: are dropped.
 *  • preCleanNotice(text) — optionally drop obvious aggregator chrome (nav,
 *    trending, related lists, comments, footer) WITHOUT ever deleting a line that
 *    could hold a date, a post name, a vacancy number or a link.
 *
 * Nothing here is a security boundary — the pipeline re-attests every URL against
 * the source before it is used. This only recovers what the paste already carried.
 */

export interface SourceLink { label: string; url: string }

const BAD_URL_SCHEME = /^\s*(javascript|data|vbscript|mailto|tel):/i;

/** Nav chrome labels that are never a real "important link". */
const NAV_LABELS = new Set([
  "home", "latest jobs", "results", "result", "admit card", "tools", "more",
  "search", "login", "sign up", "signup", "contact us", "about us", "share",
]);

/**
 * Parse pasted HTML for anchor label+href. Returns [] if there is no HTML or no
 * DOMParser (plain-text paste keeps working unchanged). De-duplicates by URL.
 */
export function extractAnchors(html: string): SourceLink[] {
  if (!html || typeof DOMParser === "undefined") return [];
  const out: SourceLink[] = [];
  const seen = new Set<string>();
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
      const url = (a.getAttribute("href") || "").trim();
      const label = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (!url || !label) continue;
      if (BAD_URL_SCHEME.test(url)) continue;
      if (NAV_LABELS.has(label.toLowerCase())) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ label, url });
    }
  } catch {
    return []; // malformed HTML → no anchors; the plain text still stands
  }
  return out;
}

/** A line that is clearly aggregator chrome. */
const CHROME_LINE = /^\s*(home|latest jobs|results?|admit card|tools|more|search|login|sign ?up|follow (us|now)|join now|subscribe now|get daily job alerts|trending now|quick links|related posts?|submit your question|comments?\b|designed (&|and) maintained|copyright|all rights reserved|share|whatsapp|telegram|instagram|twitter|facebook|koo|youtube|android app|apple ios app|windows app)\b/i;

/** A line we must NEVER drop — it could carry a fact. */
const KEEP_SIGNAL = /\d|https?:\/\/|www\.|\.pdf|application fee|eligibilit|vacancy|\bposts?\b|age limit|admit card|answer key|counselling|result|last date|start date|\bapply\b|download|notification|reference|advt|तारीख|आवेदन|फीस|आयु/i;

/**
 * Drop obvious chrome lines, but keep any line with a KEEP_SIGNAL (a number, a
 * date word, a post/fee/eligibility/vacancy/link token, a URL). Returns the
 * cleaned text and how many lines were removed. Opt-in; the raw text is always
 * available to the editor.
 */
export function preCleanNotice(text: string): { cleaned: string; removed: number } {
  const lines = text.split(/\r?\n/);
  let removed = 0;
  const kept = lines.filter((line) => {
    const t = line.trim();
    if (t && CHROME_LINE.test(t) && !KEEP_SIGNAL.test(t)) { removed++; return false; }
    return true;
  });
  return { cleaned: kept.join("\n"), removed };
}
