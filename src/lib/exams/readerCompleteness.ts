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

  const live = updates.filter((u) => isLiveUpdateView(u, opts.nowISO));
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
  });

  rows.push({
    key: "action-button",
    label: "Admit-card / Apply button",
    status: hasAttestedAction ? "filled" : "empty",
    fixHint: hasAttestedAction
      ? "An attested link on a published, unexpired update backs the button."
      : "Publish an update that CARRIES the real admit-card/apply link (quick link or attachment). A label with no URL never renders a button.",
    targetTab: "edition",
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
  });

  const elig = hasData(view, "eligibility");
  rows.push({
    key: "eligibility",
    label: "Eligibility",
    status: elig ? "filled" : "empty",
    fixHint: elig
      ? "Age / qualification / nationality render straight from the structured fields."
      : "Fill the structured Eligibility card (or the eligibility module) under Dates & Status.",
    targetTab: "edition",
  });

  const fee = hasData(view, "application-fee");
  const feeApplies = appliesToPillar(form.pillar, "application-fee");
  rows.push({
    key: "fee",
    label: "Application fee",
    status: !feeApplies ? "n/a" : fee ? "filled" : "empty",
    fixHint: !feeApplies
      ? "Not a reader section for this pillar — the exam page never shows a fee block."
      : "A ₹0 or blank row counts as no data; the section hides itself rather than render empty.",
    targetTab: "edition",
  });

  const vac = hasData(view, "vacancy");
  const vacApplies = appliesToPillar(form.pillar, "vacancy");
  rows.push({
    key: "vacancy",
    label: "Vacancy",
    status: !vacApplies ? "n/a" : vac ? "filled" : "empty",
    fixHint: !vacApplies
      ? "Not a reader section for this pillar — the exam page never shows a vacancy block."
      : "Set the Vacancy number under Dates & Status (0 = no data → row hidden).",
    targetTab: "edition",
  });

  const sel = hasData(view, "selection-process");
  const selApplies = appliesToPillar(form.pillar, "selection-process");
  rows.push({
    key: "selection-process",
    label: "Selection process",
    status: !selApplies ? "n/a" : sel ? "filled" : "empty",
    fixHint: !selApplies
      ? "Not a reader section for this pillar."
      : "The stages list lives on the Identity tab (exams.selection_process); empty list → the card never renders.",
    targetTab: "identity",
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
  });

  rows.push({
    key: "updates-timeline",
    label: "Updates timeline",
    status: live.length > 0 ? "filled" : "empty",
    fixHint: live.length > 0
      ? `${live.length} live update${live.length === 1 ? "" : "s"} (published, not withdrawn, not expired).`
      : "Publish an update in Dates & Status → Updates. Drafts, withdrawn and expired items never reach the reader.",
    targetTab: "edition",
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
      : "Add Q&A pairs in the SEO tab (exams.faqs). Placeholder answers ('N/A', 'not specified'…) count as NO data.",
    targetTab: "seo",
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
