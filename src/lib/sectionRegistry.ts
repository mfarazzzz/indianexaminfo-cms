/**
 * sectionRegistry.ts — THE single source of truth for exam detail sections.
 *
 * Defines every renderable section once: its label, where its data lives
 * (structured column vs editorial prose), which pillars show it, its order,
 * whether it appears as a content-type tab, and how to tell if it has data.
 *
 * This replaces the pre-rebuild sprawl (CONSISTENCY_AUDIT Phase 1–5):
 *   - three divergent `hasContentType` implementations
 *   - two content-type ordering arrays (contentTypeOrder / CONTENT_TYPE_ORDER)
 *   - three disagreeing ct→module maps (ctToModule / CT_TO_MODULES ×2)
 *   - hardcoded JSX section order that ignored CMS moduleOrder
 *
 * Rendering, tab derivation, and ordering all read from THIS file, for all
 * five pillars, on main pages AND sub-pages.
 *
 * ⚠️ MUST STAY IDENTICAL to indianexaminfo-frontend/lib/sectionRegistry.ts.
 * The two repos don't share a package; keep both copies in sync (same rule as
 * normalizeUrl). If they drift, the CMS editor and the site disagree on what
 * exists — which is the exact disease this rebuild removes.
 */

export type Pillar =
  | "government-exam"
  | "govt-vacancy"
  | "entrance-exam"
  | "university-exam"
  | "board-university";

export const ALL_PILLARS: Pillar[] = [
  "government-exam",
  "govt-vacancy",
  "entrance-exam",
  "university-exam",
  "board-university",
];

/**
 * Where a section's data lives.
 *  - "column"    : a typed column on exams/exam_editions (canonical for facts)
 *  - "editorial" : a prose section in exam_editions.editorial_content jsonb
 *  - "structure" : hardcoded page furniture (summary box, breadcrumb) — NOT
 *                  order-driven, NOT a module. Listed for completeness only;
 *                  the render loop skips these (they live in the template shell).
 */
export type SectionSource = "column" | "editorial" | "structure";

/**
 * Where a section appears:
 *  - "main" : summary on the main exam page (orderable) + no dedicated tab
 *  - "tab"  : its own detail page only (reference material, not on main page)
 *  - "both" : summary on the main page AND a deeper detail tab
 * Placement is DATA here (read by both CMS and frontend); the frontend maps
 * slug → renderer components in sectionRenderers.tsx.
 */
export type SectionPlacement = "main" | "tab" | "both";

export interface SectionDef {
  /** Stable slug — the ONE identifier used in URLs, tabs, and editorial_content keys. */
  slug: string;
  /** Human label shown as the section heading and tab text. */
  label: string;
  /** Where the data comes from. */
  source: SectionSource;
  /** Pillars that show this section. The only place domain differences live. */
  appliesTo: Pillar[];
  /** Default render/tab order (ascending). Overridable per-edition later. */
  order: number;
  /** Where this section appears (main / tab / both). See SectionPlacement. */
  placement: SectionPlacement;
  /** True → appears in the content-type tab row and has a sub-page. */
  showAsTab: boolean;
}

/**
 * THE registry. Order of this array is the default section/tab order.
 * `structure` entries are documented but not rendered by the section loop.
 */
