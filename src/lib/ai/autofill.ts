/**
 * autofill.ts — AI form auto-fill.
 *
 * KEY FEATURE: If you paste JSON directly (from ChatGPT/Perplexity/Claude),
 * it skips the API call entirely and fills forms instantly. No tokens used.
 *
 * Only calls the model when you paste raw text (not JSON).
 *
 * There is no key here, and there never was a good reason for one: the model
 * call goes to the `ai-fill` Edge Function, which holds the key as a server-side
 * secret. See src/lib/ai/aiFillClient.ts.
 */
import { validateAndFixDate, INDIAN_DATE_PROMPT_RULES } from "@/lib/utils/indianDateParser";
import { generateText } from "@/lib/ai/aiFillClient";

// ── Try to parse input as JSON directly (no API call needed) ─────────────────

function tryDirectParse(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  // Check if it starts with { or is wrapped in ```json blocks
  let jsonStr = trimmed;
  if (!jsonStr.startsWith("{")) {
    const match = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (match) jsonStr = match[1];
    else return null;
  }
  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      // Looks like valid structured data — skip API
      return parsed;
    }
  } catch {}
  return null;
}

// ── Model call (only for raw text, not JSON) ─────────────────────────────────

async function callAI(prompt: string, consumer = "autofill"): Promise<Record<string, unknown>> {
  const text = await generateText(prompt, consumer, true);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        /* fall through to the message below */
      }
    }
    throw new Error("AI response was not valid JSON. Try pasting JSON directly.");
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATE POST-PROCESSING — validates and fixes all dates from AI/JSON input
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Known date field keys in the AI response that need validation */
const DATE_FIELD_KEYS = [
  "registrationOpen", "registrationClose", "examWindowStart", "examWindowEnd",
  "lastDateApply", "feeLastDate", "notificationDate", "examDate", "resultDate",
  "admitCardDate", "answerKeyDate", "counsellingDate", "cutoffDate",
  "releaseDate", "declarationDate", "applicationStartDate", "applicationEndDate",
  "lastDateFeePayment", "admitCardReleaseDate", "answerKeyReleaseDate", "resultDeclaredDate",
];

/**
 * Post-process AI response to validate/fix ALL date fields.
 * Handles:
 * - Top-level date strings (e.g., result.notificationDate)
 * - dates/importantDates arrays with {date: "..."} objects
 * - typeFields object with date keys
 * - Nested objects recursively
 */
function postProcessDates(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };

  // Fix top-level date fields
  for (const key of DATE_FIELD_KEYS) {
    if (typeof result[key] === "string" && result[key]) {
      result[key] = validateAndFixDate(result[key] as string);
    }
  }

  // Fix dates array (importantDates or dates)
  for (const arrayKey of ["dates", "importantDates"]) {
    if (Array.isArray(result[arrayKey])) {
      result[arrayKey] = (result[arrayKey] as any[]).map((d: any) => {
        if (d && typeof d.date === "string") {
          return { ...d, date: validateAndFixDate(d.date) };
        }
        return d;
      });
    }
  }

  // Fix typeFields
  if (result.typeFields && typeof result.typeFields === "object") {
    const tf = { ...(result.typeFields as Record<string, unknown>) };
    for (const key of DATE_FIELD_KEYS) {
      if (typeof tf[key] === "string" && tf[key]) {
        tf[key] = validateAndFixDate(tf[key] as string);
      }
    }
    result.typeFields = tf;
  }

  // Fix contentModules date fields (admit-card.releaseDate, result.declarationDate, etc.)
  if (result.contentModules && typeof result.contentModules === "object") {
    const modules = { ...(result.contentModules as Record<string, any>) };
    for (const [slug, mod] of Object.entries(modules)) {
      if (mod && typeof mod === "object") {
        const fixedMod = { ...mod };
        for (const key of DATE_FIELD_KEYS) {
          if (typeof fixedMod[key] === "string" && fixedMod[key]) {
            fixedMod[key] = validateAndFixDate(fixedMod[key]);
          }
        }
        modules[slug] = fixedMod;
      }
    }
    result.contentModules = modules;
  }

  return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAM AUTO-FILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ExamAutoFillResult { [key: string]: unknown }

