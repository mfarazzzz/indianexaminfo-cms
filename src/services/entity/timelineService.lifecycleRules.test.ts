/**
 * timelineService.lifecycleRules.test.ts
 *
 * Unit tests for the evaluateLifecycleRules pure function.
 * REQ-005: Lifecycle Rules Engine
 */
import { describe, it, expect } from 'vitest'
import { evaluateLifecycleRules } from './timelineService'
import type { LifecycleRule } from '@/types/lifecycle-template'
import type { TimelineEvent } from '@/types/entity'

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'evt-1',
    entityId: 'entity-1',
    title: 'Test Event',
    eventType: 'notification',
    eventDate: '2026-03-01',
    eventTime: null,
    description: null,
    status: 'upcoming',
    badgeColor: 'blue',
    isHighlighted: false,
    isFeatured: false,
    officialLink: null,
    pdfLink: null,
    imageUrl: null,
    visibility: 'public',
    stageKey: 'notification',
    eventSubtype: null,
    publishAt: null,
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  }
}

describe('evaluateLifecycleRules', () => {
  it('returns empty array when no rules', () => {
    const result = evaluateLifecycleRules([], [makeEvent()])
    expect(result).toEqual([])
  })

  it('returns empty array when no events have dates', () => {
    const rules: LifecycleRule[] = [{
      ruleType: 'must_follow',
      subjectStage: 'exam',
      objectStage: 'application',
      errorMessage: 'Exam must follow Application',
      severity: 'error',
    }]
    const events = [makeEvent({ stageKey: 'exam', eventDate: null })]
    expect(evaluateLifecycleRules(rules, events)).toEqual([])
  })

  describe('must_follow', () => {
    const rule: LifecycleRule = {
      ruleType: 'must_follow',
      subjectStage: 'exam',
      objectStage: 'application',
      errorMessage: 'Exam date must be after Application date',
      severity: 'error',
    }

    it('no violation when subject is after object', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'application', eventDate: '2026-03-01' }),
        makeEvent({ id: 'e2', stageKey: 'exam', eventDate: '2026-04-01' }),
      ]
      expect(evaluateLifecycleRules([rule], events)).toEqual([])
    })

    it('violation when subject is before object', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'application', eventDate: '2026-05-01' }),
        makeEvent({ id: 'e2', stageKey: 'exam', eventDate: '2026-04-01' }),
      ]
      const result = evaluateLifecycleRules([rule], events)
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe('error')
      expect(result[0].message).toBe('Exam date must be after Application date')
    })

    it('violation when subject equals object (same date)', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'application', eventDate: '2026-04-01' }),
        makeEvent({ id: 'e2', stageKey: 'exam', eventDate: '2026-04-01' }),
      ]
      expect(evaluateLifecycleRules([rule], events)).toHaveLength(1)
    })
  })

  describe('minimum_gap', () => {
    const rule: LifecycleRule = {
      ruleType: 'minimum_gap',
      subjectStage: 'admit_card',
      objectStage: 'application_end',
      errorMessage: 'Admit Card must be at least 7 days after Application End',
      minimumDays: 7,
      severity: 'warning',
    }

    it('no violation when gap is sufficient', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'application_end', eventDate: '2026-03-01' }),
        makeEvent({ id: 'e2', stageKey: 'admit_card', eventDate: '2026-03-10' }),
      ]
      expect(evaluateLifecycleRules([rule], events)).toEqual([])
    })

    it('violation when gap is insufficient', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'application_end', eventDate: '2026-03-01' }),
        makeEvent({ id: 'e2', stageKey: 'admit_card', eventDate: '2026-03-05' }),
      ]
      const result = evaluateLifecycleRules([rule], events)
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe('warning')
    })

    it('violation when gap is exactly at boundary (less than minimumDays)', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'application_end', eventDate: '2026-03-01' }),
        makeEvent({ id: 'e2', stageKey: 'admit_card', eventDate: '2026-03-07' }),
      ]
      // 6 days gap — less than 7
      const result = evaluateLifecycleRules([rule], events)
      expect(result).toHaveLength(1)
    })

    it('no violation when gap equals minimumDays exactly', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'application_end', eventDate: '2026-03-01' }),
        makeEvent({ id: 'e2', stageKey: 'admit_card', eventDate: '2026-03-08' }),
      ]
      // 7 days gap — equal to minimumDays = OK
      expect(evaluateLifecycleRules([rule], events)).toEqual([])
    })
  })

  describe('maximum_gap', () => {
    const rule: LifecycleRule = {
      ruleType: 'maximum_gap',
      subjectStage: 'result',
      objectStage: 'exam',
      errorMessage: 'Result cannot be more than 90 days after Exam',
      maximumDays: 90,
      severity: 'warning',
    }

    it('no violation when gap is within limit', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'exam', eventDate: '2026-03-01' }),
        makeEvent({ id: 'e2', stageKey: 'result', eventDate: '2026-05-01' }),
      ]
      // 61 days — within 90
      expect(evaluateLifecycleRules([rule], events)).toEqual([])
    })

    it('violation when gap exceeds limit', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'exam', eventDate: '2026-01-01' }),
        makeEvent({ id: 'e2', stageKey: 'result', eventDate: '2026-06-01' }),
      ]
      // ~151 days — exceeds 90
      const result = evaluateLifecycleRules([rule], events)
      expect(result).toHaveLength(1)
      expect(result[0].severity).toBe('warning')
    })
  })

  describe('cannot_precede', () => {
    // cannot_precede: subjectStage must NOT come BEFORE objectStage
    // "admit_card cannot_precede exam" = admit card must not be earlier than exam
    const rule: LifecycleRule = {
      ruleType: 'cannot_precede',
      subjectStage: 'admit_card',
      objectStage: 'exam',
      errorMessage: 'Admit Card cannot be before Exam date',
      severity: 'error',
    }

    it('violation when admit card is before exam', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'admit_card', eventDate: '2026-03-01' }),
        makeEvent({ id: 'e2', stageKey: 'exam', eventDate: '2026-04-01' }),
      ]
      // admit_card (Mar 1) < exam (Apr 1) → violates cannot_precede
      expect(evaluateLifecycleRules([rule], events)).toHaveLength(1)
    })

    it('no violation when admit card equals exam (same date)', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'admit_card', eventDate: '2026-04-01' }),
        makeEvent({ id: 'e2', stageKey: 'exam', eventDate: '2026-04-01' }),
      ]
      expect(evaluateLifecycleRules([rule], events)).toEqual([])
    })

    it('no violation when admit card is after exam', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'admit_card', eventDate: '2026-05-01' }),
        makeEvent({ id: 'e2', stageKey: 'exam', eventDate: '2026-04-01' }),
      ]
      expect(evaluateLifecycleRules([rule], events)).toEqual([])
    })
  })

  describe('requires (both dates must exist)', () => {
    const rule: LifecycleRule = {
      ruleType: 'requires',
      subjectStage: 'result',
      objectStage: 'exam',
      errorMessage: 'Result requires Exam date to be set',
      severity: 'error',
    }

    it('no violation when both dates exist', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'exam', eventDate: '2026-03-01' }),
        makeEvent({ id: 'e2', stageKey: 'result', eventDate: '2026-05-01' }),
      ]
      expect(evaluateLifecycleRules([rule], events)).toEqual([])
    })

    it('skips evaluation when object date is missing (REQ-005.4)', () => {
      const events = [
        makeEvent({ id: 'e1', stageKey: 'result', eventDate: '2026-05-01' }),
        // exam has no event_date — skipped per REQ-005.4
      ]
      expect(evaluateLifecycleRules([rule], events)).toEqual([])
    })
  })

  it('handles multiple rules with mixed severities', () => {
    const rules: LifecycleRule[] = [
      { ruleType: 'must_follow', subjectStage: 'exam', objectStage: 'application', errorMessage: 'R1', severity: 'error' },
      { ruleType: 'minimum_gap', subjectStage: 'admit_card', objectStage: 'exam', errorMessage: 'R2', minimumDays: 3, severity: 'warning' },
    ]
    const events = [
      makeEvent({ id: 'e1', stageKey: 'application', eventDate: '2026-05-01' }),
      makeEvent({ id: 'e2', stageKey: 'exam', eventDate: '2026-04-01' }),        // violates must_follow
      makeEvent({ id: 'e3', stageKey: 'admit_card', eventDate: '2026-04-02' }),   // 1 day after exam — violates minimum_gap
    ]
    const result = evaluateLifecycleRules(rules, events)
    expect(result).toHaveLength(2)
    expect(result[0].severity).toBe('error')
    expect(result[1].severity).toBe('warning')
  })
})