export const SECTION_REGISTRY: SectionDef[] = [
  // Placement per the approved model:
  //   main = summary on main page (orderable); tab = own detail page only;
  //   both = main-page summary + deeper detail tab. Empty sections hide everywhere.
  // ── Main-page decision material (order 10–150) ──────────────────────────────
  { slug: "key-highlights",      label: "Key Highlights",      source: "structure", appliesTo: ALL_PILLARS, order: 10,  placement: "main", showAsTab: false },
  { slug: "overview",            label: "About This Exam",     source: "editorial", appliesTo: ALL_PILLARS, order: 20,  placement: "both", showAsTab: true },
  { slug: "important-dates",     label: "Important Dates",     source: "column",    appliesTo: ALL_PILLARS, order: 30,  placement: "both", showAsTab: true },
  { slug: "eligibility",         label: "Eligibility Criteria", source: "column",   appliesTo: ALL_PILLARS, order: 40,  placement: "both", showAsTab: true },
  { slug: "application-fee",     label: "Application Fee",     source: "column",    appliesTo: ["government-exam", "govt-vacancy", "entrance-exam"], order: 50, placement: "both", showAsTab: true },
  { slug: "vacancy",             label: "Vacancy Details",     source: "column",    appliesTo: ["government-exam", "govt-vacancy"], order: 60, placement: "both", showAsTab: true },
  { slug: "application-process", label: "Application Process", source: "editorial", appliesTo: ["government-exam", "govt-vacancy", "entrance-exam", "university-exam"], order: 70, placement: "both", showAsTab: true },
  { slug: "selection-process",   label: "Selection Process",   source: "column",    appliesTo: ["government-exam", "govt-vacancy", "entrance-exam"], order: 80, placement: "both", showAsTab: true },
  { slug: "salary",              label: "Salary & Pay Scale",  source: "editorial", appliesTo: ["government-exam", "govt-vacancy"], order: 90, placement: "both", showAsTab: true },
  { slug: "age-limit",           label: "Age Limit",           source: "editorial", appliesTo: ["government-exam", "govt-vacancy", "entrance-exam"], order: 100, placement: "both", showAsTab: true },
  { slug: "admit-card",          label: "Admit Card",          source: "editorial", appliesTo: ALL_PILLARS, order: 110, placement: "both", showAsTab: true },
  { slug: "result",              label: "Result",              source: "editorial", appliesTo: ALL_PILLARS, order: 120, placement: "both", showAsTab: true },
  { slug: "documents-required",  label: "Documents Required",  source: "editorial", appliesTo: ["government-exam", "govt-vacancy"], order: 130, placement: "both", showAsTab: true },
  { slug: "reservation",         label: "Reservation Policy",  source: "editorial", appliesTo: ["government-exam", "govt-vacancy"], order: 140, placement: "both", showAsTab: true },
  { slug: "faqs",                label: "Frequently Asked Questions", source: "column", appliesTo: ALL_PILLARS, order: 150, placement: "main", showAsTab: false },

  // ── Tab-only reference material (no main-page summary) ──────────────────────
  { slug: "syllabus",            label: "Syllabus",            source: "column",    appliesTo: ALL_PILLARS, order: 200, placement: "tab", showAsTab: true },
  { slug: "cut-off",             label: "Cut Off Marks",       source: "editorial", appliesTo: ["government-exam", "govt-vacancy", "entrance-exam"], order: 210, placement: "tab", showAsTab: true },
  { slug: "answer-key",          label: "Answer Key",          source: "editorial", appliesTo: ["government-exam", "govt-vacancy", "entrance-exam"], order: 220, placement: "tab", showAsTab: true },
  { slug: "previous-papers",     label: "Previous Year Papers", source: "editorial", appliesTo: ALL_PILLARS, order: 230, placement: "tab", showAsTab: true },
  { slug: "study-material",      label: "Study Material",      source: "editorial", appliesTo: ALL_PILLARS, order: 240, placement: "tab", showAsTab: true },
  { slug: "news",                label: "News & Updates",      source: "editorial", appliesTo: ALL_PILLARS, order: 250, placement: "tab", showAsTab: true },
];

/** Fast lookup by slug. */
export const SECTION_BY_SLUG: Record<string, SectionDef> = Object.fromEntries(
  SECTION_REGISTRY.map((s) => [s.slug, s])
);

/** Sections that apply to a pillar, in order, excluding structure furniture. */
export function sectionsForPillar(pillar: Pillar): SectionDef[] {
  return SECTION_REGISTRY
    .filter((s) => s.source !== "structure" && s.appliesTo.includes(pillar))
    .sort((a, b) => a.order - b.order);
}

