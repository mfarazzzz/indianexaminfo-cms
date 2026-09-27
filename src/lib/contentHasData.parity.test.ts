// @vitest-environment node
/**
 * contentHasData.parity.test.ts — the guard behind "one fact, one place".
 *
 * Loads the PROPOSED canonical SQL rule (supabase/proposed/content_has_data_fn.sql)
 * into an embedded Postgres (PGlite) and, for a matrix of HasDataView fixtures,
 * asserts the SQL boolean equals the TS boolean from the single-source registry
 * (src/lib/sectionRegistry.ts). If either side drifts on how "a section has
 * content" is decided, this test fails in CI — no live DB, no production data.
 *
 * Runs in the `node` environment (see the docblock): PGlite is a WASM Postgres
 * that executes real PL/pgSQL, so the SQL under test is the exact SQL that will
 * be promoted, not a re-implementation.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import {
  SECTION_REGISTRY,
  CONTENT_TYPE_TO_SECTION,
  hasData,
  contentTypeHasData,
  type HasDataView,
} from '@/lib/sectionRegistry';

const SQL_FILE = path.resolve(process.cwd(), 'supabase/proposed/content_has_data_fn.sql');

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

// Sections present in the registry (the whole surface of the rule), plus a few
// slugs that are intentionally NOT in the CMS registry (retired / unknown) so we
// pin the "unknown slug -> false" branch on both sides.
const SECTIONS: string[] = [
  ...SECTION_REGISTRY.map((s) => s.slug),
  'previous-papers',   // retired in the CMS registry (still live in the frontend mirror)
  'study-material',    // retired in the CMS registry
  'date-sheet',        // never a real section
  'nonexistent-slug',
];

// A broad fixture matrix exercising every branch of the rule.
const fixtures: { name: string; view: HasDataView }[] = [
  { name: 'empty', view: { pillar: 'government-exam' } },

  // column-backed positives / negatives
  { name: 'dates present', view: { pillar: 'government-exam', dates: [{ label: 'Exam', date: '2026-10-01' }] } },
  { name: 'dates empty arr', view: { pillar: 'government-exam', dates: [] } },
  { name: 'eligibility qual', view: { pillar: 'government-exam', eligibility: { qualification: 'Graduate' } } },
  { name: 'eligibility blank', view: { pillar: 'government-exam', eligibility: { qualification: '   ' } } },
  { name: 'vacancy >0', view: { pillar: 'government-exam', vacancy: 120 } },
  { name: 'vacancy 0', view: { pillar: 'government-exam', vacancy: 0 } },
  { name: 'fee >0', view: { pillar: 'entrance-exam', applicationFee: { general: 1000, sc: 0 } } },
  { name: 'fee all zero', view: { pillar: 'entrance-exam', applicationFee: { general: 0 } } },
  { name: 'selection-process', view: { pillar: 'government-exam', selectionProcess: ['Prelims', 'Mains'] } },
  { name: 'syllabus structured', view: { pillar: 'government-exam', hasStructuredSyllabus: true } },
  { name: 'syllabus false', view: { pillar: 'government-exam', hasStructuredSyllabus: false } },
  { name: 'academic-info', view: { pillar: 'university-exam', academicInfo: { academicYear: '2026' } } },

  // pillar-applicability negatives
  { name: 'vacancy on entrance (n/a pillar)', view: { pillar: 'entrance-exam', vacancy: 50 } },
  { name: 'seat-allotment on govt (n/a pillar)', view: { pillar: 'government-exam', contentModules: { 'seat-allotment': { rounds: [1] } } } },

  // editorial positives across the distinct key-sets
  { name: 'overview body', view: { pillar: 'government-exam', contentModules: { overview: { body: 'About the exam' } } } },
  { name: 'app-process steps arr', view: { pillar: 'government-exam', contentModules: { 'application-process': { steps: [{ t: 'Apply' }] } } } },
  { name: 'admit-card releaseDate', view: { pillar: 'government-exam', contentModules: { 'admit-card': { releaseDate: '2026-09-01' } } } },
  { name: 'result checkLink only', view: { pillar: 'government-exam', contentModules: { result: { checkLink: 'https://x' } } } },
  { name: 'answer-key blank body', view: { pillar: 'government-exam', contentModules: { 'answer-key': { body: '   ' } } } },
  { name: 'merit-list url', view: { pillar: 'government-exam', contentModules: { 'merit-list': { meritListUrl: 'https://m' } } } },
  { name: 'interview rounds', view: { pillar: 'government-exam', contentModules: { 'interview-schedule': { rounds: [{}] } } } },
  { name: 'document-verification venue', view: { pillar: 'government-exam', contentModules: { 'document-verification': { venue: 'Hall' } } } },
  { name: 'final-selection url', view: { pillar: 'government-exam', contentModules: { 'final-selection': { finalListUrl: 'https://f' } } } },
  { name: 'seat-allotment university rounds', view: { pillar: 'university-exam', contentModules: { 'seat-allotment': { rounds: [{}] } } } },
  { name: 'news with titled item', view: { pillar: 'government-exam', contentModules: { news: { items: [{ title: 'Update' }] } } } },
  { name: 'news item no title', view: { pillar: 'government-exam', contentModules: { news: { items: [{ body: 'x' }] } } } },
  { name: 'salary (default editorial)', view: { pillar: 'government-exam', contentModules: { salary: { summary: '₹50k' } } } },

  // enabledModules opt-out
  {
    name: 'overview disabled by _config',
    view: { pillar: 'government-exam', contentModules: { overview: { body: 'text' }, _config: { enabledModules: ['result'] } } },
  },
  {
    name: 'overview enabled in _config',
    view: { pillar: 'government-exam', contentModules: { overview: { body: 'text' }, _config: { enabledModules: ['overview'] } } },
  },
  {
    name: 'empty enabledModules list = fresh record',
    view: { pillar: 'government-exam', contentModules: { overview: { body: 'text' }, _config: { enabledModules: [] } } },
  },

  // structure key-highlights
  { name: 'key-highlights via vacancy', view: { pillar: 'government-exam', vacancy: 10 } },
  { name: 'key-highlights none', view: { pillar: 'government-exam', vacancy: 0, dates: [] } },

  // faqs is column-sourced with no column branch -> always false (pinned quirk)
  { name: 'faqs populated (quirk: always false)', view: { pillar: 'government-exam', faqs: [{ question: 'Q', answer: 'A' }] } },
];

describe('content_has_data (SQL) === hasData (TS) — canonical parity', () => {
  for (const fx of fixtures) {
    it(`fixtures × every section: ${fx.name}`, async () => {
      for (const section of SECTIONS) {
        const ts = hasData(fx.view, section);
        const sql = await sqlHasData(fx.view, section);
        expect(
          { fixture: fx.name, section, sql, ts },
          `mismatch for "${fx.name}" / "${section}"`,
        ).toEqual({ fixture: fx.name, section, sql: ts, ts });
      }
    });
  }
});

describe('contentTypeHasData (TS) === content_has_data (SQL) via the URL bridge', () => {
  for (const fx of fixtures) {
    it(`content-type bridge matches SQL: ${fx.name}`, async () => {
      for (const [contentType, section] of Object.entries(CONTENT_TYPE_TO_SECTION)) {
        const ts = contentTypeHasData(fx.view, contentType);
        const sql = await sqlHasData(fx.view, section);
        // contentTypeHasData maps -> section; hasData(section) is the same rule.
        expect({ fx: fx.name, contentType, sql, ts }).toEqual({ fx: fx.name, contentType, sql: ts, ts });
      }
    });
  }
});
