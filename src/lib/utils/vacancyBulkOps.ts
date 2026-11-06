/**
 * vacancyBulkOps.ts — bulk FILL (not bulk create) for the `sarkari_naukri` table.
 *
 * Owner batch 7, Phase C2. The 361 vacancy rows that carry ~91% of the site's Search
 * Console clicks have NO structured dates and NO official links, so every reader-facing
 * "last date" line and every JobPosting is silent (see docs/status/vacancy-bulk-fill.md
 * for the measured census and the five gates). Filling 361 rows one screen at a time is
 * not a realistic task, so this module makes it a spreadsheet job:
 *
 *   export  → one row per vacancy, the 20 slugs that carry 84% of impressions FIRST,
 *             current values included so the owner only types what is missing;
 *   fill    → offline, in any spreadsheet app;
 *   import  → through the existing readSpreadsheetUpload gate (type/size/row caps),
 *             preview every change, then write ONLY the whitelisted columns, matched by
 *             id. It NEVER creates a row, NEVER clears a value, and NEVER overwrites a
 *             non-empty value unless `overwrite` is explicitly ticked.
 *
 * The whitelist is exactly what the public vacancy page and Google's JobPosting need —
 * nothing else can be written through this path:
 *   notification_date, application_start_date, application_end_date,
 *   official_notification_url, application_url, vacancy_count, exam_date
 *
 * Verification interplay is reported, never silently broken: trg_sarkari_verify voids
 * verified_at whenever one of the four gated fields moves, so any row that is already
 * verified and will change carries a warning telling the owner to re-verify.
 */
import * as XLSX from "xlsx";
import { db } from "@/lib/supabase/client";
import { readSpreadsheetUpload, type ParsedUpload } from "@/lib/utils/spreadsheetUpload";
/** Columns this module may write. Anything else in the sheet is ignored, on purpose. */
export const VACANCY_IMPORT_COLUMNS = [
  "notification_date",
  "application_start_date",
  "application_end_date",
  "official_notification_url",
  "application_url",
  "vacancy_count",
  "exam_date",
] as const;
export type VacancyImportColumn = typeof VACANCY_IMPORT_COLUMNS[number];

const DATE_COLUMNS = ["notification_date", "application_start_date", "application_end_date", "exam_date"] as const;
const URL_COLUMNS = ["official_notification_url", "application_url"] as const;

/**
 * The twenty slugs the owner's GSC export says carry 84% of the vacancy impressions.
 * The export puts them first so the highest-value work is at the top of the sheet.
 */
export const TOP_VACANCY_SLUGS: readonly string[] = [
  "up-swasthya-vibhag-ambulance-driver-2026",
  "up-district-hospital-ward-boy-2026-gorakhpur",
  "tamil-nadu-anganwadi-worker-2026-chennai",
  "gujarat-anganwadi-worker-helper-bharti-2026-ahmedabad",
  "up-swasthya-vibhag-pharmacist-2026",
  "jharkhand-forest-guard-2026",
  "up-nagar-nigam-safai-karmi-2026-lucknow",
  "uttarakhand-anganwadi-bharti-2026-haridwar",
  "rajasthan-health-dept-radiographer-2026",
  "ibps-clerk-2026-prelims-result",
  "up-nagar-nigam-safai-karmi-2026-kanpur",
  "up-fisheries-dept-matsya-mitra-2026",
  "west-bengal-gram-panchayat-sahayak-2026",
  "karnataka-anganwadi-2026-belgaum",
  "rajasthan-forest-guard-vanrakshak-2026",
  "rajasthan-pwd-work-charged-2026",
  "bihar-anganwadi-bharti-2026-east-champaran",
  "up-asha-worker-bharti-2026-varanasi",
  "up-nagar-palika-parishad-clerk-2026",
  "mp-mahila-supervisor-icds-2026",
];

/** The five conditions buildSarkariJobPostingSchema() checks, in the order they are filled. */
export const JOBPOSTING_GATES = [
  { column: "notification_date", label: "Notification date (datePosted — required)" },
  { column: "application_start_date", label: "Application start (opens the window)" },
  { column: "application_end_date", label: "Application end / last date (validThrough)" },
  { column: "official_notification_url", label: "Official notification URL (source of truth)" },
  { column: "__verified__", label: "Verified against that notice (verified_at)" },
] as const;

export interface VacancyCurrent {
  id: string;
  slug: string;
  title: string;
  organization: string | null;
  state: string | null;
  recruitment_type: string | null;
  workflow_status: string | null;
  verified_at: string | null;
  notification_date: string | null;
  application_start_date: string | null;
  application_end_date: string | null;
  official_notification_url: string | null;
  application_url: string | null;
  vacancy_count: number | null;
  exam_date: string | null;
}