/** Tab-eligible sections for a pillar, in order. */
export function tabSectionsForPillar(pillar: Pillar): SectionDef[] {
  return sectionsForPillar(pillar).filter((s) => s.showAsTab);
}

/**
 * Sections that render a summary on the MAIN page (placement main|both), in
 * order. Unlike sectionsForPillar this KEEPS "structure" sections (key-highlights
 * is synthesized furniture that still occupies a main-page slot and is orderable).
 */
export function mainSectionsForPillar(pillar: Pillar): SectionDef[] {
  return SECTION_REGISTRY
    .filter((s) => s.appliesTo.includes(pillar) && (s.placement === "main" || s.placement === "both"))
    .sort((a, b) => a.order - b.order);
}

// ── hasData: the ONE predicate every enforcement point uses ──────────────────
//
// A section is "present" iff its canonical source actually holds renderable
// content. This is the single rule behind: tab visibility, sitemap inclusion,
// sub-page route notFound(), and content-hub link lists. There is no separate
// "enabled" flag — presence of data IS enablement (see REBUILD_PLAN "empty-tab
// cause"). Uses a minimal structural view of the exam so both repos can share it.

export interface HasDataView {
  pillar: string;
  // structured columns
  dates?: { label: string; date: string }[];
  eligibility?: { age?: string; qualification?: string; nationality?: string } | null;
  vacancy?: number | null;
  applicationFee?: Record<string, number | undefined> | null;
  selectionProcess?: string[] | null;
  syllabusHighlights?: string[] | null;
  faqs?: { question: string; answer: string }[] | null;
  // editorial / module store (exam_editions.content_modules today; editorial_content post-rebuild)
  contentModules?: Record<string, unknown>;
}

