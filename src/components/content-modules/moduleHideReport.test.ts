/**
 * R2.2 (a) — the READ-ONLY hide report and the stored-data guard.
 *
 * The owner asked (17 Oct) for a report that, for each of the 21 ACTIVE
 * module_registry slugs and each pillar, lists what WOULD be hidden if the new
 * rules were enforced, and to PROVE with the live counts that nothing currently
 * holding stored content_modules data would be hidden. This test does NOT switch
 * any hiding on — it asserts `enforceHiding: false` for all 12 new rules, and it
 * exercises `isSectionHideable` (the stored-data guard) so the future enforcement
 * path can be shown safe BEFORE it is turned on.
 *
 * Live facts baked in below (read 17 Oct 2026, project cwbhhcqsrbuoybeaondk):
 *   module_registry: 22 rows, 21 active (sample-papers is_active=false).
 *   content_modules key usage across exam_editions, per pillar — only these of
 *   the 12 newly-ruled slugs hold stored content at all:
 *     overview(12/27/99/99/38), eligibility(2/101/99/1), important-dates(11/27/
 *     99/98/38), news(11/27/99/99/39), application-process(2/4/3/1 incl. 1 BOARD
 *     edition). The other 7 (cut-off, salary, age-limit, selection-process,
 *     documents-required, reservation, practical-exams) hold ZERO stored rows.
 *   Counts per slug are entrance-exam / university-exam / government-exam /
 *   govt-vacancy / board-exam in that order (0 when a pillar has none).
 */
import { describe, expect, it } from 'vitest';
import {
  MODULE_REGISTRY, ALL_ENTITY_TYPES, isModuleApplicable, isHidingEnforced,
  isSectionHideable, hasApplicabilityRule, type EntityType,
} from '@/config/moduleRegistry';

/** The pillar→entity-type rule the whole app shares (entityTypeForPillar mirror). */
const PILLAR_TO_ENTITIES: Record<string, EntityType[]> = {
  'entrance-exam': ['exam', 'university-admission'],
  'government-exam': ['recruitment'],
  'govt-vacancy': ['recruitment'],
  'sarkari-naukri': ['recruitment'],
  'sarkari-bharti': ['recruitment'],
  'board-exam': ['board'],
  'board-university': ['board'],
  'university-exam': ['university-exam'],
  'university-admission': ['university-admission'],
};

const THE_12 = [
  'overview', 'eligibility', 'important-dates', 'application-process', 'cut-off',
  'news', 'salary', 'age-limit', 'selection-process', 'documents-required',
  'reservation', 'practical-exams',
];
const ALL_21_ACTIVE = [
  'overview', 'eligibility', 'important-dates', 'application-process', 'exam-pattern',
  'syllabus', 'faqs', 'admit-card', 'result', 'cut-off', 'counselling', 'news',
  'vacancy-details', 'salary', 'age-limit', 'selection-process', 'documents-required',
  'reservation', 'date-sheet', 'revaluation', 'practical-exams',
];

/** entity types that currently hold stored content for a slug (from the live SQL). */
const STORED_ENTITY_TYPES: Record<string, EntityType[]> = {
  'overview': ['exam', 'university-admission', 'university-exam', 'recruitment', 'board'],
  'eligibility': ['exam', 'university-admission', 'recruitment', 'board'],
  'important-dates': ['exam', 'university-admission', 'university-exam', 'recruitment', 'board'],
  'news': ['exam', 'university-admission', 'university-exam', 'recruitment', 'board'],
  'application-process': ['exam', 'university-admission', 'recruitment', 'board'],
  // the other 7 of the 12 hold no stored content_modules rows at all
};

describe('R2.2 (a): no hiding is switched on this turn', () => {
  it('all 12 new rules exist but are NOT enforced for hiding', () => {
    for (const s of THE_12) {
      expect(hasApplicabilityRule(s), `${s} should now have a rule`).toBe(true);
      expect(isHidingEnforced(s), `${s} hiding must stay OFF until owner approval`).toBe(false);
    }
  });

  it('isSectionHideable is false for every new slug on every entity type (enforce off)', () => {
    for (const s of THE_12) {
      for (const et of ALL_ENTITY_TYPES) {
        expect(isSectionHideable(s, et, undefined, false), `${s}/${et}`).toBe(false);
      }
    }
  });
});

