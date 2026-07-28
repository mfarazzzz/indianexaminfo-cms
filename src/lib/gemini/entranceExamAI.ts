/**
 * entranceExamAI.ts — AI-powered content generation for entrance exams.
 * 
 * Two-stage approach:
 *   Stage 1: Small AI call extracts structured facts (dates, fees, eligibility, identity)
 *   Stage 2: Main AI call generates rich content (FAQs, SEO, modules) using Stage 1 facts
 *
 * This ensures dates/fees are extracted accurately (focused prompt) while
 * content generation gets full creative freedom.
 */
import { generateWithGemini } from "./client";

export interface AIExamData {
  shortName: string;
  conductingBody: string;
  officialWebsite: string;
  importantDates: { label: string; date: string; isUrgent: boolean }[];
  vacancy: number | null;
  status: string;
  hasNotification: boolean;
  hasApplication: boolean;
  hasAdmitCard: boolean;
  hasSyllabus: boolean;
  hasAnswerKey: boolean;
  hasResult: boolean;
  hasCutoff: boolean;
  hasCounselling: boolean;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  faqs: { question: string; answer: string }[];
  contentModules: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 1: Extract structured facts (dates, fees, eligibility, identity)
// Small focused prompt — high accuracy, low token usage (~3K total)
// ═══════════════════════════════════════════════════════════════════════════════

const STAGE1_PROMPT = (examName: string, year: number, rawContent: string) => `Extract structured facts from this text about "${examName}" ${year}.

TEXT:
${rawContent.slice(0, 5000)}

Return ONLY this JSON (no markdown):
{
  "shortName": "abbreviation like CAT/JEE/NEET",
  "conductingBody": "organization name",
  "officialWebsite": "URL",
  "dates": [
    {"label": "event name as written", "dateText": "date as written in text"}
  ],
  "fee": {"general": number_or_null, "scSt": number_or_null},
  "eligibility": {"qualification": "requirement text", "percentage": "50% or 45% etc"},
  "vacancy": null,
  "status": "upcoming"
}

RULES:
- For dates: copy the EXACT label and EXACT date text as they appear. Do NOT reformat.
- For fee: extract exact numbers (2700, 1350 etc). null if not found.
- For eligibility: copy the requirement sentence.
- Include EVERY date mentioned in the text.`;

interface Stage1Result {
  shortName: string;
  conductingBody: string;
  officialWebsite: string;
  dates: { label: string; dateText: string }[];
  fee: { general: number | null; scSt: number | null } | null;
  eligibility: { qualification: string; percentage: string } | null;
  vacancy: number | null;
  status: string;
}

async function runStage1(
  examName: string,
  year: number,
  rawContent: string,
  apiKey: string,
  model?: string
): Promise<Stage1Result> {
  const raw = await generateWithGemini(STAGE1_PROMPT(examName, year, rawContent), apiKey, model);
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > 0) cleaned = cleaned.slice(0, lastBrace + 1);

  try {
    const data = JSON.parse(cleaned);
    return {
      shortName: data.shortName ?? "",
      conductingBody: data.conductingBody ?? "",
      officialWebsite: data.officialWebsite ?? "",
      dates: Array.isArray(data.dates) ? data.dates : [],
      fee: data.fee ?? null,
      eligibility: data.eligibility ?? null,
      vacancy: data.vacancy ?? null,
      status: data.status ?? "upcoming",
    };
  } catch {
    return { shortName: "", conductingBody: "", officialWebsite: "", dates: [], fee: null, eligibility: null, vacancy: null, status: "upcoming" };
  }
}

// ── Date text → YYYY-MM-DD conversion (deterministic code) ─────────────────

const MONTH_MAP: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06",
  jul: "07", july: "07", aug: "08", august: "08", sep: "09", september: "09",
  oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
};