export async function autoFillExam(rawText: string): Promise<ExamAutoFillResult> {
  // If user pasted JSON directly (from ChatGPT/Perplexity), use it without API call
  const direct = tryDirectParse(rawText);
  if (direct) return postProcessDates(direct);

  // Otherwise call AI to extract from raw text with comprehensive prompt
  const result = await callAI(`You are an expert at extracting structured data from Indian exam/recruitment notifications. Extract ALL possible information from the given text and return comprehensive JSON.

CRITICAL RULES:
1. Dates must be in YYYY-MM-DD format
2. pillar MUST be one of: "sarkari-naukri" | "entrance-exam" | "board-university"
3. entityType MUST be one of: "recruitment" | "exam" | "board" | "university"
4. status MUST be one of: "upcoming" | "active" | "registration-open" | "registration-closed" | "result-declared" | "completed" | "ongoing"
5. Generate 6-8 high-quality FAQs — each answer MUST contain specific verifiable data (exact numbers, dates, fees, percentages). Do NOT write generic answers like "check official website".
6. Set ALL boolean flags (hasNotification, hasApplication, etc.) to true if the exam logically has those resources
7. Fill ALL type-specific fields based on the exam type (entrance exam fields for entrance exams, recruitment fields for jobs, etc.)
8. officialWebsite MUST be a valid URL — infer from conducting body if not directly stated
9. Fill selectionProcess with all stages (e.g. ["Written Exam", "Interview", "Document Verification"])
10. Fill tags with 8-10 relevant tags
12. Fill searchKeywords with 8-12 keywords students would search for
13. seoTitle must be under 60 chars, seoDescription under 160 chars — both must include exam name and year
14. For entrance exams: fill examDuration, totalMarks, totalQuestions, negativeMarking, examMode, examMedium, numberOfAttempts, acceptedBy
15. For recruitment: fill department, postName, jobLocation, payScale, groupLevel, lastDateApply, notificationDate, examDate
16. dates array must include ALL key dates found in the text — mark upcoming ones isUrgent:true. Leave dates EMPTY if not found in text.
${INDIAN_DATE_PROMPT_RULES}

COMPLETE JSON SCHEMA (fill every field possible):
{
  "name": "Full Exam Name with Year",
  "shortName": "ABBREVIATION YEAR",
  "slug": "exam-name-year",
  "pillar": "entrance-exam|sarkari-naukri|board-university",
  "categorySlug": "management|engineering|medical|law|banking|railways|defence|teaching|central-government-jobs|state-government-jobs|cbse|state-boards|university-exams|defence-entrance|design|agriculture|research-fellowships|university-entrance",
  "entityType": "exam|recruitment|board|university",
  "conductingBody": "Organization that conducts",
  "officialWebsite": "https://...",
  "status": "upcoming|active|registration-open|...",
  "vacancy": 0,
  "eligibility": {
    "age": "Min-Max years as on date",
    "qualification": "Education requirement",
    "nationality": "Indian"
  },
  "applicationFee": {
    "general": 0, "obc": 0, "sc": 0, "st": 0, "ews": 0, "pwd": 0
  },
  "selectionProcess": ["Stage 1", "Stage 2", "..."],
  "dates": [
    {"label": "Notification Date", "date": "YYYY-MM-DD", "isUrgent": false},
    {"label": "Application Start", "date": "YYYY-MM-DD", "isUrgent": true},
    {"label": "Application End", "date": "YYYY-MM-DD", "isUrgent": true},
    {"label": "Admit Card Release", "date": "YYYY-MM-DD", "isUrgent": false},
    {"label": "Exam Date", "date": "YYYY-MM-DD", "isUrgent": true},
    {"label": "Result Date", "date": "YYYY-MM-DD", "isUrgent": false}
  ],
  "tags": ["tag1", "tag2", "...8-12 tags"],
  "searchKeywords": ["keyword1", "keyword2", "...10-15 keywords"],
  "seoTitle": "SEO title under 60 chars with exam name and year",
  "seoDescription": "Meta description under 160 chars covering key info",
  "faqs": [
    {"question": "What is [exam]?", "answer": "Detailed answer..."},
    {"question": "...", "answer": "..."}
  ],
  "hasNotification": true,
  "hasApplication": true,
  "hasAdmitCard": true,
  "hasResult": true,
  "hasAnswerKey": true,
  "hasSyllabus": true,
  "hasCutoff": true,
  "hasDateSheet": false,
  "hasMockTest": true,
  "hasPreviousPapers": true,
  "hasStudyMaterial": true,
  "typeFields": {
    "examDuration": "e.g. 3 hours",
    "totalMarks": 0,
    "totalQuestions": 0,
    "negativeMarking": "e.g. -1/3 per wrong answer",
    "examMode": "online|offline|hybrid",
    "examMedium": "e.g. English, Hindi",
    "numberOfAttempts": "e.g. No limit",
    "registrationOpen": "YYYY-MM-DD",
    "registrationClose": "YYYY-MM-DD",
    "examWindowStart": "YYYY-MM-DD",
    "examWindowEnd": "YYYY-MM-DD",
    "acceptedBy": "Colleges/organizations that accept score",
    "department": "For recruitment",
    "postName": "For recruitment",
    "jobLocation": "For recruitment",
    "payScale": "For recruitment",
    "groupLevel": "For recruitment: Group A/B/C",
    "lastDateApply": "YYYY-MM-DD",
    "feeLastDate": "YYYY-MM-DD",
    "notificationDate": "YYYY-MM-DD",
    "examDate": "YYYY-MM-DD"
  }
}

IMPORTANT: Generate 6-8 high-quality FAQs. Each FAQ answer must be 2-3 sentences with SPECIFIC data (exact numbers, names, percentages extracted from the text). Do NOT generate generic answers. Quality over quantity.

Text to extract from:
${rawText}`, "autofill-exam");

  return postProcessDates(result);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTENT POST AUTO-FILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ContentPostAutoFillResult { [key: string]: unknown }

export async function autoFillContentPost(rawText: string): Promise<ContentPostAutoFillResult> {
  const direct = tryDirectParse(rawText);
  if (direct) return postProcessDates(direct);

  const result = await callAI(`You are an expert at extracting content post data from Indian exam notifications. Return comprehensive JSON.

RULES:
1. dates=YYYY-MM-DD
2. contentType MUST be one of: notification|application|admit-card|date-sheet|syllabus|answer-key|result|cutoff|previous-papers|mock-test|study-material|books
3. Generate 5-7 high-quality FAQs with specific verifiable data in each answer
4. Content should be full HTML with paragraphs, headings, lists
5. quickLinks should include official notification PDF, application link, and other relevant URLs
6. Each FAQ answer must contain exact data from the text (fees, dates, names, percentages)
${INDIAN_DATE_PROMPT_RULES}

SCHEMA:
{
  "title": "Descriptive title with exam name and year",
  "slug": "url-friendly-slug",
  "excerpt": "2-3 sentence summary",
  "content": "<h2>Overview</h2><p>...</p><h2>Key Details</h2><ul><li>...</li></ul>...",
  "contentType": "notification|application|...",
  "importantDates": [
    {"label": "Date Name", "date": "YYYY-MM-DD", "isUrgent": true}
  ],
  "quickLinks": [
    {"label": "Official Notification PDF", "url": "https://...", "isPDF": true, "isOfficial": true},
    {"label": "Apply Online", "url": "https://...", "isPDF": false, "isOfficial": true}
  ],
  "tags": ["tag1", "tag2", "...8-10 tags"],
  "seoTitle": "SEO title under 60 chars",
  "seoDescription": "Meta description under 160 chars",
  "faqs": [
    {"question": "...", "answer": "Answer with specific data from text (exact numbers, dates, names)"}
  ],
  "contentTypeData": {}
}

Text: ${rawText}`, "autofill-content-post");

  return postProcessDates(result);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOG POST AUTO-FILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BlogAutoFillResult { [key: string]: unknown }

export async function autoFillBlogPost(rawText: string): Promise<BlogAutoFillResult> {
  const direct = tryDirectParse(rawText);
  if (direct) return direct;

  return callAI(`Create a comprehensive blog post from this text for an Indian education portal. Return JSON only.

RULES:
1. section MUST be one of: education-news|exam-prep|career-guidance|scholarship|study-abroad|edtech|student-life|opinion
2. postType MUST be one of: news|article|guide|listicle|opinion
3. Content must be 600+ words in proper HTML with H2/H3 headings, paragraphs, bullet lists
4. Generate 5-7 high-quality FAQs — each answer must contain specific facts from the text
5. Include relevant tags (8-10) and SEO metadata

SCHEMA:
{
  "title": "Engaging blog title",
  "slug": "url-friendly-slug",
  "excerpt": "2-3 sentence compelling excerpt",
  "content": "<h2>...</h2><p>600+ words comprehensive HTML article</p>",
  "section": "education-news|exam-prep|...",
  "postType": "news|article|guide|...",
  "tags": ["tag1", "tag2", "...8-10 tags"],
  "seoTitle": "SEO title under 60 chars",
  "seoDescription": "Meta description under 160 chars",
  "faqs": [
    {"question": "...", "answer": "Answer with specific data (numbers, names, dates)"}
  ]
}

Text: ${rawText}`, "autofill-blog-post");
}
