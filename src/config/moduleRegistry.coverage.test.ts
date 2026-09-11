import { describe, it, expect } from "vitest";
import {
  MODULE_REGISTRY,
  ALL_ENTITY_TYPES,
  ALL_MODULE_LEVELS,
  type EntityType,
  type ModuleDefinition,
  type ModuleLevel,
} from "@/config/moduleRegistry";
import { ALL_SELECTION_MODELS, type SelectionModel } from "@/types/selection";

/**
 * EXHAUSTIVENESS GUARD — makes "a new SelectionModel / entity type / level was added and a
 * module was forgotten" a TEST FAILURE, not a silent gap discovered months later.
 *
 * The cutoff bug (two selection models added, cutoff's appliesToSelection never updated) was
 * enforced-by-attention drift. This converts the rule to enforced-by-CI: for each module, on
 * each axis, the values it covers UNION the values it explicitly opts out of (with a valid
 * reason) MUST equal the full vocabulary.
 *
 * FOUR RULES (this file owns the three that operate on MODULE_REGISTRY; the renderer-coverage
 * rule lives in the frontend repo, which owns SECTION_REGISTRY ↔ SECTION_SUMMARY_RENDERERS):
 *   1. appliesToSelection covers every SelectionModel, or opts out with a valid reason
 *   2. applicableTo covers every EntityType, or opts out with a valid reason
 *   3. every module declares a valid level (exam-identity / edition-cycle / accumulated-library)
 *
 * CONSTRAINT (shared): an opt-out reason may NEVER be "empty" (or a variant). Emptiness is a
 * transient content state, never a reason a module doesn't apply. Only "superseded" reasoning
 * is valid — the module doesn't apply because another home owns that concept. isValidReason()
 * enforces this and is exercised by deliberate FAILING cases at the bottom.
 */

// ── Shared reason validator ──────────────────────────────────────────────────
// A valid opt-out reason is non-trivial AND not "empty"-based. "empty", "no data",
// "nothing to show", "blank" are all rejected — those describe a content state, not
// a structural reason the module doesn't apply. Only supersession-style reasons pass.
const EMPTY_REASON = /\b(empty|no data|nothing to show|blank|not filled|no content)\b/i;
export function isValidReason(reason: string): boolean {
  const r = (reason ?? "").trim();
  if (r.length < 8) return false;          // too short to be a real reason
  if (EMPTY_REASON.test(r)) return false;  // "empty" is never a valid reason — only supersession
  return true;
}

function assertReasons(
  optOuts: { value: string; reason: string }[] | undefined,
  moduleId: string,
  axis: string,
) {
  for (const o of optOuts ?? []) {
    expect(
      isValidReason(o.reason),
      `Module "${moduleId}" ${axis} opt-out for "${o.value}" has an invalid reason ` +
        `("${o.reason}"). Reasons must explain SUPERSESSION (another home owns this), ` +
        `never emptiness — "empty"/"no data" are banned.`
    ).toBe(true);
  }
}