function nonEmptyStr(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}
function nonEmptyArr(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

/** Read a module/editorial section object by slug from the jsonb store. */
function moduleObj(exam: HasDataView, slug: string): Record<string, unknown> | null {
  const cm = exam.contentModules;
  if (!cm) return null;
  const d = cm[slug];
  return d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : null;
}

/** True when the given editorial/module section has substantive content. */
function editorialHasData(exam: HasDataView, slug: string): boolean {
  const d = moduleObj(exam, slug);
  if (!d) return false;
  // Respect the CMS enabledModules toggle. If _config exists with an explicit
  // enabledModules array and this slug is absent, the editor intentionally turned
  // this section off — treat as no data regardless of content presence.
  // Only applied when _config is present with a non-empty enabledModules list
  // (empty list = freshly created record, no modules enabled yet — that's a
  // different state from "editor disabled this one specifically").
  const config = exam.contentModules?._config as
    | { enabledModules?: string[] }
    | undefined;
  if (
    config?.enabledModules !== undefined &&
    config.enabledModules.length > 0 &&
    !config.enabledModules.includes(slug)
  ) {
    return false;
  }
  switch (slug) {
    case "overview":
    case "application-process":
      return (
        nonEmptyStr(d.body) || nonEmptyStr(d.content) || nonEmptyStr(d.description) ||
        nonEmptyStr(d.summary) || nonEmptyArr(d.steps)
      );
    case "faqs":
      return nonEmptyArr(d.items);
    case "news":
      return Array.isArray(d.items) && (d.items as { title?: string }[]).some((i) => nonEmptyStr(i?.title));
    case "admit-card":
    case "result":
    case "answer-key":
    case "cut-off":
      return (
        nonEmptyStr(d.body) || nonEmptyStr(d.content) || nonEmptyStr(d.description) ||
        nonEmptyStr(d.summary) || nonEmptyStr(d.releaseDate) || nonEmptyStr(d.date)
      );
    default:
      return nonEmptyStr(d.body) || nonEmptyStr(d.content) || nonEmptyStr(d.description) || nonEmptyStr(d.summary);
  }
}

/**
 * THE single content-presence rule. Given a section slug and an exam, returns
 * whether that section has data worth a tab, a sitemap entry, and a 200 page.
 * Column-backed sections read the typed field (canonical); editorial sections
 * read the jsonb store. Returns false for slugs the pillar doesn't apply to.
 */
export function hasData(exam: HasDataView, slug: string): boolean {
  const def = SECTION_BY_SLUG[slug];
  if (!def) return false;
  if (!def.appliesTo.includes(exam.pillar as Pillar)) return false;

  switch (def.source) {
    case "structure":
      // Key Highlights is synthesized: show it when any at-a-glance fact exists.
      if (slug === "key-highlights") {
        return (
          (exam.vacancy != null && exam.vacancy > 0) ||
          (!!exam.eligibility && (nonEmptyStr(exam.eligibility.qualification) || nonEmptyStr(exam.eligibility.age))) ||
          (!!exam.applicationFee && Object.values(exam.applicationFee).some((v) => typeof v === "number" && v > 0)) ||
          nonEmptyArr(exam.dates)
        );
      }
      return false; // other furniture is not gated here
    case "column":
      switch (slug) {
        case "important-dates":
          return nonEmptyArr(exam.dates);
        case "eligibility":
          return !!exam.eligibility && (
            nonEmptyStr(exam.eligibility.qualification) ||
            nonEmptyStr(exam.eligibility.age) ||
            nonEmptyStr(exam.eligibility.nationality)
          );
        case "vacancy":
          return exam.vacancy != null && exam.vacancy > 0;
        case "application-fee":
          return !!exam.applicationFee && Object.values(exam.applicationFee).some((v) => typeof v === "number" && v > 0);
        case "selection-process":
          return nonEmptyArr(exam.selectionProcess);
        case "syllabus":
          return nonEmptyArr(exam.syllabusHighlights);
        default:
          return false;
      }
    case "editorial":
      // FAQs is a column today (exams.faqs) even though it's editorial in nature.
      if (slug === "faqs") return nonEmptyArr(exam.faqs) || editorialHasData(exam, "faqs");
      return editorialHasData(exam, slug);
  }
}

/** Tab sections for a pillar that ALSO have data, in order. The tab row. */
export function availableTabs(exam: HasDataView): SectionDef[] {
  return tabSectionsForPillar(exam.pillar as Pillar).filter((s) => hasData(exam, s.slug));
}

// ── ContentType (URL slug) → registry section bridge ─────────────────────────
//
// Frontend routes use ContentType URL slugs that don't 1:1 match registry
// section slugs (e.g. URL "cutoff" → section "cut-off"; URL "application" →
// section "how-to-apply"; URL "notification" → section "overview"). Step 2 gates
// the EXISTING URL content types without renaming them. This map is the bridge;
// URL/slug unification (with redirects) is a later step.
//
// A ContentType with no registry section (or whose section has no data) is
// hidden from tabs, dropped from the sitemap, and 404s on direct hit.
const CONTENT_TYPE_TO_SECTION: Record<string, string> = {
  notification: "overview",
  application: "application-process",
  "admit-card": "admit-card",
  result: "result",
  "answer-key": "answer-key",
  syllabus: "syllabus",
  cutoff: "cut-off",
  // "date-sheet" intentionally absent: board/university concept only.
  // Must NOT fall through to "admit-card" — that caused recruitment exams with
  // admit-card content to show a Date Sheet tab.
  "previous-papers": "previous-papers",
  "study-material": "study-material",
  faqs: "faqs",
  news: "news",
};

/**
 * THE gate for a content-type URL. True iff the exam has data for the section
 * that URL maps to. Used by: tab rows, sitemap CT emission, sub-page routes
 * (notFound when false), and content-hub link lists. content types not in the
 * bridge (previous-papers, mock-test, study-material, books) have no backing
 * store today and are always false — they were never real pages.
 */
export function contentTypeHasData(exam: HasDataView, contentType: string): boolean {
  const section = CONTENT_TYPE_TO_SECTION[contentType];
  if (!section) return false;
  return hasData(exam, section);
}