export interface VacancyRowPlan {
  rowNumber: number;                 // 1-based, spreadsheet-visible for the report
  id: string | null;
  slug: string | null;
  /** Column → the value that will actually be written, after normalisation. */
  writes: Partial<Record<VacancyImportColumn, string | number>>;
  /** Columns dropped, each with the plain reason shown in the preview. */
  skipped: { column: string; reason: string }[];
  errors: string[];
  warnings: string[];
  /** False when anything blocked this row; apply() refuses to write it. */
  valid: boolean;
}

// ── cell normalisation ───────────────────────────────────────────────────────────────

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/;
/** Excel stores a date as a day number from 1899-12-30; a bare "45,000"-style cell that
 *  survives the round trip arrives here as a number in that range. */
const EXCEL_SERIAL_MIN = 30000;   // 1982-ish — nothing sane in this table is older
const EXCEL_SERIAL_MAX = 60000;   // 2064-ish

/**
 * Any cell → ISO `YYYY-MM-DD`, or null when the cell holds nothing.
 *
 * Strict about what it accepts and honest about what it repaired: a day/month/year cell
 * or an Excel date serial is normalised and REPORTED (the owner sees the resolved date in
 * the preview before anything is written), while anything that is not a date at all is an
 * error for that row rather than a silent null.
 */
