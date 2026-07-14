/**
 * examTypeFields.ts
 *
 * Defines which fields appear on each tab based on the selected entityType.
 * The Exam Editor reads from this registry to progressively reveal only
 * the fields relevant to the current content being managed.
 *
 * Adding a new entity type = add a key here. Zero component changes.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "url"
  | "date"
  | "number"
  | "boolean"
  | "select"
  | "comma-list"; // comma-separated → string[]

export interface DynamicFieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
  /** Which tab this field appears in: general | dates | eligibility */
  tab: "general" | "dates" | "eligibility";
  /** Display order within the tab section */
  order?: number;
  /** Section heading (groups fields visually) */
  section?: string;
}

export interface EntityTypeConfig {
  label: string;
  description: string;
  /** Extra fields shown in the General tab for this type */
  fields: DynamicFieldDef[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENTITY TYPE CONFIGURATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ENTITY_TYPE_CONFIGS: Record<string, EntityTypeConfig> = {

  // ─── Government Recruitment (SSC, IBPS, Railway, Defence, etc.) ─────────
  recruitment: {
    label: "Government Recruitment",
    description: "Sarkari Naukri — vacancies, selection process, salary",
    fields: [
      // General tab — recruitment-specific
      { key: "department",      label: "Department / Ministry", type: "text", tab: "general", placeholder: "e.g. Ministry of Finance", section: "Organization" },
      { key: "postName",        label: "Post Name(s)",          type: "text", tab: "general", placeholder: "e.g. Probationary Officer, Clerk", section: "Organization" },
      { key: "jobLocation",     label: "Job Location",          type: "text", tab: "general", placeholder: "e.g. All India / State-wise" },
      { key: "payScale",        label: "Pay Scale / Salary",    type: "text", tab: "general", placeholder: "e.g. ₹23,700 – ₹42,020 (Level 4)" },
      { key: "groupLevel",      label: "Group / Level",         type: "select", tab: "general",
        options: [
          { value: "group-a", label: "Group A" }, { value: "group-b", label: "Group B" },
          { value: "group-c", label: "Group C" }, { value: "group-d", label: "Group D" },
        ]},
      // Dates tab — recruitment-specific
      { key: "lastDateApply",   label: "Last Date to Apply",    type: "date", tab: "dates", section: "Application Window" },
      { key: "feeLastDate",     label: "Fee Payment Last Date", type: "date", tab: "dates", section: "Application Window" },
      { key: "correctionWindow",label: "Correction Window Date",type: "date", tab: "dates" },
      // Eligibility tab — recruitment-specific
      { key: "reservationPolicy", label: "Reservation Policy",  type: "textarea", tab: "eligibility", placeholder: "OBC-NCL 27%, SC 15%, ST 7.5%, EWS 10%…", section: "Reservation" },
      { key: "physicalStandard",  label: "Physical Standards",   type: "textarea", tab: "eligibility", placeholder: "Height, chest, eyesight (if applicable)…" },
      { key: "medicalFitness",    label: "Medical Fitness",      type: "textarea", tab: "eligibility", placeholder: "Medical standards required…" },
    ],
  },

  // ─── Entrance Exam (JEE, NEET, GATE, CAT, etc.) ───────────────────────
  exam: {
    label: "Entrance Exam",
    description: "Competitive entrance exam — pattern, duration, marks",
    fields: [
      // General tab — exam-specific
      { key: "examDuration",    label: "Exam Duration",         type: "text", tab: "general", placeholder: "e.g. 3 hours", section: "Exam Pattern" },
      { key: "totalMarks",      label: "Total Marks",           type: "number", tab: "general", placeholder: "e.g. 720" },
      { key: "totalQuestions",   label: "Total Questions",      type: "number", tab: "general", placeholder: "e.g. 200" },
      { key: "negativeMarking", label: "Negative Marking",      type: "text", tab: "general", placeholder: "e.g. -1 for each wrong (1/3rd deduction)" },
      { key: "examMedium",      label: "Medium / Language",     type: "text", tab: "general", placeholder: "e.g. English, Hindi, Bilingual" },
      { key: "examMode",        label: "Exam Mode",             type: "select", tab: "general",
        options: [
          { value: "online", label: "Online (CBT)" }, { value: "offline", label: "Offline (Pen & Paper)" },
          { value: "hybrid", label: "Hybrid" },
        ]},
      { key: "numberOfAttempts", label: "Max Attempts Allowed", type: "text", tab: "general", placeholder: "e.g. No limit / 3 attempts" },
      // Dates tab — entrance exam specific
      { key: "registrationOpen",  label: "Registration Opens",  type: "date", tab: "dates", section: "Registration Window" },
      { key: "registrationClose", label: "Registration Closes", type: "date", tab: "dates", section: "Registration Window" },
      { key: "examWindowStart",   label: "Exam Window Start",   type: "date", tab: "dates", section: "Exam Schedule" },
      { key: "examWindowEnd",     label: "Exam Window End",     type: "date", tab: "dates", section: "Exam Schedule" },
      // Eligibility
      { key: "acceptedBy",        label: "Score Accepted By",   type: "textarea", tab: "eligibility", placeholder: "IITs, NITs, IIITs, GFTIs…", section: "Acceptance" },
    ],
  },

  // ─── Board / School Exam (CBSE, ICSE, State Boards) ────────────────────
  board: {
    label: "Board Exam",
    description: "School board exams — class, session, subjects",
    fields: [
      { key: "boardName",       label: "Board Name",            type: "text", tab: "general", placeholder: "e.g. CBSE, ICSE, UP Board", section: "Board Details" },
      { key: "className",       label: "Class / Grade",         type: "text", tab: "general", placeholder: "e.g. Class 10, Class 12" },
      { key: "stream",          label: "Stream",                type: "select", tab: "general",
        options: [
          { value: "science", label: "Science" }, { value: "commerce", label: "Commerce" },
          { value: "arts", label: "Arts / Humanities" }, { value: "all", label: "All Streams" },
        ]},
      { key: "examSession",     label: "Exam Session",          type: "text", tab: "general", placeholder: "e.g. March 2026" },
      { key: "practicalDates",  label: "Practical Exam Dates",  type: "text", tab: "dates", placeholder: "e.g. January 2026", section: "Schedule" },
      { key: "compartmentDate", label: "Compartment Exam Date", type: "date", tab: "dates" },
    ],
  },

  // ─── University / Admission (DU, JNU, State Universities) ──────────────
  university: {
    label: "University Admission",
    description: "University programs — course, duration, admission process",
    fields: [
      { key: "universityName",  label: "University Name",       type: "text", tab: "general", placeholder: "e.g. Delhi University", section: "Institution" },
      { key: "programName",     label: "Program / Course Name", type: "text", tab: "general", placeholder: "e.g. B.Tech CSE, MBA" },
      { key: "degreeType",      label: "Degree Type",           type: "select", tab: "general",
        options: [
          { value: "ug", label: "Undergraduate (UG)" }, { value: "pg", label: "Postgraduate (PG)" },
          { value: "diploma", label: "Diploma" }, { value: "phd", label: "Ph.D" },
          { value: "certificate", label: "Certificate" },
        ]},
      { key: "courseDuration",  label: "Course Duration",       type: "text", tab: "general", placeholder: "e.g. 4 years / 2 years" },
      { key: "admissionBasis",  label: "Admission Based On",    type: "text", tab: "general", placeholder: "e.g. CUET Score / JEE Rank / Merit" },
      { key: "totalSeats",      label: "Total Seats",           type: "number", tab: "general", placeholder: "e.g. 500" },
      // Dates
      { key: "admissionOpen",   label: "Admission Portal Opens", type: "date", tab: "dates", section: "Admission Window" },
      { key: "admissionClose",  label: "Admission Portal Closes",type: "date", tab: "dates", section: "Admission Window" },
      { key: "counsellingStart",label: "Counselling Start Date", type: "date", tab: "dates", section: "Counselling" },
      // Eligibility
      { key: "entranceExam",    label: "Entrance Exam Required", type: "text", tab: "eligibility", placeholder: "e.g. CUET-UG, JEE Main", section: "Requirements" },
      { key: "minimumPercentage",label: "Minimum % Required",   type: "text", tab: "eligibility", placeholder: "e.g. 50% in 10+2" },
    ],
  },
};

/** Get config for an entity type (fallback to empty) */
export function getEntityTypeConfig(entityType: string): EntityTypeConfig {
  return ENTITY_TYPE_CONFIGS[entityType] ?? { label: entityType, description: "", fields: [] };
}

/** Get dynamic fields for a specific tab */
export function getFieldsForTab(entityType: string, tab: DynamicFieldDef["tab"]): DynamicFieldDef[] {
  const config = getEntityTypeConfig(entityType);
  return config.fields.filter((f) => f.tab === tab);
}
