/**
 * _shared/social.ts — the PURE logic behind the social queue (S7.1b). No Deno APIs
 * here, so the unit tests (supabase/functions/_shared/social.test.ts) import it
 * directly and the two Edge Functions share one copy.
 *
 * Hard rules (owner batch 2, Phase E):
 *   • the caption is built ONLY from STRUCTURED fields (exam name, derived status,
 *     the one date that matters, the official link HOST, the page URL) — never free
 *     text scraped from a source notice;
 *   • Telegram HTML is escaped; a hard max length is enforced;
 *   • the bot token is NEVER in a caption, a payload, or a logged string (redact).
 */

export const TELEGRAM_CAPTION_MAX = 1024; // Telegram caption limit for a photo; text messages allow 4096.

/** Escape the three characters Telegram HTML mode cares about. */
export function escapeTelegramHtml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The host of an official URL, or "" — never the whole (possibly tracking-laden) URL. */
export function officialHost(url: string | null | undefined): string {
  try { return url ? new URL(url).host : ""; } catch { return ""; }
}

/**
 * The frontend's canonical-URL resolver for one record (app/go/[slug]/route.ts). The CMS
 * deliberately builds NO public URLs of its own — the pillar → URL-segment fact lives in the
 * frontend only — so /go/{slug} IS "the real reader URL", answered with a 308 to it.
 */
export function goResolverUrl(siteUrl: string, slug: string): string {
  const base = (siteUrl || "").replace(/\/+$/, "");
  if (!base || !slug) return "";
  return `${base}/go/${encodeURIComponent(slug.trim().toLowerCase())}`;
}

/** True when `url` is an http(s) URL on the same host as `siteUrl` (the public site). */
export function isSameSiteUrl(url: string, siteUrl: string): boolean {
  try {
    const u = new URL(url), s = new URL(siteUrl);
    return (u.protocol === "https:" || u.protocol === "http:") && u.host === s.host;
  } catch { return false; }
}

/**
 * The landing URL a candidate may carry (owner batch 3, H-3a).
 *
 * BEFORE, social-candidate fell back to `page_url || SUPABASE_URL` and BOTH CMS callers
 * passed page_url: "" — so every candidate would have posted the Supabase project host
 * (https://<ref>.supabase.co) instead of the reader page. The fallback is removed here:
 * a candidate with no site origin configured is refused (the caller returns 502) rather
 * than silently publishing the wrong host.
 *
 * Order: the caller's own-site page_url wins; otherwise the /go/{slug} resolver.
 */
export function pickLandingUrl(input: { pageUrl?: string; slug?: string; siteUrl: string }): string {
  const explicit = (input.pageUrl || "").trim();
  if (explicit && isSameSiteUrl(explicit, input.siteUrl)) return explicit;
  return goResolverUrl(input.siteUrl, input.slug || "");
}

/** Idempotency key: two events for the same (channel, source, event) collapse. */
export function idempotencyKey(channel: string, sourceType: string, sourceId: string, event: string): string {
  return `${channel}|${sourceType}|${sourceId}|${event}`;
}

/** Daily-cap check on the Asia/Kolkata day (the count is produced by social_sent_today()). */
export function capExceeded(sentToday: number, cap: number): boolean {
  return sentToday >= cap;
}

/**
 * J2-4 — the batch size the publish worker may claim: cap - sent_today - currently_queued,
 * never negative. 'queued' rows count as spent capacity (a claim still in flight is not
 * free), so ignoring them would let a caller push the day past its cap. Pure so a unit test
 * pins the arithmetic and the clamp; the two numbers come from social_sent_today() and
 * social_queued_count().
 */
export function queueHeadroom(cap: number, sentToday: number, currentlyQueued: number): number {
  // PostgREST hands back null for count(*) over an empty set only in odd shapes, and a
  // failed rpc() call leaves the value undefined; NaN would poison the comparison and a
  // NaN headroom reads as "no capacity", which silently stalls the queue. Coerce first.
  const int = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  };
  const room = int(cap) - int(sentToday) - int(currentlyQueued);
  return room > 0 ? room : 0;
}

