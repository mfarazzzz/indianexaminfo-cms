/**
 * R2.2 — the selection-question config (src/config/selectionQuestion.ts).
 *
 * Pins the owner's 17 Oct decisions as executable rules:
 *  - entrance-exam offers EXACTLY six answers, each a valid (entity, model) pair;
 *  - every other (fixed) pillar offers only the legal models for its fixed
 *    entity type — 3 or 4, never internal-admission unless the type is a
 *    university admission;
 *  - NO default: nothing here is pre-selected and the answered-check is strict;
 *  - LABELS ARE PLAIN — no "GATE", no technical slug shown as the label.
 *
 * Behavioural (not structural): it imports and calls the real functions.
 */
import { describe, expect, it } from 'vitest';
import { ALL_ENTITY_TYPES, type EntityType } from '@/config/moduleRegistry';
import { ALL_SELECTION_MODELS } from '@/types/selection';
import {
  answersForPillar, selectedAnswerId, isSelectionAnswered, answerIdFor,
  selectionHelperText, ENTRANCE_EXAM_ANSWERS, LEGAL_MODELS_BY_ENTITY,
  SELECTION_QUESTION,
} from '@/config/selectionQuestion';

describe('entrance-exam: the six answers', () => {
  it('offers exactly six answers, and answersForPillar returns them verbatim', () => {
    expect(ENTRANCE_EXAM_ANSWERS).toHaveLength(6);
    expect(answersForPillar('entrance-exam')).toEqual(ENTRANCE_EXAM_ANSWERS);
  });

  it('every answer is a real (entity, model) pair with a legal model for its entity type', () => {
    for (const a of ENTRANCE_EXAM_ANSWERS) {
      expect(ALL_ENTITY_TYPES, a.id).toContain(a.entityType);
      expect(ALL_SELECTION_MODELS, a.id).toContain(a.selectionModel);
      expect(LEGAL_MODELS_BY_ENTITY[a.entityType], `${a.id} not legal for ${a.entityType}`).toContain(a.selectionModel);
    }
  });

  it('both entrance-exam entity types and all four models appear across the six', () => {
    const entities = new Set(ENTRANCE_EXAM_ANSWERS.map((a) => a.entityType));
    expect([...entities].sort()).toEqual(['exam', 'university-admission']);
    const models = new Set(ENTRANCE_EXAM_ANSWERS.map((a) => a.selectionModel));
    expect([...models].sort()).toEqual([...ALL_SELECTION_MODELS].sort());
  });

  it('ids are unique and derived from the pair', () => {
    const ids = ENTRANCE_EXAM_ANSWERS.map((a) => a.id);
    expect(new Set(ids).size).toBe(6);
    for (const a of ENTRANCE_EXAM_ANSWERS) expect(a.id).toBe(answerIdFor(a.entityType, a.selectionModel));
  });
});

describe('fixed pillars: only the legal models for the fixed entity type', () => {
  // pillar -> the fixed entity type it resolves to (mirrors entityTypeForPillar).
  const cases: [string, EntityType, number][] = [
    ['government-exam', 'recruitment', 3],
    ['govt-vacancy', 'recruitment', 3],
    ['sarkari-naukri', 'recruitment', 3],
    ['board-exam', 'board', 3],
    ['board-university', 'board', 3],
    ['university-exam', 'university-exam', 3],
    ['university-admission', 'university-admission', 4],
  ];

  for (const [pillar, entity, count] of cases) {
    it(`${pillar}: ${count} answers, all fixed to ${entity}, models = LEGAL_MODELS_BY_ENTITY[${entity}]`, () => {
      const answers = answersForPillar(pillar);
      expect(answers).toHaveLength(count);
      expect(answers.every((a) => a.entityType === entity)).toBe(true);
      expect(answers.map((a) => a.selectionModel)).toEqual(LEGAL_MODELS_BY_ENTITY[entity]);
    });
  }

  it('internal-admission is offered only for a university-admission entity type', () => {
    const hasInternal = (p: string) => answersForPillar(p).some((a) => a.selectionModel === 'internal-admission');
    expect(hasInternal('university-admission')).toBe(true);
    expect(hasInternal('government-exam')).toBe(false);
    expect(hasInternal('board-exam')).toBe(false);
    expect(hasInternal('university-exam')).toBe(false);
    // and legal model lists honour the same rule
    expect(LEGAL_MODELS_BY_ENTITY['university-admission']).toContain('internal-admission');
    for (const et of ALL_ENTITY_TYPES.filter((e) => e !== 'university-admission')) {
      expect(LEGAL_MODELS_BY_ENTITY[et as EntityType], et).not.toContain('internal-admission');
    }
  });
});