export function normaliseDateCell(value: unknown): { iso: string | null; note?: string; error?: string } {
  if (value === null || value === undefined) return { iso: null };
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { iso: null, error: "a date cell that is not a real date" };
    const iso = `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
    return { iso, note: `read as a date cell, written as ${iso}` };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < EXCEL_SERIAL_MIN || value > EXCEL_SERIAL_MAX) {
      return { iso: null, error: `"${value}" is not a date (use YYYY-MM-DD)` };
    }
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    return { iso, note: `read as an Excel date serial (${value}), written as ${iso}` };
  }
  const raw = String(value).trim();
  if (raw === "") return { iso: null };
  const iso = raw.match(ISO_RE);
  if (iso) {
    const [, y, m, d] = iso.map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return { iso: null, error: `"${raw}" is not a real calendar date` };
    const back = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    // Reject 2026-02-30 style dates without a calendar library: rebuild and compare.
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== back) {
      return { iso: null, error: `"${raw}" is not a real calendar date` };
    }
    return { iso: back };
  }
  const dmy = raw.match(DMY_RE);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy.map(Number);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { iso: null, error: `"${raw}" is not a real calendar date` };
    const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return { iso: null, error: `"${raw}" is not a real calendar date` };
    return { iso: dt.toISOString().slice(0, 10), note: `"${raw}" read as day/month/year, written as ${dt.toISOString().slice(0, 10)}` };
  }
  return { iso: null, error: `"${raw}" is not a date (use YYYY-MM-DD)` };
}

/** Hosts that can stand as an official source. Anything else is allowed but flagged. */
const OFFICIAL_HOST_RE = /(\.gov\.in|\.nic\.in|\.nic$|\.ac\.in|\.edu\.in|\.gov\b|india\.gov\.in|\.nic\.in$)/i;

export function classifyUrlCell(value: unknown): { url: string | null; error?: string; warning?: string } {
  if (value === null || value === undefined) return { url: null };
  const raw = String(value).trim();
  if (raw === "") return { url: null };
  let u: URL;
  try { u = new URL(raw); } catch { return { url: null, error: `"${raw.slice(0, 60)}" is not a URL` }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { url: null, error: `"${raw.slice(0, 60)}" must be http(s)` };
  if (u.protocol === "http:") return { url: raw, warning: "plain http — the notice link should be https" };
  if (!OFFICIAL_HOST_RE.test(u.hostname)) return { url: raw, warning: `${u.hostname} is not a gov.in/nic.in-style official host — check it is the real notice` };
  return { url: raw };
}

// ── planning ────────────────────────────────────────────────────────────────────────

/** Header → whitelist, tolerant of the sheet having extra columns (they are ignored). */
function columnKey(header: string): VacancyImportColumn | null {
  const h = header.trim().toLowerCase().replace(/ /g, "_");
  return (VACANCY_IMPORT_COLUMNS as readonly string[]).includes(h) ? (h as VacancyImportColumn) : null;
}

const isEmptyCell = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/**
 * Decide what each sheet row would write, WITHOUT touching the database.
 *
 * @param records     objects from the uploaded sheet (keys are the header names)
 * @param current     the live rows, keyed by id — the only thing a write may match
 * @param opts.overwrite allow replacing a value that is already set
 * @param opts.todayISO  ISO day, injectable so the "window already closed" warning is testable
 */
export function planVacancyRows(
  records: Record<string, unknown>[],
  current: Map<string, VacancyCurrent>,
  opts: { overwrite?: boolean; todayISO?: string } = {},
): { plans: VacancyRowPlan[]; counts: { rows: number; writable: number; blocked: number; noChange: number } } {
  const overwrite = opts.overwrite === true;
  const todayISO = opts.todayISO ?? new Date().toISOString().slice(0, 10);
  const plans: VacancyRowPlan[] = [];

  records.forEach((rec, i) => {
    const plan: VacancyRowPlan = {
      rowNumber: i + 2,   // +1 for the header row, +1 because spreadsheets are 1-based
      id: null, slug: null, writes: {}, skipped: [], errors: [], warnings: [], valid: true,
    };
    const idCell = rec["id"] ?? rec["Id"] ?? rec["ID"];
    const slugCell = rec["slug"] ?? rec["Slug"];
    plan.id = idCell === null || idCell === undefined ? null : String(idCell).trim();
    plan.slug = slugCell === null || slugCell === undefined ? null : String(slugCell).trim();

    if (!plan.id) { plans.push({ ...plan, errors: ["no id — an import never creates a vacancy row"], valid: false }); return; }
    const existing = current.get(plan.id);
    if (!existing) { plans.push({ ...plan, errors: [`id ${plan.id.slice(0, 8)}… is not a vacancy row — nothing is created by an import`], valid: false }); return; }
    if (plan.slug && existing.slug && plan.slug !== existing.slug) {
      plan.warnings.push(`slug in the sheet is "${plan.slug}" but the row with this id is "${existing.slug}" — the id wins`);
    }

    for (const header of Object.keys(rec)) {
      const col = columnKey(header);
      if (!col) continue;                      // any extra column is ignored, deliberately
      const raw = rec[header];
      if (isEmptyCell(raw)) {
        plan.skipped.push({ column: col, reason: "cell empty — the current value stays" });
        continue;
      }
      const hasValue = col === "vacancy_count"
        ? existing.vacancy_count !== null && existing.vacancy_count !== undefined
        : !isEmptyCell((existing as unknown as Record<string, unknown>)[col]);
      if (hasValue && !overwrite) {
        plan.skipped.push({ column: col, reason: "already set — tick \"overwrite\" to replace it" });
        continue;
      }

      if ((DATE_COLUMNS as readonly string[]).includes(col)) {
        const r = normaliseDateCell(raw);
        if (r.error) { plan.errors.push(r.error); continue; }
        if (r.iso === null) continue;
        if (r.note) plan.warnings.push(`${col}: ${r.note}`);
        plan.writes[col] = r.iso;
      } else if ((URL_COLUMNS as readonly string[]).includes(col)) {
        const r = classifyUrlCell(raw);
        if (r.error) { plan.errors.push(r.error); continue; }
        if (r.url === null) continue;
        if (r.warning) plan.warnings.push(`${col}: ${r.warning}`);
        plan.writes[col] = r.url;
      } else if (col === "vacancy_count") {
        const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[,\s]/g, ""));
        if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) { plan.errors.push(`"${raw}" is not a whole number of vacancies`); continue; }
        plan.writes.vacancy_count = n;
      }
    }

    // Cross-field ordering, evaluated on the values that WOULD be written (sheet values win,
    // the stored row fills the rest) so a partial sheet still cannot write a nonsense window.
    const resolved = (col: VacancyImportColumn, from: VacancyCurrent): string | null =>
      plan.writes[col] !== undefined ? String(plan.writes[col]) : ((from as unknown as Record<string, unknown>)[col] as string | null) ?? null;
    const start = resolved("application_start_date", existing);
    const end = resolved("application_end_date", existing);
    const notif = resolved("notification_date", existing);
    if (start && end && start > end) plan.errors.push(`application_end_date ${end} is before application_start_date ${start}`);
    if (notif && end && notif > end) plan.warnings.push(`notification date ${notif} is after the last date ${end} — check the notice`);
    if (end && end < todayISO) plan.warnings.push(`last date ${end} is already past — this row will still not produce a JobPosting (the window must be open on the day a reader arrives)`);

    // The verification trigger's behaviour, said out loud rather than discovered later.
    const gatedMoved = (["notification_date", "application_start_date", "application_end_date", "official_notification_url"] as const)
      .some((c) => plan.writes[c] !== undefined && String(plan.writes[c]) !== String((existing as unknown as Record<string, unknown>)[c] ?? ""));
    if (existing.verified_at && gatedMoved) {
      plan.warnings.push(`this row is verified (verified_at ${existing.verified_at.slice(0, 10)}); the database voids that verification when a gated date or the notice link moves — re-verify after this import`);
    }

    plan.valid = plan.errors.length === 0;
    plans.push(plan);
  });

  return {
    plans,
    counts: {
      rows: plans.length,
      writable: plans.filter((p) => p.valid && Object.keys(p.writes).length > 0).length,
      blocked: plans.filter((p) => !p.valid).length,
      noChange: plans.filter((p) => p.valid && Object.keys(p.writes).length === 0).length,
    },
  };
}

/**
 * Write the plan. One UPDATE per row, only whitelisted columns, matched by id.
 * Rows with errors are refused here too — the caller does not have to remember to filter.
 */
export async function applyVacancyPlans(
  plans: VacancyRowPlan[],
): Promise<{ updated: number; refused: number; untouched: number; failures: { row: number; id: string | null; message: string }[] }> {
  const failures: { row: number; id: string | null; message: string }[] = [];
  let updated = 0, refused = 0, untouched = 0;

  for (const plan of plans) {
    if (!plan.valid) { refused++; continue; }
    if (Object.keys(plan.writes).length === 0 || !plan.id) { untouched++; continue; }
    const { error } = await db.from("sarkari_naukri").update(plan.writes).eq("id", plan.id);
    if (error) { failures.push({ row: plan.rowNumber, id: plan.id, message: error.message }); continue; }
    updated++;
  }
  return { updated, refused, untouched, failures };
}

// ── export ──────────────────────────────────────────────────────────────────────────

const EXPORT_HEADERS = [
  "id", "slug", "title", "organization", "state", "recruitment_type", "workflow_status", "verified_at",
  ...VACANCY_IMPORT_COLUMNS,
] as const;

/** Highest-value rows first (the twenty slugs that carry 84% of the impressions), then A-Z. */
export function sortTopFirst<T extends { slug: string | null }>(rows: T[]): T[] {
  const rank = new Map(TOP_VACANCY_SLUGS.map((s, i) => [s, i]));
  return [...rows].sort((a, b) => {
    const ra = a.slug && rank.has(a.slug) ? rank.get(a.slug)! : Number.POSITIVE_INFINITY;
    const rb = b.slug && rank.has(b.slug) ? rank.get(b.slug)! : Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return String(a.slug ?? "").localeCompare(String(b.slug ?? ""));
  });
}

export function buildVacancyExportWorkbook(rows: VacancyCurrent[]): XLSX.WorkBook {
  const ordered = sortTopFirst(rows);
  const sheet = ordered.map((r) => {
    const out: Record<string, unknown> = {};
    for (const h of EXPORT_HEADERS) out[h] = (r as unknown as Record<string, unknown>)[h] ?? "";
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(sheet, { header: [...EXPORT_HEADERS] });
  ws["!cols"] = EXPORT_HEADERS.map((h) => ({
    wch: h === "id" ? 38 : h === "slug" ? 46 : h === "title" ? 52 : h === "organization" ? 30 : h === "verified_at" ? 24 : 22,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "vacancies");
  return wb;
}

/**
 * Fetch every vacancy row and download the fill sheet. Returns the row count that went
 * into the file so the UI can say "361 rows exported, top 20 first" instead of guessing.
 */
export async function exportVacanciesForFill(): Promise<{ count: number; filename: string }> {
  const { data, error } = await db
    .from("sarkari_naukri")
    .select("id, slug, title, organization, state, recruitment_type, workflow_status, verified_at, notification_date, application_start_date, application_end_date, official_notification_url, application_url, vacancy_count, exam_date")
    .order("slug");
  if (error) throw new Error(`Failed to fetch vacancies: ${error.message}`);
  const rows = (data ?? []) as unknown as VacancyCurrent[];
  const filename = `sarkari-naukri-fill-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(buildVacancyExportWorkbook(rows), filename);
  return { count: rows.length, filename };
}

