/**
 * R2.2 (b) — the ModulePanel "no applicability rule" flag.
 *
 * Owner decision 17 Oct: replace the silent fail-open with a VISIBLE flag. A
 * `module_registry` DB slug that has no MODULE_REGISTRY entry is still SHOWN
 * (nothing is hidden) but the card says "no rule yet". This test pins:
 *  - hasApplicabilityRule() agrees with the live DB/TS vocabulary gap;
 *  - the panel keeps (never hides) a rule-less slug and passes the flag down;
 *  - the card renders the flag only for a rule-less slug.
 *
 * The 12/13 slug lists are the LIVE module_registry rows read 17 Oct 2026 (22
 * rows, 21 active; `sample-papers` is the inactive one).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hasApplicabilityRule } from '@/config/moduleRegistry';

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');
const panelSrc = read('./ModulePanel.tsx');
const cardSrc = read('./ContentModuleCard.tsx');

/** Every active module_registry slug (21) + the inactive sample-papers (22). */
const DB_SLUGS = [
  'overview', 'eligibility', 'important-dates', 'application-process', 'exam-pattern',
  'syllabus', 'faqs', 'admit-card', 'result', 'cut-off', 'counselling', 'news',
  'vacancy-details', 'salary', 'age-limit', 'selection-process', 'documents-required',
  'reservation', 'date-sheet', 'revaluation', 'practical-exams',
];
const INACTIVE = ['sample-papers'];

describe('the DB/TS vocabulary gap is closed (R2.2 a landed)', () => {
  it('every one of the 21 ACTIVE module_registry slugs now has a TS rule', () => {
    expect(DB_SLUGS).toHaveLength(21);
    for (const s of DB_SLUGS) expect(hasApplicabilityRule(s), `${s} still has no rule`).toBe(true);
  });

  it('only the retired sample-papers row still has no rule', () => {
    for (const s of INACTIVE) expect(hasApplicabilityRule(s), s).toBe(false);
  });
});

describe('hasApplicabilityRule is the single rule-existence source', () => {
  it('agrees with MODULE_REGISTRY membership, not isModuleApplicable', () => {
    // a rule can exist yet not apply (correctly) — the flag is about EXISTENCE.
    expect(hasApplicabilityRule('salary')).toBe(true);            // rule present
    expect(hasApplicabilityRule('no-such-slug-xyz')).toBe(false); // absent
  });
});

describe('the panel shows a rule-less section and flags it — it never hides it', () => {
  it('a slug with no rule returns true (kept) in the applicability filter', () => {
    // the filter branch that keeps a rule-less module visible
    expect(panelSrc).toContain('if (!hasApplicabilityRule(m.slug)) return true;');
  });

  it('the panel passes the flag to the card from the same single source', () => {
    expect(panelSrc).toContain('noApplicabilityRule={!hasApplicabilityRule(mod.slug)}');
    expect(panelSrc).toContain('hasApplicabilityRule');
    expect(panelSrc).toMatch(/import \{[^}]*isModuleApplicable[^}]*hasApplicabilityRule[^}]*\} from "@\/config\/moduleRegistry"/);
  });

  it('the card renders the flag ONLY when it is set', () => {
    expect(cardSrc).toContain('noApplicabilityRule?: boolean');
    expect(cardSrc).toContain('{noApplicabilityRule && (');
    expect(cardSrc).toContain('data-testid={`no-applicability-rule-${module.slug}`}');
    // and a plain-words, honest label
    expect(cardSrc).toContain('no rule yet');
  });

  it('hiding is still driven only by a REAL failing rule, never by an unknown slug', () => {
    // the isModuleApplicable call sits AFTER the "no rule → show" short-circuit,
    // so a section without a rule can never reach the hide decision.
    const keepLine = panelSrc.indexOf('if (!hasApplicabilityRule(m.slug)) return true;');
    const hideLine = panelSrc.indexOf('return isModuleApplicable(m.slug, entityType, selectionModel);');
    expect(keepLine).toBeGreaterThan(-1);
    expect(hideLine).toBeGreaterThan(keepLine);
  });
});
