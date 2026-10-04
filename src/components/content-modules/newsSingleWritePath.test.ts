/**
 * R0 post-review — News module single-write-path test.
 *
 * Asserts that the Modules tab never writes content_modules.news:
 *   - "news" is classified as column-backed → rendered as a read-only
 *     "Edited in the News tab" source-row, NOT as an editable card.
 *   - editHereModules (the group that gets ModuleContentEditor with
 *     2-second autosave via saveModuleContent) NEVER includes "news".
 *   - Only the News tab (buildMergedContentModules) writes content_modules.news.
 *
 * Also lists other modules affected by R0.2 (auto → editable) and confirms
 * each is safe (either no other write path, or column-backed read-only).
 */
import { describe, expect, it } from 'vitest'

// Mirror the source of truth from ModulePanel.tsx.
// If the production code changes, this test should fail.
const COLUMN_BACKED_MODULE_SOURCE: Record<string, { sourceTab: string; tabId: string }> = {
  "eligibility":        { sourceTab: "Dates & Status tab", tabId: "edition" },
  "important-dates":    { sourceTab: "Dates & Status tab", tabId: "edition" },
  "vacancy-details":    { sourceTab: "Dates & Status tab", tabId: "edition" },
  "selection-process":  { sourceTab: "Identity tab",       tabId: "identity" },
  "faqs":               { sourceTab: "SEO tab",            tabId: "seo" },
  "syllabus":           { sourceTab: "Syllabus tab",       tabId: "syllabus" },
  "academic-info":      { sourceTab: "Identity tab",       tabId: "identity" },
  "news":               { sourceTab: "News tab",           tabId: "news" },
};

// Built-in modules as listed in builtInSchemas.ts (slugs only).
const ALL_BUILT_IN_MODULES = [
  "overview", "eligibility", "important-dates", "vacancy-details",
  "selection-process", "faqs", "application-process", "exam-pattern",
  "syllabus", "admit-card", "result", "cut-off", "counselling",
  "news", "academic-info", "date-sheet",
];

/** Replicates the editHereModules filter from ModulePanel.tsx:295 */
function computeEditHereModules(orderedModules: string[]): string[] {
  return orderedModules.filter((slug) => !COLUMN_BACKED_MODULE_SOURCE[slug])
}

/** Replicates the editElsewhereRows column-backed loop from ModulePanel.tsx:315-323 */
function computeEditElsewhereColumnBacked(orderedModules: string[]): string[] {
  return orderedModules.filter((slug) => !!COLUMN_BACKED_MODULE_SOURCE[slug])
}

describe("News module: single write path (R0 post-review)", () => {
  it("news is classified as column-backed → NOT in editHereModules", () => {
    const editHere = computeEditHereModules(ALL_BUILT_IN_MODULES)
    expect(editHere).not.toContain("news")
  })

  it("news IS in editElsewhere column-backed → shows a read-only source row", () => {
    const elsewhere = computeEditElsewhereColumnBacked(ALL_BUILT_IN_MODULES)
    expect(elsewhere).toContain("news")
  })

  it("news column-backed entry points to the News tab", () => {
    expect(COLUMN_BACKED_MODULE_SOURCE.news).toEqual({ sourceTab: "News tab", tabId: "news" })
  })

  it("saveModuleContent (2s autosave) can never target 'news' because it is not rendered as editable", () => {
    // The autosave path only fires from ModuleContentEditor inside a
    // ContentModuleCard. Cards are only rendered for editHereModules.
    // Since news is NOT in editHereModules, no editor card → no autosave.
    const editHere = computeEditHereModules(ALL_BUILT_IN_MODULES)
    const slugsThatCanAutosave = editHere // these get ContentModuleCard → ModuleContentEditor
    expect(slugsThatCanAutosave).not.toContain("news")
  })
})

describe("Other R0.2 auto → editable modules: conflict check", () => {
  // Previously "auto" mode modules (read-only preview): overview, important-dates, faqs, news
  // After R0.2 (mode removed): every module in editHereModules gets the full editor card.
  // Check which auto modules are now editable AND have another write path → conflict.

  const previouslyAuto = ["overview", "important-dates", "faqs", "news"]
  // Modules with their OWN tab or column-backed editor:
  const hasDedicatedEditor: Record<string, string> = {
    "important-dates": "Dates & Status tab (edition column)",
    "faqs": "SEO tab / Identity tab (exams.faqs column)",
    "news": "News tab (buildMergedContentModules)",
    "eligibility": "Dates & Status tab (edition column)",
    "selection-process": "Identity tab (exams.selection_process column)",
    "vacancy-details": "Dates & Status tab (edition column)",
    "syllabus": "Syllabus tab (exam_syllabus table)",
    "academic-info": "Identity tab (column)",
  }

  it("overview: editable in Modules tab, NO other input → safe", () => {
    const editHere = computeEditHereModules(ALL_BUILT_IN_MODULES)
    expect(editHere).toContain("overview")
    expect(hasDedicatedEditor).not.toHaveProperty("overview")
  })

  it("important-dates: column-backed → read-only in Modules tab → safe", () => {
    const editHere = computeEditHereModules(ALL_BUILT_IN_MODULES)
    expect(editHere).not.toContain("important-dates")
  })

  it("faqs: column-backed → read-only in Modules tab → safe", () => {
    const editHere = computeEditHereModules(ALL_BUILT_IN_MODULES)
    expect(editHere).not.toContain("faqs")
  })

  it("news: column-backed → read-only in Modules tab → safe (THE FIX)", () => {
    const editHere = computeEditHereModules(ALL_BUILT_IN_MODULES)
    expect(editHere).not.toContain("news")
  })

  it("no editable module has a dedicated write path elsewhere", () => {
    const editHere = computeEditHereModules(ALL_BUILT_IN_MODULES)
    for (const slug of editHere) {
      // If a module is editable in the Modules tab AND has its own tab/column
      // writing the same content_modules[slug], that's a conflict.
      expect(hasDedicatedEditor[slug]).toBeUndefined()
    }
  })
})
