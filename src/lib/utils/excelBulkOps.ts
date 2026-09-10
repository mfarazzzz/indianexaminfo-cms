/**
 * excelBulkOps.ts — Bulk import/export operations for all exam pillars.
 *
 * Export: Fetches all exams for a pillar → generates Excel with one row per exam.
 * Import: Parses uploaded Excel → creates/updates exams via batch operations.
 *
 * Works across all pillars: entrance-exam, sarkari-naukri, board-university.
 */
import * as XLSX from "xlsx";
import { db } from "@/lib/supabase/client";
import { validateAndFixDate } from "@/lib/utils/indianDateParser";
import { normalizeUrl } from "@/lib/utils";
import { normalizeLabel } from "@/lib/dates/normalizeLabel";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExportRow {
  name: string;
  shortName: string;
  slug: string;
  pillar: string;
  category: string;
  conductingBody: string;
  officialWebsite: string;
  status: string;
  editionYear: number | null;
  editionLabel: string;
  session: string;
  vacancy: number | null;
  notificationDate: string;
  registrationOpens: string;
  registrationCloses: string;
  examDate: string;
  admitCardRelease: string;
  answerKeyRelease: string;
  resultDeclaration: string;
  isFeatured: boolean;
  isPublished: boolean;
  seoTitle: string;
  seoDescription: string;
  tags: string;
}

export interface ImportRow {
  name: string;
  shortName?: string;
  slug?: string;
  category?: string;
  conductingBody?: string;
  officialWebsite?: string;
  status?: string;
  editionYear?: number;
  editionLabel?: string;
  session?: string;
  vacancy?: number;
  notificationDate?: string;
  registrationOpens?: string;
  registrationCloses?: string;
  examDate?: string;
  admitCardRelease?: string;
  answerKeyRelease?: string;
  resultDeclaration?: string;
  isFeatured?: boolean;
  isPublished?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; name: string; error: string }[];
}

// ── Export ─────────────────────────────────────────────────────────────────────

/**
 * Export all exams for a given pillar to an Excel file (auto-downloads).
 */
