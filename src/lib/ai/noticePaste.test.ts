/**
 * S2.14b — noticePaste helpers (HTML anchor recovery + opt-in chrome strip).
 * Offline, deterministic. jsdom provides DOMParser. These are NOT security
 * boundaries; the pipeline re-attests every URL. This proves the paste layer
 * only recovers what the paste already carried and never deletes a fact line.
 */
import { describe, expect, it } from "vitest";
import { extractAnchors, preCleanNotice, looksLikeItHasLinks } from "./noticePaste";

describe("extractAnchors — recover real hrefs from a pasted page", () => {
  it("reads label+url from anchors and de-duplicates by URL", () => {
    const html = `
      <p>Apply now</p>
      <a href="https://www.rrbapply.gov.in/ntpc">  Apply   Online  </a>
      <a href="https://www.rrbcdg.gov.in/">Official Website</a>
      <a href="https://www.rrbcdg.gov.in/">Official Website (dup)</a>
    `;
    const out = extractAnchors(html);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ label: "Apply Online", url: "https://www.rrbapply.gov.in/ntpc" });
    expect(out[1].url).toBe("https://www.rrbcdg.gov.in/");
  });

  it("drops javascript:/mailto:/tel: schemes and nav chrome labels", () => {
    const html = `
      <a href="javascript:void(0)">Apply</a>
      <a href="mailto:help@example.gov.in">Contact</a>
      <a href="tel:+911800123456">Helpline</a>
      <a href="https://example.gov.in/home">Home</a>
      <a href="https://example.gov.in/latest-jobs">Latest Jobs</a>
      <a href="https://www.rrbapply.gov.in/ntpc">Apply Online</a>
    `;
    const urls = extractAnchors(html).map((a) => a.url);
    expect(urls).toEqual(["https://www.rrbapply.gov.in/ntpc"]);
  });

  it("skips anchors with no href or no text, and returns [] for empty / non-HTML", () => {
    expect(extractAnchors("")).toEqual([]);
    expect(extractAnchors("<p>no links here</p>")).toEqual([]);
    expect(extractAnchors('<a href=""></a><a>no href</a>')).toEqual([]);
  });
});

describe("preCleanNotice — strip obvious chrome, never a fact line", () => {
  it("removes nav / trending / footer chrome but keeps numbers, dates, URLs and facts", () => {
    const src = [
      "Home",
      "Latest Jobs",
      "Trending Now",
      "RRB NTPC Graduate Level Recruitment 2026",
      "Online Apply Start Date: 08 October 2026",
      "NTPC Graduate Level Posts: 3548 Posts",
      "Apply Online Link: https://www.rrbapply.gov.in/ntpc",
      "Copyright © 2026 Aggregator",
      "Share on WhatsApp",
    ].join("\n");
    const { cleaned, removed } = preCleanNotice(src);
    expect(removed).toBeGreaterThan(0);
    expect(cleaned).toContain("08 October 2026");
    expect(cleaned).toContain("3548 Posts");
    expect(cleaned).toContain("https://www.rrbapply.gov.in/ntpc");
    expect(cleaned).not.toContain("Trending Now");
    expect(cleaned).not.toMatch(/^Home$/m);
  });

  it("NEVER drops a chrome-looking line that also carries a number or date word", () => {
    // "Result" is a nav label, but a line "Result 12 October 2026" is a fact.
    const src = "Result 12 October 2026 declared";
    const { cleaned, removed } = preCleanNotice(src);
    expect(removed).toBe(0);
    expect(cleaned).toBe(src);
  });

  it("keeps Hindi fact lines (fee/date/vacancy words) untouched", () => {
    const src = ["आवेदन तिथि: 08 अक्टूबर 2026", "फीस: ₹ 500/-", "कुल पद: 3548"].join("\n");
    const { cleaned, removed } = preCleanNotice(src);
    expect(removed).toBe(0);
    expect(cleaned).toBe(src);
  });

  it("an all-chrome page cleans to empty (nothing survived the filter)", () => {
    // Only unambiguous chrome: no digit, no URL, no fact keyword substring.
    const src = ["Home", "Latest Jobs", "Tools", "More", "Search", "Login", "Subscribe Now"].join("\n");
    const { cleaned } = preCleanNotice(src);
    expect(cleaned.trim()).toBe("");
  });
});

describe("looksLikeItHasLinks — nudge a linkless plain-text paste", () => {
  it("true for anchor-style phrases that a plain paste stripped of its href", () => {
    expect(looksLikeItHasLinks("UP Police — Apply Online: Click Here to register")).toBe(true);
    expect(looksLikeItHasLinks("Download the Notification PDF for details")).toBe(true);
    expect(looksLikeItHasLinks("Correction link is active till 12 Oct")).toBe(true);
    expect(looksLikeItHasLinks("Visit official website for the short notice")).toBe(true);
  });

  it("false for a bare URL — it survives a plain paste and needs no HTML re-paste", () => {
    expect(looksLikeItHasLinks("Form: https://rrbapply.gov.in/ntpc")).toBe(false);
  });

  it("false for a fact-only notice with no link placeholders", () => {
    expect(looksLikeItHasLinks("RRB NTPC Graduate Level 2026 — 3548 posts, apply by 10 Oct 2026")).toBe(false);
  });

  it("false for empty / non-text", () => {
    expect(looksLikeItHasLinks("")).toBe(false);
    expect(looksLikeItHasLinks(undefined as unknown as string)).toBe(false);
  });
});