/**
 * J3 — the reference TEST content must never be posted. The rule is the ONE definition this
 * platform already uses (frontend lib/testContent.ts, mirrored byte-identically in
 * src/lib/testContent.ts): test identity is purely the lowercase slug prefix.
 */
export const TEST_SLUG_PREFIX = "zz-test-";

export function isTestSlug(slug: string | null | undefined): boolean {
  return typeof slug === "string" && slug.trim().toLowerCase().startsWith(TEST_SLUG_PREFIX);
}

/**
 * True when a landing URL points AT reference test content — i.e. any path SEGMENT begins
 * with the test prefix (the exam/vacancy slug is the last segment of a public URL).
 * Checked segment-wise rather than as a substring so a real slug that merely contains the
 * letters cannot be refused, and so a test slug cannot hide behind an encoded slash.
 */
export function landingUrlIsTest(url: string | null | undefined): boolean {
  if (!url) return false;
  let path = String(url);
  try { path = new URL(url).pathname; } catch { /* a relative path is fine to inspect as-is */ }
  return path.split("/").some((seg) => isTestSlug(decodeURIComponent(seg)));
}

export interface CaptionInput {
  examName: string;
  derivedStatusLabel: string;      // e.g. "Applications open" — from the derived status, not free text
  dateLabel?: string | null;       // e.g. "Last date"
  dateISO?: string | null;         // the ONE date that matters (YYYY-MM-DD)
  officialUrl?: string | null;     // official/attested link (host only is used)
  pageUrl: string;                 // our landing page
}

/**
 * Build the caption from structured fields only. Missing pieces are simply omitted —
 * nothing is invented. Escaped for Telegram HTML; clipped to the max length.
 */
export function buildCaption(i: CaptionInput): string {
  const name = escapeTelegramHtml((i.examName ?? "").trim());
  const status = escapeTelegramHtml((i.derivedStatusLabel ?? "").trim());
  const lines: string[] = [];
  if (name) lines.push(`<b>${name}</b>`);
  if (status) lines.push(status);
  if (i.dateLabel && i.dateISO) {
    lines.push(`${escapeTelegramHtml(i.dateLabel)}: ${escapeTelegramHtml(formatDateIN(i.dateISO))}`);
  }
  const host = officialHost(i.officialUrl);
  if (host) lines.push(`Official: ${escapeTelegramHtml(host)}`);
  if (i.pageUrl) lines.push(escapeTelegramHtml(i.pageUrl));
  const out = lines.join("\n");
  return out.length > TELEGRAM_CAPTION_MAX ? out.slice(0, TELEGRAM_CAPTION_MAX - 1) + "…" : out;
}

/** DD Mon YYYY (en-IN) — a stable, reader-friendly date. */
export function formatDateIN(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Redact the bot token (and any long secret-looking run) from a string before it is
 * logged or stored, and clip to 500 chars. The token must NEVER appear anywhere.
 */
export function redactError(message: string, token: string): string {
  let out = String(message ?? "");
  if (token) out = out.split(token).join("[redacted]");
  out = out.replace(/\b\d{8,}:[A-Za-z0-9_-]{30,}\b/g, "[redacted-token]"); // bot-token shape
  return out.slice(0, 500);
}

/** The exact Telegram sendMessage payload (auditable; token is NOT part of it). */
export function telegramPayload(chatId: string, caption: string) {
  return { chat_id: chatId, text: caption, parse_mode: "HTML", disable_web_page_preview: false };
}

/**
 * The ONE place the queue gate is decided, so the short-circuits are testable without
 * running Deno. Order matters: kill_switch first, then dry_run, then cap, then config.
 */
export type QueueDecision = "killed" | "dry_run" | "cap_reached" | "config_missing" | "send";
export function evaluateQueueGate(
  cfg: { kill_switch: boolean; dry_run: boolean; cap: number },
  ctx: { sentToday: number; hasToken: boolean; hasChat: boolean },
): QueueDecision {
  if (cfg.kill_switch) return "killed";
  if (cfg.dry_run) return "dry_run";
  if (capExceeded(ctx.sentToday, cfg.cap)) return "cap_reached";
  if (!ctx.hasToken || !ctx.hasChat) return "config_missing";
  return "send";
}
