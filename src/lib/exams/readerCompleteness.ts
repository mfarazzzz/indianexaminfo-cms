/**
 * readerCompleteness.ts — the exam editor's "What readers will see" panel, as
 * a PURE function (owner brief 22 Oct, item 2).
 *
 * ONE RULE PER READER BLOCK, SHARED WITH THE FRONTEND: the section rows reuse
 * hasData/meaningfulFaqs from src/lib/sectionRegistry.ts — the byte-for-byte
 * mirror of the frontend's registry (pinned by contentHasData.parity.test.ts
 * against contract/content-has-data.fixtures.json). The update-side rows reuse
 * the same reader filters the frontend updateFeed applies: published only,
 * kind !== withdrawn, expires_at in the future, and an ATTESTED url is a real
 * link stored on a live update — never a placeholder (mirrors
 * lib/exam/keyDates.pickAttestedAction). Nothing here invents a fact; a row
 * that has no data says so, and the only "blocked" rows are the ones the
 * EDITOR itself disabled (enabledModules) or that await a shipped frontend
 * change.
 *
 * Read-only by construction: it takes plain values and returns rows. It never
 * fetches, never writes, and the panel renders no Save anywhere.
 */
import { hasData, meaningfulFaqs, SECTION_BY_SLUG, type HasDataView } from "@/lib/sectionRegistry";
import type { RailTabId } from "@/pages/entrance-exams/editorSections";

export type ReaderStatus = "filled" | "empty" | "blocked" | "n/a";

export interface ReaderCompletenessRow {
  /** Stable key for tests and data-attrs. */
  key: string;
  /** Reader-facing block name, not the editor's jargon. */
  label: string;
  status: ReaderStatus;
  /** Where the fix lives, in the editor's own words. */
  fixHint: string;
  /** The rail tab the row jumps to (through the unsaved-changes guard). */
  targetTab: RailTabId;
  /**
   * The control the "Fix →" button focuses after switching the tab — a field name the
   * editor renders with data-fix-target (P2 item 15). Optional: when a fix has no single
   * control (a drag-and-drop list, a module card) the row still switches the tab, and the
   * panel says so rather than pretending to focus something.
   */
  focusKey?: string;
}

/** The plain form-state view (the editor passes its CURRENT unsaved values). */
export interface ReaderFormView {
  pillar: string;
  conductingBody?: string | null;
  officialWebsite?: string | null;
  cycleFrequency?: string | null;
  dates?: { label: string; date?: string | null }[] | null;
  eligibility?: { age?: string; qualification?: string; nationality?: string } | null;
  vacancy?: number | null;
  applicationFee?: Record<string, number | undefined> | null;
  selectionProcess?: string[] | null;
  faqs?: { question?: string; answer?: string | null }[] | null;
  contentModules?: Record<string, unknown> | null;
  /** The reader's Verified pill needs flag + date + verifier — the CMS record
   *  carries flag and date; the verify control is the only writer. */
  isVerified?: boolean;
  verifiedAt?: string | null;
}

/** The minimal view of one of the exam's own updates (content_posts). */
export interface ReaderUpdateView {
  status: "draft" | "review" | "published" | "unpublished" | string;
  kind?: string | null;
  expiresAt?: string | null;
  quickLinks?: { label?: string; url?: string }[] | null;
  attachmentUrls?: { label?: string; url?: string }[] | null;
  /** Identity + supersession edge. The reader timeline moves a SUPERSEDED update into
   *  "History / Withdrawn" (frontend lib/exam/updates.partitionUpdates), so a count that
   *  ignored these two fields would promise the editor a row the reader never sees
   *  (reference-page review 23 Oct, P2 item 15). */
  id?: string;
  supersedesId?: string | null;
}

export interface ReaderCompletenessOptions {
  /** ISO string; the tests pass a fixed one so "expired" is deterministic. */
  nowISO: string;
  /** The Quick information facts card renders ONLY once the frontend change
   *  ships; until then the panel must say BLOCKED, never pretend (see below). */
  quickInfoCardEnabled?: boolean;
  /** Reserved for hasData's syllabus signal; the panel's rows don't gate on it. */
  hasStructuredSyllabus?: boolean;
}

/** The action link vocabularies the frontend's pickAttestedAction accepts. */
const ACTION_RES: RegExp[] = [
  /admit\s*card|hall\s*ticket|call\s*letter/i,
  /apply|application|register/i,
  /result|score\s*card/i,
];

/** Mirrors the frontend updateFeed.isLiveUpdate: published, not withdrawn,
 *  not expired (ISO strings compare lexically). */
