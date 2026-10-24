/**
 * social.test.ts — E3 unit tests for the pure social-queue logic (no Deno, no fetch).
 * Covers: caption built from structured fields only (no invented facts, missing-date
 * case, Telegram-HTML escaping, hard max length), idempotency key, daily-cap boundary,
 * the kill_switch/dry_run/cap/config short-circuit order, and that the bot token never
 * appears in a caption, a payload, or a (redacted) log string.
 */
import { describe, it, expect } from "vitest";
import {
  buildCaption, escapeTelegramHtml, idempotencyKey, capExceeded,
  redactError, telegramPayload, evaluateQueueGate, officialHost,
  TELEGRAM_CAPTION_MAX,
} from "./social";

const TOKEN = "123456789:AA-supersecret-token-value-abcdefghij";

describe("buildCaption — structured fields only", () => {
  it("includes only the fields given; a missing date omits the date line", () => {
    const c = buildCaption({ examName: "SSC CGL 2026", derivedStatusLabel: "Applications open", dateLabel: null, dateISO: null, officialUrl: "https://ssc.gov.in/x?utm=1", pageUrl: "https://www.indianexaminfo.com/sarkari-naukri/ssc-cgl" });
    expect(c).toContain("SSC CGL 2026");
    expect(c).toContain("Applications open");
    expect(c).not.toContain("Last date");           // no date → no date line (never invented)
    expect(c).toContain("Official: ssc.gov.in");    // host only, no query
    expect(c).toContain("indianexaminfo.com/sarkari-naukri/ssc-cgl");
  });
  it("escapes Telegram HTML", () => {
    const c = buildCaption({ examName: "A & B <script>", derivedStatusLabel: "x", pageUrl: "u" });
    expect(c).toContain("&amp;");
    expect(c).toContain("&lt;script&gt;");
    expect(c).not.toContain("<script>");
  });
  it("clips to the hard max length", () => {
    const c = buildCaption({ examName: "N".repeat(2000), derivedStatusLabel: "", pageUrl: "u" });
    expect(c.length).toBeLessThanOrEqual(TELEGRAM_CAPTION_MAX);
  });
});

describe("helpers", () => {
  it("idempotencyKey is channel|sourceType|sourceId|event", () => {
    expect(idempotencyKey("telegram", "exam", "abc", "verified")).toBe("telegram|exam|abc|verified");
  });
  it("officialHost returns the host, tolerates junk", () => {
    expect(officialHost("https://uppsc.up.nic.in/Apply?x=1")).toBe("uppsc.up.nic.in");
    expect(officialHost("not a url")).toBe("");
    expect(officialHost(null)).toBe("");
  });
  it("capExceeded boundary at the IST-day count", () => {
    expect(capExceeded(19, 20)).toBe(false);
    expect(capExceeded(20, 20)).toBe(true);   // at the cap → stop
  });
  it("escapeTelegramHtml covers & < >", () => {
    expect(escapeTelegramHtml("<a>&")).toBe("&lt;a&gt;&amp;");
  });
});

describe("evaluateQueueGate — short-circuit order", () => {
  const ctx = { sentToday: 0, hasToken: true, hasChat: true };
  it("kill_switch wins over everything (posts nothing)", () => {
    expect(evaluateQueueGate({ kill_switch: true, dry_run: true, cap: 20 }, ctx)).toBe("killed");
  });
  it("dry_run next", () => {
    expect(evaluateQueueGate({ kill_switch: false, dry_run: true, cap: 20 }, ctx)).toBe("dry_run");
  });
  it("cap next", () => {
    expect(evaluateQueueGate({ kill_switch: false, dry_run: false, cap: 20 }, { ...ctx, sentToday: 20 })).toBe("cap_reached");
  });
  it("missing token/chat → config_missing", () => {
    expect(evaluateQueueGate({ kill_switch: false, dry_run: false, cap: 20 }, { sentToday: 0, hasToken: false, hasChat: true })).toBe("config_missing");
  });
  it("otherwise send", () => {
    expect(evaluateQueueGate({ kill_switch: false, dry_run: false, cap: 20 }, ctx)).toBe("send");
  });
});

describe("token safety", () => {
  it("redactError removes the token and any token-shaped run", () => {
    const msg = `Telegram 401 Unauthorized: bad token ${TOKEN} in call`;
    const r = redactError(msg, TOKEN);
    expect(r).not.toContain(TOKEN);
    expect(r).toContain("[redacted]");
    expect(redactError("see 123456789:AA-supersecret-token-value-abcdefghij", "")).not.toContain("supersecret");
  });
  it("telegramPayload never contains the token", () => {
    const p = telegramPayload("@chan", "hello");
    expect(JSON.stringify(p)).not.toContain(TOKEN);
  });
});