describe('labels and hints are plain words (owner: no jargon in labels)', () => {
  // The jargon to ban is the RAW technical identifier — the hyphenated value
  // strings that are the enum/DB values. Plain words like "exam"/"board" that
  // also happen to be entity values are exactly what we WANT in a label.
  const HYPHENATED_VALUES = [...ALL_SELECTION_MODELS, ...ALL_ENTITY_TYPES].filter((v) => v.includes('-')) as string[];
  const allAnswers = [...ENTRANCE_EXAM_ANSWERS, ...['government-exam', 'board-exam', 'university-exam', 'university-admission'].flatMap(answersForPillar)];

  it('no label shows a hyphenated technical identifier or the GATE acronym', () => {
    for (const a of allAnswers) {
      for (const j of [...HYPHENATED_VALUES, 'GATE']) {
        expect(a.label, `label "${a.label}" leaks "${j}"`).not.toContain(j);
      }
    }
  });

  it('every answer has a non-empty label and hint', () => {
    for (const a of allAnswers) {
      expect(a.label.trim().length).toBeGreaterThan(0);
      expect(a.hint.trim().length).toBeGreaterThan(0);
    }
  });

  it('the question text is asked in plain words', () => {
    expect(SELECTION_QUESTION).toBe('How are candidates selected?');
  });
});

describe('no default + answered check', () => {
  it('an empty selection model is unanswered and selects no answer', () => {
    expect(isSelectionAnswered('')).toBe(false);
    expect(selectedAnswerId('entrance-exam', 'exam', '')).toBe('');
  });

  it('a real model is answered; a bogus string is not', () => {
    for (const m of ALL_SELECTION_MODELS) expect(isSelectionAnswered(m), m).toBe(true);
    expect(isSelectionAnswered('made-up')).toBe(false);
    expect(isSelectionAnswered(undefined)).toBe(false);
    expect(isSelectionAnswered(null)).toBe(false);
  });

  it('selectedAnswerId only matches a pair THIS pillar offers (no phantom selection)', () => {
    // interview + university-admission is legal in general but NOT one of the six
    // curated entrance-exam answers, so entrance-exam shows it unselected.
    expect(selectedAnswerId('entrance-exam', 'university-admission', 'interview-based')).toBe('');
    // ...while the university-admission pillar does offer it.
    expect(selectedAnswerId('university-admission', 'university-admission', 'interview-based'))
      .toBe(answerIdFor('university-admission', 'interview-based'));
    // a wrong entity type for the pillar returns "", not a stale pick
    expect(selectedAnswerId('board-exam', 'recruitment', 'written-exam')).toBe('');
  });
});

describe('helper text', () => {
  it('names the chosen answer hint once answered', () => {
    const hint = selectionHelperText('entrance-exam', 'exam', 'written-exam');
    expect(hint).toBe(ENTRANCE_EXAM_ANSWERS[0].hint);
  });

  it('tells the editor to answer while it is unanswered', () => {
    expect(selectionHelperText('entrance-exam', 'exam', '')).toMatch(/Choose how candidates are selected/);
  });
});
