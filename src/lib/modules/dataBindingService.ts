/**
 * dataBindingService.ts — Smart data binding for content modules.
 *
 * Resolves module content based on data mode (auto/hybrid/manual).
 * Auto-generates content from existing structured data (Identity, Dates, SEO, News).
 * Detects stale modules and provides sync capabilities.
 */
import type { ExamIdentity, ExamEdition } from "@/services/entranceExamService";
import type { ContentModulesData, ModuleContentData } from "@/types/modules";

// ── Types ──────────────────────────────────────────────────────────────────

export type DataMode = "auto" | "hybrid" | "manual";

export interface BindingConfig {
  modes: Record<string, DataMode>;
  syncTimestamps: Record<string, string>;
}

export interface ResolvedContent {
  autoContent: Record<string, unknown> | null;
  manualContent: Record<string, unknown> | null;
  isStale: boolean;
}

// ── Default Modes ──────────────────────────────────────────────────────────

const DEFAULT_MODES: Record<string, DataMode> = {
  "overview": "auto",
  "important-dates": "auto",
  "faqs": "auto",
  "news": "auto",
  "eligibility": "manual",
  "application-process": "manual",
  "exam-pattern": "manual",
  "syllabus": "manual",
  "admit-card": "manual",
  "result": "manual",
  "cut-off": "manual",
  "counselling": "manual",
};

// ── Mode Helpers ───────────────────────────────────────────────────────────

export function getModuleMode(config: BindingConfig | undefined, slug: string): DataMode {
  return config?.modes?.[slug] ?? DEFAULT_MODES[slug] ?? "manual";
}

export function setModuleMode(config: BindingConfig, slug: string, mode: DataMode): BindingConfig {
  return {
    ...config,
    modes: { ...config.modes, [slug]: mode },
  };
}

export function getDefaultBindingConfig(): BindingConfig {
  return { modes: { ...DEFAULT_MODES }, syncTimestamps: {} };
}

// ── Stale Detection ────────────────────────────────────────────────────────

export function isModuleStale(
  slug: string,
  syncTimestamp: string | undefined,
  sourceUpdatedAt: string | undefined
): boolean {
  if (!syncTimestamp || !sourceUpdatedAt) return false;
  return new Date(sourceUpdatedAt) > new Date(syncTimestamp);
}

/**
 * Get the relevant source timestamp for a module's auto-content.
 */
export function getSourceTimestamp(
  slug: string,
  exam: ExamIdentity | null,
  edition: ExamEdition | null
): string | undefined {
  switch (slug) {
    case "overview":
      // Overview depends on both identity and edition
      return exam?.updatedAt && edition?.updatedAt
        ? new Date(exam.updatedAt) > new Date(edition.updatedAt) ? exam.updatedAt : edition.updatedAt
        : exam?.updatedAt ?? edition?.updatedAt;
    case "important-dates":
      return edition?.updatedAt;
    case "faqs":
      return exam?.updatedAt; // FAQs come from exam.faqs (SEO tab)
    case "news":
      return edition?.updatedAt; // News stored in content_modules
    default:
      return edition?.updatedAt;
  }
}

// ── Content Resolution ─────────────────────────────────────────────────────

/**
 * Resolve what content to display for a module based on its data mode.
 */
export function resolveModuleContent(
  slug: string,
  mode: DataMode,
  exam: ExamIdentity | null,
  edition: ExamEdition | null,
  contentModules: ContentModulesData
): ResolvedContent {
  const manualContent = (contentModules[slug] as ModuleContentData) ?? null;
  const syncTimestamp = (contentModules._config as any)?.syncTimestamps?.[slug];
  const sourceTs = getSourceTimestamp(slug, exam, edition);
  const isStale = isModuleStale(slug, syncTimestamp, sourceTs);

  switch (mode) {
    case "auto": {
      const autoContent = generateAutoContent(slug, exam, edition, contentModules);
      return { autoContent, manualContent: null, isStale };
    }
    case "hybrid": {
      const autoContent = generateAutoContent(slug, exam, edition, contentModules);
      return { autoContent, manualContent: manualContent ? { notes: (manualContent as any).notes ?? "" } : null, isStale };
    }
    case "manual":
      return { autoContent: null, manualContent: manualContent as Record<string, unknown> | null, isStale: false };
  }
}