describe('the stored-data guard: a section with content is never hidden', () => {
  it('isSectionHideable returns false whenever hasStoredData is true', () => {
    // Even for a slug+entity type whose rule WOULD hide it, stored data protects it.
    const wouldHide = THE_12
      .flatMap((s) => ALL_ENTITY_TYPES.map((et) => [s, et] as const))
      .filter(([s, et]) => !isModuleApplicable(s, et));
    expect(wouldHide.length, 'expected some rule+entity pairs to be non-applicable').toBeGreaterThan(0);
    for (const [s, et] of wouldHide) {
      expect(isSectionHideable(s, et, undefined, true), `${s}/${et} with data must not hide`).toBe(false);
    }
  });
});

describe('the hide report — nothing holding stored data would be hidden', () => {
  it('every slug/pillar pair with stored content is APPLICABLE (safe even before the guard)', () => {
    for (const [slug, entityTypes] of Object.entries(STORED_ENTITY_TYPES)) {
      for (const et of entityTypes) {
        expect(isModuleApplicable(slug, et), `${slug} holds data on ${et} but rule hides it`).toBe(true);
      }
    }
  });

  it('cross-check: for each active slug and pillar, a rule-hidden pair never has stored data', () => {
    const storedSet = new Set<string>();
    for (const [slug, ets] of Object.entries(STORED_ENTITY_TYPES)) for (const et of ets) storedSet.add(`${slug}::${et}`);

    const hiddenWouldBe: string[] = [];
    for (const slug of ALL_21_ACTIVE) {
      for (const [pillar, ets] of Object.entries(PILLAR_TO_ENTITIES)) {
        for (const et of ets) {
          const hideable = isSectionHideable(slug, et, undefined, storedSet.has(`${slug}::${et}`));
          // a stored-data pair can never be hideable
          if (storedSet.has(`${slug}::${et}`)) expect(hideable, `${slug} stored on ${pillar}`).toBe(false);
          if (hideable) hiddenWouldBe.push(`${slug}@${pillar}`);
        }
      }
    }
    // Prove the crux with the live counts: NO stored-data section appears in the
    // would-hide list, and every would-hide entry has zero stored rows.
    for (const entry of hiddenWouldBe) {
      const slug = entry.split('@')[0];
      expect(storedSet.has(`${slug}::exam`) || storedSet.has(`${slug}::board`)
        || storedSet.has(`${slug}::recruitment`) || storedSet.has(`${slug}::university-exam`)
        || storedSet.has(`${slug}::university-admission`),
      `${entry} would hide a slug that holds stored data`).toBe(false);
    }
  });

  it('prints the full WOULD-BE-HIDDEN table (axis-1, enforcement ignored) for the owner', () => {
    const lines: string[] = ['R2.2(a) hypothetical hide table — "H" = rule says hide (NOT enforced, enforceHiding:false):'];
    const header = ['slug'.padEnd(18), ...ALL_ENTITY_TYPES.map((e) => e.slice(0, 6).padEnd(7))];
    lines.push(header.join(' '));
    for (const slug of ALL_21_ACTIVE) {
      const cells = ALL_ENTITY_TYPES.map((et) => {
        const applicable = isModuleApplicable(slug, et);
        const mark = applicable ? '.' : 'H';
        return `${mark}${STORED_ENTITY_TYPES[slug]?.includes(et) ? '*' : ''}`.padEnd(7);
      });
      lines.push(`${slug.padEnd(18)} ${cells.join(' ')}`);
    }
    lines.push('* = slug holds stored content_modules data for that entity type (guard-protected, never hidden).');
    console.log('\n' + lines.join('\n'));
    // Sanity: the table is built from the same registry the panel uses.
    expect(MODULE_REGISTRY.filter((m) => m.enforceHiding === false)).toHaveLength(12);
    expect(lines.length).toBeGreaterThan(20);
  });
});
