/**
 * CMS wiring guard — the needs-verification backlog must exclude reference TEST
 * rows, and every exam list must badge them. Source-scan style, matching the
 * frontend guard, so a regression (a filter removed) fails the suite.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

describe("CMS excludes/badges reference TEST rows", () => {
  it("getVerificationQueue filters test slugs out of the real backlog", () => {
    const src = read("../services/examService.ts");
    expect(src).toContain('import { TEST_SLUG_LIKE } from "@/lib/testContent"');
    // the exclusion sits on the verification-queue query
    expect(src).toContain('.not("slug", "like", TEST_SLUG_LIKE)');
  });

  it("every exam list page imports and renders the TEST badge", () => {
    for (const p of [
      "../pages/entrance-exams/EntranceExamListPage.tsx",
      "../pages/exams/ExamsListPage.tsx",
      "../pages/university-exams/UniversityExamsListPage.tsx",
      "../pages/board-exams/BoardExamsListPage.tsx",
      "../pages/govt-exam/GovtExamListPage.tsx",
    ]) {
      const src = read(p);
      expect(src, p).toContain("TestBadge");
    }
  });

  it("the dashboard aggregates exclude reference TEST rows", () => {
    const dash = read("../pages/dashboard/DashboardPage.tsx");
    // every exams/content_posts count + the two recent-activity lists are guarded
    expect((dash.match(/.not\("slug", "like", TEST_SLUG_LIKE\)/g) || []).length).toBeGreaterThanOrEqual(9);
    // the pending-review badge is real-content only
    expect(read("../services/contentService.ts")).toContain('.not("slug", "like", TEST_SLUG_LIKE)');
  });
});
