/**
 * entranceExamAI.ts — AI-powered content generation for entrance exams.
 * 
 * Generates comprehensive exam data including:
 * - Important dates, eligibility, fees
 * - SEO title, description optimized for Google Discover & News
 * - FAQs targeting "People Also Ask" featured snippets
 * - Tags and keywords for organic traffic
 * - Module flags based on exam lifecycle
 */
import { generateWithGemini } from "./client";

export interface AIExamData {
  // Identity
  shortName: string;
  conductingBody: string;
  officialWebsite: string;
  // Edition data
  importantDates: { label: string; date: string; isUrgent: boolean }[];
  vacancy: number | null;
  status: string;
  // Modules
  hasNotification: boolean;
  hasApplication: boolean;
  hasAdmitCard: boolean;
  hasSyllabus: boolean;
  hasAnswerKey: boolean;
  hasResult: boolean;
  hasCutoff: boolean;
  hasCounselling: boolean;
  // SEO (optimized for Google Discover + News)
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  faqs: { question: string; answer: string }[];
}

const GENERATE_PROMPT = (examName: string, year: number) => `
You are an SEO expert for Indian education portals. Generate comprehensive data for the entrance exam "${examName}" for the year ${year}.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation, just JSON):

{
  "shortName": "short abbreviation like CAT, JEE, NEET",
  "conductingBody": "full official name of conducting organization",
  "officialWebsite": "official website URL",
  "importantDates": [
    {"label": "Notification Release", "date": "${year}-MM-DD", "isUrgent": false},
    {"label": "Registration Opens", "date": "${year}-MM-DD", "isUrgent": true},
    {"label": "Registration Closes", "date": "${year}-MM-DD", "isUrgent": true},
    {"label": "Admit Card Release", "date": "${year}-MM-DD", "isUrgent": false},
    {"label": "Exam Date", "date": "${year}-MM-DD", "isUrgent": true},
    {"label": "Result Declaration", "date": "${year + 1}-MM-DD", "isUrgent": false}
  ],
  "vacancy": null,
  "status": "upcoming",
  "hasNotification": true,
  "hasApplication": true,
  "hasAdmitCard": true,
  "hasSyllabus": true,
  "hasAnswerKey": true,
  "hasResult": true,
  "hasCutoff": true,
  "hasCounselling": true,
  "seoTitle": "60 char max title optimized for Google: include exam name, year, key action (Apply/Result/Date)",
  "seoDescription": "155 char meta description with exam name, year, key dates, and call to action. Optimized for CTR in Google Search and Discover.",
  "tags": ["tag1", "tag2", "up to 10 relevant tags for discovery"],
  "faqs": [
    {"question": "What is [exam] ${year}?", "answer": "detailed 2-3 sentence answer"},
    {"question": "When is [exam] ${year} exam date?", "answer": "specific date with context"},
    {"question": "How to apply for [exam] ${year}?", "answer": "step by step brief"},
    {"question": "What is the eligibility for [exam] ${year}?", "answer": "age, qualification, attempts"},
    {"question": "What is the exam pattern of [exam] ${year}?", "answer": "sections, marks, duration"},
    {"question": "When will [exam] ${year} result be declared?", "answer": "expected date and how to check"}
  ]
}

RULES:
- Use REAL expected dates based on historical patterns for this exam (approximate month if exact unknown).
- All dates must be in YYYY-MM-DD format.
- SEO title MUST be under 60 characters, include year.
- SEO description MUST be under 160 characters.
- FAQs should target "People Also Ask" queries that students actually search.
- Tags should include: exam abbreviation, full name, conducting body, category (MBA/Engineering/Medical), year, and related terms.
- Set vacancy to null if not applicable (entrance exams typically don't have vacancies).
- Set status to "upcoming" if exam hasn't happened yet, "registration-open" if registration is ongoing, "result-declared" if results are out.
- Set module flags (has*) based on what's typically available for this exam at this stage.

Return ONLY the JSON object. No markdown code fences, no explanation.
`;

export async function generateExamDataWithAI(
  examName: string,
  year: number,
  apiKey: string,
  model?: string
): Promise<AIExamData> {
  const prompt = GENERATE_PROMPT(examName, year);
  const raw = await generateWithGemini(prompt, apiKey, model);

  // Clean potential markdown wrapping
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

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
    };
  } catch (e) {
    throw new Error("AI returned invalid JSON. Try again.");
  }
}
