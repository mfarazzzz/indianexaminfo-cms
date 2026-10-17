/**
 * pillarAdminLists.test.ts — the map the duplicate toast uses to name WHERE a
 * colliding record lives and open the right editor (2a).
 */
import { describe, it, expect } from 'vitest';
import { adminListForPillar } from '@/config/pillarAdminLists';

describe('adminListForPillar', () => {
  it('names each pillar list with the route the editor uses for back-nav', () => {
    expect(adminListForPillar('government-exam')).toEqual({ path: '/govt-exam', label: 'Govt Exams' });
    expect(adminListForPillar('sarkari-naukri').path).toBe('/govt-exam');
    expect(adminListForPillar('govt-vacancy').path).toBe('/govt-vacancy');
    expect(adminListForPillar('board-exam').path).toBe('/board-exams');
    expect(adminListForPillar('university-exam').path).toBe('/university-exams');
    expect(adminListForPillar('entrance-exam').label).toBe('Entrance Exams');
  });

  it('an entrance-exam create that collides with a govt record routes to /govt-exam, not /entrance-exams', () => {
    // the case the owner hit: typed via Entrance Exams, existing record is government-exam
    expect(adminListForPillar('government-exam').path).not.toBe('/entrance-exams');
  });

  it('falls back to Entrance Exams for unknown / null pillar', () => {
    expect(adminListForPillar('made-up')).toEqual({ path: '/entrance-exams', label: 'Entrance Exams' });
    expect(adminListForPillar(null).path).toBe('/entrance-exams');
  });
});
