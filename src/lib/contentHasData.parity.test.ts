// @vitest-environment node
/**
 * contentHasData.parity.test.ts — the guard behind "one fact, one place".
 *
 * THREE-WAY content-presence contract (Q1c). The site's rule is the truth:
 * the frozen booleans in contract/content-has-data.expected.json were GENERATED
 * from indianexaminfo-frontend/lib/sectionRegistry.ts (hasData/contentTypeHasData)
 * over the shared fixture contract/content-has-data.fixtures.json. This test:
 *   1. asserts the vendored contract files are byte-identical to the pinned
 *      sha256 constants (the SAME constants live in the frontend's
 *      lib/contract/contentHasData.contract.test.ts — the cross-repo tripwire);
 *   2. asserts the CMS TS mirror (src/lib/sectionRegistry.ts) returns exactly
 *      the frozen expected boolean for every case;
 *   3. asserts the canonical SQL mirror (supabase/proposed/content_has_data_fn.sql),
 *      loaded into an embedded Postgres (PGlite — real PL/pgSQL, no live DB,
 *      no production data), returns the same boolean for every case.
 * The frontend's own test asserts frontend TS === the same expected file. So
 * drift in EITHER repo — registry, SQL, or the site rule itself — fails CI in
 * both repos. Re-baking expected.json (see the frontend test docblock) changes
 * its hash and forces a deliberate, visible hash update in BOTH test files.
 *
 * pinned hashes below MUST equal the frontend test's constants (LF-normalized
 * bytes; .gitattributes pins contract/*.json to eol=lf in both repos):
 *   FIXTURES 57329f42ff7d9846e4a59e28cb1292f69485426e997207ebfd597afeb9ea35b1
 *   EXPECTED d90e9be51f650f74b89c8c024a52b599b3f078c7ace4b61fded026364f12ab06
 * (baked 2026-09-28 (S0-2) from the frontend rule; the FAQs cases pin the owner
 *  decision of that date - hasData('faqs') counts the exams.faqs column so the
 *  section is visible on the main page, a contentModules.faqs store alone is
 *  not enough, and the 'faqs' contentType stays unmapped so /faqs never routes.)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import {
  SECTION_REGISTRY,
  CONTENT_TYPE_TO_SECTION,
  hasData,
  contentTypeHasData,
  type HasDataView,
} from '@/lib/sectionRegistry';

const FIXTURES_SHA256 = '57329f42ff7d9846e4a59e28cb1292f69485426e997207ebfd597afeb9ea35b1';
const EXPECTED_SHA256 = 'd90e9be51f650f74b89c8c024a52b599b3f078c7ace4b61fded026364f12ab06';

const CONTRACT_DIR = path.resolve(process.cwd(), 'contract');
const FIXTURES_FILE = path.join(CONTRACT_DIR, 'content-has-data.fixtures.json');
const EXPECTED_FILE = path.join(CONTRACT_DIR, 'content-has-data.expected.json');
const SQL_FILE = path.resolve(process.cwd(), 'supabase/proposed/content_has_data_fn.sql');

interface FixtureCase {
  id: string;
  kind: 'section' | 'contentType';
  key: string;
  view: HasDataView;
}
interface FixtureDoc { cases: FixtureCase[] }
interface ExpectedCase { id: string; expected: boolean }
interface ExpectedDoc { cases: ExpectedCase[] }

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const fixtures = JSON.parse(fs.readFileSync(FIXTURES_FILE, 'utf8')) as FixtureDoc;
const expected = JSON.parse(fs.readFileSync(EXPECTED_FILE, 'utf8')) as ExpectedDoc;
const expectedById = new Map(expected.cases.map((c) => [c.id, c.expected]));

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  await db.exec(sql);
}, 30_000);

async function sqlHasData(view: object, section: string): Promise<boolean> {
  const res = await db.query<{ has: boolean }>(
    'SELECT public.content_has_data($1::jsonb, $2) AS has',
    [JSON.stringify(view), section],
  );
  return res.rows[0].has;
}

/** CMS TS evaluation of one contract case (bridge applied for contentType). */
function cmsEvaluate(c: FixtureCase): boolean {
  return c.kind === 'section' ? hasData(c.view, c.key) : contentTypeHasData(c.view, c.key);
}

describe('contract files are pinned (hash tripwire shared with the frontend repo)', () => {
  it('vendored fixtures + expected match the embedded sha256 constants', () => {
    expect(sha256(FIXTURES_FILE), 'fixtures hash drift vs pinned constant').toBe(FIXTURES_SHA256);
    expect(sha256(EXPECTED_FILE), 'expected hash drift vs pinned constant').toBe(EXPECTED_SHA256);
  });

  it('fixture ids and expected ids are the same list', () => {
    expect(fixtures.cases.map((c) => c.id)).toEqual(expected.cases.map((c) => c.id));
  });
});

