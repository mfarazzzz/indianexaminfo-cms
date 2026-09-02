/**
 * tabAI.ts — Tab-scoped AI generation for the entrance exam editor.
 *
 * Each function generates data for ONE specific tab only.
 * Never touches other tabs' data. Reuses generateWithGemini from client.ts.
 *
 * Level 2 of the 3-level AI system:
 *   Level 1 = Full page (entranceExamAI.ts — existing, enhanced)
 *   Level 2 = Tab-level (this file)
 *   Level 3 = Module-level (moduleAI.ts — existing)
 */
import { generateWithGemini } from "./client";
import { validateAndFixDate, INDIAN_DATE_PROMPT_RULES } from "@/lib/utils/indianDateParser";

function cleanJSON(raw: string): unknown {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  // Strip trailing text after JSON
  const lastBrace = s.lastIndexOf("}");
  const lastBracket = s.lastIndexOf("]");
  const lastClose = Math.max(lastBrace, lastBracket);
  if (lastClose > 0 && lastClose < s.length - 1) {
    s = s.slice(0, lastClose + 1);
  }
  try {
    return JSON.parse(s);
  } catch {
    // Try to find valid JSON object or array
    const match = s.match(/^[\[{][\s\S]*[\]}]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI returned invalid response. Try again.");
  }
}

// ── Identity Tab ────────────────────────────────────────────────────────────

export interface IdentityAIData {
  shortName: string;
  conductingBody: string;
  officialWebsite: string;
}

export async function aiFillIdentityTab(
  examName: string,
  rawContent: string,
  apiKey: string,
  model?: string
): Promise<IdentityAIData> {
  const hasRaw = rawContent && rawContent.trim().length > 10;
  const prompt = hasRaw
    ? `Extract identity information for the entrance exam "${examName}" from the following raw data.

RAW DATA:
---
${rawContent.slice(0, 8000)}
---

Return ONLY a valid JSON object:
{
  "shortName": "short abbreviation (e.g. CAT, JEE, NEET) — extract from data",
  "conductingBody": "full name of the organization conducting this exam — extract from data",
  "officialWebsite": "official website URL — extract from data"
}

Return ONLY the JSON. No markdown, no explanation.`
    : `Generate identity information for the entrance exam "${examName}". Use your knowledge to provide accurate data.

Return ONLY a valid JSON object:
{
  "shortName": "short abbreviation (e.g. CAT, JEE, NEET)",
  "conductingBody": "full official name of the organization conducting this exam",
  "officialWebsite": "official website URL"
}

Return ONLY the JSON. No markdown, no explanation.`;

  const raw = await generateWithGemini(prompt, apiKey, model);
  const data = cleanJSON(raw) as any;
  return {
    shortName: data.shortName ?? "",
    conductingBody: data.conductingBody ?? "",
    officialWebsite: data.officialWebsite ?? "",
  };
}

// ── Dates & Status Tab ──────────────────────────────────────────────────────

export interface DatesAIData {
  importantDates: {
    label: string;
    date: string;
    isUrgent: boolean;
    type: string;
    stage_label: string;
    state: 'confirmed' | 'expected';
    verified: boolean;
  }[];
  status: string;
  vacancy: number | null;
  notificationDate: string;
}

export async function aiFillDatesTab(
  examName: string,
  year: number,
  rawContent: string,
  apiKey: string,
  model?: string
): Promise<DatesAIData> {
  const prompt = `Extract ALL dates, status, and vacancy for the entrance exam "${examName}" ${year} from this raw data.

RAW DATA:
---
${rawContent.slice(0, 8000)}
---
${INDIAN_DATE_PROMPT_RULES}

DATE EXTRACTION INSTRUCTIONS:
- Extract EVERY date from the text and convert to YYYY-MM-DD.
- MAP these phrases to standard labels:
  - "Registration Starts/Opens/begins/Start of submission" → "Registration Opens"
  - "Registration Ends/Closes/Last date for submission" → "Registration Closes"
  - "Last date for fee payment" → "Registration Closes" (same deadline)
  - "Test Day/Exam Date/Date of Examination" → "Exam Date"
  - "Admit Card/Hall Ticket/Download Admit Card" → "Admit Card Release"
  - "Result/Scorecard/Declaration of Result" → "Result Declaration"
  - "Notification/Bulletin released" → "Notification Release"
  - "Correction/Edit application/Online corrections" → "Application Correction Window"
- For date ranges like "15.06.2026 to 18.06.2026", use the START date.
- SEARCH the entire text for an "Important Dates" section — extract ALL dates from it.
- DO NOT leave dates empty if they exist in the raw data!

Return ONLY valid JSON:
{
  "importantDates": [
    {"label": "Notification Release", "date": "YYYY-MM-DD or empty string", "isUrgent": false},
    {"label": "Registration Opens", "date": "YYYY-MM-DD or empty string", "isUrgent": true},
    {"label": "Registration Closes", "date": "YYYY-MM-DD or empty string", "isUrgent": true},
    {"label": "Application Correction Window", "date": "YYYY-MM-DD or empty string", "isUrgent": false},
    {"label": "Admit Card Release", "date": "YYYY-MM-DD or empty string", "isUrgent": false},
    {"label": "Exam Date", "date": "YYYY-MM-DD or empty string", "isUrgent": true},
    {"label": "Answer Key Release", "date": "YYYY-MM-DD or empty string", "isUrgent": false},
    {"label": "Result Declaration", "date": "YYYY-MM-DD or empty string", "isUrgent": false},
    {"label": "Counselling Starts", "date": "YYYY-MM-DD or empty string", "isUrgent": false},
    {"label": "Cutoff Release", "date": "YYYY-MM-DD or empty string", "isUrgent": false}
  ],
  "status": "upcoming|registration-open|registration-closed|admit-card-released|exam-conducted|answer-key-released|result-declared|completed",
  "vacancy": number or null,
  "notificationDate": "YYYY-MM-DD or empty string"
}

Return ONLY the JSON.`;

  const raw = await generateWithGemini(prompt, apiKey, model);
  const data = cleanJSON(raw) as any;

  // Deterministic label → type map. These labels are the hardcoded ones in the
  // prompt above — no AI needed to infer the type, it's a lookup.
  const LABEL_TO_TYPE: Record<string, { type: string; stage_label: string }> = {
    "Notification Release":          { type: 'notification',       stage_label: '' },
    "Registration Opens":            { type: 'application_start',  stage_label: '' },
    "Registration Closes":           { type: 'application_end',    stage_label: '' },
    "Application Correction Window": { type: 'correction_window',  stage_label: '' },
    "Admit Card Release":            { type: 'admit_card',         stage_label: '' },
    "Exam Date":                     { type: 'exam_written',       stage_label: '' },
    "Answer Key Release":            { type: 'answer_key',         stage_label: '' },
    "Result Declaration":            { type: 'result',             stage_label: '' },
    "Counselling Starts":            { type: 'counselling',        stage_label: '' },
    "Cutoff Release":                { type: 'result',             stage_label: '' },
  };

  // Tentative signal — label or source text implies date is not confirmed
  const TENTATIVE = /tentative|expected|approximate|provisional|likely|tba|to be announced/i;

  // Post-process: validate dates, add type/state/verified
  const importantDates = Array.isArray(data.importantDates)
    ? data.importantDates.map((d: any) => {
        const label = d.label ?? "";
        const typeInfo = LABEL_TO_TYPE[label] ?? { type: 'other', stage_label: '' };
        const state = TENTATIVE.test(label) ? 'expected' : 'confirmed';
        return {
          label,
          date:        validateAndFixDate(d.date ?? ""),
          isUrgent:    d.isUrgent ?? false,
          type:        typeInfo.type,
          stage_label: typeInfo.stage_label,
          state,
          verified:    false,   // AI-extracted — never pre-verified
        };
      })
    : [];

  return {
    importantDates,
    status: data.status ?? "upcoming",
    vacancy: data.vacancy ?? null,
    notificationDate: validateAndFixDate(data.notificationDate ?? ""),
  };
}

// ── SEO Tab ─────────────────────────────────────────────────────────────────

export interface SEOAIData {
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  faqs: { question: string; answer: string }[];
}

export async function aiFillSEOTab(
  examName: string,
  year: number,
  rawContent: string,
  apiKey: string,
  model?: string
): Promise<SEOAIData> {
  const prompt = `Generate SEO data for the entrance exam "${examName}" ${year}.
${rawContent ? `\nContext from raw data:\n---\n${rawContent.slice(0, 6000)}\n---` : ""}

Return ONLY valid JSON:
{
  "seoTitle": "Max 60 chars — include exam name + year + main benefit (e.g. 'CAT 2026 Notification, Eligibility & Apply')",
  "seoDescription": "Max 160 chars — compelling meta description for Google Discover, mention key info students need",
  "tags": ["8-10 relevant tags for discovery — exam name, abbreviation, category, conducting body, year, exam type"],
  "faqs": [
    {"question": "What is ${examName} ${year}?", "answer": "Detailed 2-3 sentence answer about what this exam is, who conducts it, and its purpose"},
    {"question": "What is the eligibility for ${examName} ${year}?", "answer": "State the educational qualification, percentage, and category-wise requirements"},
    {"question": "What is the exam pattern of ${examName}?", "answer": "Describe mode (online/offline), duration, total marks, sections"},
    {"question": "What is the application fee for ${examName} ${year}?", "answer": "State exact fee amounts for different categories"},
    {"question": "How to apply for ${examName} ${year}?", "answer": "Summarize the registration/application process in 2-3 sentences"},
    {"question": "What is the selection process for ${examName} ${year}?", "answer": "Describe stages: exam, shortlisting, interview/GD, final selection"},
    {"question": "Is there negative marking in ${examName}?", "answer": "Describe the marking scheme including any negative marking"},
    {"question": "Which colleges/organizations accept ${examName} score?", "answer": "List top institutes or categories of institutes accepting this score"}
  ]
}

RULES:
- SEO title MUST be under 60 characters
- SEO description MUST be under 160 characters  
- Generate exactly 8 FAQs — each answer MUST contain specific verifiable data (exact numbers, names, percentages)
- Do NOT generate generic answers like "Check official website" or "Visit the portal"
- Use real data from the raw content where available
Return ONLY the JSON.`;

  const raw = await generateWithGemini(prompt, apiKey, model);
  const data = cleanJSON(raw) as any;
  return {
    seoTitle: data.seoTitle ?? "",
    seoDescription: data.seoDescription ?? "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    faqs: Array.isArray(data.faqs) ? data.faqs : [],
  };
}

// ── News Tab ────────────────────────────────────────────────────────────────

export interface NewsItemAI {
  title: string;
  content: string;
  excerpt: string;
  tags: string[];
  isFeatured: boolean;
}

export async function aiFillNewsTab(
  examName: string,
  year: number,
  rawContent: string,
  apiKey: string,
  model?: string
): Promise<NewsItemAI[]> {
  const prompt = `Extract or generate news updates for the entrance exam "${examName}" ${year} from this raw data.

RAW DATA:
---
${rawContent.slice(0, 8000)}
---

Return ONLY valid JSON — an array of news items:
[
  {
    "title": "News headline (concise, factual)",
    "content": "<p>Full news content in HTML</p>",
    "excerpt": "1-2 sentence summary of the news",
    "tags": ["relevant", "tags"],
    "isFeatured": false
  }
]

Generate 2-4 news items based on the raw data. If specific news is not available, generate general exam updates.
Return ONLY the JSON array.`;

  const raw = await generateWithGemini(prompt, apiKey, model);
  const data = cleanJSON(raw) as any;
  return Array.isArray(data) ? data : [];
}

// ── Modules Tab (all content modules at once) ─────────────────────────────

export interface ModulesAIData {
  contentModules: Record<string, unknown>;
  enabledModules: string[];
}

export async function aiFillModulesTab(
  examName: string,
  year: number,
  rawContent: string,
  apiKey: string,
  model?: string
): Promise<ModulesAIData> {
  const prompt = `Generate all content module data for the entrance exam "${examName}" ${year}.
${rawContent ? `\nRAW DATA:\n---\n${rawContent.slice(0, 8000)}\n---` : ""}

Return ONLY valid JSON with content for each module that you have data for:
{
  "enabledModules": ["list", "of", "module", "slugs", "that", "have", "content"],
  "contentModules": {
    "overview": {
      "summary": "1-2 line summary",
      "body": "<html overview content>"
    },
    "eligibility": {
      "qualification": "educational qualification",
      "ageLimit": "age limit",
      "nationality": "nationality",
      "attempts": "attempts allowed",
      "additionalCriteria": "<html>"
    },
    "application-process": {
      "description": "<html process overview>",
      "steps": [{"title": "Step 1", "description": "details"}],
      "applyLink": "url",
      "fee": "<html fee details>"
    },
    "exam-pattern": {
      "mode": "Online CBT",
      "duration": "duration",
      "totalMarks": 0,
      "markingScheme": "+X/-Y",
      "sections": [{"name": "Section", "questions": 0, "marks": 0}],
      "notes": "<html>"
    },
    "syllabus": {
      "subjects": [{"name": "Subject", "topics": "<html topics>"}],
      "downloadLink": "",
      "notes": "<html>"
    },
    "admit-card": {
      "releaseDate": "",
      "downloadLink": "",
      "body": "<html instructions>",
      "documents": "documents list"
    },
    "result": {
      "declarationDate": "",
      "checkLink": "",
      "body": "<html result details>",
      "statistics": "statistics"
    },
    "cut-off": {
      "body": "<html cutoff details>",
      "categories": [{"category": "General", "cutoff": "score", "year": "${year - 1}"}],
      "notes": "<html>"
    },
    "counselling": {
      "body": "<html counselling overview>",
      "officialLink": "",
      "rounds": [{"name": "Round 1", "date": "", "description": "details"}],
      "documents": "<html documents list>"
    }
  }
}

RULES:
- Only include modules where you have real or well-informed data
- List included module slugs in enabledModules array
- Do NOT create modules not in the list above
- Fill with real data from raw content where available
Return ONLY the JSON.`;

  const raw = await generateWithGemini(prompt, apiKey, model);
  const data = cleanJSON(raw) as any;
  return {
    contentModules: data.contentModules ?? {},
    enabledModules: Array.isArray(data.enabledModules) ? data.enabledModules : [],
  };
}
