// @vitest-environment node
/**
 * gscCsv.test.ts — the CSV parser unit test (Q3).
 *
 * Runs against the REAL Search Console "Performance → Pages" export committed
 * at docs/seo/gsc-pages-2026-09-27.csv, plus synthetic edge cases (quoted
 * commas, thousands separators, CRLF, malformed lines, foreign headers). If the
 * parser stops matching the actual GSC output format, this test goes red.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCsvRecords, parseGscPagesCsv, GscCsvError } from './gscCsv';

const REAL_CSV = path.resolve(process.cwd(), 'docs/seo/gsc-pages-2026-09-27.csv');

describe('parseGscPagesCsv — real GSC export (docs/seo/gsc-pages-2026-09-27.csv)', () => {
  const text = fs.readFileSync(REAL_CSV, 'utf8');
  const { rows, skipped } = parseGscPagesCsv(text);

  it('parses every data row of the export', () => {
    // 316 non-empty lines = 1 header + 315 data rows, all well-formed.
    expect(rows.length).toBe(315);
    expect(skipped).toBe(0);
  });

  it('maps the top page exactly as exported (url / clicks / impressions)', () => {
    const top = rows[0];
    expect(top.url).toBe('https://www.indianexaminfo.com/sarkari-naukri/up-swasthya-vibhag-ambulance-driver-2026');
    expect(top.clicks).toBe(186);
    expect(top.impressions).toBe(2786);
  });

  it('keeps the last row and ignores the extra columns (host/path/ctr/position)', () => {
    const last = rows[rows.length - 1];
    expect(last.url).toBe('https://www.indianexaminfo.com/entrance-exam/management/ipmat-indore/syllabus');
    expect(last.clicks).toBeGreaterThanOrEqual(0);
    expect(typeof last.impressions).toBe('number');
  });

  it('every parsed row has a URL and integer metrics', () => {
    for (const r of rows) {
      expect(r.url.startsWith('http')).toBe(true);
      expect(Number.isInteger(r.clicks)).toBe(true);
      expect(Number.isInteger(r.impressions)).toBe(true);
    }
  });
});

describe('parseCsvRecords — RFC 4180 edge cases', () => {
  it('handles quoted cells containing commas', () => {
    const rec = parseCsvRecords('url,clicks,impressions\n"https://x/a,b",10,20\n');
    expect(rec[1]).toEqual(['https://x/a,b', '10', '20']);
  });

  it('handles doubled quotes inside a quoted cell', () => {
    const rec = parseCsvRecords('a\n"say ""hi"""\n');
    expect(rec[1][0]).toBe('say "hi"');
  });

  it('handles CRLF line endings', () => {
    const rec = parseCsvRecords('a,b\r\n1,2\r\n');
    expect(rec).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('flushes a final line without a trailing newline', () => {
    const rec = parseCsvRecords('a,b\n3,4');
    expect(rec.length).toBe(2);
    expect(rec[1]).toEqual(['3', '4']);
  });
});

describe('parseGscPagesCsv — synthetic edge cases', () => {
  it('accepts a header in any order and ignores extra columns', () => {
    const { rows } = parseGscPagesCsv('clicks,page,url,impressions\n5,ignore,https://x/p,50\n');
    expect(rows).toEqual([{ url: 'https://x/p', clicks: 5, impressions: 50 }]);
  });

  it('parses quoted thousands-separated numbers ("1,234" -> 1234)', () => {
    const { rows } = parseGscPagesCsv('url,clicks,impressions\n"https://x/1","1,234","12,345"\n');
    expect(rows[0].clicks).toBe(1234);
    expect(rows[0].impressions).toBe(12345);
  });

  it('counts malformed data lines as skipped instead of failing', () => {
    const { rows, skipped } = parseGscPagesCsv(
      'url,clicks,impressions\nhttps://x/1,10,20\n,3,4\nhttps://x/2,abc,5\nhttps://x/3,1\n',
    );
    expect(rows.length).toBe(1);
    expect(skipped).toBe(3);
  });

  it('throws on an empty file or a foreign header', () => {
    expect(() => parseGscPagesCsv('')).toThrow(GscCsvError);
    expect(() => parseGscPagesCsv('query,clicks,impressions\nq,1,2\n')).toThrow(GscCsvError);
  });
});
