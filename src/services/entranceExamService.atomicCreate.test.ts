/**
 * FX1.5 — atomic create: a failed edition insert triggers a compensating delete.
 *
 * createEntranceExam detects a collision (findExamConflict: slug, then name, then
 * short name), then inserts exams then exam_editions. If the edition insert fails,
 * it must DELETE the just-created exam (so no orphan with zero editions survives —
 * the FX1 state) and surface the real error. All Supabase calls mocked — no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/client', () => ({ db: { from: (...a: any[]) => mockFrom(...a) } }));
vi.mock('@/services/moduleRegistryService', () => ({ getModuleRegistry: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/revalidate', () => ({ revalidateExams: vi.fn().mockResolvedValue(undefined) }));

import { createEntranceExam, type NewExamInput } from './entranceExamService';

const input: NewExamInput = {
  name: 'Test Exam', shortName: 'TE', slug: 'test-exam', region: 'all-india',
  categoryId: 'cat-1', conductingBody: 'CB', officialWebsite: 'https://x.in',
  selectionModel: 'written-exam', firstEditionYear: 2026,
};

beforeEach(() => { vi.clearAllMocks(); });

describe('createEntranceExam FX1.5 compensating delete', () => {
  it('deletes the orphan exam when the edition insert fails', async () => {
    const actions: string[] = [];
    // outcomes in call order: slug free, name free, short free, exam insert ok, edition insert FAIL, delete ok
    const outcomes = [
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null }, // A.4 name-core scan → no matches
      { data: { id: 'ex-new', slug: 'test-exam', name: 'Test Exam', pillar: 'entrance-exam', workflow_status: 'draft', created_at: '', updated_at: '' }, error: null },
      { data: null, error: { message: 'edition boom' } },
      { data: null, error: null }, // compensating delete awaited result
    ];
    let i = 0;
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {};
      chain.__table = table;
      for (const m of ['select', 'eq', 'ilike', 'or', 'order', 'limit', 'in', 'is']) chain[m] = vi.fn(() => chain);
      chain.insert = vi.fn(() => { actions.push(`insert:${table}`); return chain; });
      chain.update = chain.insert;
      chain.delete = vi.fn(() => { actions.push(`delete:${table}`); return chain; });
      const pop = () => outcomes[i++] ?? { data: null, error: null };
      chain.maybeSingle = vi.fn(() => Promise.resolve(pop()));
      chain.single = vi.fn(() => Promise.resolve(pop()));
      chain.then = (res: (v: unknown) => unknown) => res(pop());
      return chain;
    });

    await expect(createEntranceExam(input)).rejects.toThrow(/Could not create the first cycle: edition boom/);
    expect(actions).toContain('insert:exams');
    expect(actions).toContain('insert:exam_editions');
    expect(actions).toContain('delete:exams'); // orphan removed
  });

  it('names BOTH failures when the compensating delete also fails', async () => {
    const outcomes = [
      { data: null, error: null },        // slug free
      { data: [], error: null },          // name free
      { data: [], error: null },          // short free
      { data: [], error: null },          // A.4 name-core scan → no matches
      { data: { id: 'ex-new', slug: 'test-exam', name: 'Test Exam', pillar: 'entrance-exam', workflow_status: 'draft', created_at: '', updated_at: '' }, error: null }, // exam insert
      { data: null, error: { message: 'edition boom' } },  // edition insert FAIL
      { data: null, error: { message: 'delete boom' } },   // compensating delete FAILS too
    ];
    let i = 0;
    mockFrom.mockImplementation(() => {
      const chain: any = {};
      for (const m of ['select', 'eq', 'ilike', 'or', 'order', 'limit', 'in', 'is']) chain[m] = vi.fn(() => chain);
      chain.insert = vi.fn(() => chain);
      chain.update = chain.insert;
      chain.delete = vi.fn(() => chain);
      const pop = () => outcomes[i++] ?? { data: null, error: null };
      chain.maybeSingle = vi.fn(() => Promise.resolve(pop()));
      chain.single = vi.fn(() => Promise.resolve(pop()));
      chain.then = (res: (v: unknown) => unknown) => res(pop());
      return chain;
    });

    await expect(createEntranceExam(input)).rejects.toThrow(/edition boom.*delete boom.*manual repair/s);
  });
});