export async function exportExamsToExcel(pillar: string, pillarLabel: string): Promise<void> {
  // Fetch exams with their current editions
  const { data, error } = await db
    .from("exams")
    .select(`
      id, slug, name, short_name, pillar, conducting_body, official_website,
      is_featured, is_published, seo_title, seo_description, tags, status,
      cat:categories!category_id(slug, name),
      current_edition:exam_editions!current_edition_id(
        id, year, edition_label, session, status, vacancy,
        notification_date, important_dates
      )
    `)
    .eq("pillar", pillar)
    .order("name");

  if (error) throw new Error(`Failed to fetch exams: ${error.message}`);

  const rows: ExportRow[] = (data ?? []).map((row: any) => {
    const ed = row.current_edition;
    const dates: { label: string; date: string }[] = ed?.important_dates ?? [];

    const findDate = (keywords: string[]) => {
      const match = dates.find((d) =>
        keywords.some((kw) => d.label.toLowerCase().includes(kw))
      );
      return match?.date ?? "";
    };

    return {
      name: row.name ?? "",
      shortName: row.short_name ?? "",
      slug: row.slug ?? "",
      pillar: row.pillar ?? pillar,
      category: row.cat?.name ?? row.cat?.slug ?? "",
      conductingBody: row.conducting_body ?? "",
      officialWebsite: row.official_website ?? "",
      status: ed?.status ?? row.status ?? "upcoming",
      editionYear: ed?.year ?? null,
      editionLabel: ed?.edition_label ?? "",
      session: ed?.session ?? "main",
      vacancy: ed?.vacancy ?? null,
      notificationDate: ed?.notification_date ?? findDate(["notification"]),
      registrationOpens: findDate(["registration opens", "application start", "start of submission"]),
      registrationCloses: findDate(["registration closes", "application end", "last date"]),
      examDate: findDate(["exam date", "test date"]),
      admitCardRelease: findDate(["admit card"]),
      answerKeyRelease: findDate(["answer key"]),
      resultDeclaration: findDate(["result"]),
      isFeatured: row.is_featured ?? false,
      isPublished: row.is_published ?? false,
      seoTitle: row.seo_title ?? "",
      seoDescription: row.seo_description ?? "",
      tags: (row.tags ?? []).join(", "),
    };
  });

  // Create workbook
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 40 }, // name
    { wch: 12 }, // shortName
    { wch: 30 }, // slug
    { wch: 15 }, // pillar
    { wch: 20 }, // category
    { wch: 30 }, // conductingBody
    { wch: 30 }, // officialWebsite
    { wch: 18 }, // status
    { wch: 8 },  // editionYear
    { wch: 15 }, // editionLabel
    { wch: 10 }, // session
    { wch: 8 },  // vacancy
    { wch: 12 }, // notificationDate
    { wch: 12 }, // registrationOpens
    { wch: 12 }, // registrationCloses
    { wch: 12 }, // examDate
    { wch: 12 }, // admitCardRelease
    { wch: 12 }, // answerKeyRelease
    { wch: 12 }, // resultDeclaration
    { wch: 8 },  // isFeatured
    { wch: 8 },  // isPublished
    { wch: 50 }, // seoTitle
    { wch: 80 }, // seoDescription
    { wch: 60 }, // tags
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, pillarLabel);

  // Download
  const filename = `${pillar}-exams-export-${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Generate a blank template Excel for import.
 */
export function downloadImportTemplate(pillar: string, pillarLabel: string): void {
  const templateRow: ImportRow = {
    name: "Example Exam Name 2026",
    shortName: "EEN",
    slug: "",
    category: "",
    conductingBody: "Example Board",
    officialWebsite: "https://example.gov.in",
    status: "upcoming",
    editionYear: new Date().getFullYear(),
    editionLabel: String(new Date().getFullYear()),
    session: "main",
    vacancy: 0,
    notificationDate: "2026-01-15",
    registrationOpens: "2026-02-01",
    registrationCloses: "2026-03-15",
    examDate: "2026-06-15",
    admitCardRelease: "2026-06-01",
    answerKeyRelease: "",
    resultDeclaration: "",
    isFeatured: false,
    isPublished: true,
    seoTitle: "Example Exam 2026 - Dates, Eligibility & Apply",
    seoDescription: "Check Example Exam 2026 notification, dates, eligibility...",
    tags: "example, exam, 2026",
  };

  const ws = XLSX.utils.json_to_sheet([templateRow]);
  ws["!cols"] = [
    { wch: 40 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 30 },
    { wch: 30 }, { wch: 18 }, { wch: 8 }, { wch: 15 }, { wch: 10 },
    { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
    { wch: 50 }, { wch: 80 }, { wch: 60 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");

  XLSX.writeFile(wb, `${pillar}-import-template.xlsx`);
}

// ── Import ────────────────────────────────────────────────────────────────────

/**
 * Parse an uploaded Excel file and import exams.
 * Creates new exams or updates existing ones (matched by slug or name).
 */
export async function importExamsFromExcel(
  file: File,
  pillar: string
): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Empty spreadsheet — no sheet found.");

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
  if (rows.length === 0) throw new Error("No data rows found in the spreadsheet.");

  const result: ImportResult = { created: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 2; // Excel row number (1-indexed + header)

    try {
      const name = String(raw.name || raw.Name || "").trim();
      if (!name) {
        result.errors.push({ row: rowNum, name: "(empty)", error: "Name is required" });
        continue;
      }

      const shortName = String(raw.shortName || raw["Short Name"] || raw.short_name || "").trim();
      const slug = String(raw.slug || raw.Slug || "").trim() || generateSlug(shortName || name);
      const conductingBody = String(raw.conductingBody || raw["Conducting Body"] || raw.conducting_body || "").trim();
      const officialWebsite = String(raw.officialWebsite || raw["Official Website"] || raw.official_website || "").trim();
      const status = String(raw.status || raw.Status || "upcoming").trim();
      const editionYear = parseInt(raw.editionYear || raw["Edition Year"] || raw.edition_year || new Date().getFullYear());
      const editionLabel = String(raw.editionLabel || raw["Edition Label"] || raw.edition_label || editionYear).trim();
      const session = String(raw.session || raw.Session || "main").trim();
      const vacancy = parseInt(raw.vacancy || raw.Vacancy || "0") || null;
      // Absent cell = PRESERVE existing value (undefined), never default to
      // false/true — defaulting silently unfeatured or published records on
      // re-import. Only a present, explicit value changes the flag.
      const rawFeatured = raw.isFeatured ?? raw["Is Featured"] ?? raw.is_featured;
      const isFeatured = rawFeatured === undefined || rawFeatured === "" ? undefined : parseBool(rawFeatured);
      const rawPublished = raw.isPublished ?? raw["Is Published"] ?? raw.is_published;
      const isPublished = rawPublished === undefined || rawPublished === "" ? undefined : parseBool(rawPublished);
      const seoTitle = String(raw.seoTitle || raw["SEO Title"] || raw.seo_title || "").trim();
      const seoDescription = String(raw.seoDescription || raw["SEO Description"] || raw.seo_description || "").trim();
      const tagsStr = String(raw.tags || raw.Tags || "").trim();
      const tags = tagsStr ? tagsStr.split(",").map((t: string) => t.trim()).filter(Boolean) : [];

      // Parse dates with Indian format awareness
      const notificationDate = validateAndFixDate(String(raw.notificationDate || raw["Notification Date"] || raw.notification_date || ""));
      const registrationOpens = validateAndFixDate(String(raw.registrationOpens || raw["Registration Opens"] || raw.registration_opens || ""));
      const registrationCloses = validateAndFixDate(String(raw.registrationCloses || raw["Registration Closes"] || raw.registration_closes || ""));
      const examDate = validateAndFixDate(String(raw.examDate || raw["Exam Date"] || raw.exam_date || ""));
      const admitCardRelease = validateAndFixDate(String(raw.admitCardRelease || raw["Admit Card Release"] || raw.admit_card_release || ""));
      const answerKeyRelease = validateAndFixDate(String(raw.answerKeyRelease || raw["Answer Key Release"] || raw.answer_key_release || ""));
      const resultDeclaration = validateAndFixDate(String(raw.resultDeclaration || raw["Result Declaration"] || raw.result_declaration || ""));

      // Build important_dates array
      const importantDates = [
        { label: "Notification Release", date: notificationDate, isUrgent: false },
        { label: "Registration Opens", date: registrationOpens, isUrgent: true },
        { label: "Registration Closes", date: registrationCloses, isUrgent: true },
        { label: "Admit Card Release", date: admitCardRelease, isUrgent: false },
        { label: "Exam Date", date: examDate, isUrgent: true },
        { label: "Answer Key Release", date: answerKeyRelease, isUrgent: false },
        { label: "Result Declaration", date: resultDeclaration, isUrgent: false },
      ].filter((d) => d.date !== "");

      // Check if exam exists by slug
      const { data: existing } = await db
        .from("exams")
        .select("id, current_edition_id")
        .eq("slug", slug)
        .eq("pillar", pillar)
        .maybeSingle();

      if (existing) {
        // Update existing exam — identity fields only. status/cycle data go to the
        // edition below (exams.status was dropped in step 4).
        // is_featured/is_published are only written when the cell was explicitly
        // present — an absent flag preserves the existing value (no silent flip).
        await db.from("exams").update({
          name,
          short_name: shortName,
          conducting_body: conductingBody,
          official_website: officialWebsite,
          ...(isFeatured !== undefined ? { is_featured: isFeatured } : {}),
          ...(isPublished !== undefined ? { is_published: isPublished } : {}),
          seo_title: seoTitle || null,
          seo_description: seoDescription || null,
          tags,
        }).eq("id", existing.id);

        // Update current edition if exists
        if (existing.current_edition_id) {
          await db.from("exam_editions").update({
            status,
            vacancy,
            notification_date: notificationDate || null,
            important_dates: importantDates,
            edition_label: editionLabel,
            session,
          }).eq("id", existing.current_edition_id);
        }

        result.updated++;
      } else {
        // Create new exam
        const { data: newExam, error: createErr } = await db.from("exams").insert({
          slug,
          name,
          short_name: shortName,
          pillar,
          conducting_body: conductingBody,
          official_website: officialWebsite,
          entity_type: (
            (pillar === "sarkari-naukri" || pillar === "govt-vacancy" || pillar === "government-exam")
              ? "recruitment"
              : pillar === "board-exam" || pillar === "board-university"
              ? "board"
              : pillar === "university-exam"
              ? "university"
              : "exam"
          ),
          // status DROPPED from exams (step 4) — written to the edition insert below.
          // New record: absent flag → sensible default (not featured; published).
          is_featured: isFeatured ?? false,
          is_published: isPublished ?? true,
          seo_title: seoTitle || null,
          seo_description: seoDescription || null,
          tags,
        }).select("id").single();

        if (createErr) {
          result.errors.push({ row: rowNum, name, error: createErr.message });
          continue;
        }

        // Create first edition
        const { error: edErr } = await db.from("exam_editions").insert({
          exam_id: newExam.id,
          year: editionYear,
          session,
          edition_label: editionLabel,
          is_current: true,
          status,
          vacancy,
          notification_date: notificationDate || null,
          important_dates: importantDates,
        });

        if (edErr) {
          result.errors.push({ row: rowNum, name, error: `Exam created but edition failed: ${edErr.message}` });
        }

        result.created++;
      }
    } catch (err: any) {
      result.errors.push({ row: rowNum, name: String(raw.name || "(unknown)"), error: err.message || "Unknown error" });
    }
  }

  return result;
}

// ── Preview / Dry-run ───────────────────────────────────────────────────────
//
// Read-only. Parses the same file with the same logic importExamsFromExcel uses,
// matches each row against the DB, and reports EXACTLY what a real import would do —
// plus the guard gaps that the raw-write import path silently incurs (dates losing
// type/state, URLs not normalized, fields being cleared, new editions archiving the
// current cycle). Writes NOTHING. This is the safety net that makes an accidental
// import impossible and the missing guards visible BEFORE any write.

export type RowAction =
  | "create-exam"        // no existing match → new exam + first edition
  | "update-edition"     // match, year same/absent → update current edition in place
  | "new-edition"        // match, year differs → would ARCHIVE current + create new cycle
  | "skip";              // no name, or match with no current edition to update

/** A date row whose state would change on import (change 3: infer + report). */
export interface DateStateChange {
  label: string;
  type: string;                        // inferred from label via normalizeLabel (AI-Fill source)
  fromState: string | null;           // existing edition's state for this type, if any
  toState: string;                    // 'confirmed' unless a state column / label signals otherwise
}

/** Summary of what an existing edition contains — used for the "leaves the live page" line. */
export interface EditionContentSummary {
  year: number | null;
  dateCount: number;
  expectedStateCount: number;  // dates carrying a non-confirmed state (expected/cancelled/postponed)
  vacancy: number | null;
  hasEligibility: boolean;
  hasFee: boolean;
}

export interface PreviewRow {
  row: number;
  name: string;
  slug: string;
  action: RowAction;
  reason?: string;
  existingEditionYear?: number | null;
  rowYear?: number | null;
  fieldsCleared: string[];             // existing values this row would blank (destructive)
  // Point 1: important_dates wipe gets its OWN signal, not buried in fieldsCleared.
  importantDatesWipe?: { existingCount: number; statefulCount: number }; // row has NO dates → all deleted
  dateStateChanges: DateStateChange[]; // date rows whose state changes (destructive/visible)
  droppedDateTypes: string[];          // existing edition date types NOT in the 7 columns → dropped
  // Point 2: for new-edition rows, what the archived (current) edition holds.
  archivedContent?: EditionContentSummary;
  guardGaps: string[];
  destructive: boolean;                // this row does something requiring CONFIRM
}

export interface ImportPreview {
  totalRows: number;
  // Change 1: new editions are their OWN top block, with names + archived-content summary.
  newEditions: {
    row: number; name: string; slug: string;
    fromYear: number | null; toYear: number | null;
    archivedContent: EditionContentSummary;
  }[];
  createExam: number;
  updateEdition: number;
  skip: number;
  requiresConfirm: boolean;
  destructiveRowCount: number;
  rows: PreviewRow[];
  guardSummary: {
    datesLosingTypeState: number;
    urlsNotNormalized: number;
    editionsArchived: number;
    rowsClearingFields: number;
    rowsChangingDateState: number;
    editionsWithAllDatesDeleted: number;  // point 1: rows that wipe important_dates entirely
  };
}

/** The 7 fixed date columns import writes, with the label each maps to. */
const IMPORT_DATE_COLUMNS: { keys: string[]; label: string }[] = [
  { keys: ["notificationDate", "Notification Date", "notification_date"], label: "Notification Release" },
  { keys: ["registrationOpens", "Registration Opens", "registration_opens"], label: "Registration Opens" },
  { keys: ["registrationCloses", "Registration Closes", "registration_closes"], label: "Registration Closes" },
  { keys: ["admitCardRelease", "Admit Card Release", "admit_card_release"], label: "Admit Card Release" },
  { keys: ["examDate", "Exam Date", "exam_date"], label: "Exam Date" },
  { keys: ["answerKeyRelease", "Answer Key Release", "answer_key_release"], label: "Answer Key Release" },
  { keys: ["resultDeclaration", "Result Declaration", "result_declaration"], label: "Result Declaration" },
];

function cellFor(raw: Record<string, any>, keys: string[]): any {
  for (const k of keys) if (raw[k] !== undefined) return raw[k];
  return undefined;
}

export async function previewImportFromExcel(
  file: File,
  pillar: string
): Promise<ImportPreview> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Empty spreadsheet — no sheet found.");
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
  if (rows.length === 0) throw new Error("No data rows found in the spreadsheet.");

  const preview: ImportPreview = {
    totalRows: rows.length,
    newEditions: [],
    createExam: 0, updateEdition: 0, skip: 0,
    requiresConfirm: false, destructiveRowCount: 0,
    rows: [],
    guardSummary: {
      datesLosingTypeState: 0, urlsNotNormalized: 0, editionsArchived: 0,
      rowsClearingFields: 0, rowsChangingDateState: 0, editionsWithAllDatesDeleted: 0,
    },
  };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 2;
    const name = String(raw.name || raw.Name || "").trim();
    const shortName = String(raw.shortName || raw["Short Name"] || raw.short_name || "").trim();
    const slug = String(raw.slug || raw.Slug || "").trim() || generateSlug(shortName || name);
    const officialWebsite = String(raw.officialWebsite || raw["Official Website"] || raw.official_website || "").trim();
    const rowYearRaw = raw.editionYear ?? raw["Edition Year"] ?? raw.edition_year;
    const rowYear = rowYearRaw === undefined || rowYearRaw === "" ? null : parseInt(String(rowYearRaw));
    // Optional explicit state column (change 3: spreadsheet state overrides inference).
    const stateColumn = String(raw.state ?? raw.State ?? raw.dateState ?? "").trim().toLowerCase() || null;

    const pr: PreviewRow = {
      row: rowNum, name: name || "(empty)", slug, action: "skip",
      fieldsCleared: [], dateStateChanges: [], droppedDateTypes: [], guardGaps: [],
      destructive: false, rowYear: rowYear ?? null,
    };

    if (!name) {
      pr.reason = "Name is required — row skipped";
      preview.skip++; preview.rows.push(pr); continue;
    }

    // Build the (label, type, toState) set this row would write, via the SAME
    // normalizeLabel AI Fill uses (change 3: infer type, don't preserve).
    const rowDates: { label: string; type: string; toState: string }[] = [];
    for (const col of IMPORT_DATE_COLUMNS) {
      const cell = cellFor(raw, col.keys);
      if (cell === undefined || String(cell).trim() === "") continue;
      const norm = normalizeLabel(col.label);
      const toState = stateColumn ?? (norm?.state ?? "confirmed");
      rowDates.push({ label: col.label, type: norm?.type ?? "other", toState });
    }
    const rowHasDates = rowDates.length > 0;

    // Guard gap: URL not normalized by the raw import path.
    if (officialWebsite && normalizeUrl(officialWebsite) !== officialWebsite) {
      pr.guardGaps.push(`officialWebsite written un-normalized ("${officialWebsite}" → "${normalizeUrl(officialWebsite)}")`);
      preview.guardSummary.urlsNotNormalized++;
    }

    // Match existing exam.
    const { data: existing } = await db
      .from("exams")
      .select("id, current_edition_id, short_name, conducting_body, official_website, seo_title, seo_description, tags")
      .eq("slug", slug).eq("pillar", pillar).maybeSingle();

    if (!existing) {
      pr.action = "create-exam";
      preview.createExam++; preview.rows.push(pr); continue;
    }

    // Fetch current edition + its existing cycle content (for wipe + archive summaries).
    let existingYear: number | null = null;
    let existingDates: any[] = [];
    let editionSummary: EditionContentSummary | null = null;
    if (existing.current_edition_id) {
      const { data: ed } = await db
        .from("exam_editions")
        .select("year, important_dates, vacancy, eligibility, application_fee")
        .eq("id", existing.current_edition_id).maybeSingle();
      existingYear = (ed?.year as number) ?? null;
      existingDates = Array.isArray(ed?.important_dates) ? (ed!.important_dates as any[]) : [];
      const elig = ed?.eligibility as Record<string, unknown> | null | undefined;
      const fee = ed?.application_fee as Record<string, unknown> | null | undefined;
      editionSummary = {
        year: existingYear,
        dateCount: existingDates.length,
        expectedStateCount: existingDates.filter(
          (d) => d?.state && d.state !== "confirmed"
        ).length,
        vacancy: (ed?.vacancy as number) ?? null,
        hasEligibility: !!elig && Object.values(elig).some((v) => v !== null && String(v).trim() !== ""),
        hasFee: !!fee && Object.values(fee).some((v) => typeof v === "number" && v > 0),
      };
    }
    pr.existingEditionYear = existingYear;

    // Change 3: report which date rows change STATE (by matching type), and which
    // existing date types would be DROPPED (types outside the 7 import columns).
    if (rowHasDates && existing.current_edition_id) {
      const existingByType = new Map<string, any>();
      for (const d of existingDates) {
        const t = (d?.type as string) || "";
        if (t) existingByType.set(t, d);
      }
      for (const rd of rowDates) {
        const ex = existingByType.get(rd.type);
        const fromState = ex ? ((ex.state as string) ?? "confirmed") : null;
        if (fromState !== rd.toState) {
          pr.dateStateChanges.push({ label: rd.label, type: rd.type, fromState, toState: rd.toState });
        }
      }
      const importTypes = new Set(rowDates.map((d) => d.type));
      for (const [t] of existingByType) {
        if (!importTypes.has(t)) pr.droppedDateTypes.push(t);
      }
      pr.guardGaps.push(`${rowDates.length} date(s) written with inferred type + state=${stateColumn ?? "confirmed"}, verified=false`);
      preview.guardSummary.datesLosingTypeState++;
    }

    // Point 1: the catastrophic wipe — row has NO date cells but the current edition
    // HAS dates. Import writes important_dates = [], deleting all of them. Its OWN line.
    if (!rowHasDates && existing.current_edition_id && existingDates.length > 0) {
      pr.importantDatesWipe = {
        existingCount: existingDates.length,
        statefulCount: existingDates.filter((d) => d?.state && d.state !== "confirmed").length,
      };
      preview.guardSummary.editionsWithAllDatesDeleted++;
    }

    // Field-clear detection: a blank cell overwrites an existing value with blank.
    const existingRow = existing as Record<string, any>;
    const clearChecks: { field: string; cell: any }[] = [
      { field: "short_name",       cell: raw.shortName ?? raw["Short Name"] ?? raw.short_name },
      { field: "conducting_body",  cell: raw.conductingBody ?? raw["Conducting Body"] ?? raw.conducting_body },
      { field: "official_website", cell: raw.officialWebsite ?? raw["Official Website"] ?? raw.official_website },
      { field: "seo_title",        cell: raw.seoTitle ?? raw["SEO Title"] ?? raw.seo_title },
      { field: "seo_description",  cell: raw.seoDescription ?? raw["SEO Description"] ?? raw.seo_description },
      { field: "tags",             cell: raw.tags ?? raw.Tags },
    ];
    for (const { field, cell } of clearChecks) {
      const cellBlank = cell === undefined || String(cell).trim() === "";
      const dbVal = existingRow[field];
      const existingHas = dbVal !== undefined && dbVal !== null
        && !(Array.isArray(dbVal) ? dbVal.length === 0 : String(dbVal).trim() === "");
      if (cellBlank && existingHas) pr.fieldsCleared.push(field);
    }

    if (!existing.current_edition_id) {
      pr.action = "skip";
      pr.reason = "Existing exam has no current edition to update — skipped (needs New Edition)";
      preview.skip++;
    } else if (rowYear !== null && existingYear !== null && rowYear !== existingYear) {
      // Change 1: new edition = its own block, with an archived-content summary (point 2).
      pr.action = "new-edition";
      const summary: EditionContentSummary = editionSummary ?? {
        year: existingYear, dateCount: 0, expectedStateCount: 0, vacancy: null, hasEligibility: false, hasFee: false,
      };
      pr.archivedContent = summary;
      pr.reason = `Year ${rowYear} != current edition ${existingYear} — ARCHIVES the current cycle (its content leaves the live page) and creates a new one`;
      preview.newEditions.push({ row: rowNum, name, slug, fromYear: existingYear, toYear: rowYear, archivedContent: summary });
      preview.guardSummary.editionsArchived++;
    } else {
      pr.action = "update-edition";
      preview.updateEdition++;
    }

    // Change 2: destructive = new-edition OR field-clear OR date-state change OR dropped
    // types OR the all-dates wipe (point 1).
    pr.destructive =
      pr.action === "new-edition" ||
      pr.fieldsCleared.length > 0 ||
      pr.dateStateChanges.length > 0 ||
      pr.droppedDateTypes.length > 0 ||
      !!pr.importantDatesWipe;

    if (pr.fieldsCleared.length > 0) preview.guardSummary.rowsClearingFields++;
    if (pr.dateStateChanges.length > 0) preview.guardSummary.rowsChangingDateState++;

    preview.rows.push(pr);
  }

  preview.destructiveRowCount = preview.rows.filter((r) => r.destructive).length;
  // Any destructive row at all → CONFIRM required (no count threshold).
  preview.requiresConfirm = preview.destructiveRowCount > 0 || preview.newEditions.length > 0;
  return preview;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function parseBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  const s = String(val ?? "").toLowerCase().trim();
  return s === "true" || s === "yes" || s === "1";
}
