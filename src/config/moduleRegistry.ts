/**
 * moduleRegistry.ts — The single source of truth for all content modules.
 *
 * ARCHITECTURE:
 * - Each module is a first-class citizen with its own config, fields, validation, and lifecycle
 * - Modules are context-aware: fields adapt based on the parent entity type
 * - Entity types declare required vs optional modules
 * - The UI renders entirely from this registry — zero hardcoded module logic in components
 * - Adding a new module = add config here. No component changes needed.
 *
 * DESIGN PRINCIPLES:
 * - Progressive disclosure: essential fields first, advanced collapsed
 * - Repeatable collections modeled properly (not comma-separated hacks)
 * - Each module can have independent publish status and save state
 * - Context-aware fields: same module shows different fields per entity type
 */

import type { ContentType } from "@/types/exam";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SELECTION MODEL — Axis 2 (how a candidate is selected)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// THE canonical SelectionModel type. Mirrors the Postgres enum `selection_model`
// exactly. Import this everywhere — do NOT redefine as a separate string union.
// Entity type (Axis 1) says WHAT the entity is; selection model (Axis 2) says
// how a candidate progresses, which determines the lifecycle and therefore
// which modules are structurally applicable.

export type SelectionModel =
  | "written-exam"
  | "merit-based"
  | "interview-based"
  | "internal-admission";

