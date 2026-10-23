/**
 * Sidebar.navScroll.test.tsx — P2 item 18: the nav list must scroll inside itself, so
 * no group is ever clipped and the footer (View Site / user / build stamp) stays visible.
 *
 * The bug was a flexbox rule, not a missing overflow: a flex item's default min-height
 * is its CONTENT height, so `flex-1 overflow-y-auto` alone never scrolls — the list grew
 * past the viewport and everything below it was pushed off screen. `min-h-0` is what makes
 * the scroll real. This test pins the pair of classes rather than trusting a screenshot.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("./Sidebar.tsx", import.meta.url)), "utf8");

describe("Sidebar nav scroll container", () => {
  const nav = src.match(/<nav className="([^"]+)"/)?.[1] ?? "";

  it("exists and is the scroll container", () => {
    expect(nav).not.toBe("");
    expect(nav).toContain("overflow-y-auto");
  });

  it("carries min-h-0, without which flex-1 + overflow-y-auto never scrolls", () => {
    expect(nav).toMatch(/(^|\s)min-h-0(\s|$)/);
    expect(nav).toMatch(/(^|\s)flex-1(\s|$)/);
  });

  it("the aside itself does not scroll (only the nav does, so the footer is fixed)", () => {
    const aside = src.match(/<aside className=\{cn\(\s*"([^"]+)"/)?.[1] ?? "";
    expect(aside).toContain("flex");
    expect(aside).toContain("flex-col");
    expect(aside).not.toContain("overflow-y-auto");
  });
});
