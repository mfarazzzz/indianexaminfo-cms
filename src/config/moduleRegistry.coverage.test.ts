import { describe, it, expect } from "vitest";
import {
  MODULE_REGISTRY,
  ALL_ENTITY_TYPES,
  type EntityType,
} from "@/config/moduleRegistry";
import { ALL_SELECTION_MODELS, type SelectionModel } from "@/types/selection";

/**
 * EXHAUSTIVENESS GUARD — makes "a new SelectionModel / entity type was added and a
 * module was forgotten" a TEST FAILURE, not a silent gap discovered months later.
 *
 * The cutoff bug (two selection models added, cutoff's appliesToSelection never
 * updated) was enforced-by-attention drift. This converts the rule to
 * enforced-by-CI: for each module, on each axis, the values it covers UNION the
 * values it explicitly opts out of (with a reason) MUST equal the full vocabulary.
 *
 * When you add a value to SelectionModel or EntityType, every module that neither
 * covers nor opts out of it fails here — forcing a conscious per-module decision
 * at the point of the change.
 */

describe("moduleRegistry axis coverage", () => {
  describe("Axis 2 — appliesToSelection covers all SelectionModels or opts out", () => {
    for (const m of MODULE_REGISTRY) {
      it(`${m.id}: selection coverage is exhaustive`, () => {
        // Omitted appliesToSelection means "applies to ALL models" (per the
        // ModuleDefinition contract) — fully covered by definition.
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

        // Opt-outs must carry a non-empty reason (no silent opt-out).
        for (const o of m.selectionOptOut ?? []) {
          expect(o.reason.trim().length, `Module "${m.id}" selectionOptOut for "${o.value}" needs a reason`).toBeGreaterThan(0);
        }
      });
    }
  });

  describe("Axis 1 — applicableTo covers all EntityTypes or opts out", () => {
    for (const m of MODULE_REGISTRY) {
      it(`${m.id}: entity-type coverage is exhaustive`, () => {
        // "*" means all entity types — fully covered.
        const covered: EntityType[] = m.applicableTo.includes("*")
          ? [...ALL_ENTITY_TYPES]
          : (m.applicableTo.filter((t): t is EntityType =>
              (ALL_ENTITY_TYPES as string[]).includes(t)));
        const optedOut = (m.entityOptOut ?? []).map((o) => o.value);

        const accountedFor = new Set<EntityType>([...covered, ...optedOut]);
        const missing = ALL_ENTITY_TYPES.filter((et) => !accountedFor.has(et));

        expect(
          missing,
          `Module "${m.id}" neither includes nor opts out of entity type(s): ` +
            `${missing.join(", ")}. Add them to applicableTo, or add an ` +
            `entityOptOut entry {value, reason} for each.`
        ).toEqual([]);

        for (const o of m.entityOptOut ?? []) {
          expect(o.reason.trim().length, `Module "${m.id}" entityOptOut for "${o.value}" needs a reason`).toBeGreaterThan(0);
        }
      });
    }
  });
});