export const ALL_SELECTION_MODELS: SelectionModel[] = [
  "written-exam",
  "merit-based",
  "interview-based",
  "internal-admission",
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIELD TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "url"
  | "date"
  | "number"
  | "boolean"
  | "select"
  | "multi-select"
  | "file-upload"
  | "repeatable"
  | "fee-table"
  | "cutoff-table"
  | "schedule-table";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
  /** For 'repeatable' type: defines the columns in each row */
  columns?: { key: string; label: string; type: "text" | "url" | "date" | "number"; placeholder?: string }[];
  /** Field group: 'essential' shows immediately, 'advanced' is collapsed */
  priority: "essential" | "advanced";
  /** Only show this field when entityType matches (empty = show for all) */
  contextFilter?: string[];
  /** Validation rule */
  validation?: { min?: number; max?: number; pattern?: string; message?: string };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODULE DEFINITION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ModuleDefinition {
  /** Unique identifier — matches content_type in DB */
  id: string;
  /** Display label */
  label: string;
  /** Icon emoji */
  icon: string;
  /** Short description for editors */
  description: string;
  /** Axis 1 — which entity types this module applies to */
  applicableTo: string[];  // ["recruitment", "exam", "board", "university"] or ["*"] for all
  /**
   * Axis 2 — which selection models this module applies to.
   * OMITTED = applies to ALL selection models (backward compatible).
   * Only set this on modules whose relevance genuinely depends on how the
   * candidate is selected (e.g. Admit Card exists only for written-exam).
   */
  appliesToSelection?: SelectionModel[];
  /** Module capabilities */
  capabilities: {
    supportsAttachments: boolean;
    supportsTimeline: boolean;
    supportsDownloads: boolean;
    supportsFAQs: boolean;
    supportsSEO: boolean;
    supportsAI: boolean;
    supportsVersionHistory: boolean;
    supportsPreview: boolean;
    isRepeatable: boolean;  // Can have multiple instances (e.g. multiple results)
  };
  /** Fields rendered in the module editor */
  fields: FieldDef[];
  /** Display order in the modules panel */
  displayOrder: number;
  /** Category for grouping in UI */
  category: "lifecycle" | "academic" | "resource" | "media" | "meta";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENTITY TYPE PROFILES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface EntityTypeProfile {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** Modules that MUST have content before publishing */
  requiredModules: string[];
  /** Modules shown by default (but not mandatory) */
  defaultModules: string[];
  /** Additional fields shown in the General tab for this type */
  generalFields: FieldDef[];
  /** Additional fields for the Dates tab */
  dateFields: FieldDef[];
  /** Additional fields for the Eligibility tab */
  eligibilityFields: FieldDef[];
  /** Publish checklist — conditions that must be met */
  publishChecklist: { label: string; check: string }[];
}

export const ENTITY_TYPE_PROFILES: Record<string, EntityTypeProfile> = {
  recruitment: {
    id: "recruitment",
    label: "Government Recruitment",
    description: "Sarkari Naukri — SSC, IBPS, Railway, Defence, State PSC",
    icon: "🏛️",
    requiredModules: ["notification", "application", "vacancy-details"],
    defaultModules: ["notification", "application", "vacancy-details", "eligibility-details", "admit-card", "result"],
    publishChecklist: [
      { label: "Notification PDF uploaded", check: "module:notification.notificationPdfUrl" },
      { label: "Apply link provided", check: "module:application.applyOnlineUrl" },
      { label: "Vacancy count filled", check: "field:vacancy" },
      { label: "SEO title set", check: "field:seoTitle" },
    ],
    generalFields: [
      { key: "department", label: "Department / Ministry", type: "text", placeholder: "e.g. Ministry of Finance", priority: "essential" },
      { key: "postName", label: "Post Name(s)", type: "text", placeholder: "e.g. Probationary Officer, Clerk", priority: "essential" },
      { key: "totalPosts", label: "Total Posts", type: "number", placeholder: "e.g. 4500", priority: "essential" },
      { key: "jobLocation", label: "Job Location", type: "text", placeholder: "e.g. All India / State-wise", priority: "essential" },
      { key: "payScale", label: "Pay Scale / Salary", type: "text", placeholder: "e.g. ₹23,700 – ₹42,020", priority: "advanced" },
      { key: "groupLevel", label: "Group / Level", type: "select", priority: "advanced",
        options: [{ value: "group-a", label: "Group A" }, { value: "group-b", label: "Group B" }, { value: "group-c", label: "Group C" }, { value: "group-d", label: "Group D" }] },
      { key: "probationPeriod", label: "Probation Period", type: "text", placeholder: "e.g. 2 years", priority: "advanced" },
    ],
    dateFields: [
      { key: "notificationDate", label: "Notification Date", type: "date", priority: "essential" },
      { key: "lastDateApply", label: "Last Date to Apply", type: "date", priority: "essential", required: true },
      { key: "feeLastDate", label: "Fee Payment Last Date", type: "date", priority: "essential" },
      { key: "correctionWindow", label: "Correction Window", type: "date", priority: "advanced" },
      { key: "examDate", label: "Exam Date (tentative)", type: "date", priority: "essential" },
    ],
    eligibilityFields: [
      { key: "reservationPolicy", label: "Reservation Policy", type: "textarea", placeholder: "OBC-NCL 27%, SC 15%, ST 7.5%, EWS 10%…", priority: "essential" },
      { key: "physicalStandard", label: "Physical Standards", type: "textarea", placeholder: "Height, chest, eyesight (if applicable)", priority: "advanced" },
      { key: "medicalFitness", label: "Medical Fitness", type: "textarea", placeholder: "Medical standards required", priority: "advanced" },
      { key: "experienceRequired", label: "Experience Required", type: "text", placeholder: "e.g. 2 years in relevant field", priority: "advanced" },
    ],
  },

  exam: {
    id: "exam",
    label: "Entrance Exam",
    description: "JEE, NEET, GATE, CAT, CLAT, CUET and competitive exams",
    icon: "📝",
    requiredModules: ["notification", "application"],
    defaultModules: ["notification", "application", "exam-pattern", "syllabus", "admit-card", "answer-key", "result"],
    publishChecklist: [
      { label: "Conducting body filled", check: "field:conductingBody" },
      { label: "Exam pattern defined", check: "module:exam-pattern" },
      { label: "SEO title set", check: "field:seoTitle" },
    ],
    generalFields: [
      { key: "examDuration", label: "Exam Duration", type: "text", placeholder: "e.g. 3 hours", priority: "essential" },
      { key: "totalMarks", label: "Total Marks", type: "number", placeholder: "e.g. 720", priority: "essential" },
      { key: "totalQuestions", label: "Total Questions", type: "number", placeholder: "e.g. 200", priority: "essential" },
      { key: "negativeMarking", label: "Negative Marking", type: "text", placeholder: "e.g. -1/3 per wrong answer", priority: "essential" },
      { key: "examMode", label: "Exam Mode", type: "select", priority: "essential",
        options: [{ value: "online", label: "Online (CBT)" }, { value: "offline", label: "Offline (Pen & Paper)" }, { value: "hybrid", label: "Hybrid" }] },
      { key: "examMedium", label: "Medium / Language", type: "text", placeholder: "e.g. English, Hindi, Bilingual", priority: "advanced" },
      { key: "numberOfAttempts", label: "Max Attempts", type: "text", placeholder: "e.g. No limit / 3 attempts", priority: "advanced" },
      { key: "examFrequency", label: "Exam Frequency", type: "select", priority: "advanced",
        options: [{ value: "annual", label: "Annual" }, { value: "biannual", label: "Biannual" }, { value: "monthly", label: "Monthly" }, { value: "irregular", label: "Irregular" }] },
    ],
    dateFields: [
      { key: "registrationOpen", label: "Registration Opens", type: "date", priority: "essential" },
      { key: "registrationClose", label: "Registration Closes", type: "date", priority: "essential", required: true },
      { key: "examWindowStart", label: "Exam Window Start", type: "date", priority: "essential" },
      { key: "examWindowEnd", label: "Exam Window End", type: "date", priority: "advanced" },
      { key: "resultExpected", label: "Result Expected", type: "date", priority: "advanced" },
    ],
    eligibilityFields: [
      { key: "acceptedBy", label: "Score Accepted By", type: "textarea", placeholder: "IITs, NITs, IIITs, GFTIs…", priority: "essential" },
      { key: "subjectRequirements", label: "Subject Requirements", type: "textarea", placeholder: "PCM with 75% in 12th…", priority: "advanced" },
      { key: "numberOfPapers", label: "Number of Papers", type: "text", placeholder: "e.g. Paper 1 + Paper 2", priority: "advanced" },
    ],
  },

  board: {
    id: "board",
    label: "Board Exam",
    description: "CBSE, ICSE, State Boards — class 10/12 examinations",
    icon: "🏫",
    requiredModules: ["date-sheet"],
    defaultModules: ["date-sheet", "syllabus", "admit-card", "result", "previous-papers"],
    publishChecklist: [
      { label: "Board name filled", check: "typeField:boardName" },
      { label: "Class specified", check: "typeField:className" },
      { label: "SEO title set", check: "field:seoTitle" },
    ],
    generalFields: [
      { key: "boardName", label: "Board Name", type: "text", placeholder: "e.g. CBSE, UP Board, Maharashtra Board", priority: "essential", required: true },
      { key: "className", label: "Class / Grade", type: "text", placeholder: "e.g. Class 10, Class 12", priority: "essential", required: true },
      { key: "stream", label: "Stream", type: "select", priority: "essential",
        options: [{ value: "science", label: "Science" }, { value: "commerce", label: "Commerce" }, { value: "arts", label: "Arts / Humanities" }, { value: "all", label: "All Streams" }] },
      { key: "examSession", label: "Exam Session", type: "text", placeholder: "e.g. March 2026", priority: "essential" },
      { key: "totalStudents", label: "Total Students Registered", type: "number", placeholder: "e.g. 3500000", priority: "advanced" },
    ],
    dateFields: [
      { key: "practicalStartDate", label: "Practical Exam Start", type: "date", priority: "essential" },
      { key: "theoryStartDate", label: "Theory Exam Start", type: "date", priority: "essential" },
      { key: "theoryEndDate", label: "Theory Exam End", type: "date", priority: "essential" },
      { key: "compartmentDate", label: "Compartment Exam Date", type: "date", priority: "advanced" },
      { key: "resultDate", label: "Result Declaration Date", type: "date", priority: "advanced" },
    ],
    eligibilityFields: [
      { key: "regularsOnly", label: "Regular Students Only?", type: "boolean", priority: "advanced" },
      { key: "privateCandidate", label: "Private Candidate Allowed?", type: "boolean", priority: "advanced" },
      { key: "attendanceRequired", label: "Min Attendance Required", type: "text", placeholder: "e.g. 75%", priority: "advanced" },
    ],
  },

  university: {
    id: "university",
    label: "University Admission",
    description: "DU, JNU, State Universities — program admissions",
    icon: "🎓",
    requiredModules: ["application"],
    defaultModules: ["application", "eligibility-details", "counselling", "merit-list"],
    publishChecklist: [
      { label: "University name filled", check: "typeField:universityName" },
      { label: "Program name filled", check: "typeField:programName" },
      { label: "Admission basis specified", check: "typeField:admissionBasis" },
      { label: "SEO title set", check: "field:seoTitle" },
    ],
    generalFields: [
      { key: "universityName", label: "University Name", type: "text", placeholder: "e.g. Delhi University, JNU", priority: "essential", required: true },
      { key: "programName", label: "Program / Course", type: "text", placeholder: "e.g. B.Tech CSE, MBA, B.A. Hons", priority: "essential", required: true },
      { key: "degreeType", label: "Degree Type", type: "select", priority: "essential",
        options: [{ value: "ug", label: "Undergraduate (UG)" }, { value: "pg", label: "Postgraduate (PG)" }, { value: "diploma", label: "Diploma" }, { value: "phd", label: "Ph.D" }, { value: "certificate", label: "Certificate" }] },
      { key: "courseDuration", label: "Course Duration", type: "text", placeholder: "e.g. 4 years", priority: "essential" },
      { key: "admissionBasis", label: "Admission Based On", type: "text", placeholder: "e.g. CUET Score / JEE Rank / Merit", priority: "essential" },
      { key: "totalSeats", label: "Total Seats", type: "number", placeholder: "e.g. 500", priority: "essential" },
      { key: "accreditation", label: "Accreditation", type: "text", placeholder: "e.g. NAAC A++, NBA", priority: "advanced" },
      { key: "campusLocation", label: "Campus Location", type: "text", placeholder: "e.g. New Delhi", priority: "advanced" },
    ],
    dateFields: [
      { key: "admissionOpen", label: "Admission Portal Opens", type: "date", priority: "essential" },
      { key: "admissionClose", label: "Admission Portal Closes", type: "date", priority: "essential", required: true },
      { key: "counsellingStart", label: "Counselling Start", type: "date", priority: "essential" },
      { key: "classesBegin", label: "Classes Begin", type: "date", priority: "advanced" },
    ],
    eligibilityFields: [
      { key: "entranceExam", label: "Entrance Exam Required", type: "text", placeholder: "e.g. CUET-UG, JEE Main", priority: "essential" },
      { key: "minimumPercentage", label: "Minimum % Required", type: "text", placeholder: "e.g. 50% in 10+2", priority: "essential" },
      { key: "domicileRequired", label: "Domicile Required?", type: "boolean", priority: "advanced" },
      { key: "lateralEntry", label: "Lateral Entry Available?", type: "boolean", priority: "advanced" },
    ],
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODULE REGISTRY — All content modules
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const MODULE_REGISTRY: ModuleDefinition[] = [

  // ─── LIFECYCLE MODULES ─────────────────────────────────────────────────────

  {
    id: "notification",
    label: "Notification",
    icon: "🔔",
    description: "Official notification / recruitment advertisement",
    applicableTo: ["*"],
    category: "lifecycle",
    displayOrder: 1,
    capabilities: {
      supportsAttachments: true, supportsTimeline: true, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: true,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "notificationTitle", label: "Notification Title", type: "text", priority: "essential", required: true, placeholder: "Official notification headline" },
      { key: "notificationDate", label: "Notification Date", type: "date", priority: "essential", required: true },
      { key: "summary", label: "Summary", type: "textarea", priority: "essential", placeholder: "Brief overview of the notification" },
      { key: "notificationPdfUrl", label: "Notification PDF URL", type: "url", priority: "essential", placeholder: "https://…/notification.pdf", hint: "Official PDF from conducting body" },
      { key: "officialPageUrl", label: "Official Notification Page", type: "url", priority: "essential", placeholder: "https://…/official-page" },
      { key: "applyLink", label: "Apply Online Link", type: "url", priority: "essential", placeholder: "https://…/apply" },
      // Context-aware: only for recruitment
      { key: "vacancyCount", label: "Total Vacancies", type: "number", priority: "essential", placeholder: "e.g. 4455", contextFilter: ["recruitment"] },
      { key: "advertisementNo", label: "Advertisement Number", type: "text", priority: "advanced", placeholder: "e.g. IBPS/CRP-PO/MT-XIV", contextFilter: ["recruitment"] },
      // Repeatable: corrigendum / amendments
      { key: "corrigendums", label: "Corrigendum / Amendments", type: "repeatable", priority: "advanced",
        columns: [{ key: "date", label: "Date", type: "date" }, { key: "title", label: "Title", type: "text", placeholder: "Amendment description" }, { key: "url", label: "PDF URL", type: "url", placeholder: "https://…" }],
        hint: "Add each corrigendum or amendment to the original notification" },
      { key: "importantInstructions", label: "Important Instructions", type: "textarea", priority: "advanced", placeholder: "Key points candidates must know" },
    ],
  },

  {
    id: "application",
    label: "Application",
    icon: "📝",
    description: "Application form, fee, documents, and process",
    applicableTo: ["*"],
    category: "lifecycle",
    displayOrder: 2,
    capabilities: {
      supportsAttachments: true, supportsTimeline: true, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: true,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "applicationStartDate", label: "Application Start Date", type: "date", priority: "essential", required: true },
      { key: "applicationEndDate", label: "Application End Date", type: "date", priority: "essential", required: true },
      { key: "lastDateFeePayment", label: "Last Date — Fee Payment", type: "date", priority: "essential" },
      { key: "correctionWindowStart", label: "Correction Window Start", type: "date", priority: "advanced" },
      { key: "correctionWindowEnd", label: "Correction Window End", type: "date", priority: "advanced" },
      { key: "applyOnlineUrl", label: "Apply Online URL", type: "url", priority: "essential", required: true, placeholder: "https://…/apply-online" },
      { key: "fees", label: "Application Fee (₹)", type: "fee-table", priority: "essential", hint: "Category-wise fee breakdown" },
      { key: "documentsRequired", label: "Documents Required", type: "repeatable", priority: "essential",
        columns: [{ key: "name", label: "Document", type: "text", placeholder: "e.g. Photograph" }, { key: "specs", label: "Specs", type: "text", placeholder: "e.g. 3.5x4.5cm, <50KB" }] },
      { key: "howToApply", label: "How to Apply (Steps)", type: "textarea", priority: "essential", placeholder: "Step-by-step instructions for candidates" },
      { key: "paymentMethods", label: "Payment Methods", type: "text", priority: "advanced", placeholder: "e.g. Online, Challan, UPI" },
      { key: "applicationFormPdf", label: "Offline Application Form PDF", type: "url", priority: "advanced", placeholder: "https://…/form.pdf" },
    ],
  },

  {
    id: "admit-card",
    label: "Admit Card",
    icon: "🪪",
    description: "Hall ticket release, download, and exam day instructions",
    applicableTo: ["*"],
    appliesToSelection: ["written-exam"], // hall ticket exists only for a sit-down exam
    category: "lifecycle",
    displayOrder: 3,
    capabilities: {
      supportsAttachments: true, supportsTimeline: true, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: true,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: true,
    },
    fields: [
      { key: "releaseDate", label: "Admit Card Release Date", type: "date", priority: "essential", required: true },
      { key: "examDate", label: "Exam Date", type: "date", priority: "essential" },
      { key: "downloadUrl", label: "Download Admit Card URL", type: "url", priority: "essential", required: true, placeholder: "https://…/admit-card" },
      { key: "loginMethod", label: "Login Method", type: "text", priority: "essential", placeholder: "e.g. Registration No. + DOB / Password" },
      { key: "examCentreDetails", label: "Exam Centre Details", type: "textarea", priority: "advanced", placeholder: "How to find centre, city-wise links" },
      { key: "downloadInstructions", label: "Download Steps", type: "textarea", priority: "essential", placeholder: "Step-by-step download guide" },
      { key: "importantInstructions", label: "Exam Day Instructions", type: "textarea", priority: "essential", placeholder: "What to carry, what is NOT allowed" },
      { key: "itemsToCarry", label: "Items to Carry", type: "repeatable", priority: "advanced",
        columns: [{ key: "item", label: "Item", type: "text", placeholder: "e.g. Photo ID, Admit Card printout" }] },
    ],
  },

  {
    id: "answer-key",
    label: "Answer Key",
    icon: "🔑",
    description: "Provisional / final answer key and objection window",
    applicableTo: ["recruitment", "exam"],
    appliesToSelection: ["written-exam"], // presupposes a question paper
    category: "lifecycle",
    displayOrder: 4,
    capabilities: {
      supportsAttachments: true, supportsTimeline: true, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: false,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: true,
    },
    fields: [
      { key: "keyType", label: "Key Type", type: "select", priority: "essential", required: true,
        options: [{ value: "provisional", label: "Provisional" }, { value: "final", label: "Final" }, { value: "revised", label: "Revised" }] },
      { key: "releaseDate", label: "Release Date", type: "date", priority: "essential", required: true },
      { key: "answerKeyUrl", label: "Answer Key URL / PDF", type: "url", priority: "essential", required: true, placeholder: "https://…/answer-key" },
      { key: "challengeStartDate", label: "Challenge Window Start", type: "date", priority: "essential" },
      { key: "challengeEndDate", label: "Challenge Window End", type: "date", priority: "essential" },
      { key: "objectionFee", label: "Objection Fee (₹ per question)", type: "number", priority: "advanced", placeholder: "e.g. 200" },
      { key: "challengePortalUrl", label: "Challenge Portal URL", type: "url", priority: "advanced", placeholder: "https://…/challenge" },
      { key: "responseSheetUrl", label: "Response Sheet URL", type: "url", priority: "advanced", placeholder: "https://…/response-sheet" },
      { key: "instructions", label: "Instructions", type: "textarea", priority: "advanced", placeholder: "How to match answers, raise objections" },
    ],
  },

  {
    id: "result",
    label: "Result",
    icon: "🏆",
    description: "Result declaration, scorecards, and merit lists",
    applicableTo: ["*"],
    category: "lifecycle",
    displayOrder: 5,
    capabilities: {
      supportsAttachments: true, supportsTimeline: true, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: true,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: true,
    },
    fields: [
      { key: "resultDate", label: "Result Declared Date", type: "date", priority: "essential", required: true },
      { key: "resultUrl", label: "Result / Scorecard URL", type: "url", priority: "essential", required: true, placeholder: "https://…/result" },
      { key: "scoreCardUrl", label: "Individual Score Card URL", type: "url", priority: "essential", placeholder: "https://…/score-card" },
      { key: "meritListUrl", label: "Merit List PDF URL", type: "url", priority: "advanced", placeholder: "https://…/merit-list.pdf" },
      { key: "cutoffApplicable", label: "Cutoff Applicable?", type: "boolean", priority: "advanced" },
      { key: "totalQualified", label: "Total Candidates Qualified", type: "number", priority: "advanced", placeholder: "e.g. 25000" },
      { key: "nextSteps", label: "Next Steps After Result", type: "textarea", priority: "essential", placeholder: "Document verification, interview, counselling" },
      { key: "additionalLinks", label: "Additional Result Links", type: "repeatable", priority: "advanced",
        columns: [{ key: "label", label: "Label", type: "text", placeholder: "e.g. Category-wise list" }, { key: "url", label: "URL", type: "url", placeholder: "https://…" }] },
    ],
  },

  {
    id: "cutoff",
    label: "Cut Off",
    icon: "📊",
    description: "Category-wise cutoff marks and trends",
    applicableTo: ["recruitment", "exam"],
    appliesToSelection: ["written-exam", "merit-based"], // exam cutoff AND merit qualifying cutoff
    category: "lifecycle",
    displayOrder: 6,
    capabilities: {
      supportsAttachments: true, supportsTimeline: false, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: true,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: true,
    },
    fields: [
      { key: "cutoffYear", label: "Cutoff Year", type: "text", priority: "essential", required: true, placeholder: "2025" },
      { key: "cutoffStage", label: "Stage", type: "select", priority: "essential",
        options: [{ value: "prelims", label: "Prelims" }, { value: "mains", label: "Mains" }, { value: "final", label: "Final" }, { value: "interview", label: "Interview" }] },
      { key: "categoryWiseCutoff", label: "Category-wise Cutoff", type: "cutoff-table", priority: "essential", hint: "Add: Category → Cutoff Marks" },
      { key: "cutoffPdfUrl", label: "Official Cutoff PDF", type: "url", priority: "advanced", placeholder: "https://…/cutoff.pdf" },
      { key: "previousYearComparison", label: "Previous Year Comparison", type: "textarea", priority: "advanced", placeholder: "Year-wise trend analysis" },
    ],
  },

  {
    id: "counselling",
    label: "Counselling",
    icon: "🤝",
    description: "Counselling rounds, seat allotment, and choice filling",
    applicableTo: ["exam", "university"],
    // Re-scoped: used by exam/university admission lifecycles; selection-agnostic
    // (unconstrained) so it serves internal-admission universities too.
    category: "lifecycle",
    displayOrder: 7,
    capabilities: {
      supportsAttachments: true, supportsTimeline: true, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: true,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: true,
    },
    fields: [
      { key: "counsellingBody", label: "Counselling Body", type: "text", priority: "essential", placeholder: "e.g. JoSAA, CCAA, State Authority" },
      { key: "registrationUrl", label: "Registration Portal URL", type: "url", priority: "essential", placeholder: "https://…/counselling-register" },
      { key: "rounds", label: "Counselling Rounds", type: "repeatable", priority: "essential",
        columns: [{ key: "round", label: "Round", type: "text", placeholder: "e.g. Round 1" }, { key: "startDate", label: "Start", type: "date" }, { key: "endDate", label: "End", type: "date" }, { key: "resultDate", label: "Result", type: "date" }] },
      { key: "choiceFillingGuide", label: "Choice Filling Guide", type: "textarea", priority: "essential", placeholder: "How to fill preferences, tips" },
      { key: "documentsForReporting", label: "Documents for Reporting", type: "repeatable", priority: "advanced",
        columns: [{ key: "document", label: "Document", type: "text", placeholder: "e.g. Original marksheet" }] },
      { key: "seatMatrix", label: "Seat Matrix URL", type: "url", priority: "advanced", placeholder: "https://…/seat-matrix" },
      { key: "feeStructure", label: "Fee After Allotment", type: "textarea", priority: "advanced", placeholder: "Acceptance fee, semester fee details" },
    ],
  },

  {
    id: "merit-list",
    label: "Merit List",
    icon: "📋",
    description: "Merit list publication and verification",
    applicableTo: ["recruitment", "university"],
    // Re-scoped: the non-exam outcome document. Exam-based recruitment uses
    // Result instead, so exclude written-exam to avoid a duplicate outcome.
    appliesToSelection: ["merit-based", "interview-based", "internal-admission"],
    category: "lifecycle",
    displayOrder: 8,
    capabilities: {
      supportsAttachments: true, supportsTimeline: false, supportsDownloads: true,
      supportsFAQs: false, supportsSEO: true, supportsAI: false,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: true,
    },
    fields: [
      { key: "listType", label: "List Type", type: "select", priority: "essential",
        options: [{ value: "provisional", label: "Provisional" }, { value: "final", label: "Final" }, { value: "waiting", label: "Waiting List" }] },
      { key: "releaseDate", label: "Release Date", type: "date", priority: "essential", required: true },
      { key: "meritListUrl", label: "Merit List URL / PDF", type: "url", priority: "essential", required: true, placeholder: "https://…/merit-list.pdf" },
      { key: "totalSelected", label: "Total Selected", type: "number", priority: "essential", placeholder: "e.g. 5000" },
      { key: "verificationDates", label: "Document Verification Dates", type: "text", priority: "advanced", placeholder: "e.g. 15 July – 30 July 2025" },
      { key: "reportingVenue", label: "Reporting Venue", type: "textarea", priority: "advanced", placeholder: "Where to report for verification" },
    ],
  },

  // ─── NEW: non-exam selection lifecycle modules ─────────────────────────────

  {
    id: "document-verification",
    label: "Document Verification",
    icon: "📑",
    description: "Document verification schedule, venue, and required documents — the selection gate for merit/interview processes",
    applicableTo: ["recruitment"],
    appliesToSelection: ["merit-based", "interview-based"],
    category: "lifecycle",
    displayOrder: 9,
    capabilities: {
      supportsAttachments: true, supportsTimeline: true, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: false,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "startDate", label: "DV Start Date", type: "date", priority: "essential", required: true },
      { key: "endDate", label: "DV End Date", type: "date", priority: "essential" },
      { key: "venue", label: "Venue / Reporting Centre", type: "textarea", priority: "essential", placeholder: "Where candidates report for verification" },
      { key: "callLetterUrl", label: "DV Call Letter URL", type: "url", priority: "essential", placeholder: "https://…/dv-call-letter" },
      { key: "documentsRequired", label: "Documents to Bring", type: "repeatable", priority: "essential",
        columns: [{ key: "document", label: "Document", type: "text", placeholder: "e.g. Original 10th marksheet" }, { key: "notes", label: "Notes", type: "text", placeholder: "e.g. + 2 photocopies" }] },
      { key: "instructions", label: "Instructions", type: "textarea", priority: "advanced", placeholder: "What to expect, dress code, timings" },
    ],
  },

  {
    id: "interview-schedule",
    label: "Interview Schedule",
    icon: "🗣️",
    description: "Interview / personality-test dates, venue, and panel details",
    applicableTo: ["recruitment", "exam", "university"],
    appliesToSelection: ["interview-based"],
    category: "lifecycle",
    displayOrder: 9.5,
    capabilities: {
      supportsAttachments: true, supportsTimeline: true, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: false,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: true,
    },
    fields: [
      { key: "callLetterDate", label: "Call Letter Release Date", type: "date", priority: "essential" },
      { key: "callLetterUrl", label: "Interview Call Letter URL", type: "url", priority: "essential", placeholder: "https://…/interview-call-letter" },
      { key: "rounds", label: "Interview Rounds", type: "repeatable", priority: "essential",
        columns: [{ key: "round", label: "Round", type: "text", placeholder: "e.g. Technical / HR / GD" }, { key: "date", label: "Date", type: "date" }, { key: "venue", label: "Venue", type: "text", placeholder: "City / online" }] },
      { key: "marksWeightage", label: "Interview Weightage", type: "text", priority: "advanced", placeholder: "e.g. 100 marks / 25% of total" },
      { key: "instructions", label: "Instructions", type: "textarea", priority: "advanced", placeholder: "Documents to carry, reporting time" },
    ],
  },

  {
    id: "final-selection",
    label: "Final Selection",
    icon: "✅",
    description: "Final selected list / appointment where there is no exam scorecard",
    applicableTo: ["recruitment"],
    appliesToSelection: ["merit-based", "interview-based"],
    category: "lifecycle",
    displayOrder: 9.7,
    capabilities: {
      supportsAttachments: true, supportsTimeline: false, supportsDownloads: true,
      supportsFAQs: false, supportsSEO: true, supportsAI: false,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: true,
    },
    fields: [
      { key: "releaseDate", label: "Final List Date", type: "date", priority: "essential", required: true },
      { key: "finalListUrl", label: "Final Selection List URL / PDF", type: "url", priority: "essential", required: true, placeholder: "https://…/final-selection.pdf" },
      { key: "totalSelected", label: "Total Selected", type: "number", priority: "essential", placeholder: "e.g. 1200" },
      { key: "joiningDetails", label: "Joining / Appointment Details", type: "textarea", priority: "advanced", placeholder: "Reporting date, posting, next steps" },
    ],
  },

  {
    id: "seat-allotment",
    label: "Seat Allotment",
    icon: "🎟️",
    description: "Round-wise seat allotment and acceptance — the admission analogue of a result",
    applicableTo: ["university"],
    appliesToSelection: ["internal-admission"],
    category: "lifecycle",
    displayOrder: 9.9,
    capabilities: {
      supportsAttachments: true, supportsTimeline: true, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: false,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: true,
    },
    fields: [
      { key: "rounds", label: "Allotment Rounds", type: "repeatable", priority: "essential",
        columns: [{ key: "round", label: "Round", type: "text", placeholder: "e.g. Round 1" }, { key: "allotmentDate", label: "Allotment Date", type: "date" }, { key: "reportingLastDate", label: "Reporting Last Date", type: "date" }] },
      { key: "allotmentResultUrl", label: "Allotment Result URL", type: "url", priority: "essential", placeholder: "https://…/seat-allotment" },
      { key: "seatMatrixUrl", label: "Seat Matrix URL", type: "url", priority: "advanced", placeholder: "https://…/seat-matrix" },
      { key: "acceptanceProcess", label: "Acceptance / Reporting Process", type: "textarea", priority: "essential", placeholder: "How to accept a seat, freeze/float, fee payment" },
    ],
  },

  // ─── ACADEMIC MODULES ──────────────────────────────────────────────────────

  {
    id: "exam-pattern",
    label: "Exam Pattern",
    icon: "📐",
    description: "Exam structure, papers, marking scheme",
    applicableTo: ["recruitment", "exam"],
    appliesToSelection: ["written-exam"], // structure of a paper — only where a paper exists
    category: "academic",
    displayOrder: 10,
    capabilities: {
      supportsAttachments: false, supportsTimeline: false, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: true,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "papers", label: "Papers / Stages", type: "repeatable", priority: "essential",
        columns: [{ key: "name", label: "Paper/Stage", type: "text", placeholder: "e.g. Prelims Paper I" }, { key: "subjects", label: "Subjects", type: "text", placeholder: "e.g. Reasoning, Quant" }, { key: "marks", label: "Marks", type: "number" }, { key: "duration", label: "Duration", type: "text", placeholder: "e.g. 60 min" }, { key: "questions", label: "Questions", type: "number" }] },
      { key: "totalMarks", label: "Total Marks (Overall)", type: "number", priority: "essential", placeholder: "e.g. 200" },
      { key: "passingMarks", label: "Passing / Qualifying Marks", type: "text", priority: "advanced", placeholder: "e.g. 40% overall" },
      { key: "negativeMarking", label: "Negative Marking Details", type: "text", priority: "essential", placeholder: "e.g. 0.25 marks deducted per wrong answer" },
      { key: "examMode", label: "Exam Mode", type: "select", priority: "essential",
        options: [{ value: "online", label: "Online (CBT)" }, { value: "offline", label: "Offline" }, { value: "hybrid", label: "Hybrid" }] },
      { key: "sectionWiseTime", label: "Section-wise Time Limit?", type: "boolean", priority: "advanced" },
      { key: "normalization", label: "Normalization Applied?", type: "boolean", priority: "advanced" },
      { key: "patternPdfUrl", label: "Official Pattern PDF", type: "url", priority: "advanced", placeholder: "https://…/exam-pattern.pdf" },
    ],
  },

  {
    id: "syllabus",
    label: "Syllabus",
    icon: "📚",
    description: "Subject-wise syllabus and topic breakdown",
    applicableTo: ["*"],
    category: "academic",
    displayOrder: 11,
    capabilities: {
      supportsAttachments: true, supportsTimeline: false, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: true,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "syllabusYear", label: "Syllabus Year", type: "text", priority: "essential", placeholder: "e.g. 2025" },
      { key: "syllabusPdfUrl", label: "Official Syllabus PDF", type: "url", priority: "essential", placeholder: "https://…/syllabus.pdf" },
      { key: "subjects", label: "Subjects & Topics", type: "repeatable", priority: "essential",
        columns: [{ key: "subject", label: "Subject", type: "text", placeholder: "e.g. Mathematics" }, { key: "topics", label: "Key Topics", type: "text", placeholder: "Algebra, Geometry, Calculus" }, { key: "weightage", label: "Weightage", type: "text", placeholder: "e.g. 30%" }] },
      { key: "changesFromLastYear", label: "Changes from Last Year", type: "textarea", priority: "advanced", placeholder: "What's new or removed" },
      { key: "preparationStrategy", label: "Preparation Strategy", type: "textarea", priority: "advanced", placeholder: "Subject-wise prep tips" },
    ],
  },

  {
    id: "date-sheet",
    label: "Date Sheet / Schedule",
    icon: "📅",
    description: "Exam timetable / date sheet",
    applicableTo: ["board", "university"],
    category: "academic",
    displayOrder: 12,
    capabilities: {
      supportsAttachments: true, supportsTimeline: true, supportsDownloads: true,
      supportsFAQs: true, supportsSEO: true, supportsAI: false,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "examStartDate", label: "Exam Start Date", type: "date", priority: "essential", required: true },
      { key: "examEndDate", label: "Exam End Date", type: "date", priority: "essential" },
      { key: "dateSheetPdfUrl", label: "Date Sheet PDF URL", type: "url", priority: "essential", placeholder: "https://…/date-sheet.pdf" },
      { key: "schedule", label: "Subject Schedule", type: "schedule-table", priority: "essential", hint: "Add: Date → Subject" },
      { key: "reportingTime", label: "Reporting Time", type: "text", priority: "advanced", placeholder: "e.g. 9:30 AM (30 min before exam)" },
      { key: "centreGuidelines", label: "Exam Centre Guidelines", type: "textarea", priority: "advanced", placeholder: "Dress code, items allowed/prohibited" },
    ],
  },

  {
    id: "vacancy-details",
    label: "Vacancy Details",
    icon: "👥",
    description: "Post-wise and category-wise vacancy breakdown",
    applicableTo: ["recruitment"],
    category: "academic",
    displayOrder: 13,
    capabilities: {
      supportsAttachments: true, supportsTimeline: false, supportsDownloads: true,
      supportsFAQs: false, supportsSEO: false, supportsAI: true,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "totalVacancy", label: "Total Vacancy", type: "number", priority: "essential", required: true, placeholder: "e.g. 4500" },
      { key: "postWiseBreakdown", label: "Post-wise Breakdown", type: "repeatable", priority: "essential",
        columns: [{ key: "post", label: "Post Name", type: "text", placeholder: "e.g. PO" }, { key: "total", label: "Total", type: "number" }, { key: "ur", label: "UR", type: "number" }, { key: "obc", label: "OBC", type: "number" }, { key: "sc", label: "SC", type: "number" }, { key: "st", label: "ST", type: "number" }, { key: "ews", label: "EWS", type: "number" }] },
      { key: "stateWiseVacancy", label: "State-wise Vacancy", type: "repeatable", priority: "advanced",
        columns: [{ key: "state", label: "State", type: "text", placeholder: "e.g. UP" }, { key: "count", label: "Vacancies", type: "number" }] },
      { key: "backlogVacancy", label: "Includes Backlog Vacancy?", type: "boolean", priority: "advanced" },
      { key: "vacancyPdfUrl", label: "Vacancy PDF URL", type: "url", priority: "advanced", placeholder: "https://…/vacancy-details.pdf" },
    ],
  },

  {
    id: "eligibility-details",
    label: "Eligibility Details",
    icon: "✅",
    description: "Detailed eligibility criteria and relaxation",
    applicableTo: ["*"],
    category: "academic",
    displayOrder: 14,
    capabilities: {
      supportsAttachments: false, supportsTimeline: false, supportsDownloads: false,
      supportsFAQs: true, supportsSEO: true, supportsAI: true,
      supportsVersionHistory: true, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "minAge", label: "Minimum Age", type: "number", priority: "essential", placeholder: "e.g. 18" },
      { key: "maxAge", label: "Maximum Age", type: "number", priority: "essential", placeholder: "e.g. 30" },
      { key: "ageRelaxation", label: "Age Relaxation", type: "repeatable", priority: "essential",
        columns: [{ key: "category", label: "Category", type: "text", placeholder: "e.g. OBC-NCL" }, { key: "years", label: "Relaxation (years)", type: "number" }] },
      { key: "educationalQualification", label: "Educational Qualification", type: "textarea", priority: "essential", placeholder: "Minimum education required" },
      { key: "experienceRequired", label: "Experience", type: "text", priority: "advanced", placeholder: "e.g. Nil / 2 years" },
      { key: "nationality", label: "Nationality", type: "text", priority: "essential", placeholder: "Indian citizen" },
      { key: "otherConditions", label: "Other Conditions", type: "textarea", priority: "advanced", placeholder: "Any special eligibility conditions" },
    ],
  },

  // ─── RESOURCE MODULES ──────────────────────────────────────────────────────

  {
    id: "previous-papers",
    label: "Previous Papers",
    icon: "📄",
    description: "Year-wise previous question papers and solutions",
    applicableTo: ["recruitment", "exam", "board"],
    appliesToSelection: ["written-exam"], // past question papers presuppose a paper
    category: "resource",
    displayOrder: 20,
    capabilities: {
      supportsAttachments: true, supportsTimeline: false, supportsDownloads: true,
      supportsFAQs: false, supportsSEO: true, supportsAI: false,
      supportsVersionHistory: false, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "papers", label: "Previous Papers", type: "repeatable", priority: "essential", required: true,
        columns: [{ key: "year", label: "Year", type: "text", placeholder: "2024" }, { key: "title", label: "Paper / Set", type: "text", placeholder: "Paper I - Set A" }, { key: "url", label: "PDF URL", type: "url", placeholder: "https://…/paper.pdf" }],
        hint: "Add each year/set separately for best download UX" },
      { key: "solutionsAvailable", label: "Solutions Available?", type: "boolean", priority: "advanced" },
      { key: "solutionsPdfUrl", label: "Solutions PDF URL", type: "url", priority: "advanced", placeholder: "https://…/solutions.pdf" },
      { key: "analysisNotes", label: "Paper Analysis Notes", type: "textarea", priority: "advanced", placeholder: "Difficulty level, topic distribution" },
    ],
  },

  {
    id: "mock-test",
    label: "Mock Test",
    icon: "🧪",
    description: "Free and paid mock test series",
    applicableTo: ["recruitment", "exam"],
    appliesToSelection: ["written-exam"], // practice tests presuppose a test
    category: "resource",
    displayOrder: 21,
    capabilities: {
      supportsAttachments: false, supportsTimeline: false, supportsDownloads: false,
      supportsFAQs: false, supportsSEO: true, supportsAI: false,
      supportsVersionHistory: false, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "testPortalUrl", label: "Mock Test Portal URL", type: "url", priority: "essential", required: true, placeholder: "https://…/mock-test" },
      { key: "totalTests", label: "Total Tests Available", type: "number", priority: "essential", placeholder: "50" },
      { key: "freeTests", label: "Free Tests Count", type: "number", priority: "essential" },
      { key: "isPaid", label: "Paid Tests Available?", type: "boolean", priority: "advanced" },
      { key: "testPattern", label: "Test Pattern", type: "textarea", priority: "advanced", placeholder: "Duration, questions, marking scheme" },
      { key: "topicsCovered", label: "Topics Covered", type: "text", priority: "advanced", placeholder: "Quant, Reasoning, English…" },
    ],
  },

  {
    id: "study-material",
    label: "Study Material",
    icon: "🗂️",
    description: "Notes, PDFs, video courses, and resources",
    applicableTo: ["*"],
    category: "resource",
    displayOrder: 22,
    capabilities: {
      supportsAttachments: true, supportsTimeline: false, supportsDownloads: true,
      supportsFAQs: false, supportsSEO: true, supportsAI: false,
      supportsVersionHistory: false, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "resources", label: "Study Resources", type: "repeatable", priority: "essential",
        columns: [{ key: "subject", label: "Subject", type: "text", placeholder: "e.g. Mathematics" }, { key: "title", label: "Resource Title", type: "text", placeholder: "e.g. Complete Notes" }, { key: "url", label: "URL", type: "url", placeholder: "https://…" }, { key: "type", label: "Type", type: "text", placeholder: "PDF/Video/Notes" }] },
      { key: "isFree", label: "Free Resources?", type: "boolean", priority: "advanced" },
      { key: "description", label: "Description", type: "textarea", priority: "advanced", placeholder: "What's included, coverage" },
    ],
  },

  // ─── META MODULES ──────────────────────────────────────────────────────────

  {
    id: "important-links",
    label: "Important Links",
    icon: "🔗",
    description: "Official and useful links collection",
    applicableTo: ["*"],
    category: "meta",
    displayOrder: 30,
    capabilities: {
      supportsAttachments: false, supportsTimeline: false, supportsDownloads: false,
      supportsFAQs: false, supportsSEO: false, supportsAI: false,
      supportsVersionHistory: false, supportsPreview: false, isRepeatable: false,
    },
    fields: [
      { key: "links", label: "Links", type: "repeatable", priority: "essential",
        columns: [{ key: "label", label: "Label", type: "text", placeholder: "e.g. Official Website" }, { key: "url", label: "URL", type: "url", placeholder: "https://…" }, { key: "isOfficial", label: "Official?", type: "text", placeholder: "Yes/No" }] },
    ],
  },

  {
    id: "downloads",
    label: "Downloads",
    icon: "⬇️",
    description: "Downloadable PDFs, forms, and documents",
    applicableTo: ["*"],
    category: "meta",
    displayOrder: 31,
    capabilities: {
      supportsAttachments: true, supportsTimeline: false, supportsDownloads: true,
      supportsFAQs: false, supportsSEO: false, supportsAI: false,
      supportsVersionHistory: false, supportsPreview: false, isRepeatable: false,
    },
    fields: [
      { key: "files", label: "Downloadable Files", type: "repeatable", priority: "essential",
        columns: [{ key: "label", label: "File Name", type: "text", placeholder: "e.g. Notification PDF" }, { key: "url", label: "URL", type: "url", placeholder: "https://…/file.pdf" }, { key: "fileType", label: "Type", type: "text", placeholder: "PDF/ZIP/DOC" }, { key: "size", label: "Size", type: "text", placeholder: "e.g. 2.4 MB" }] },
    ],
  },

  {
    id: "faqs",
    label: "FAQs",
    icon: "❓",
    description: "Frequently asked questions (JSON-LD schema)",
    applicableTo: ["*"],
    category: "meta",
    displayOrder: 32,
    capabilities: {
      supportsAttachments: false, supportsTimeline: false, supportsDownloads: false,
      supportsFAQs: true, supportsSEO: true, supportsAI: true,
      supportsVersionHistory: false, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "questions", label: "FAQ Items", type: "repeatable", priority: "essential",
        columns: [{ key: "question", label: "Question", type: "text", placeholder: "What is…?" }, { key: "answer", label: "Answer", type: "text", placeholder: "The answer is…" }],
        hint: "These generate FAQ structured data for Google rich snippets" },
    ],
  },

  {
    id: "gallery",
    label: "Gallery",
    icon: "🖼️",
    description: "Image gallery — campus, exam centre, admit card samples",
    applicableTo: ["*"],
    category: "media",
    displayOrder: 40,
    capabilities: {
      supportsAttachments: true, supportsTimeline: false, supportsDownloads: false,
      supportsFAQs: false, supportsSEO: false, supportsAI: false,
      supportsVersionHistory: false, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "images", label: "Images", type: "repeatable", priority: "essential",
        columns: [{ key: "url", label: "Image URL", type: "url", placeholder: "https://…/image.jpg" }, { key: "alt", label: "Alt Text", type: "text", placeholder: "Description" }, { key: "caption", label: "Caption", type: "text", placeholder: "Optional caption" }] },
    ],
  },

  {
    id: "videos",
    label: "Videos",
    icon: "🎬",
    description: "Video resources — tutorials, announcements, guides",
    applicableTo: ["*"],
    category: "media",
    displayOrder: 41,
    capabilities: {
      supportsAttachments: false, supportsTimeline: false, supportsDownloads: false,
      supportsFAQs: false, supportsSEO: false, supportsAI: false,
      supportsVersionHistory: false, supportsPreview: true, isRepeatable: false,
    },
    fields: [
      { key: "videos", label: "Videos", type: "repeatable", priority: "essential",
        columns: [{ key: "title", label: "Title", type: "text", placeholder: "Video title" }, { key: "url", label: "YouTube/URL", type: "url", placeholder: "https://youtube.com/…" }, { key: "duration", label: "Duration", type: "text", placeholder: "10:30" }] },
    ],
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REGISTRY QUERY HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Get a module definition by ID */
export function getModule(id: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((m) => m.id === id);
}

/**
 * Get all modules structurally applicable to an entity type and (optionally)
 * a selection model. This is THE single authority for applicability.
 *
 * Two axes, both must pass:
 *   Axis 1 (entityType):     module.applicableTo includes "*" or the entityType
 *   Axis 2 (selectionModel): module.appliesToSelection is omitted (→ all models)
 *                            or includes the given selectionModel
 *
 * BACKWARD COMPATIBLE: when `selectionModel` is omitted, Axis 2 is not applied
 * at all, so the result is identical to the pre-selection-model behaviour.
 */
export function getModulesForEntityType(
  entityType: string,
  selectionModel?: SelectionModel,
): ModuleDefinition[] {
  return MODULE_REGISTRY
    .filter((m) => m.applicableTo.includes("*") || m.applicableTo.includes(entityType))
    .filter((m) =>
      !selectionModel                    // omitted arg → no selection filtering
      || !m.appliesToSelection           // omitted field → applies to all models
      || m.appliesToSelection.includes(selectionModel)
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/** Get modules grouped by category for an entity type (+ optional selection model). */
export function getModulesGrouped(
  entityType: string,
  selectionModel?: SelectionModel,
): Record<string, ModuleDefinition[]> {
  const modules = getModulesForEntityType(entityType, selectionModel);
  const grouped: Record<string, ModuleDefinition[]> = {};
  for (const m of modules) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }
  return grouped;
}

/**
 * STRUCTURAL applicability check — "can this module exist for this record?"
 * This is separate from hasData ("is it filled in?"). Never use hasData as a
 * proxy for applicability: a non-applicable module must not exist at all (no
 * CMS tab, no frontend section/route/sitemap entry), whereas an applicable-but-
 * empty module is a legitimate add-content state.
 */
export function isModuleApplicable(
  moduleId: string,
  entityType: string,
  selectionModel?: SelectionModel,
): boolean {
  return getModulesForEntityType(entityType, selectionModel).some((m) => m.id === moduleId);
}

/** Get the entity type profile */
export function getEntityProfile(entityType: string): EntityTypeProfile | undefined {
  return ENTITY_TYPE_PROFILES[entityType];
}

/** Get fields for a module, filtered by entity type context */
export function getModuleFields(moduleId: string, entityType: string): FieldDef[] {
  const module = getModule(moduleId);
  if (!module) return [];
  return module.fields.filter(
    (f) => !f.contextFilter || f.contextFilter.length === 0 || f.contextFilter.includes(entityType)
  );
}

/** Get essential fields only (for progressive disclosure) */
export function getEssentialFields(moduleId: string, entityType: string): FieldDef[] {
  return getModuleFields(moduleId, entityType).filter((f) => f.priority === "essential");
}

/** Get advanced fields only */
export function getAdvancedFields(moduleId: string, entityType: string): FieldDef[] {
  return getModuleFields(moduleId, entityType).filter((f) => f.priority === "advanced");
}

/** Check if a module is required for an entity type */
export function isModuleRequired(moduleId: string, entityType: string): boolean {
  const profile = getEntityProfile(entityType);
  return profile?.requiredModules.includes(moduleId) ?? false;
}

/** Check if a module is a default for an entity type */
export function isModuleDefault(moduleId: string, entityType: string): boolean {
  const profile = getEntityProfile(entityType);
  return profile?.defaultModules.includes(moduleId) ?? false;
}

/** Category labels for UI grouping */
export const MODULE_CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  lifecycle: { label: "Exam Lifecycle", description: "Notification → Application → Admit Card → Exam → Result" },
  academic: { label: "Academic & Eligibility", description: "Syllabus, pattern, vacancy, eligibility details" },
  resource: { label: "Resources", description: "Previous papers, mock tests, study material" },
  media: { label: "Media & Links", description: "Downloads, links, gallery, videos" },
  meta: { label: "Meta", description: "FAQs, downloads, important links" },
};