export function isLiveUpdateView(u: ReaderUpdateView, nowISO: string): boolean {
  if (u.status !== "published") return false;
  if (u.kind === "withdrawn") return false;
  const e = u.expiresAt;
  if (typeof e === "string" && e.trim() !== "" && e < nowISO) return false;
  return true;
}

/**
 * The ids SUPERSEDED by some other update in the SAME set — the exact rule the
 * frontend's partitionUpdates applies (a row another row points at moves to
 * History). Exported so the panel and its tests share one definition.
 */
export function supersededUpdateIds(updates: readonly ReaderUpdateView[]): Set<string> {
  const ids = new Set<string>();
  for (const u of updates) {
    const sid = typeof u.supersedesId === "string" ? u.supersedesId.trim() : "";
    if (sid) ids.add(sid);
  }
  return ids;
}

/**
 * Live AND not superseded — what the reader's Updates timeline actually shows.
 * The editor's counts must use THIS, not the looser isLiveUpdateView, or the panel
 * promises a row the reader cannot see.
 */
export function readerVisibleUpdates(updates: readonly ReaderUpdateView[], nowISO: string): ReaderUpdateView[] {
  const superseded = supersededUpdateIds(updates);
  return updates.filter((u) => isLiveUpdateView(u, nowISO) && !(u.id && superseded.has(u.id)));
}

function liveLinks(updates: ReaderUpdateView[]): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (const u of updates) {
    if (!isLiveUpdateView(u, "")) {
      // expiry needs nowISO — handled by the caller's filtered list; keep any
      // non-expired decision made upstream. This function is only called with
      // already-live updates.
    }
    for (const l of [...(u.quickLinks ?? []), ...(u.attachmentUrls ?? [])]) {
      if (l && typeof l.url === "string" && l.url.trim()) out.push({ label: String(l.label ?? ""), url: l.url });
    }
  }
  return out;
}

function moduleDisabled(view: ReaderFormView, slug: string): boolean {
  const config = (view.contentModules ?? {})._config as { enabledModules?: string[] } | undefined;
  return !!(config?.enabledModules && config.enabledModules.length > 0 && !config.enabledModules.includes(slug));
}

/** True when an editorial module carries prose a reader would actually see. */
function moduleHasProse(view: ReaderFormView, slug: string): boolean {
  const d = (view.contentModules ?? {})[slug];
  if (!d || typeof d !== "object" || Array.isArray(d)) return false;
  const o = d as Record<string, unknown>;
  return ["body", "content", "description", "summary", "additionalCriteria"].some(
    (k) => typeof o[k] === "string" && (o[k] as string).trim() !== "",
  );
}

/**
 * THE panel rows, in the owner's order. Every row is computed from the same
 * predicate the reader uses; nothing is fetched or invented here.
 */
/** True when the registry section is shown for this pillar at all. A column
 *  section that does not apply to the pillar is NOT "no data" — it is simply not
 *  a reader block here, so the panel says "n/a" rather than nagging to fill it. */
function appliesToPillar(pillar: string, slug: string): boolean {
  const def = SECTION_BY_SLUG[slug];
  return def ? (def.appliesTo as string[]).includes(pillar) : true;
}