/**
 * Read a sheet through the shared gate (type, size and row caps) and return its
 * header-mapped records. readSpreadsheetUpload already maps the first non-empty sheet,
 * so nothing here touches SheetJS's parser directly — the gate stays the only door.
 */
export async function readVacancySheet(
  file: File,
  limits: { maxBytes?: number; maxRows?: number } = {},
): Promise<{ upload: ParsedUpload; records: Record<string, unknown>[] }> {
  const upload = await readSpreadsheetUpload(file, limits);
  // A trailing blank line in Excel arrives as an all-empty record; it is not a row.
  const records = (upload.rows ?? []).filter((r) => Object.values(r).some((v) => !isEmptyCell(v)));
  return { upload, records };
}

/** The live rows, keyed by id — the whitelist match target. */
export async function fetchVacancyCurrentByIds(): Promise<Map<string, VacancyCurrent>> {
  const { data, error } = await db
    .from("sarkari_naukri")
    .select("id, slug, title, organization, state, recruitment_type, workflow_status, verified_at, notification_date, application_start_date, application_end_date, official_notification_url, application_url, vacancy_count, exam_date");
  if (error) throw new Error(`Failed to fetch vacancies: ${error.message}`);
  const map = new Map<string, VacancyCurrent>();
  for (const r of (data ?? []) as unknown as VacancyCurrent[]) map.set(r.id, r);
  return map;
}
