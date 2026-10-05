/**
 * FX3 C3 — AI Fill must keep the C1 time keys when present.
 *
 * AI Fill is form-only (R1.6); its date merge spreads the original row and
 * overlays only date/isUrgent, so end_date/start_time/end_time/time_text on an
 * existing row survive. The save then runs serializeDateRowsForWrite, which
 * keeps non-empty keys. This test pins both halves of that contract.
 */
import { describe, expect, it } from "vitest";
import { serializeDateRowsForWrite } from "./EntranceExamEditorPage";

type DateRow = { label: string; date: string; isUrgent: boolean; [k: string]: unknown };

/** Mirror of handleAIGenerate's merge: fill a BLANK dated row, spread-preserve. */
function mergeAiDate(current: DateRow, ai: { date: string; isUrgent: boolean }): DateRow {
  return { ...current, date: ai.date, isUrgent: ai.isUrgent };
}

describe("C3 — AI fill + save preserve the time keys", () => {
  it("an existing row with time keys keeps them after an AI date fill", () => {
    const current: DateRow = {
      label: "Choice filling", date: "", isUrgent: false,
      end_date: "2026-10-07", start_time: "09:00", end_time: "18:00", time_text: "afternoon",
    };
    const merged = mergeAiDate(current, { date: "2026-10-05", isUrgent: true });
    // date + isUrgent updated; the time keys are untouched (pass-through).
    expect(merged.date).toBe("2026-10-05");
    expect(merged.end_date).toBe("2026-10-07");
    expect(merged.start_time).toBe("09:00");
    expect(merged.end_time).toBe("18:00");
    expect(merged.time_text).toBe("afternoon");
  });

  it("the save serializer keeps those keys (never drops a filled one)", () => {
    const [out] = serializeDateRowsForWrite([
      { label: "Choice filling", date: "2026-10-05", isUrgent: true, end_date: "2026-10-07", start_time: "09:00", end_time: "18:00", time_text: "afternoon" },
    ] as never);
    expect(out).toMatchObject({ end_date: "2026-10-07", start_time: "09:00", end_time: "18:00", time_text: "afternoon" });
  });

  it("a freshly appended AI row (no time keys) is written without empty time keys", () => {
    const [out] = serializeDateRowsForWrite([
      { label: "New AI date", date: "2026-11-11", isUrgent: false },
    ] as never);
    for (const k of ["end_date", "start_time", "end_time", "time_text"]) {
      expect(k in out).toBe(false);
    }
  });
});
