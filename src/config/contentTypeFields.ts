/**
 * contentTypeFields.ts
 *
 * Defines the structured fields for each content type.
 * Each field maps to a key inside `content_type_data` JSONB column.
 * The ContentEditPage renders only the fields relevant to the selected type.
 */

export type FieldType =
  | "text"        // single-line text
  | "textarea"    // multi-line text
  | "url"         // URL input with validation
  | "date"        // date picker
  | "number"      // numeric input
  | "boolean"     // checkbox toggle
  | "select"      // dropdown with predefined options
  | "fee-table"   // special: renders category-wise fee rows
  | "subject-list"// special: repeatable subject entries
  | "paper-list"  // special: year + PDF URL pairs
  | "cutoff-table"// special: category + marks table
  | "schedule-table"; // special: date + subject rows

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
}

export interface ContentTypeConfig {
  label: string;
  icon: string;
  description: string;
  fields: FieldDef[];
}

export const CONTENT_TYPE_CONFIGS: Record<string, ContentTypeConfig> = {

  notification: {
    label: "Notification",
    icon: "🔔",
    description: "Official notification / recruitment advertisement",
    fields: [
      { key: "notificationTitle",    label: "Official Notification Title", type: "text",     required: true,  placeholder: "e.g. IBPS PO 2025 Official Notification" },
      { key: "description",          label: "Short Description",           type: "textarea",                  placeholder: "Brief summary of the notification" },
      { key: "notificationPdfUrl",   label: "Notification PDF URL",        type: "url",                       placeholder: "https://…/notification.pdf",   hint: "Direct link to the official PDF" },
      { key: "applyLink",            label: "Apply Online Link",           type: "url",                       placeholder: "https://…/apply" },
      { key: "eligibilitySummary",   label: "Eligibility Summary",         type: "textarea",                  placeholder: "Age, qualification, nationality…" },
      { key: "vacancyCount",         label: "Total Vacancies",             type: "number",                    placeholder: "e.g. 4455" },
    ],
  },

  application: {
    label: "Application",
    icon: "📝",
    description: "Application form, fee details, and eligibility",
    fields: [
      { key: "applicationStartDate", label: "Application Start Date",  type: "date",   required: true },
      { key: "applicationEndDate",   label: "Application End Date",    type: "date",   required: true },
      { key: "lastDateFeePayment",   label: "Last Date — Fee Payment", type: "date" },
      { key: "applyOnlineUrl",       label: "Apply Online Link",       type: "url",    required: true, placeholder: "https://…/apply-online" },
      { key: "eligibilitySummary",   label: "Eligibility Summary",     type: "textarea", placeholder: "Age, qualification, category…" },
      { key: "fees",                 label: "Application Fee",         type: "fee-table", hint: "Leave 0 for no fee" },
      { key: "documentsRequired",    label: "Documents Required",      type: "textarea", placeholder: "Photo, Signature, ID proof…" },
      { key: "howToApply",           label: "How to Apply (steps)",    type: "textarea", placeholder: "Step-by-step instructions…" },
    ],
  },

  "admit-card": {
    label: "Admit Card",
    icon: "🪪",
    description: "Hall ticket release and download information",
    fields: [
      { key: "admitCardReleaseDate",  label: "Admit Card Release Date",   type: "date",     required: true },
      { key: "examDate",              label: "Exam Date",                  type: "date" },
      { key: "admitCardUrl",          label: "Download Admit Card URL",    type: "url",      required: true, placeholder: "https://…/admit-card" },
      { key: "credentialsRequired",   label: "Login Credentials Required", type: "text",     placeholder: "e.g. Registration No. + DOB" },
      { key: "downloadInstructions",  label: "Download Instructions",      type: "textarea", placeholder: "Step-by-step download guide…" },
      { key: "importantInstructions", label: "Exam Day Instructions",      type: "textarea", placeholder: "What to carry, what is not allowed…" },
    ],
  },

  result: {
    label: "Result",
    icon: "🏆",
    description: "Result declaration and scorecard",
    fields: [
      { key: "resultDeclaredDate",  label: "Result Declared Date",   type: "date",     required: true },
      { key: "resultUrl",           label: "Result / Scorecard URL", type: "url",      required: true, placeholder: "https://…/result" },
      { key: "scoreCardUrl",        label: "Score Card URL",         type: "url",      placeholder: "https://…/score-card" },
      { key: "cutoffApplicable",    label: "Cutoff Applicable?",     type: "boolean" },
      { key: "cutoffDetails",       label: "Cutoff Summary",         type: "textarea", placeholder: "e.g. General: 65, OBC: 60, SC: 55…" },
      { key: "nextSteps",           label: "Next Steps After Result", type: "textarea", placeholder: "Document verification, interview, etc." },
    ],
  },

  "answer-key": {
    label: "Answer Key",
    icon: "🔑",
    description: "Provisional / final answer key with objection window",
    fields: [
      { key: "keyType",              label: "Key Type",                type: "select", required: true,
        options: [{ value: "provisional", label: "Provisional" }, { value: "final", label: "Final" }] },
      { key: "answerKeyUrl",         label: "Answer Key PDF URL",      type: "url",      required: true, placeholder: "https://…/answer-key.pdf" },
      { key: "challengeStartDate",   label: "Challenge Window — Start", type: "date" },
      { key: "challengeEndDate",     label: "Challenge Window — End",   type: "date" },
      { key: "objectionFee",         label: "Objection Fee (₹)",        type: "number",   placeholder: "e.g. 200" },
      { key: "challengePortalUrl",   label: "Challenge Portal URL",     type: "url",      placeholder: "https://…/challenge" },
      { key: "keyInstructions",      label: "Instructions",             type: "textarea", placeholder: "How to match answers, raise objections…" },
    ],
  },

  syllabus: {
    label: "Syllabus",
    icon: "📚",
    description: "Syllabus PDF, subject breakdown, and exam pattern",
    fields: [
      { key: "syllabusYear",    label: "Syllabus Year",       type: "text",          placeholder: "2025" },
      { key: "syllabusVersion", label: "Version / Edition",   type: "text",          placeholder: "Latest / Revised" },
      { key: "syllabusUrl",     label: "Syllabus PDF URL",    type: "url",           placeholder: "https://…/syllabus.pdf" },
      { key: "subjects",        label: "Subjects / Sections", type: "subject-list",  hint: "Add each subject/section with optional topic list" },
      { key: "examPattern",     label: "Exam Pattern Notes",  type: "textarea",      placeholder: "Phases, mode (online/offline), duration…" },
    ],
  },

  "date-sheet": {
    label: "Date Sheet / Schedule",
    icon: "📅",
    description: "Exam timetable / date sheet",
    fields: [
      { key: "examStartDate",  label: "Exam Start Date",     type: "date",           required: true },
      { key: "examEndDate",    label: "Exam End Date",        type: "date" },
      { key: "dateSheetUrl",   label: "Date Sheet PDF URL",  type: "url",            placeholder: "https://…/date-sheet.pdf" },
      { key: "subjectSchedule",label: "Subject Schedule",    type: "schedule-table", hint: "Add date + subject/paper rows" },
      { key: "additionalInfo", label: "Additional Notes",    type: "textarea",       placeholder: "Reporting time, centre guidelines…" },
    ],
  },

  cutoff: {
    label: "Cutoff",
    icon: "📊",
    description: "Category-wise cutoff marks / merit list",
    fields: [
      { key: "cutoffYear",          label: "Cutoff Year",              type: "text",         required: true, placeholder: "2025" },
      { key: "cutoffType",          label: "Cutoff Type",              type: "select",
        options: [{ value: "written", label: "Written Exam" }, { value: "final", label: "Final / Overall" }, { value: "interview", label: "Interview" }] },
      { key: "categoryWiseCutoff",  label: "Category-wise Cutoff",    type: "cutoff-table",  hint: "Add rows: Category, Cutoff Marks" },
      { key: "previousYearCutoff",  label: "Previous Year Comparison", type: "textarea",      placeholder: "2024: General 68, 2023: General 65…" },
      { key: "cutoffPdfUrl",        label: "Official Cutoff PDF URL",  type: "url",           placeholder: "https://…/cutoff.pdf" },
    ],
  },

  "previous-papers": {
    label: "Previous Papers",
    icon: "📄",
    description: "Year-wise previous question papers",
    fields: [
      { key: "papers",         label: "Previous Papers",  type: "paper-list", required: true, hint: "Add year, paper name, and PDF/link URL" },
      { key: "totalPapers",    label: "Total Papers Available", type: "number" },
      { key: "solutionsAvailable", label: "Solutions Available?", type: "boolean" },
      { key: "instructions",   label: "Usage Instructions",     type: "textarea", placeholder: "How to use, copyright notes…" },
    ],
  },

  "mock-test": {
    label: "Mock Test",
    icon: "🧪",
    description: "Free / paid mock test series",
    fields: [
      { key: "testUrl",       label: "Mock Test Portal URL",   type: "url",      required: true, placeholder: "https://…/mock-test" },
      { key: "totalTests",    label: "Total Tests Available",  type: "number",   placeholder: "e.g. 50" },
      { key: "freeTests",     label: "Free Tests Count",       type: "number" },
      { key: "isPaid",        label: "Paid Tests Available?",  type: "boolean" },
      { key: "testPattern",   label: "Test Pattern",           type: "textarea", placeholder: "Duration, questions, marking scheme…" },
      { key: "topics",        label: "Topics Covered",         type: "textarea", placeholder: "Quantitative, Reasoning, English…" },
    ],
  },

  "study-material": {
    label: "Study Material",
    icon: "🗂️",
    description: "Notes, PDFs, and study resources",
    fields: [
      { key: "materialUrl",   label: "Primary Material URL",   type: "url",      placeholder: "https://…/notes.pdf" },
      { key: "subjects",      label: "Subjects Covered",       type: "subject-list", hint: "Add subject + resource URL" },
      { key: "format",        label: "Format",                 type: "select",
        options: [{ value: "pdf", label: "PDF" }, { value: "video", label: "Video" }, { value: "both", label: "PDF + Video" }] },
      { key: "isFree",        label: "Free Resource?",         type: "boolean" },
      { key: "description",   label: "Description",            type: "textarea", placeholder: "What's included, quality, coverage…" },
    ],
  },

  books: {
    label: "Books",
    icon: "📖",
    description: "Recommended books and PDF downloads",
    fields: [
      { key: "bookList",      label: "Book List",              type: "subject-list", hint: "Book name + author + buy/download URL" },
      { key: "description",   label: "Why These Books?",       type: "textarea", placeholder: "Recommendations and rationale…" },
    ],
  },
};
