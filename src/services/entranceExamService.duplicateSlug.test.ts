/**
 * R1.9 / 2a — duplicate-record detection test.
 *
 * createEntranceExam must detect a collision BEFORE writing, by slug OR by a
 * case-insensitive trimmed match on the exam Name or Short Name, and throw a
 * structured DUPLICATE_SLUG error carrying the existing record's id/name/status
 * AND (2a) its pillar + which field matched, so the UI can name the list and open
 * the correct editor. When nothing collides, the create proceeds (exam + edition).
 *
 * The mock routes each awaited terminal (.maybeSingle / .limit / .single) to the
 * next scripted outcome, in call order.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/client', () => ({ db: { from: (...a: any[]) => mockFrom(...a) } }));
vi.mock('@/services/moduleRegistryService', () => ({ getModuleRegistry: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/revalidate', () => ({ revalidateExams: vi.fn().mockResolvedValue(undefined) }));

import { createEntranceExam, type NewExamInput } from './entranceExamService';

/** Route each awaited terminal to the next queued outcome ({data,error}). */
function route(...outcomes: { data: unknown; error: unknown }[]) {
  const queue = [...outcomes];
  const next = () => queue.shift() ?? { data: null, error: null };
  const chain: Record<string, any> = {};
  for (const m of ['select', 'eq', 'ilike', 'or', 'order', 'insert', 'update', 'delete', 'limit', 'in', 'is']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve(next()));
  chain.single = vi.fn(() => Promise.resolve(next()));
  chain.then = (res: (v: { data: unknown; error: unknown }) => unknown) => res(next());
  mockFrom.mockImplementation(() => chain);
  return chain;
}

const input: NewExamInput = {
  name: 'UP Deled Entrance',
  shortName: 'UP DELED',
  slug: 'up-deled-entrance',
  region: 'all-india',
  categoryId: 'cat-1',
  conductingBody: 'MEERUT UNIVERSITY',
  officialWebsite: 'https://updeled.gov.in',
  selectionModel: 'merit-based',
  firstEditionYear: 2026,
};

const OK = { data: null, error: null };

beforeEach(() => { vi.clearAllMocks(); });

describe('duplicate detection by SLUG', () => {
  it('throws DUPLICATE_SLUG with the existing record + matched="slug" + pillar', async () => {
    route({ data: { id: 'ex-dup-1', name: 'UP Deled Entrance', workflow_status: 'published', pillar: 'government-exam' }, error: null });
    try {
      await createEntranceExam(input);
      expect.unreachable('should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('DUPLICATE_SLUG');
      expect(err.existingExam).toEqual({
        id: 'ex-dup-1', name: 'UP Deled Entrance', status: 'published',
        pillar: 'government-exam', matched: 'slug',
      });
    }
  });

  it('message stays parseable: DUPLICATE_SLUG::<id>::<name>::<status>', async () => {
    route({ data: { id: 'ex-99', name: 'JEE Main 2026', workflow_status: 'draft', pillar: 'entrance-exam' }, error: null });
    await expect(createEntranceExam(input)).rejects.toThrow(/DUPLICATE_SLUG::ex-99::JEE Main 2026::draft/);
  });

  it('null workflow_status defaults to "draft"', async () => {
    route({ data: { id: 'ex-5', name: 'Old Exam', workflow_status: null, pillar: 'entrance-exam' }, error: null });
    try { await createEntranceExam(input); expect.unreachable(); }
    catch (err: any) { expect(err.existingExam.status).toBe('draft'); }
  });
});

describe('duplicate detection by NAME / SHORT NAME (2a: not slug only)', () => {
  it('slug free but NAME matches (case-insensitive) → DUPLICATE matched="name"', async () => {
    // call1 slug maybeSingle → null; call2 name ilike.limit → a row.
    route(
      OK,
      { data: [{ id: 'ex-name', name: 'UP Deled Entrance', workflow_status: 'draft', pillar: 'entrance-exam' }], error: null },
    );
    try { await createEntranceExam(input); expect.unreachable(); }
    catch (err: any) { expect(err.code).toBe('DUPLICATE_SLUG'); expect(err.existingExam.matched).toBe('name'); expect(err.existingExam.id).toBe('ex-name'); }
  });

  it('slug + name free but SHORT NAME matches → DUPLICATE matched="short_name"', async () => {
    route(
      OK,
      OK, // name → []
      { data: [{ id: 'ex-short', name: 'Whatever', workflow_status: 'published', pillar: 'board-exam' }], error: null }, // short_name → row
    );
    try { await createEntranceExam(input); expect.unreachable(); }
    catch (err: any) { expect(err.existingExam.matched).toBe('short_name'); expect(err.existingExam.pillar).toBe('board-exam'); }
  });

  it('a name/short read ERROR is not treated as a duplicate (slug guard still rules) → create proceeds', async () => {
    // slug free; name query errors; short query errors; then both inserts succeed.
    route(
      OK,
      { data: null, error: { message: 'boom' } },
      { data: null, error: { message: 'boom' } },
      { data: { id: 'ex-new', name: input.name, slug: input.slug, pillar: 'entrance-exam', workflow_status: 'draft', selection_model: 'merit-based', created_at: '', updated_at: '' }, error: null },
      { data: { id: 'ed-new', exam_id: 'ex-new', year: 2026, session: 'main', is_current: true, status: 'upcoming', important_dates: [], eligibility: {}, application_fee: {}, content_modules: {}, created_at: '', updated_at: '' }, error: null },
    );
    await expect(createEntranceExam(input)).resolves.toBeDefined();
  });
});

describe('free slug + free name + free short name → creates', () => {
  it('inserts the exam then the first edition', async () => {
    const chain = route(
      OK, // slug null
      OK, // name []
      OK, // short []
      { data: { id: 'ex-new', name: input.name, slug: input.slug, pillar: 'entrance-exam', workflow_status: 'draft', selection_model: 'merit-based', created_at: '', updated_at: '' }, error: null },
      { data: { id: 'ed-new', exam_id: 'ex-new', year: 2026, session: 'main', is_current: true, status: 'upcoming', important_dates: [], eligibility: {}, application_fee: {}, content_modules: {}, created_at: '', updated_at: '' }, error: null },
    );
    const out = await createEntranceExam(input);
    expect(out.exam.id).toBe('ex-new');
    expect(out.edition.id).toBe('ed-new');
    expect(chain.insert).toHaveBeenCalled();
  });
});
