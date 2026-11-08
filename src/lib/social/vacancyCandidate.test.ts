/**
 * vacancyCandidate.test.ts — owner batch 8, H3.
 *
 * Two things are pinned here:
 *
 *   1. THE PUBLISHED + VERIFIED RULE. A vacancy may only become a candidate when it is
 *      BOTH published (a reader can reach it) and verified (somebody checked it against
 *      the official notification).
 *
 *   2. THE TWO COPIES OF THE source_type VALUE AGREE. The CMS sends
 *      `source_type: "sarkari_naukri"` in the request body and the Edge Function writes
 *      `source_type: "sarkari_naukri"` into social_posts. The two live in different
 *      trees (the CMS `src` tree must not import from the Edge Function tree — the same
 *      reason `src/lib/testContent.ts` exists as a mirror), so the value is written
 *      twice and this test makes the two copies fail together if either drifts.
 *
 * The same text-comparison technique `supabase/functions/bundleLayout.test.ts` uses for
 * the test-slug rule.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  VACANCY_SOURCE_TYPE, VACANCY_CANDIDATE_EVENT, mayQueueVacancyCandidate,
} from "./vacancyCandidate";

const ROOT = resolve(__dirname, "..", "..", "..");   // the CMS repo root

describe("mayQueueVacancyCandidate — published AND verified, or nothing", () => {
  it("accepts a row that is both published and verified", () => {
    expect(mayQueueVacancyCandidate({
      workflowStatus: "published", verifiedAt: "2026-11-08T09:00:00Z",
    })).toBe(true);
  });

  it("refuses a published row that is not verified", () => {
    expect(mayQueueVacancyCandidate({ workflowStatus: "published", verifiedAt: null })).toBe(false);
    expect(mayQueueVacancyCandidate({ workflowStatus: "published" })).toBe(false);
  });

  it("refuses a verified row that is not published", () => {
    expect(mayQueueVacancyCandidate({ workflowStatus: "draft", verifiedAt: "2026-11-08T09:00:00Z" })).toBe(false);
    expect(mayQueueVacancyCandidate({ workflowStatus: "review", verifiedAt: "2026-11-08T09:00:00Z" })).toBe(false);
    expect(mayQueueVacancyCandidate({ workflowStatus: "archived", verifiedAt: "2026-11-08T09:00:00Z" })).toBe(false);
  });

  it("refuses an empty row", () => {
    expect(mayQueueVacancyCandidate({})).toBe(false);
    expect(mayQueueVacancyCandidate({ workflowStatus: null, verifiedAt: null })).toBe(false);
  });
});

describe("the CMS and the Edge Function agree on the vacancy source_type", () => {
  it("the shared edge module carries the same value", () => {
    const shared = readFileSync(resolve(ROOT, "supabase/functions/_shared/social.ts"), "utf8");
    const edge = /VACANCY_SOURCE_TYPE\s*=\s*"([^"]+)"/.exec(shared)?.[1];
    expect(edge, "the shared edge module lost VACANCY_SOURCE_TYPE").toBe(VACANCY_SOURCE_TYPE);
    expect(VACANCY_SOURCE_TYPE).toBe("sarkari_naukri");
  });

  it("the value is what the idempotency key is built from", () => {
    // channel|source_type|source_id|event — the owner's format, unchanged.
    expect(`telegram|${VACANCY_SOURCE_TYPE}|v1|${VACANCY_CANDIDATE_EVENT}`)
      .toBe("telegram|sarkari_naukri|v1|published");
  });
});
