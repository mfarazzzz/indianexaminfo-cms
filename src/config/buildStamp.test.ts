import { describe, it, expect } from "vitest";
import { formatBuildStampContent } from "./buildStamp";

/**
 * The <meta name="build"> content is what a no-login deploy check reads, so its
 * exact shape ("sha sync iso", degrading to "dev") is worth pinning.
 */
describe("formatBuildStampContent", () => {
  it("renders sha + sync + iso time for a real release", () => {
    expect(
      formatBuildStampContent({ sha: "905b1e3", sync: "clean", time: "2026-10-01T01:22:00.000Z" }),
    ).toBe("905b1e3 clean 2026-10-01T01:22:00.000Z");
  });

  it("marks a dirty build so view-source flags an uncommitted deploy", () => {
    expect(
      formatBuildStampContent({ sha: "f6e0e32", sync: "dirty", time: "2026-09-30T04:27:45.000Z" }),
    ).toBe("f6e0e32 dirty 2026-09-30T04:27:45.000Z");
  });

  it("degrades to 'dev' when git produced no SHA", () => {
    expect(formatBuildStampContent({ sha: "unknown", sync: "unknown", time: "" })).toBe("dev");
    expect(formatBuildStampContent({ sha: "", sync: "clean", time: "x" })).toBe("dev");
    expect(formatBuildStampContent({})).toBe("dev");
  });

  it("falls back to 'unknown' sync and drops a missing time without trailing space", () => {
    expect(formatBuildStampContent({ sha: "abc1234" })).toBe("abc1234 unknown");
    expect(formatBuildStampContent({ sha: "abc1234", sync: "", time: "" })).toBe("abc1234 unknown");
  });
});
