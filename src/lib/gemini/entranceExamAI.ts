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
import { parseDateText, INDIAN_DATE_PROMPT_RULES } from "@/lib/utils/indianDateParser";

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
${INDIAN_DATE_PROMPT_RULES}

ADDITIONAL RULES:
- Copy the EXACT date text as written in the source text. Do NOT reformat.
- Match each date to its CORRECT label. Read carefully which date belongs to which event.
- Include EVERY date mentioned in the text.
- For fee: extract exact numbers (2700, 1350 etc). null if not found.
- For eligibility: copy the requirement sentence.`;

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

// ── Date text → YYYY-MM-DD conversion (uses shared indianDateParser) ────────

// ── Label normalization ────────────────────────────────────────────────────

function normalizeLabel(rawLabel: string): { label: string; isUrgent: boolean } | null {
  const l = rawLabel.toLowerCase().trim();

  if (/registration\s*(open|start|begin|window\s*open)|start\s*of\s*submission|application\s*(start|open|begin)/i.test(l)) return { label: "Registration Opens", isUrgent: true };
  if (/registration\s*(close|end|deadline)|last\s*date\s*(for|of)\s*(submission|application|submitting)|application\s*(close|end|deadline)/i.test(l)) return { label: "Registration Closes", isUrgent: true };
  if (/last\s*date\s*(for|of)\s*(fee|payment)|fee\s*(deadline|last\s*date)/i.test(l)) return { label: "Registration Closes", isUrgent: true };
  if (/exam\s*date|test\s*day|test\s*date|date\s*of\s*exam/i.test(l)) return { label: "Exam Date", isUrgent: true };
  if (/admit\s*card|hall\s*ticket|download\s*admit/i.test(l)) return { label: "Admit Card Release", isUrgent: false };
  if (/result|score\s*card|declaration\s*of\s*result/i.test(l)) return { label: "Result Declaration", isUrgent: false };
  if (/notification|bulletin|advertisement/i.test(l)) return { label: "Notification Release", isUrgent: false };
  if (/correction|edit\s*application|modify|online\s*correction/i.test(l)) return { label: "Application Correction Window", isUrgent: false };
  if (/answer\s*key|objection/i.test(l)) return { label: "Answer Key Release", isUrgent: false };
  if (/counsel/i.test(l)) return { label: "Counselling Starts", isUrgent: false };
  if (/cut\s*off/i.test(l)) return { label: "Cutoff Release", isUrgent: false };
  if (/score\s*validity/i.test(l)) return null; // not a date we track

  // Fallback: if the label contains "last date" without specific context, treat as registration closes
  if (/last\s*date/i.test(l)) return { label: "Registration Closes", isUrgent: true };

  return null;
}

function processStage1Dates(stage1Dates: { label: string; dateText: string }[], year: number): { label: string; date: string; isUrgent: boolean }[] {
  const results: { label: string; date: string; isUrgent: boolean }[] = [];

  for (const { label, dateText } of stage1Dates) {
    const normalized = normalizeLabel(label);
    if (!normalized) continue;

    // parseDateText handles ranges internally (takes first date from "X to Y")
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
- Generate 6 FAQs with REAL detailed answers containing specific data (exact fees, dates, eligibility percentages). Each answer MUST be 2-3 sentences with verifiable facts.
- Use the VERIFIED FACTS in your content. 
- seoTitle must be under 60 chars.
- Include 5-7 steps in application-process.
- All HTML content should be detailed, not placeholder text.`;

// ═══════════════════════════════════════════════════════════════════════════════
// NO-RAW-DATA PROMPT (generates from exam name knowledge only)
// ═══════════════════════════════════════════════════════════════════════════════

const GENERATE_PROMPT = (examName: string, year: number) => `Generate complete data for entrance exam "${examName}" ${year}. Return ONLY valid JSON:
{"shortName":"abbreviation","conductingBody":"org","officialWebsite":"url","importantDates":[{"label":"Notification Release","date":"","isUrgent":false},{"label":"Registration Opens","date":"","isUrgent":true},{"label":"Registration Closes","date":"","isUrgent":true},{"label":"Admit Card Release","date":"","isUrgent":false},{"label":"Exam Date","date":"","isUrgent":true},{"label":"Result Declaration","date":"","isUrgent":false}],"vacancy":null,"status":"upcoming","hasNotification":true,"hasApplication":true,"hasAdmitCard":true,"hasSyllabus":true,"hasAnswerKey":true,"hasResult":true,"hasCutoff":true,"hasCounselling":false,"seoTitle":"under 60 chars","seoDescription":"under 160 chars","tags":["8-10 tags"],"faqs":[{"question":"What is ${examName} ${year}?","answer":"detailed answer with conducting body name and exam purpose"},{"question":"What is the eligibility for ${examName} ${year}?","answer":"specific qualification, percentage, age limit"},{"question":"What is the exam pattern of ${examName}?","answer":"mode, duration, total marks, sections"},{"question":"What is the application fee for ${examName} ${year}?","answer":"exact fee amounts for each category"},{"question":"How to apply for ${examName} ${year}?","answer":"step by step process"},{"question":"What is the selection process?","answer":"stages of selection"}],"contentModules":{}}
IMPORTANT: Leave all date values as EMPTY STRINGS — dates must be filled from official sources only. Use REAL data for identity, eligibility, fees, and exam pattern based on your knowledge. All answers must contain specific verifiable facts (numbers, names, percentages).`;

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
    // No raw data — generate from AI knowledge BUT mark dates as unverified/TBA
    // Google YMYL policy: never publish unverified exam dates
    const raw = await generateWithGemini(GENERATE_PROMPT(examName, year), apiKey, model);
    const result = parseAIResponse(raw);
    // Clear all dates — AI-fabricated dates are YMYL-dangerous
    // Editors MUST fill these from official sources
    result.importantDates = result.importantDates.map(d => ({
      ...d,
      date: "", // Leave blank — editor must verify from official source
    }));
    return result;
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
  } catch (err) {
    // Stage 2 failed — still return Stage 1 facts but log the failure for debugging
    console.warn("[entranceExamAI] Stage 2 (content generation) failed:", err instanceof Error ? err.message : String(err));
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
