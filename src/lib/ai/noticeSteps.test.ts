/**
 * noticeSteps.test.ts — B2/B4: the deterministic "How to …" detector, proven on
 * the REAL UPSSSC PET admit-card how-to block (the 8 steps), plus the model-step
 * validation (invented concrete nouns dropped) and the attested-URL rule.
 */
import { describe, it, expect } from "vitest";
import { detectHowToSteps, stepNounsInSource, filterModelSteps } from "./noticeSteps";

const PET_HOWTO = [
  "How to Download UPSSSC PET Admit Card & Check Exam Notice",
  "Visit the official UPSSSC website at upsssc.gov.in.",
  'On the homepage, navigate to the "Notice Board" or "Important Alerts" section.',
  'Click on the link corresponding to the "UPSSSC PET 2026 Exam Date / Admit Card".',
  "To download the admit card (once released), enter your Registration Number, Date of Birth, Gender, and Verification Code.",
  'Click on the "Download Admit Card" button.',
  "Your UPSSSC PET Admit Card will be displayed on the screen.",
  "Check your Exam City, Center Name, Exam Date, and Shift Timing carefully.",
  "Download and take a printout of the admit card to carry to the examination hall along with a valid ID proof and photographs as instructed.",
  "Some Useful Important Links",
  "Official Website",
].join("\n");

describe("detectHowToSteps — the PET 8-step how-to golden", () => {
  const blocks = detectHowToSteps(PET_HOWTO);
  it("finds one admit-card how-to block", () => {
    expect(blocks).toHaveLength(1);
    expect(blocks[0].module).toBe("admit-card");
  });
  it("extracts exactly the 8 instruction steps (not the heading, not the links section)", () => {
    expect(blocks[0].steps).toHaveLength(8);
    expect(blocks[0].steps[0].text).toMatch(/Visit the official UPSSSC website/);
    expect(blocks[0].steps[7].text).toMatch(/printout of the admit card/);
    // the "Some Useful Important Links" chrome is NOT a step
    expect(blocks[0].steps.some((s) => /Some Useful|Official Website$/i.test(s.text))).toBe(false);
  });
  it("every step keeps a verbatim source line", () => {
    for (const s of blocks[0].steps) expect(PET_HOWTO).toContain(s.sourceQuote);
  });
  it("no step introduces a URL that is not in the source", () => {
    for (const s of blocks[0].steps) {
      for (const url of s.text.match(/https?:\/\/\S+|\b[\w.-]+\.(?:gov|in|com)\b/gi) ?? []) {
        expect(PET_HOWTO.toLowerCase(), `unattested URL ${url}`).toContain(url.toLowerCase());
      }
    }
  });
  it("returns nothing when there is no how-to section", () => {
    expect(detectHowToSteps("Important Dates\nExam: 25 Oct 2026")).toEqual([]);
  });
});

describe("stepNounsInSource / filterModelSteps — invented model steps dropped", () => {
  it("keeps a paraphrased step whose concrete nouns appear in the source", () => {
    expect(stepNounsInSource("Enter your registration number and date of birth", PET_HOWTO)).toBe(true);
  });
  it("drops a step that invents a field the notice never mentions (OTP)", () => {
    expect(stepNounsInSource("Verify with the OTP sent to your mobile", PET_HOWTO)).toBe(false);
  });
  it("filterModelSteps keeps attested and drops invented", () => {
    const kept = filterModelSteps([
      { text: "Open the official website", sourceQuote: "" },
      { text: "Enter your OTP", sourceQuote: "" },
    ], PET_HOWTO);
    expect(kept.map((k) => k.text)).toEqual(["Open the official website"]);
  });
});
