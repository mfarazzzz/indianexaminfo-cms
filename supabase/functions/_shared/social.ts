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

/** Idempotency key: two events for the same (channel, source, event) collapse. */
export function idempotencyKey(channel: string, sourceType: string, sourceId: string, event: string): string {
  return `${channel}|${sourceType}|${sourceId}|${event}`;
}

/** Daily-cap check on the Asia/Kolkata day (the count is produced by social_sent_today()). */
export function capExceeded(sentToday: number, cap: number): boolean {
  return sentToday >= cap;
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
