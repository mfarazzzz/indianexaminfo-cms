/**
 * R2.1 (editor shell skeleton, part 1) — the section rail.
 *
 * Owner decision 16 Oct: R2.1 is NAVIGATION ONLY. Save, the workflow/Publish
 * select, ModulePanel autosave and the News save all behave exactly as before;
 * the rail dots are a view over the flags the unsaved-changes guard already
 * aggregates. A single page-level Save writing dirty sections is R2.5.
 *
 * What is pinned here:
 *  - "rail order = registry order" (the acceptance rule) — no second sort, so the
 *    rail can never drift from what the Modules panel and the frontend use;
 *  - every section points at a tab that actually exists, and the four sections
 *    whose content is NOT in the Modules panel point where they really live;
 *  - the dirty dot reads the guard's own flags, per surface, and never claims
 *    unsaved work on a surface that has no such signal;
 *  - structurally, the rail only asks the page to navigate (through
 *    guardedSetActiveTab) — it holds no state and saves nothing.
 *
 * The registry rows are the LIVE values read from module_registry on 16 Oct 2026
 * (22 rows, `sample-papers` is_active=false so getModuleRegistry returns 21).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildRail, tabIdForSection, sectionIsDirty, SECTION_TABS,
  type RailTabId,
} from './editorSections'

const pageSrc = readFileSync(resolve(__dirname, 'EntranceExamEditorPage.tsx'), 'utf8').replace(/\r\n/g, '\n')
const railSrc = readFileSync(
  resolve(__dirname, '../../components/entrance-exams/EditorSectionRail.tsx'), 'utf8',
).replace(/\r\n/g, '\n')

/** module_registry, is_active, in display_order (entrance-exam pillar sees 1-12 + 16). */
const REGISTRY_ROWS = [
  { slug: 'overview', name: 'Overview' },
  { slug: 'eligibility', name: 'Eligibility' },
  { slug: 'important-dates', name: 'Important Dates' },
  { slug: 'application-process', name: 'Application Process' },
  { slug: 'exam-pattern', name: 'Exam Pattern' },
  { slug: 'syllabus', name: 'Syllabus' },
  { slug: 'faqs', name: 'FAQs' },
  { slug: 'admit-card', name: 'Admit Card' },
  { slug: 'result', name: 'Result' },
  { slug: 'cut-off', name: 'Cut-off' },
  { slug: 'counselling', name: 'Counselling' },
  { slug: 'news', name: 'News & Updates' },
  { slug: 'vacancy-details', name: 'Vacancy Details' },
  { slug: 'salary', name: 'Salary & Pay Scale' },
  { slug: 'age-limit', name: 'Age Limit' },
  { slug: 'selection-process', name: 'Selection Process' },
  { slug: 'documents-required', name: 'Documents Required' },
  { slug: 'reservation', name: 'Reservation Policy' },
  { slug: 'date-sheet', name: 'Date Sheet' },
  { slug: 'revaluation', name: 'Revaluation / Rechecking' },
  { slug: 'practical-exams', name: 'Practical Exams' },
]

/** The tab ids the page really renders. */
const REAL_TAB_IDS = ["identity", "resources", "syllabus", "edition", "modules", "news", "seo", "editions"];

describe('R2.1 buildRail: rail order = registry order', () => {
  it('keeps display_order exactly as the registry returned it, all 21 active sections', () => {
    const rail = buildRail(REGISTRY_ROWS)
    expect(rail).toHaveLength(21)
    expect(rail.map((r) => r.slug)).toEqual(REGISTRY_ROWS.map((r) => r.slug))
  })

  it('does NOT re-sort: a deliberately unordered input stays unordered (one source of order)', () => {
    const shuffled = [REGISTRY_ROWS[5], REGISTRY_ROWS[0], REGISTRY_ROWS[2]]
    expect(buildRail(shuffled).map((r) => r.slug)).toEqual(['syllabus', 'overview', 'important-dates'])
  })

  it('labels come from the registry name, and a blank name falls back to the slug (never an empty button)', () => {
    const [one] = buildRail([{ slug: 'faqs', name: '  ' }])
    expect(one.label).toBe('faqs')
    expect(buildRail([{ slug: 'result', name: 'Result' }])[0].label).toBe('Result')
  })

  it('a duplicate slug collapses to the first row — no two rail buttons share a React key', () => {
    const rail = buildRail([
      { slug: 'overview', name: 'Overview' },
      { slug: 'overview', name: 'Overview (duplicate row)' },
    ])
    expect(rail).toHaveLength(1)
    expect(rail[0].label).toBe('Overview')
  })

  it('rows with no usable slug are dropped, not rendered as dead buttons', () => {
    expect(buildRail([{ slug: '  ', name: 'x' }, { slug: '', name: 'y' }, {} as never])).toHaveLength(0)
  })
})