describe('three-way parity: SQL mirror === CMS TS === frozen expected (site rule)', () => {
  for (const c of fixtures.cases) {
    it(c.id, async () => {
      const want = expectedById.get(c.id);
      expect(want, `no expected entry for case "${c.id}"`).toBeDefined();

      const ts = cmsEvaluate(c);
      expect({ case: c.id, cmsTs: ts }, 'CMS TS drifted from the site rule').toEqual({ case: c.id, cmsTs: want });

      // SQL mirror: sections are evaluated directly; contentType cases are
      // evaluated through the same bridge the TS uses (the SQL function owns
      // the registry, the bridge lives in TS). An unmapped contentType is
      // always false in TS and has no SQL section to evaluate — the CMS-TS
      // assertion above already pins it, and 'mock-test'/'date-sheet' are not
      // registry slugs so the sweep below re-checks the false branch anyway.
      const section =
        c.kind === 'section' ? c.key : CONTENT_TYPE_TO_SECTION[c.key] ?? null;
      if (section !== null) {
        const sql = await sqlHasData(c.view, section);
        expect({ case: c.id, sql }, 'SQL mirror drifted from the site rule').toEqual({ case: c.id, sql: want });
      }
    });
  }
});

// ── Local breadth sweep (not part of the vendored contract) ──────────────────
// The frozen contract is the BINDING; this sweep is extra insurance that the
// SQL registry map (source + appliesTo per slug) cannot drift from the CMS TS
// registry for section/pillar combinations the contract cases don't exercise.
const SWEEP_VIEWS: HasDataView[] = [
  { pillar: 'government-exam' },
  {
    pillar: 'government-exam',
    dates: [{ label: 'Exam', date: '2026-10-01' }],
    eligibility: { qualification: 'Graduate' },
    vacancy: 100,
    applicationFee: { general: 500 },
    selectionProcess: ['Prelims'],
    hasStructuredSyllabus: true,
    faqs: [{ question: 'Q', answer: 'A' }],
    contentModules: {
      overview: { body: 'x' }, 'application-process': { steps: [{}] },
      'admit-card': { releaseDate: '2026-01-01' }, result: { checkLink: 'https://x' },
      'answer-key': { body: 'x' }, 'cut-off': { body: 'x' }, 'previous-papers': { papers: [{}] },
      'study-material': { materials: [{}] }, news: { items: [{ title: 'n' }] },
      'merit-list': { meritListUrl: 'https://m' }, 'interview-schedule': { rounds: [{}] },
      'document-verification': { venue: 'Hall' }, 'final-selection': { finalListUrl: 'https://f' },
      'seat-allotment': { rounds: [{}] }, salary: { summary: 's' }, 'age-limit': { body: 'b' },
      'documents-required': { body: 'b' }, reservation: { body: 'b' },
    },
  },
  {
    pillar: 'entrance-exam',
    applicationFee: { general: 1000 },
    academicInfo: { academicYear: '2026' },
    contentModules: { overview: { body: 'x' }, 'previous-papers': { notes: 'n' }, 'study-material': { notes: 'n' } },
  },
  {
    pillar: 'university-exam',
    academicInfo: { semester: 'Odd' },
    contentModules: { overview: { body: 'x' }, 'seat-allotment': { rounds: [{}] }, 'previous-papers': { papers: [{}] } },
  },
  { pillar: 'board-exam', contentModules: { overview: { body: 'x' } } },
  { pillar: 'govt-vacancy', vacancy: 5, contentModules: { overview: { body: 'x' } } },
];

const SWEEP_SECTIONS: string[] = [
  ...SECTION_REGISTRY.map((s) => s.slug),
  'date-sheet',        // never a real section
  'nonexistent-slug',  // unknown slug -> false on both sides
];

describe('SQL === CMS TS across every registry slug (local breadth sweep)', () => {
  for (const [i, view] of SWEEP_VIEWS.entries()) {
    it(`sweep view #${i} (${view.pillar})`, async () => {
      for (const section of SWEEP_SECTIONS) {
        const ts = hasData(view, section);
        const sql = await sqlHasData(view, section);
        expect({ view: i, section, sql, ts }, `sweep mismatch view#${i} / ${section}`).toEqual({
          view: i, section, sql: ts, ts,
        });
      }
    });
  }
});
