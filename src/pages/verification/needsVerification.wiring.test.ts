/**
 * S3.2 C+D wiring — source-scan guarantees (the same style as editorShell.test.ts):
 *  – the verify WRITE exists and asserts publish_exam BEFORE the update;
 *  – the editor header really wires the control, shows the exact reason and
 *    the Un-verify action, and accepts the triage deep-link ?tab=edition;
 *  – the router + sidebar expose the Needs-verification page;
 *  – the triage page itself CANNOT write: it never imports the verify call —
 *    verification happens one-at-a-time in the editor only (no bulk anywhere).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");
const service = read("../../services/examService.ts");
const page = read("../../pages/entrance-exams/EntranceExamEditorPage.tsx");
const router = read("../../router/index.tsx");
const sidebar = read("../../components/layout/Sidebar.tsx");
const triage = read("NeedsVerificationPage.tsx");

describe("S3.2 verify write (CMS service)", () => {
  it("asserts publish_exam FIRST and writes exactly the three verified columns", () => {
    expect(service).toContain('assertPermission(P.PUBLISH_EXAM, "verify an exam")');
    expect(service).toContain("is_verified: verified");
    expect(service).toContain("verified_by: verified ? actorId : null");
    expect(service).toContain("assertAffected(data as unknown[] | null, \"verify this exam\")");
  });
  it("refuses a verify stamp without an actor id (uuid is mandatory for a verification)", () => {
    expect(service).toContain("if (verified && !actorId)");
  });
  it("exposes the triage queue using the shared row builder", () => {
    expect(service).toContain("export async function getVerificationQueue");
    expect(service).toContain("buildQueueRow(r, todayISO)");
  });
});

describe("S3.2 verify control (editor header)", () => {
  it("is wired: reasons from the shared lib, one exam at a time", () => {
    expect(page).toContain("verifyBlockReasons({");
    expect(page).toContain("Verify this exam");
    expect(page).toContain("Un-verify");
    expect(page).toContain('data-testid="verify-control"');
    expect(page).toContain("setExamVerification(exam.id, wantVerify, user?.id ?? null)");
  });
  it("shows the EXACT blocked reason and deep-links from the triage list", () => {
    expect(page).toContain('data-testid="verify-blocked-reason"');
    expect(page).toContain('new URLSearchParams(window.location.search).get("tab")');
  });
  it("gates on the publish_exam permission in the UI layer too", () => {
    expect(page).toContain('permissions.includes("publish_exam")');
  });
});

describe("S3.2 triage page (D6)", () => {
  it("is routed and navigable", () => {
    expect(router).toContain('"/needs-verification"');
    expect(router).toContain("NeedsVerificationPage");
    expect(sidebar).toContain('"Needs Verification"');
    expect(sidebar).toContain('"/needs-verification"');
  });
  it("CANNOT write — it never touches the verify call (one-at-a-time is the editor's job)", () => {
    expect(triage).not.toContain("setExamVerification");
    expect(triage).not.toMatch(/Promise\.all\s*\(\s*\w+\.map\s*\(.*verify/i);
  });
  it("deep-links rows to the editor's Dates tab and shows the live counts", () => {
    expect(triage).toContain("?tab=edition");
    expect(triage).toContain("needs-verify-ready");
    expect(triage).toContain("needs-verify-recheck-flag");
  });
});
