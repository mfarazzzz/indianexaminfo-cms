/**
 * S2.10.4 — ONE place derives kind/type from a label.
 *
 * The whole point of S2.10: the editor used to re-derive kind/type in
 * toProposedRow, so the golden guarantees (selection-model gate, type-vocabulary
 * enforcement) were absent from what the owner used. These structural pins fail
 * if the label→kind/type mapping ever gets duplicated:
 *   • the mapping's DEFINITIONS live only in normalizeLabel.ts;
 *   • the low-level primitive typeForKind( is CALLED only by the pipeline
 *     (importers may use the high-level normalizeLabel — that is the shared fn);
 *   • noticeReview.ts does no derivation of its own (no toProposedRow);
 *   • the editor runs the server answer through postProcessExtraction first.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(process.cwd(), 'src')
const NORM = join('lib', 'dates', 'normalizeLabel.ts')
const PIPELINE = join('lib', 'ai', 'noticePipeline.ts')
// S2.15: the deterministic date-line parser is a sanctioned pipeline-layer caller
// of the SHARED typeForKind (it must not re-implement the mapping).
const DATELINES = join('lib', 'ai', 'noticeDateLines.ts')

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) acc.push(p)
  }
  return acc
}

describe('kind/type derivation lives in ONE shared function (S2.10)', () => {
  it('the mapping definitions exist ONLY in normalizeLabel.ts (never duplicated)', () => {
    const defs = /export\s+(?:function\s+typeForKind|const\s+KIND_TO_VIEW_TYPE|interface\s+KindRule)\b/
    const offenders = walk(SRC)
      .filter((f) => defs.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))
    expect(offenders, `type-mapping defined outside normalizeLabel.ts: ${offenders.join(', ')}`).toEqual([NORM])
  })

  it('the low-level typeForKind( is CALLED only by normalizeLabel, the pipeline and the date-line parser', () => {
    const callers = walk(SRC)
      .filter((f) => /\btypeForKind\s*\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))
      .filter((rel) => rel !== NORM && rel !== PIPELINE && rel !== DATELINES)
    expect(callers, `typeForKind called outside the shared pipeline: ${callers.join(', ')}`).toEqual([])
  })

  it('noticeReview.ts does no date/kind/type derivation of its own (toProposedRow is gone)', () => {
    const f = readFileSync(join(SRC, 'components', 'entrance-exams', 'noticeReview.ts'), 'utf8')
    expect(f).not.toMatch(/from ['"]@\/lib\/dates\/normalizeLabel['"]/)
    expect(f).not.toMatch(/from ['"]@\/lib\/utils\/indianDateParser['"]/)
    expect(f).not.toMatch(/\btoProposedRow\b/)
  })

  it('the editor page runs the server answer through the deterministic pipeline before buildReviewRows', () => {
    const f = readFileSync(join(SRC, 'pages', 'entrance-exams', 'EntranceExamEditorPage.tsx'), 'utf8')
    // S2.15: buildNoticeResult is the pipeline entry — it runs postProcessExtraction
    // (the S2.10 authority) and layers the deterministic date-line rows under it.
    const idx = f.indexOf('buildNoticeResult(')
    const buildIdx = f.indexOf('buildReviewRows(')
    expect(idx, 'editor must call buildNoticeResult').toBeGreaterThan(-1)
    expect(buildIdx, 'editor must call buildReviewRows').toBeGreaterThan(idx)
    // The wrap must be real: buildNoticeResult itself calls postProcessExtraction.
    const res = readFileSync(join(SRC, 'lib', 'ai', 'noticeResult.ts'), 'utf8')
    expect(res, 'buildNoticeResult must run postProcessExtraction').toMatch(/postProcessExtraction\(/)
  })
})