export function computeReaderCompleteness(
  form: ReaderFormView,
  updates: ReaderUpdateView[],
  opts: ReaderCompletenessOptions,
): ReaderCompletenessRow[] {
  const view: HasDataView = {
    pillar: form.pillar,
    dates: (form.dates ?? []) as HasDataView["dates"],
    eligibility: form.eligibility ?? null,
    vacancy: form.vacancy ?? null,
    applicationFee: (form.applicationFee ?? null) as HasDataView["applicationFee"],
    selectionProcess: form.selectionProcess ?? null,
    academicInfo: null,
    hasStructuredSyllabus: opts.hasStructuredSyllabus ?? false,
    faqs: (form.faqs ?? null) as HasDataView["faqs"],
    contentModules: (form.contentModules ?? undefined) as HasDataView["contentModules"],
  };

  const live = readerVisibleUpdates(updates, opts.nowISO);
  const attested = liveLinks(live);
  const hasAttestedAction = attested.some((l) => ACTION_RES.some((re) => re.test(l.label)));
  const datedRows = (form.dates ?? []).filter((d) => d && String(d.date ?? "").trim() !== "");

  const rows: ReaderCompletenessRow[] = [];

  rows.push({
    key: "key-dates",
    label: "Key dates strip",
    status: datedRows.length > 0 ? "filled" : "empty",
    fixHint: datedRows.length > 0
      ? `Next dates a reader sees come from the edition's Important Dates (${datedRows.length} dated row${datedRows.length === 1 ? "" : "s"}).`
      : "Add a dated row under Dates & Status → Important Dates. Undated rows never render.",
    targetTab: "edition",
    focusKey: "important-dates",
  });

  const website = (form.officialWebsite ?? "").trim();
  rows.push({
    key: "official-website",
    label: "Official website button",
    status: website ? "filled" : "empty",
    fixHint: website
      ? "Shown in the strip, sidebar and sources line straight from the stored field."
      : "Set Official Website in the Identity tab. No URL stored → no button anywhere (never a fake link).",
    targetTab: "identity",
    focusKey: "officialWebsite",
  });

  rows.push({
    key: "action-button",
    label: "Admit-card / Apply button",
    status: hasAttestedAction ? "filled" : "empty",
    fixHint: hasAttestedAction
      ? "An attested link on a published, unexpired, not superseded update backs the button."
      : "Publish an update that CARRIES the real admit-card/apply link (quick link or attachment). A label with no URL never renders a button.",
    targetTab: "edition",
    focusKey: "updates",
  });

  const impDates = hasData(view, "important-dates");
  rows.push({
    key: "important-dates",
    label: "Important dates table",
    status: impDates ? "filled" : "empty",
    fixHint: impDates
      ? "Renders every row the edition stores."
      : "Fill Important Dates under Dates & Status; an empty list hides the whole card.",
    targetTab: "edition",
    focusKey: "important-dates",
  });

  const elig = hasData(view, "eligibility");
  rows.push({
    key: "eligibility",
    label: "Eligibility",
    status: elig ? "filled" : "empty",
    fixHint: elig
      ? "Age / qualification / nationality render straight from the structured fields."
      : "Fill the Eligibility card on the Modules tab (it writes the edition column). The reader hides the table while every field is blank.",
    targetTab: "modules",
    focusKey: "eligibility",
  });

  const fee = hasData(view, "application-fee");
  const feeApplies = appliesToPillar(form.pillar, "application-fee");
  rows.push({
    key: "fee",
    label: "Application fee",
    status: !feeApplies ? "n/a" : fee ? "filled" : "empty",
    fixHint: !feeApplies
      ? "Not a reader section for this pillar — the exam page never shows a fee block."
      : "Fill the Application Fee card on the Modules tab. A ₹0 or blank row counts as no data; the section hides itself rather than render empty.",
    targetTab: "modules",
    focusKey: "application-fee",
  });

  // The row must agree with the PAGE, not with the column alone. The reader renders a
  // "Vacancy Details" section when the structured vacancy is > 0; on a pillar the registry
  // section does NOT cover, the module block still paints one when the vacancy-details
  // module carries prose (frontend lib/exam/sectionOwnership gives the block anything no
  // other surface shows). Only when neither is true is the section genuinely n/a.
  const vac = hasData(view, "vacancy");
  const vacApplies = appliesToPillar(form.pillar, "vacancy");
  const vacModuleProse = moduleHasProse(view, "vacancy-details");
  const vacModuleOff = moduleDisabled(view, "vacancy-details");
  // Order matters and mirrors the frontend: a DISABLED module renders nowhere
  // (moduleShowsInContentBlock requires it in enabledModules), so "blocked" must be
  // decided BEFORE prose — otherwise the panel claims a section the reader will not see.
  const vacStatus: ReaderStatus = vacApplies
    ? (vac ? "filled" : "empty")
    : vacModuleOff
      ? "blocked"
      : vacModuleProse
        ? "filled"
        : "n/a";
  rows.push({
    key: "vacancy",
    label: "Vacancy",
    status: vacStatus,
    fixHint: vacApplies
      ? vac
        ? "Readers see the total from the Vacancy field, with any post-wise detail from the module beneath it."
        : "Set the Vacancy number under Dates & Status (0 = no data → the section is hidden)."
      : vacModuleOff
        ? "The Modules tab has Vacancy Details switched OFF, so the reader cannot see it."
        : vacModuleProse
          ? "This pillar has no vacancy section, but the Vacancy Details module carries text — the site shows it as a plain section."
          : "Not a reader section for this pillar — nothing to fill.",
    targetTab: "edition",
    focusKey: "vacancy",
  });

  const sel = hasData(view, "selection-process");
  const selApplies = appliesToPillar(form.pillar, "selection-process");
  rows.push({
    key: "selection-process",
    label: "Selection process",
    status: !selApplies ? "n/a" : sel ? "filled" : "empty",
    fixHint: !selApplies
      ? "Not a reader section for this pillar."
      : "Fill the Selection Process card on the Modules tab (it writes exams.selection_process); an empty list means the section never renders.",
    targetTab: "modules",
    focusKey: "selection-process",
  });

  const steps = ((view.contentModules?.["application-process"] ?? {}) as { steps?: unknown[] }).steps;
  const hasSteps = Array.isArray(steps) && steps.length > 0;
  const apDisabled = moduleDisabled(view, "application-process");
  const apApplies = appliesToPillar(form.pillar, "application-process");
  rows.push({
    key: "how-to-steps",
    label: "How-to steps",
    status: !apApplies ? "n/a" : hasSteps && !apDisabled ? "filled" : apDisabled ? "blocked" : "empty",
    fixHint: !apApplies
      ? "Not a reader section for this pillar."
      : apDisabled
        ? "The Modules tab has Application Process switched OFF (enabledModules) — the reader cannot see it until re-enabled."
        : "Add steps to the Application Process module in the Modules tab.",
    targetTab: "modules",
    focusKey: "application-process",
  });

  rows.push({
    key: "updates-timeline",
    label: "Updates timeline",
    status: live.length > 0 ? "filled" : "empty",
    fixHint: live.length > 0
      ? `${live.length} live update${live.length === 1 ? "" : "s"} (published, not withdrawn, not expired, not superseded).`
      : "Publish an update in Dates & Status → Updates. Drafts, withdrawn, expired and superseded items never reach the reader's timeline.",
    targetTab: "edition",
    focusKey: "updates",
  });

  const verified = form.isVerified === true && String(form.verifiedAt ?? "").trim() !== "";
  rows.push({
    key: "verified-line",
    label: "Verified line",
    status: verified ? "filled" : "empty",
    fixHint: verified
      ? "Readers see 'Verified by IndianExamInfo editorial team · <date>' instead of the honest notice."
      : "Use the Verify control in the header. Until then readers see the honest 'not yet verified' notice (by design).",
    targetTab: "identity",
    focusKey: "verify",
  });

  const quickFacts = [form.conductingBody, website, form.cycleFrequency].some((v) => String(v ?? "").trim() !== "");
  rows.push({
    key: "quick-info-card",
    label: "Quick information card",
    status: !opts.quickInfoCardEnabled ? "blocked" : quickFacts ? "filled" : "empty",
    fixHint: !opts.quickInfoCardEnabled
      ? "The card is added to the reader template in the same batch (mock gap audit); until it ships it renders nowhere."
      : quickFacts
        ? "Conducting body, frequency and website come straight from the stored fields; facts with no stored value are omitted."
        : "Fill Conducting Body / Exam Frequency / Official Website in the Identity tab.",
    targetTab: "identity",
    focusKey: "conductingBody",
  });

  // FAQs render from the exams.faqs COLUMN (FaqsSummary + hasData both read the
  // column), so enabledModules does NOT gate them — a record with meaningful FAQs
  // always shows them. (The reader never hides FAQs via the module toggle.)
  const faqCount = meaningfulFaqs(form.faqs ?? []).length;
  rows.push({
    key: "faq",
    label: "FAQ (details/summary)",
    status: faqCount > 0 ? "filled" : "empty",
    fixHint: faqCount > 0
      ? `${faqCount} meaningful answer${faqCount === 1 ? "" : "s"} render as expandable <details>.`
      : "Add Q&A pairs on the FAQs card (Modules tab, or the SEO tab — both write exams.faqs). Placeholder answers ('N/A', 'not specified'…) count as NO data.",
    targetTab: "modules",
    focusKey: "faqs",
  });

  return rows;
}

/** Compact summary for the panel header, e.g. "9 filled · 3 empty · 1 blocked · 2 n/a". */
export function summarizeReaderCompleteness(rows: ReaderCompletenessRow[]): string {
  const c = { filled: 0, empty: 0, blocked: 0, "n/a": 0 };
  for (const r of rows) c[r.status] += 1;
  const parts = [`${c.filled} filled`, `${c.empty} empty`, `${c.blocked} blocked`];
  if (c["n/a"] > 0) parts.push(`${c["n/a"]} n/a`);
  return parts.join(" · ");
}

/**
 * Panel order (P2 item 15): what still needs work comes FIRST, in the owner's own row
 * order — blocked, then empty, then n/a, then filled at the bottom. The reader's eye
 * opens on the rows that have a Fix button, not on the nine things already right.
 */
const STATUS_RANK: Record<ReaderStatus, number> = { blocked: 0, empty: 1, "n/a": 2, filled: 3 };

export function orderRowsForFixFirst(rows: ReaderCompletenessRow[]): ReaderCompletenessRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => STATUS_RANK[a.r.status] - STATUS_RANK[b.r.status] || a.i - b.i)
    .map(({ r }) => r);
}
