/**
 * builtInSchemas.ts — Hardcoded field schemas for all 12 built-in modules.
 *
 * These serve as the canonical reference when the module_registry table
 * is unavailable (offline/build time) and as the seed source for the DB.
 * The DB is the source of truth at runtime; these are fallbacks.
 */
import type { ModuleDefinition } from "@/types/modules";

export const BUILT_IN_MODULES: ModuleDefinition[] = [
  {
    id: "",
    slug: "overview",
    name: "Overview",
    type: "built-in",
    icon: "file-text",
    description: "General overview and introduction to the exam",
    displayOrder: 1,
    isActive: true,
    fields: [
      { key: "summary", label: "Summary", type: "textarea", required: false, placeholder: "Brief 1-2 line summary of the exam" },
      { key: "body", label: "Body Content", type: "richtext", required: false, placeholder: "Write detailed overview..." },
    ],
  },
  {
    id: "",
    slug: "eligibility",
    name: "Eligibility",
    type: "built-in",
    icon: "user-check",
    description: "Educational qualifications and eligibility criteria",
    displayOrder: 2,
    isActive: true,
    fields: [
      { key: "qualification", label: "Educational Qualification", type: "textarea", required: false, placeholder: "e.g. Graduate with 50% marks" },
      { key: "ageLimit", label: "Age Limit", type: "text", required: false, placeholder: "e.g. No upper age limit" },
      { key: "nationality", label: "Nationality", type: "text", required: false, placeholder: "e.g. Indian / NRI / PIO" },
      { key: "attempts", label: "Attempts Allowed", type: "text", required: false, placeholder: "e.g. No limit" },
      { key: "additionalCriteria", label: "Additional Criteria", type: "richtext", required: false, placeholder: "Any other eligibility details..." },
    ],
  },
  {
    id: "",
    slug: "important-dates",
    name: "Important Dates",
    type: "built-in",
    icon: "calendar",
    description: "Key dates and deadlines for the exam cycle",
    displayOrder: 3,
    isActive: true,
    fields: [
      {
        key: "dates", label: "Dates", type: "repeater", required: false,
        subFields: [
          { key: "label", label: "Event Name", type: "text", required: true },
          { key: "date", label: "Date", type: "date", required: false },
          { key: "isUrgent", label: "Urgent/Upcoming", type: "checkbox", required: false },
        ],
      },
    ],
  },
  {
    id: "",
    slug: "application-process",
    name: "Application Process",
    type: "built-in",
    icon: "clipboard-list",
    description: "How to apply, step-by-step instructions",
    displayOrder: 4,
    isActive: true,
    fields: [
      { key: "description", label: "Process Description", type: "richtext", required: false, placeholder: "Overview of the application process..." },
      {
        key: "steps", label: "Steps", type: "repeater", required: false,
        subFields: [
          { key: "title", label: "Step Title", type: "text", required: true },
          { key: "description", label: "Description", type: "textarea", required: false },
          { key: "image", label: "Screenshot/Image", type: "image", required: false },
        ],
      },
      { key: "applyLink", label: "Apply Online Link", type: "url", required: false, placeholder: "https://..." },
      { key: "fee", label: "Application Fee Details", type: "richtext", required: false },
    ],
  },
  {
    id: "",
    slug: "exam-pattern",
    name: "Exam Pattern",
    type: "built-in",
    icon: "layout-grid",
    description: "Exam structure, sections, marks, and duration",
    displayOrder: 5,
    isActive: true,
    fields: [
      { key: "mode", label: "Exam Mode", type: "text", required: false, placeholder: "e.g. Online CBT" },
      { key: "duration", label: "Duration", type: "text", required: false, placeholder: "e.g. 3 hours" },
      { key: "totalMarks", label: "Total Marks", type: "number", required: false },
      { key: "markingScheme", label: "Marking Scheme", type: "text", required: false, placeholder: "e.g. +4 / -1" },
      {
        key: "sections", label: "Sections", type: "repeater", required: false,
        subFields: [
          { key: "name", label: "Section Name", type: "text", required: true },
          { key: "questions", label: "No. of Questions", type: "number", required: false },
          { key: "marks", label: "Marks", type: "number", required: false },
          { key: "duration", label: "Duration", type: "text", required: false },
        ],
      },
      { key: "notes", label: "Additional Notes", type: "richtext", required: false },
    ],
  },
  {
    id: "",
    slug: "syllabus",
    name: "Syllabus",
    type: "built-in",
    icon: "book-open",
    description: "Subject-wise syllabus and topics",
    displayOrder: 6,
    isActive: true,
    fields: [
      {
        key: "subjects", label: "Subjects", type: "repeater", required: false,
        subFields: [
          { key: "name", label: "Subject Name", type: "text", required: true },
          { key: "topics", label: "Topics & Content", type: "richtext", required: false },
        ],
      },
      { key: "downloadLink", label: "Syllabus PDF Link", type: "url", required: false },
      { key: "notes", label: "Preparation Notes", type: "richtext", required: false },
    ],
  },
  {
    id: "",
    slug: "faqs",
    name: "FAQs",
    type: "built-in",
    icon: "help-circle",
    description: "Frequently asked questions and answers",
    displayOrder: 7,
    isActive: true,
    fields: [
      {
        key: "items", label: "FAQ Items", type: "repeater", required: false,
        subFields: [
          { key: "question", label: "Question", type: "text", required: true },
          { key: "answer", label: "Answer", type: "richtext", required: true },
        ],
      },
    ],
  },
  {
    id: "",
    slug: "admit-card",
    name: "Admit Card",
    type: "built-in",
    icon: "id-card",
    description: "Admit card download information and instructions",
    displayOrder: 8,
    isActive: true,
    fields: [
      { key: "releaseDate", label: "Release Date", type: "date", required: false },
      { key: "downloadLink", label: "Download Link", type: "url", required: false, placeholder: "https://..." },
      { key: "body", label: "Instructions", type: "richtext", required: false, placeholder: "How to download admit card, what to check..." },
      { key: "documents", label: "Documents Required", type: "textarea", required: false, placeholder: "List documents to bring to exam center" },
    ],
  },
  {
    id: "",
    slug: "result",
    name: "Result",
    type: "built-in",
    icon: "trophy",
    description: "Result declaration details and scorecard",
    displayOrder: 9,
    isActive: true,
    fields: [
      { key: "declarationDate", label: "Declaration Date", type: "date", required: false },
      { key: "checkLink", label: "Check Result Link", type: "url", required: false, placeholder: "https://..." },
      { key: "body", label: "Result Details", type: "richtext", required: false, placeholder: "How to check result, what the scorecard contains..." },
      { key: "statistics", label: "Key Statistics", type: "textarea", required: false, placeholder: "Total appeared, qualified, pass percentage etc." },
    ],
  },
  {
    id: "",
    slug: "cut-off",
    name: "Cut-off",
    type: "built-in",
    icon: "bar-chart-2",
    description: "Category-wise cutoff marks and trends",
    displayOrder: 10,
    isActive: true,
    fields: [
      { key: "body", label: "Cutoff Details", type: "richtext", required: false, placeholder: "Category-wise cutoff marks, trends..." },
      {
        key: "categories", label: "Category Cutoffs", type: "repeater", required: false,
        subFields: [
          { key: "category", label: "Category", type: "text", required: true, placeholder: "e.g. General, OBC, SC, ST" },
          { key: "cutoff", label: "Cutoff Score", type: "text", required: false },
          { key: "year", label: "Year", type: "text", required: false },
        ],
      },
      { key: "notes", label: "Additional Notes", type: "richtext", required: false },
    ],
  },
  {
    id: "",
    slug: "counselling",
    name: "Counselling",
    type: "built-in",
    icon: "users",
    description: "Counselling process, rounds, and seat allocation",
    displayOrder: 11,
    isActive: true,
    fields: [
      { key: "body", label: "Process Description", type: "richtext", required: false, placeholder: "Overview of counselling process..." },
      { key: "officialLink", label: "Official Counselling Portal", type: "url", required: false },
      {
        key: "rounds", label: "Counselling Rounds", type: "repeater", required: false,
        subFields: [
          { key: "name", label: "Round Name", type: "text", required: true },
          { key: "date", label: "Date", type: "date", required: false },
          { key: "description", label: "Description", type: "textarea", required: false },
        ],
      },
      { key: "documents", label: "Required Documents", type: "richtext", required: false },
    ],
  },
  {
    id: "",
    slug: "news",
    name: "News & Updates",
    type: "built-in",
    icon: "newspaper",
    description: "Exam-specific news and latest updates",
    displayOrder: 12,
    isActive: true,
    fields: [
      {
        key: "items", label: "News Items", type: "repeater", required: false,
        subFields: [
          { key: "title", label: "Title", type: "text", required: true },
          { key: "date", label: "Date", type: "date", required: false },
          { key: "summary", label: "Summary", type: "textarea", required: false },
          { key: "body", label: "Full Content", type: "richtext", required: false },
          { key: "featureImage", label: "Feature Image", type: "image", required: false },
        ],
      },
    ],
  },
];

/** Quick lookup by slug */
export const BUILT_IN_MODULES_MAP = Object.fromEntries(
  BUILT_IN_MODULES.map((m) => [m.slug, m])
) as Record<string, ModuleDefinition>;