function parseDateText(text: string, defaultYear: number): string {
  if (!text) return "";
  const t = text.trim();

  // "Aug 3, 2026" / "August 3, 2026" / "AUG 03, 2026"
  let m = t.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (m && MONTH_MAP[m[1].toLowerCase()]) {
    return `${m[3]}-${MONTH_MAP[m[1].toLowerCase()]}-${m[2].padStart(2, "0")}`;
  }

  // "3 Aug 2026" / "03 August 2026"
  m = t.match(/(\d{1,2})\s+([A-Za-z]+),?\s*(\d{4})/);
  if (m && MONTH_MAP[m[2].toLowerCase()]) {
    return `${m[3]}-${MONTH_MAP[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  }

  // "03-08-2026" or "03/08/2026"
  m = t.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // "2026-08-03" (already ISO)
  m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // "First week of January 2027"
  m = t.match(/first\s+week\s+of\s+([A-Za-z]+)\s+(\d{4})/i);
  if (m && MONTH_MAP[m[1].toLowerCase()]) {
    return `${m[2]}-${MONTH_MAP[m[1].toLowerCase()]}-07`;
  }

  // "January 2027" (month + year only)
  m = t.match(/([A-Za-z]+)\s+(\d{4})/);
  if (m && MONTH_MAP[m[1].toLowerCase()]) {
    return `${m[2]}-${MONTH_MAP[m[1].toLowerCase()]}-15`;
  }

  return "";
}

// ── Label normalization ────────────────────────────────────────────────────

function normalizeLabel(rawLabel: string): { label: string; isUrgent: boolean } | null {
  const l = rawLabel.toLowerCase().trim();

  if (/registration\s*(open|start|begin|window\s*open)/i.test(l)) return { label: "Registration Opens", isUrgent: true };
  if (/registration\s*(close|end|deadline)|last\s*date/i.test(l)) return { label: "Registration Closes", isUrgent: true };
  if (/exam\s*date|test\s*day|test\s*date|date\s*of\s*exam/i.test(l)) return { label: "Exam Date", isUrgent: true };
  if (/admit\s*card|hall\s*ticket/i.test(l)) return { label: "Admit Card Release", isUrgent: false };
  if (/result|score\s*card|declaration/i.test(l)) return { label: "Result Declaration", isUrgent: false };
  if (/notification|bulletin|advertisement/i.test(l)) return { label: "Notification Release", isUrgent: false };
  if (/correction|edit\s*application|modify/i.test(l)) return { label: "Application Correction Window", isUrgent: false };
  if (/answer\s*key|objection/i.test(l)) return { label: "Answer Key Release", isUrgent: false };
  if (/counsel/i.test(l)) return { label: "Counselling Starts", isUrgent: false };
  if (/cut\s*off/i.test(l)) return { label: "Cutoff Release", isUrgent: false };
  if (/score\s*validity/i.test(l)) return null; // not a date we track

  return null;
}

function processStage1Dates(stage1Dates: { label: string; dateText: string }[], year: number): { label: string; date: string; isUrgent: boolean }[] {
  const results: { label: string; date: string; isUrgent: boolean }[] = [];

  for (const { label, dateText } of stage1Dates) {
    const normalized = normalizeLabel(label);
    if (!normalized) continue;

    const date = parseDateText(dateText, year);
    if (!date) continue;

    if (!results.find((r) => r.label === normalized.label)) {
      results.push({ label: normalized.label, date, isUrgent: normalized.isUrgent });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 2: Generate rich content (FAQs, SEO, modules)
// Uses Stage 1 facts as context for accurate content generation
// ═══════════════════════════════════════════════════════════════════════════════

const STAGE2_PROMPT = (examName: string, year: number, rawContent: string, facts: Stage1Result) => `Generate SEO content and modules for "${examName}" ${year}.

VERIFIED FACTS (use these exactly):
- Conducting Body: ${facts.conductingBody}
- Website: ${facts.officialWebsite}
- Fee: General ₹${facts.fee?.general || "N/A"}, SC/ST ₹${facts.fee?.scSt || "N/A"}
- Eligibility: ${facts.eligibility?.qualification || "N/A"} (${facts.eligibility?.percentage || "N/A"})

RAW CONTEXT:
${rawContent.slice(0, 3500)}

Return ONLY valid JSON:
{"seoTitle":"under 60 chars with exam name+year","seoDescription":"under 160 chars for Google Discover","tags":["10-12 tags"],"faqs":[{"question":"Q about ${examName} ${year}","answer":"2-3 sentence detailed answer using real data above"}],"contentModules":{"overview":{"summary":"1-2 line summary","body":"<h3>About</h3><p>overview using facts above</p>"},"eligibility":{"qualification":"${facts.eligibility?.qualification || ""}","ageLimit":"No upper age limit","nationality":"Indian citizens","attempts":"No limit","additionalCriteria":"<p>Additional criteria from data</p>"},"application-process":{"description":"<p>Process overview</p>","steps":[{"title":"Step","description":"detail"}],"applyLink":"${facts.officialWebsite}","fee":"<p>General: ₹${facts.fee?.general || 0}, SC/ST/PwBD: ₹${facts.fee?.scSt || 0}</p>"},"exam-pattern":{"mode":"Computer Based Test","duration":"","totalMarks":0,"markingScheme":"","sections":[],"notes":""},"syllabus":{"subjects":[],"notes":""},"admit-card":{"releaseDate":"","downloadLink":"${facts.officialWebsite}","body":"<p>How to download</p>","documents":""},"result":{"declarationDate":"","checkLink":"${facts.officialWebsite}","body":"<p>How to check result</p>","statistics":""}}}

RULES:
- Generate 15 FAQs with REAL detailed answers (not "answer").
- Use the VERIFIED FACTS in your content. 
- seoTitle must be under 60 chars.
- Include 5-7 steps in application-process.
- All HTML content should be detailed, not placeholder text.`;

// ═══════════════════════════════════════════════════════════════════════════════
// NO-RAW-DATA PROMPT (generates from exam name knowledge only)
// ═══════════════════════════════════════════════════════════════════════════════

const GENERATE_PROMPT = (examName: string, year: number) => `Generate complete data for entrance exam "${examName}" ${year}. Return ONLY valid JSON:
{"shortName":"abbreviation","conductingBody":"org","officialWebsite":"url","importantDates":[{"label":"Notification Release","date":"${year}-MM-DD","isUrgent":false},{"label":"Registration Opens","date":"${year}-MM-DD","isUrgent":true},{"label":"Registration Closes","date":"${year}-MM-DD","isUrgent":true},{"label":"Application Correction Window","date":"","isUrgent":false},{"label":"Admit Card Release","date":"${year}-MM-DD","isUrgent":false},{"label":"Exam Date","date":"${year}-MM-DD","isUrgent":true},{"label":"Answer Key Release","date":"","isUrgent":false},{"label":"Result Declaration","date":"${year+1}-MM-DD","isUrgent":false},{"label":"Counselling Starts","date":"","isUrgent":false},{"label":"Cutoff Release","date":"","isUrgent":false}],"vacancy":null,"status":"upcoming","hasNotification":true,"hasApplication":true,"hasAdmitCard":true,"hasSyllabus":true,"hasAnswerKey":true,"hasResult":true,"hasCutoff":true,"hasCounselling":false,"seoTitle":"under 60 chars","seoDescription":"under 160 chars","tags":["10+ tags"],"faqs":[{"question":"What is ${examName} ${year}?","answer":"detailed real answer"},{"question":"When is ${examName} ${year} exam date?","answer":"real answer"},{"question":"How to apply for ${examName} ${year}?","answer":"real answer"},{"question":"What is eligibility for ${examName} ${year}?","answer":"real answer"},{"question":"What is exam pattern?","answer":"real answer"},{"question":"What is syllabus?","answer":"real answer"},{"question":"What is application fee?","answer":"real answer"},{"question":"How to download admit card?","answer":"real answer"},{"question":"When will result be declared?","answer":"real answer"},{"question":"What is cutoff?","answer":"real answer"},{"question":"How many attempts allowed?","answer":"real answer"},{"question":"What is selection process?","answer":"real answer"},{"question":"Is there negative marking?","answer":"real answer"},{"question":"Which colleges accept score?","answer":"real answer"},{"question":"What is counselling process?","answer":"real answer"}],"contentModules":{}}
Use REAL data based on your knowledge. All dates YYYY-MM-DD format.`;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT: Two-stage generation
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateExamDataWithAI(
  examName: string,
  year: number,
  apiKey: string,
  model?: string,
  rawContent?: string
): Promise<AIExamData> {

  if (!rawContent || rawContent.trim().length < 50) {
    // No raw data — single AI call from knowledge
    const raw = await generateWithGemini(GENERATE_PROMPT(examName, year), apiKey, model);
    return parseAIResponse(raw);
  }

  // ── STAGE 1: Extract facts (small, focused call) ──
  const facts = await runStage1(examName, year, rawContent, apiKey, model);

  // Convert extracted date texts to YYYY-MM-DD using deterministic code
  const importantDates = processStage1Dates(facts.dates, year);

  // ── STAGE 2: Generate rich content using facts ──
  let seoTitle = "";
  let seoDescription = "";
  let tags: string[] = [];
  let faqs: { question: string; answer: string }[] = [];
  let contentModules: Record<string, unknown> = {};

  try {
    const raw = await generateWithGemini(STAGE2_PROMPT(examName, year, rawContent, facts), apiKey, model);
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace > 0) cleaned = cleaned.slice(0, lastBrace + 1);

    const data = JSON.parse(cleaned);
    seoTitle = data.seoTitle ?? "";
    seoDescription = data.seoDescription ?? "";
    tags = Array.isArray(data.tags) ? data.tags : [];
    faqs = Array.isArray(data.faqs) ? data.faqs : [];
    contentModules = data.contentModules ?? {};
  } catch {
    // Stage 2 failed — still return Stage 1 facts
  }

  return {
    shortName: facts.shortName,
    conductingBody: facts.conductingBody,
    officialWebsite: facts.officialWebsite,
    importantDates,
    vacancy: facts.vacancy,
    status: facts.status,
    hasNotification: true,
    hasApplication: true,
    hasAdmitCard: importantDates.some((d) => d.label === "Admit Card Release"),
    hasSyllabus: true,
    hasAnswerKey: true,
    hasResult: importantDates.some((d) => d.label === "Result Declaration"),
    hasCutoff: true,
    hasCounselling: true,
    seoTitle,
    seoDescription,
    tags,
    faqs,
    contentModules,
  };
}

// ── Response parser for single-call mode ───────────────────────────────────

function parseAIResponse(raw: string): AIExamData {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > 0 && lastBrace < cleaned.length - 1) cleaned = cleaned.slice(0, lastBrace + 1);

  try {
    const data = JSON.parse(cleaned);
    return {
      shortName: data.shortName ?? "",
      conductingBody: data.conductingBody ?? "",
      officialWebsite: data.officialWebsite ?? "",
      importantDates: Array.isArray(data.importantDates) ? data.importantDates : [],
      vacancy: data.vacancy ?? null,
      status: data.status ?? "upcoming",
      hasNotification: data.hasNotification ?? true,
      hasApplication: data.hasApplication ?? true,
      hasAdmitCard: data.hasAdmitCard ?? true,
      hasSyllabus: data.hasSyllabus ?? true,
      hasAnswerKey: data.hasAnswerKey ?? true,
      hasResult: data.hasResult ?? true,
      hasCutoff: data.hasCutoff ?? true,
      hasCounselling: data.hasCounselling ?? false,
      seoTitle: data.seoTitle ?? "",
      seoDescription: data.seoDescription ?? "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      faqs: Array.isArray(data.faqs) ? data.faqs : [],
      contentModules: data.contentModules ?? {},
    };
  } catch {
    throw new Error("AI returned invalid JSON. Try again.");
  }
}
