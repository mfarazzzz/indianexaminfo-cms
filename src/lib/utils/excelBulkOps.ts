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
      const isFeatured = parseBool(raw.isFeatured || raw["Is Featured"] || raw.is_featured);
      const isPublished = parseBool(raw.isPublished || raw["Is Published"] || (raw.is_published ?? true));
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
        // Update existing exam
        await db.from("exams").update({
          name,
          short_name: shortName,
          conducting_body: conductingBody,
          official_website: officialWebsite,
          is_featured: isFeatured,
          is_published: isPublished,
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
          status,
          is_featured: isFeatured,
          is_published: isPublished,
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