// ── Auto Content Generators ────────────────────────────────────────────────

function generateAutoContent(
  slug: string,
  exam: ExamIdentity | null,
  edition: ExamEdition | null,
  contentModules: ContentModulesData
): Record<string, unknown> | null {
  switch (slug) {
    case "overview":
      return generateOverviewAuto(exam, edition);
    case "important-dates":
      return generateImportantDatesAuto(edition);
    case "faqs":
      return generateFaqsAuto(exam);
    case "news":
      return generateNewsAuto(contentModules);
    default:
      return null;
  }
}

/**
 * Generate Overview HTML from structured exam data.
 */
export function generateOverviewAuto(
  exam: ExamIdentity | null,
  edition: ExamEdition | null
): Record<string, unknown> | null {
  if (!exam) return null;

  const year = edition?.year ?? new Date().getFullYear();
  const name = exam.name;
  const shortName = exam.shortName;
  const body = exam.conductingBody;
  const website = exam.officialWebsite;
  const status = edition?.status?.replace(/-/g, " ") ?? "upcoming";
  const category = exam.category?.replace(/-/g, " ") ?? "";

  // Build upcoming dates (next 3)
  const dates = (edition?.importantDates ?? [])
    .filter((d) => d.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const datesHtml = dates.length > 0
    ? `<ul>${dates.map((d) => `<li><strong>${d.label}:</strong> ${formatDateForOverview(d.date)}${d.isUrgent ? " ⚡" : ""}</li>`).join("")}</ul>`
    : "";

  // Build eligibility snippet
  const elig = edition?.eligibility as Record<string, unknown> | undefined;
  const eligSnippet = elig?.qualification
    ? `<p><strong>Eligibility:</strong> ${elig.qualification}</p>`
    : "";

  // Build fee snippet
  const fee = edition?.applicationFee as Record<string, unknown> | undefined;
  const feeSnippet = fee?.general
    ? `<p><strong>Application Fee:</strong> ₹${fee.general} (General)${fee.sc ? ` / ₹${fee.sc} (SC/ST)` : ""}</p>`
    : "";

  const html = `
<p><strong>${name} (${shortName}) ${year}</strong> is conducted by <strong>${body}</strong>. It is a ${category} exam. Current status: <strong>${status}</strong>.</p>
${website ? `<p>Official Website: <a href="${website}" target="_blank" rel="noopener">${website}</a></p>` : ""}
${datesHtml ? `<h3>Key Dates</h3>${datesHtml}` : ""}
${eligSnippet}
${feeSnippet}
`.trim();

  return {
    summary: `${shortName} ${year} — ${body}. Status: ${status}.`,
    body: html,
  };
}

function generateImportantDatesAuto(edition: ExamEdition | null): Record<string, unknown> | null {
  if (!edition) return null;
  return {
    dates: (edition.importantDates ?? []).filter((d) => d.date && d.date.trim() !== ""),
  };
}

function generateFaqsAuto(exam: ExamIdentity | null): Record<string, unknown> | null {
  if (!exam || !exam.faqs || exam.faqs.length === 0) return null;
  return {
    items: exam.faqs.map((f) => ({ question: f.question, answer: f.answer, source: "seo", pinned: false })),
  };
}

function generateNewsAuto(contentModules: ContentModulesData): Record<string, unknown> | null {
  const newsData = contentModules.news as Record<string, unknown> | undefined;
  if (!newsData) return null;
  // News items are already stored — just pass through
  return newsData;
}

// ── Utility ────────────────────────────────────────────────────────────────

function formatDateForOverview(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/**
 * Count stale modules given current config and source timestamps.
 */
export function countStaleModules(
  config: BindingConfig,
  exam: ExamIdentity | null,
  edition: ExamEdition | null
): number {
  let count = 0;
  for (const [slug, mode] of Object.entries(config.modes)) {
    if (mode === "manual") continue;
    const syncTs = config.syncTimestamps[slug];
    const sourceTs = getSourceTimestamp(slug, exam, edition);
    if (isModuleStale(slug, syncTs, sourceTs)) count++;
  }
  return count;
}
