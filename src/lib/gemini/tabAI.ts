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

function cleanJSON(raw: string): unknown {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(s);
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
  const prompt = `Extract identity information for the entrance exam "${examName}" from the following raw data.

RAW DATA:
---
${rawContent.slice(0, 4000)}
---

Return ONLY a valid JSON object:
{
  "shortName": "short abbreviation (e.g. CAT, JEE, NEET) — extract from data or infer",
  "conductingBody": "full name of the organization conducting this exam",
  "officialWebsite": "official website URL — extract if present, else best guess"
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
  importantDates: { label: string; date: string; isUrgent: boolean }[];
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
${rawContent.slice(0, 4000)}
---

CRITICAL DATE EXTRACTION:
- Convert ALL date formats to YYYY-MM-DD.
- "1 Aug 2026" → "${year}-08-01", "29 Nov 2026" → "${year}-11-29"
- "Registration: 1 Aug - 15 Sep" → two separate dates
- NEVER skip a date that is clearly mentioned

Return ONLY valid JSON:
{
  "importantDates": [
    {"label": "Notification Release", "date": "${year}-MM-DD or empty string", "isUrgent": false},
    {"label": "Registration Opens", "date": "${year}-MM-DD or empty string", "isUrgent": true},
    {"label": "Registration Closes", "date": "${year}-MM-DD or empty string", "isUrgent": true},
    {"label": "Application Correction Window", "date": "${year}-MM-DD or empty string", "isUrgent": false},
    {"label": "Admit Card Release", "date": "${year}-MM-DD or empty string", "isUrgent": false},
    {"label": "Exam Date", "date": "${year}-MM-DD or empty string", "isUrgent": true},
    {"label": "Answer Key Release", "date": "${year}-MM-DD or empty string", "isUrgent": false},
    {"label": "Result Declaration", "date": "${year + 1}-MM-DD or empty string", "isUrgent": false},
    {"label": "Counselling Starts", "date": "empty string", "isUrgent": false},
    {"label": "Cutoff Release", "date": "empty string", "isUrgent": false}
  ],
  "status": "upcoming|registration-open|registration-closed|admit-card-released|exam-conducted|answer-key-released|result-declared|completed",
  "vacancy": number or null,
  "notificationDate": "YYYY-MM-DD or empty string"
}

Return ONLY the JSON.`;

  const raw = await generateWithGemini(prompt, apiKey, model);
  const data = cleanJSON(raw) as any;
  return {
    importantDates: Array.isArray(data.importantDates) ? data.importantDates : [],
    status: data.status ?? "upcoming",
    vacancy: data.vacancy ?? null,
    notificationDate: data.notificationDate ?? "",
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
${rawContent ? `\nContext from raw data:\n---\n${rawContent.slice(0, 3000)}\n---` : ""}

Return ONLY valid JSON:
{
  "seoTitle": "Max 60 chars — include exam name + year + main benefit (e.g. 'CAT 2026 Notification, Eligibility & Apply')",
  "seoDescription": "Max 160 chars — compelling meta description for Google Discover, mention key info students need",
  "tags": ["10-12 relevant tags for discovery — exam name, abbreviation, category, conducting body, year, exam type"],
  "faqs": [
    {"question": "What is ${examName} ${year}?", "answer": "Detailed 2-3 sentence answer"},
    {"question": "When is ${examName} ${year} exam date?", "answer": "answer"},
    {"question": "How to apply for ${examName} ${year}?", "answer": "answer"},
    {"question": "What is the eligibility for ${examName} ${year}?", "answer": "answer"},
    {"question": "What is the exam pattern of ${examName}?", "answer": "answer"},
    {"question": "What is the syllabus of ${examName}?", "answer": "answer"},
    {"question": "What is the application fee for ${examName} ${year}?", "answer": "answer"},
    {"question": "How to download ${examName} ${year} admit card?", "answer": "answer"},
    {"question": "When will ${examName} ${year} result be declared?", "answer": "answer"},
    {"question": "What is the cutoff for ${examName} ${year}?", "answer": "answer"},
    {"question": "How many attempts are allowed in ${examName}?", "answer": "answer"},
    {"question": "Is there negative marking in ${examName}?", "answer": "answer"},
    {"question": "Which colleges accept ${examName} score?", "answer": "answer"},
    {"question": "What is the selection process for ${examName} ${year}?", "answer": "answer"},
    {"question": "What is the counselling process for ${examName}?", "answer": "answer"}
  ]
}

RULES:
- SEO title MUST be under 60 characters
- SEO description MUST be under 160 characters  
- Generate exactly 15 FAQs — mix of informational and how-to questions
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
${rawContent.slice(0, 4000)}
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
${rawContent ? `\nRAW DATA:\n---\n${rawContent.slice(0, 4000)}\n---` : ""}

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
