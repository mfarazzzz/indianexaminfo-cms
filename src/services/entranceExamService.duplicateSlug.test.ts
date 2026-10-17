/**
 * R1.9 / 2a / follow-up #2 — duplicate detection test.
 *
 * createEntranceExam splits a pre-write collision into:
 *  - HARD BLOCK: exact slug, or exact Name (case-insensitive trimmed), or a Short
 *    Name match that is ALSO the same pillar AND region (genuinely the same exam);
 *  - SOFT WARNING: a Short Name reused by a different pillar/region — the create
 *    still proceeds and returns { warnings: [...] } (short names are legitimately
 *    shared across states — many "B.Ed", "CET", "PET").
 * The DUPLICATE_SLUG error carries id/name/status + pillar + which field matched.
 * Mock routes each awaited terminal (.maybeSingle / .limit→then / .single) to the
 * next scripted outcome, in call order.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/client', () => ({ db: { from: (...a: any[]) => mockFrom(...a) } }));
vi.mock('@/services/moduleRegistryService', () => ({ getModuleRegistry: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/revalidate', () => ({ revalidateExams: vi.fn().mockResolvedValue(undefined) }));

import { createEntranceExam, type NewExamInput } from './entranceExamService';

const OK = { data: null, error: null };
const EMPTY = { data: [], error: null };

/** Each awaited terminal pops the next outcome. */
function route(...outcomes: { data?: unknown; error?: unknown }[]) {
  const q = [...outcomes];
  const pop = () => q.shift() ?? { data: null, error: null };
  const chain: Record<string, any> = {};
  for (const m of ['select', 'eq', 'ilike', 'or', 'order', 'in', 'is']) chain[m] = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = chain.insert;
  chain.delete = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => Promise.resolve(pop()));
  chain.single = vi.fn(() => Promise.resolve(pop()));
  chain.then = (res: (v: unknown) => unknown) => res(pop());
  mockFrom.mockImplementation(() => chain);
}

const input: NewExamInput = {
  name: 'UP Deled Entrance', shortName: 'UP DELED', slug: 'up-deled-entrance',
  region: 'all-india', categoryId: 'cat-1', conductingBody: 'MEERUT UNIVERSITY',
  officialWebsite: 'https://updeled.gov.in', selectionModel: 'merit-based', firstEditionYear: 2026,
};

const created = {
  data: { id: 'ex-new', name: input.name, slug: input.slug, pillar: 'entrance-exam', workflow_status: 'draft', selection_model: 'merit-based', created_at: '', updated_at: '' },
  error: null,
};
const edition = {
  data: { id: 'ed-new', exam_id: 'ex-new', year: 2026, session: 'main', is_current: true, status: 'upcoming', important_dates: [], eligibility: {}, application_fee: {}, content_modules: {}, created_at: '', updated_at: '' },
  error: null,
};

beforeEach(() => { vi.clearAllMocks(); });

describe('HARD BLOCK: slug', () => {
  it('slug collision throws DUPLICATE_SLUG matched="slug" + pillar', async () => {
    route({ data: { id: 'ex-dup', name: 'UP Deled Entrance', workflow_status: 'published', pillar: 'government-exam', region: 'uttar-pradesh' }, error: null });
    try { await createEntranceExam(input); expect.unreachable(); }
    catch (err: any) {
      expect(err.code).toBe('DUPLICATE_SLUG');
      expect(err.existingExam).toEqual({ id: 'ex-dup', name: 'UP Deled Entrance', status: 'published', pillar: 'government-exam', matched: 'slug' });
    }
  });
});

describe('HARD BLOCK: exact name', () => {
  it('name match (case-insensitive) throws matched="name"', async () => {
    route(OK, { data: [{ id: 'ex-name', name: 'UP Deled Entrance', workflow_status: 'draft', pillar: 'entrance-exam', region: 'all-india' }], error: null });
    try { await createEntranceExam(input); expect.unreachable(); }
    catch (err: any) { expect(err.code).toBe('DUPLICATE_SLUG'); expect(err.existingExam.matched).toBe('name'); }
  });
});

describe('HARD BLOCK vs WARNING: short name', () => {
  it('same pillar AND region → block (matched="short_name")', async () => {
    route(
      OK, EMPTY,
      { data: [{ id: 'ex-same', name: 'Other Name', workflow_status: 'draft', pillar: 'entrance-exam', region: 'all-india' }], error: null },
    );
    try { await createEntranceExam(input); expect.unreachable(); }
    catch (err: any) { expect(err.existingExam.matched).toBe('short_name'); expect(err.existingExam.id).toBe('ex-same'); }
  });

  it('DIFFERENT region (same short name) → does NOT block; creates + returns a warning', async () => {
    route(
      OK, EMPTY,
      { data: [{ id: 'ex-other', name: 'Bihar DELED Entrance', workflow_status: 'published', pillar: 'entrance-exam', region: 'bihar' }], error: null },
      created, edition,
    );
    const res = await createEntranceExam(input); // must NOT throw
    expect(res.exam.id).toBe('ex-new');
    expect(res.warnings).toHaveLength(1);
    expect(res.warnings[0]).toMatchObject({ id: 'ex-other', name: 'Bihar DELED Entrance', pillar: 'entrance-exam' });
  });

  it('no collision at all → creates, warnings empty', async () => {
    route(OK, EMPTY, EMPTY, created, edition);
    const res = await createEntranceExam(input);
    expect(res.warnings).toEqual([]);
    expect(res.edition.id).toBe('ed-new');
  });
});

describe('read failures on the widened checks never block a valid create', () => {
  it('name + short reads error → still creates (slug is the only hard uniqueness key)', async () => {
    route(
      OK,
      { data: null, error: { message: 'name boom' } },
      { data: null, error: { message: 'short boom' } },
      created, edition,
    );
    await expect(createEntranceExam(input)).resolves.toMatchObject({ exam: { id: 'ex-new' } });
  });
});