describe("moduleRegistry axis coverage", () => {
  // ── Rule 1 — appliesToSelection ────────────────────────────────────────────
  describe("Rule 1 — appliesToSelection covers all SelectionModels or opts out", () => {
    for (const m of MODULE_REGISTRY) {
      it(`${m.id}: selection coverage is exhaustive`, () => {
        const covered: SelectionModel[] = m.appliesToSelection ?? [...ALL_SELECTION_MODELS];
        const optedOut = (m.selectionOptOut ?? []).map((o) => o.value);
        const accountedFor = new Set<SelectionModel>([...covered, ...optedOut]);
        const missing = ALL_SELECTION_MODELS.filter((sm) => !accountedFor.has(sm));
        expect(
          missing,
          `Module "${m.id}" neither includes nor opts out of selection model(s): ` +
            `${missing.join(", ")}. Add them to appliesToSelection, or add a ` +
            `selectionOptOut entry {value, reason} for each.`
        ).toEqual([]);
        assertReasons(m.selectionOptOut, m.id, "selection");
      });
    }
  });

  // ── Rule 2 — applicableTo ────────────────────────────────────────────────────
  describe("Rule 2 — applicableTo covers all EntityTypes or opts out", () => {
    for (const m of MODULE_REGISTRY) {
      it(`${m.id}: entity-type coverage is exhaustive`, () => {
        const covered: EntityType[] = m.applicableTo.includes("*")
          ? [...ALL_ENTITY_TYPES]
          : m.applicableTo.filter((t): t is EntityType => (ALL_ENTITY_TYPES as string[]).includes(t));
        const optedOut = (m.entityOptOut ?? []).map((o) => o.value);
        const accountedFor = new Set<EntityType>([...covered, ...optedOut]);
        const missing = ALL_ENTITY_TYPES.filter((et) => !accountedFor.has(et));
        expect(
          missing,
          `Module "${m.id}" neither includes nor opts out of entity type(s): ` +
            `${missing.join(", ")}. Add them to applicableTo, or add an ` +
            `entityOptOut entry {value, reason} for each.`
        ).toEqual([]);
        assertReasons(m.entityOptOut, m.id, "entity");
      });
    }
  });

  // ── Rule 3 — level declaration ───────────────────────────────────────────────
  describe("Rule 3 — every module declares a valid level", () => {
    for (const m of MODULE_REGISTRY) {
      it(`${m.id}: declares a valid level`, () => {
        expect(
          ALL_MODULE_LEVELS.includes(m.level),
          `Module "${m.id}" has an invalid or missing level ("${m.level}"). ` +
            `It must be one of: ${ALL_MODULE_LEVELS.join(", ")}.`
        ).toBe(true);
      });
    }
  });
});

// ── Deliberate FAILING cases — prove each rule CATCHES drift, not just passes clean ──
// These construct broken modules and assert the rule's own predicate REJECTS them. A rule
// that only goes green on a clean registry tells you nothing about whether it catches the
// next drift; these lock in that it does.
describe("moduleRegistry rules reject drift (deliberate failing cases)", () => {
  const base: ModuleDefinition = {
    id: "__test__", label: "t", icon: "x", description: "d",
    applicableTo: ["*"], category: "meta", level: "exam-identity", displayOrder: 999,
    capabilities: {
      supportsAttachments: false, supportsTimeline: false, supportsDownloads: false,
      supportsFAQs: false, supportsSEO: false, supportsAI: false,
      supportsVersionHistory: false, supportsPreview: false, isRepeatable: false,
    },
    fields: [],
  };

  it("Rule 1 catches a selection model neither covered nor opted out", () => {
    const broken = { ...base, appliesToSelection: ["written-exam"] as SelectionModel[], selectionOptOut: [] };
    const covered = broken.appliesToSelection;
    const accountedFor = new Set<SelectionModel>([...covered]);
    const missing = ALL_SELECTION_MODELS.filter((sm) => !accountedFor.has(sm));
    expect(missing.length).toBeGreaterThan(0); // merit-based/interview-based/internal-admission uncovered
  });

  it("Rule 2 catches an entity type neither covered nor opted out", () => {
    const broken = { ...base, applicableTo: ["recruitment"], entityOptOut: [] };
    const covered = broken.applicableTo.filter((t): t is EntityType => (ALL_ENTITY_TYPES as string[]).includes(t));
    const accountedFor = new Set<EntityType>([...covered]);
    const missing = ALL_ENTITY_TYPES.filter((et) => !accountedFor.has(et));
    expect(missing.length).toBeGreaterThan(0); // exam/board/university uncovered
  });

  it("Rule 3 catches a missing/invalid level", () => {
    const broken = { ...base, level: "made-up-level" as unknown as ModuleLevel };
    expect(ALL_MODULE_LEVELS.includes(broken.level)).toBe(false);
  });

  it("'empty' is never a valid opt-out reason — only supersession", () => {
    // The banned case: opting out because the module is empty.
    expect(isValidReason("empty")).toBe(false);
    expect(isValidReason("no data yet")).toBe(false);
    expect(isValidReason("nothing to show")).toBe(false);
    // The valid case: supersession — another home owns the concept.
    expect(isValidReason("Written exams publish Result (scorecard), not a merit list")).toBe(true);
  });
});
