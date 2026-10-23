/**
 * R2.1 — the editor shell's section rail, as data.
 *
 * The rail is the registry: `module_registry` rows, `is_active`, ordered by
 * `display_order`, already narrowed to this record's pillar by
 * `getModuleRegistry(pillar)` (the pillar filter lives THERE and only there —
 * this module does not re-implement it, so the rail and the Modules panel can
 * never disagree about which sections exist for a pillar).
 *
 * R2.1 is a NAVIGATION skeleton (owner decision, 16 Oct): it moves nothing and
 * saves nothing. Each registry section points at the surface that holds its
 * content TODAY, which is why several sections share one tab — that is the
 * honest state of the editor, not a placeholder. R2.3/R2.5 re-home content into
 * first-class sections; when they do, they change a row of `SECTION_TABS` and
 * nothing else.
 */

/** Tab ids that exist in EntranceExamEditorPage's `tabs` list. */
export type RailTabId =
  | "identity" | "resources" | "syllabus" | "edition"
  | "modules" | "news" | "seo" | "editions";

/**
 * The ONE label per editor tab (reference-page review 23 Oct, P2 items 15 and 17).
 * The tab strip, the rail hint and the "What readers will see" Fix button all read
 * this, so a hint can never name a place the editor cannot find under that name.
 * `editions` is shown with a count by the tab strip; the count is appended there, the
 * base word stays here.
 */
export const TAB_LABELS: Record<RailTabId, string> = {
  identity: "Identity",
  resources: "Resources",
  syllabus: "Syllabus",
  edition: "Dates & Status",
  modules: "Modules",
  news: "News",
  seo: "SEO",
  editions: "Editions",
};

export interface RailItem {
  /** module_registry.slug — the stable key, never the display label. */
  slug: string;
  /** module_registry.name, shown in the rail. */
  label: string;
  /** where this section's content lives today. */
  tabId: RailTabId;
}

/**
 * The sections whose content is NOT in the Modules panel today. Everything else
 * in the registry is a `content_modules[slug]` section, edited in ModulePanel —
 * so the default is "modules", and the four exceptions are stated explicitly.
 * `important-dates` is the Dates & Status tab (exam_editions.important_dates),
 * `syllabus` is its own tab (exam_syllabus_subjects), `faqs` sits in the SEO tab
 * (exams.faqs) until R2.5 gives it a first-class input, and `news` is the News
 * tab (retired by R4 in favour of content_posts, so it keeps its own entry).
 */
export const SECTION_TABS: Record<string, RailTabId> = {
  "important-dates": "edition",
  "syllabus": "syllabus",
  "faqs": "seo",
  "news": "news",
};

export function tabIdForSection(slug: string): RailTabId {
  return SECTION_TABS[slug] ?? "modules";
}

/**
 * Rail items from an ALREADY pillar-filtered registry list, in `display_order`
 * order. Order is taken from the input, never re-sorted here — "rail order =
 * registry order" is the acceptance rule, and a second sort would be a second
 * source of truth. Duplicate slugs collapse to the first row (a registry
 * duplicate must not render two rail buttons with the same key).
 */
export function buildRail(rows: readonly { slug?: unknown; name?: unknown }[]): RailItem[] {
  const seen = new Set<string>();
  const items: RailItem[] = [];
  for (const row of rows) {
    const slug = typeof row?.slug === "string" ? row.slug.trim() : "";
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const name = typeof row?.name === "string" && row.name.trim() ? row.name.trim() : slug;
    items.push({ slug, label: name, tabId: tabIdForSection(slug) });
  }
  return items;
}

/** The dirty flags the page already aggregates for its unsaved-changes guard. */
export interface DirtyFlags {
  formDirty: boolean;
  moduleDirty: boolean;
  newsDirty: boolean;
}

/**
 * Which surfaces hold unsaved work today. One fact, one place: these are the
 * SAME flags `isDirty` is built from, read per tab — the rail dots are a view,
 * never their own state (a dot that could disagree with the guard would be
 * worse than no dot).
 * - `resources` / `syllabus` save to the server from their own controls, so the
 *   shell has no dirty signal for them and never claims one;
 * - `news` reports up via onDirtyChange, `modules` is ModulePanel's autosave
 *   state, everything form-backed (identity, edition, seo) is the RHF form.
 */
export function sectionIsDirty(tabId: RailTabId, flags: DirtyFlags): boolean {
  switch (tabId) {
    case "modules": return flags.moduleDirty;
    case "news": return flags.newsDirty;
    case "resources":
    case "syllabus": return false;
    default: return flags.formDirty;
  }
}