describe('R2.1 the section -> surface map is the truth of today', () => {
  it('the four sections that are NOT Modules-panel content point at their real tab', () => {
    expect(SECTION_TABS['important-dates']).toBe('edition')
    expect(SECTION_TABS['syllabus']).toBe('syllabus')
    expect(SECTION_TABS['faqs']).toBe('seo')
    expect(SECTION_TABS['news']).toBe('news')
  })

  it('every other registry section is content_modules[slug], i.e. the Modules panel', () => {
    for (const slug of ['overview', 'eligibility', 'application-process', 'exam-pattern',
      'admit-card', 'result', 'cut-off', 'counselling', 'vacancy-details', 'salary',
      'age-limit', 'selection-process', 'documents-required', 'reservation', 'date-sheet',
      'revaluation', 'practical-exams']) {
      expect(tabIdForSection(slug), slug).toBe('modules')
    }
  })

  it('no mapping points at a tab that does not exist in the page', () => {
    for (const row of REGISTRY_ROWS) {
      expect(REAL_TAB_IDS, `${row.slug} -> ?`).toContain(tabIdForSection(row.slug));
    }
    // and the ids really are the page's, read off the source rather than trusted
    for (const id of REAL_TAB_IDS) {
      expect(pageSrc, `tab id "${id}" is not rendered by the page`).toContain(`{ id: "${id}", label:`)
    }
  })
})

describe('R2.1 the rail dirty dots read the guard, never their own opinion', () => {
  const clean = { formDirty: false, moduleDirty: false, newsDirty: false }

  it('nothing is dirty when nothing is dirty', () => {
    for (const id of REAL_TAB_IDS) expect(sectionIsDirty(id as RailTabId, clean), id).toBe(false)
  })

  it('a form edit marks the form-backed surfaces, not Modules or News', () => {
    const flags = { ...clean, formDirty: true }
    for (const id of ['identity', 'edition', 'seo', 'editions']) {
      expect(sectionIsDirty(id as RailTabId, flags), id).toBe(true)
    }
    expect(sectionIsDirty('modules', flags)).toBe(false)
    expect(sectionIsDirty('news', flags)).toBe(false)
  })

  it('a pending ModulePanel autosave marks the module sections only', () => {
    const flags = { ...clean, moduleDirty: true }
    expect(sectionIsDirty('modules', flags)).toBe(true)
    expect(sectionIsDirty('edition', flags)).toBe(false)
    // and it lights up every section that lives in the panel (they share a surface)
    const rail = buildRail([{ slug: 'eligibility', name: 'Eligibility' }, { slug: 'result', name: 'Result' }])
    expect(rail.every((r) => sectionIsDirty(r.tabId, flags))).toBe(true)
  })

  it('resources and syllabus save to the server from their own controls, so the shell never claims them', () => {
    const allDirty = { formDirty: true, moduleDirty: true, newsDirty: true }
    expect(sectionIsDirty('resources', allDirty)).toBe(false)
    expect(sectionIsDirty('syllabus', allDirty)).toBe(false)
  })
})

describe('R2.1 the rail navigates and does nothing else', () => {
  it('the page routes the rail through the ONE unsaved-changes guard', () => {
    expect(pageSrc).toContain('onSection={guardedSetActiveTab}')
    expect(pageSrc).toContain('<EditorSectionRail')
  })

  it('the rail holds no state, fires no request and saves nothing (navigation only)', () => {
    expect(railSrc).not.toMatch(/useState|useEffect/)
    expect(railSrc).not.toMatch(/\bfetch\(|from "@\/services/)
    expect(railSrc).not.toContain('handleSave')
    expect(railSrc).not.toContain('updateEdition')
  })

  it('the old tab bar is still rendered — R2.1 keeps it reachable, it does not replace it', () => {
    expect(pageSrc).toContain('{tabs.map((tab) => (')
    expect(pageSrc).toContain('guardedSetActiveTab(tab.id)')
  })

  it('1366x768 without horizontal scroll: fixed-width rail + min-w-0 content column', () => {
    expect(railSrc).toContain('w-52 shrink-0')
    expect(pageSrc).toContain('<div className="flex-1 min-w-0">')
    expect(pageSrc).toContain('<div className="flex items-start gap-4">')
  })
})
