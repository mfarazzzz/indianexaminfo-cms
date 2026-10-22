import { describe, it, expect } from "vitest";
import { isTestSlug, excludeTest, TEST_SLUG_LIKE } from "./testContent";

describe("CMS testContent mirror", () => {
  it("agrees with the frontend rule", () => {
    expect(TEST_SLUG_LIKE).toBe("zz-test-%");
    expect(isTestSlug("zz-test-board-exam")).toBe(true);
    expect(isTestSlug("up-board-class-10")).toBe(false);
    expect(isTestSlug(null)).toBe(false);
  });
  it("excludeTest drops test rows", () => {
    expect(excludeTest([{ slug: "a" }, { slug: "zz-test-b" }]).map((r) => r.slug)).toEqual(["a"]);
  });
});
