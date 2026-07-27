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
  // Content modules
  contentModules: Record<string, unknown>;
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
    {"label": "Application Correction Window", "date": "${year}-MM-DD", "isUrgent": false},
    {"label": "Admit Card Release", "date": "${year}-MM-DD", "isUrgent": false},
    {"label": "Exam Date", "date": "${year}-MM-DD", "isUrgent": true},
    {"label": "Answer Key Release", "date": "${year}-MM-DD", "isUrgent": false},
    {"label": "Result Declaration", "date": "${year + 1}-MM-DD", "isUrgent": false},
    {"label": "Counselling Starts", "date": "", "isUrgent": false},
    {"label": "Cutoff Release", "date": "", "isUrgent": false}
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
  "hasCounselling": false,
  "seoTitle": "60 char max, include exam name + year + key action",
  "seoDescription": "155 char meta description optimized for CTR",
  "tags": ["10-12 tags"],
  "faqs": [
    {"question": "What is [exam] ${year}?", "answer": "detailed answer"},
    {"question": "When is [exam] ${year} exam date?", "answer": "answer"},
    {"question": "How to apply for [exam] ${year}?", "answer": "answer"},
    {"question": "What is the eligibility for [exam] ${year}?", "answer": "answer"},
    {"question": "What is the exam pattern?", "answer": "answer"},
    {"question": "What is the syllabus?", "answer": "answer"},
    {"question": "What is the application fee?", "answer": "answer"},
    {"question": "How to download [exam] ${year} admit card?", "answer": "answer"},
    {"question": "When will result be declared?", "answer": "answer"},
    {"question": "What is the cutoff?", "answer": "answer"},
    {"question": "How many attempts allowed?", "answer": "answer"},
    {"question": "What is the selection process?", "answer": "answer"},
    {"question": "Is there negative marking?", "answer": "answer"},
    {"question": "Which colleges accept this score?", "answer": "answer"},
    {"question": "What is the counselling process?", "answer": "answer"}
  ],
  "contentModules": {
    "howToApply": {
      "title": "How to Apply for [exam] ${year}",
      "steps": [
        {"order": 1, "text": "Visit official website", "link": "url"},
        {"order": 2, "text": "Click on New Registration"},
        {"order": 3, "text": "Fill personal details"},
        {"order": 4, "text": "Upload photo and signature"},
        {"order": 5, "text": "Pay application fee"},
        {"order": 6, "text": "Submit and download confirmation"}
      ]
    },
    "howToDownloadAdmitCard": {
      "title": "How to Download [exam] ${year} Admit Card",
      "steps": [{"order": 1, "text": "Visit official website"}, {"order": 2, "text": "Login with registration number and password"}, {"order": 3, "text": "Click Download Admit Card link"}, {"order": 4, "text": "Verify details and print"}]
    },
    "howToCheckResult": {
      "title": "How to Check [exam] ${year} Result",
      "steps": [{"order": 1, "text": "Visit official website"}, {"order": 2, "text": "Login with credentials"}, {"order": 3, "text": "Click Check Result/Scorecard"}, {"order": 4, "text": "Download and save"}]
    },
    "howToDownloadAnswerKey": {
      "title": "How to Download [exam] ${year} Answer Key",
      "steps": [{"order": 1, "text": "Visit official website"}, {"order": 2, "text": "Login to candidate portal"}, {"order": 3, "text": "Click on Answer Key link"}, {"order": 4, "text": "Download PDF"}]
    },
    "howToDownloadNotification": {
      "title": "How to Download [exam] ${year} Notification",
      "steps": [{"order": 1, "text": "Visit official website"}, {"order": 2, "text": "Go to Notifications/Downloads section"}, {"order": 3, "text": "Click on Official Notification PDF"}, {"order": 4, "text": "Save and read carefully"}]
    },
    "howToFillApplication": {
      "title": "How to Fill [exam] ${year} Application Form",
      "steps": [{"order": 1, "text": "Register with email and phone"}, {"order": 2, "text": "Fill academic details"}, {"order": 3, "text": "Select exam center preferences"}, {"order": 4, "text": "Upload documents"}, {"order": 5, "text": "Review and submit"}]
    },
    "howToPayFee": {
      "title": "How to Pay [exam] ${year} Application Fee",
      "steps": [{"order": 1, "text": "Login to application portal"}, {"order": 2, "text": "Go to Fee Payment section"}, {"order": 3, "text": "Select payment mode (UPI/Card/Net Banking)"}, {"order": 4, "text": "Complete payment and save receipt"}]
    },
    "howToCorrectApplication": {
      "title": "How to Correct [exam] ${year} Application Form",
      "steps": [{"order": 1, "text": "Login during correction window"}, {"order": 2, "text": "Click Edit Application"}, {"order": 3, "text": "Make corrections in allowed fields"}, {"order": 4, "text": "Submit and pay additional fee if required"}]
    },
    "howToRecoverLogin": {
      "title": "How to Recover [exam] ${year} Login Details",
      "steps": [{"order": 1, "text": "Visit official website login page"}, {"order": 2, "text": "Click Forgot Password/Registration Number"}, {"order": 3, "text": "Enter registered email or phone"}, {"order": 4, "text": "Follow OTP verification steps"}]
    },
    "examPattern": {
      "mode": "Online CBT",
      "duration": "duration",
      "totalMarks": 0,
      "sections": [{"name": "Section", "questions": 0, "marks": 0}],
      "markingScheme": "+X/-Y"
    },
    "selectionProcess": ["step 1", "step 2"],
    "syllabus": [{"subject": "Subject", "topics": ["topic1", "topic2"]}],
    "eligibility": {
      "qualification": "details",
      "ageLimit": "details",
      "attempts": "details",
      "nationality": "Indian"
    },
    "applicationFee": {
      "general": 0, "obc": 0, "sc": 0, "st": 0,
      "paymentModes": ["Online", "UPI", "Net Banking"]
    },
    "importantLinks": [
      {"label": "Official Website", "url": "", "isOfficial": true, "type": "other"},
      {"label": "Apply Online", "url": "", "isOfficial": true, "type": "apply"}
    ],
    "highlights": ["key highlight 1", "key highlight 2"]
  }
}

RULES:
- Use REAL expected dates based on historical patterns. Leave date empty string "" if unknown.
- All known dates must be YYYY-MM-DD format.
- SEO title MUST be under 60 characters.
- SEO description MUST be under 160 characters.
- Generate exactly 15 FAQs targeting "People Also Ask" queries. Include both informational ("What is...", "When is...") and how-to ("How to apply...", "How to download...") questions.
- Content modules: fill ALL step-by-step guides with detailed 4-6 steps each.
- Exam pattern: use real data (sections, marks, duration) if known.
- Syllabus: list actual subjects and key topics.

Return ONLY the JSON object. No markdown code fences, no explanation.
`;

const GENERATE_WITH_RAW_PROMPT = (examName: string, year: number, rawContent: string) => `
You are an SEO expert for Indian education portals. I have raw unstructured data about the entrance exam "${examName}" for ${year}. Extract all information and generate structured data.

RAW DATA PROVIDED BY EDITOR:
---
${rawContent.slice(0, 6000)}
---

CRITICAL DATE EXTRACTION INSTRUCTIONS:
- Look for ANY date mentions in the raw data: "1 Aug 2026", "August 1, 2026", "01-08-2026", "01/08/2026", "1st August", etc.
- Convert ALL dates to YYYY-MM-DD format. Examples:
  - "1 Aug 2026" → "${year}-08-01"
  - "29 November 2026" → "${year}-11-29"  
  - "15 Sep 2026" → "${year}-09-15"
  - "January 2027" → "${year + 1}-01-15" (use 15 as day if only month given)
- Map dates to these standard labels: "Notification Release", "Registration Opens", "Registration Closes", "Application Correction Window", "Admit Card Release", "Exam Date", "Answer Key Release", "Result Declaration", "Counselling Starts", "Cutoff Release"
- If the raw data says "Registration: 1 Aug - 15 Sep 2026", that means Registration Opens = ${year}-08-01 and Registration Closes = ${year}-09-15
- NEVER leave a date as empty string if the raw data contains that date. Extract every single date mentioned.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation, just JSON):

{
  "shortName": "short abbreviation",
  "conductingBody": "extracted from raw data or inferred",
  "officialWebsite": "extracted URL or best guess",
  "importantDates": [
    {"label": "Notification Release", "date": "YYYY-MM-DD or empty", "isUrgent": false},
    {"label": "Registration Opens", "date": "YYYY-MM-DD or empty", "isUrgent": true},
    {"label": "Registration Closes", "date": "YYYY-MM-DD or empty", "isUrgent": true},
    {"label": "Application Correction Window", "date": "YYYY-MM-DD or empty", "isUrgent": false},
    {"label": "Admit Card Release", "date": "YYYY-MM-DD or empty", "isUrgent": false},
    {"label": "Exam Date", "date": "YYYY-MM-DD or empty", "isUrgent": true},
    {"label": "Answer Key Release", "date": "YYYY-MM-DD or empty", "isUrgent": false},
    {"label": "Result Declaration", "date": "YYYY-MM-DD or empty", "isUrgent": false},
    {"label": "Counselling Starts", "date": "YYYY-MM-DD or empty", "isUrgent": false},
    {"label": "Cutoff Release", "date": "YYYY-MM-DD or empty", "isUrgent": false}
  ],
  "vacancy": number or null,
  "status": "upcoming|registration-open|registration-closed|admit-card-released|exam-conducted|answer-key-released|result-declared|completed",
  "hasNotification": true/false,
  "hasApplication": true/false,
  "hasAdmitCard": true/false,
  "hasSyllabus": true/false,
  "hasAnswerKey": true/false,
  "hasResult": true/false,
  "hasCutoff": true/false,
  "hasCounselling": true/false,
  "seoTitle": "under 60 chars, include exam name + year + key action",
  "seoDescription": "under 160 chars, optimized for Google Discover CTR",
  "tags": ["8-12 tags for discovery"],
  "faqs": [
    {"question": "...", "answer": "2-3 sentence detailed answer based on the raw data"}
  ],
  "contentModules": {
    "howToApply": {"title": "How to Apply for ${examName} ${year}", "steps": [{"order": 1, "text": "detailed step from raw data or inferred", "link": "url if found"}]},
    "howToDownloadAdmitCard": {"title": "How to Download ${examName} ${year} Admit Card", "steps": [{"order": 1, "text": "Visit official website"}, {"order": 2, "text": "Login with registration number and password"}, {"order": 3, "text": "Click on Download Admit Card"}, {"order": 4, "text": "Verify details and print"}]},
    "howToCheckResult": {"title": "How to Check ${examName} ${year} Result", "steps": [{"order": 1, "text": "Visit official website"}, {"order": 2, "text": "Login with credentials"}, {"order": 3, "text": "Click on Check Result/Scorecard"}, {"order": 4, "text": "Download and save"}]},
    "howToDownloadAnswerKey": {"title": "How to Download ${examName} ${year} Answer Key", "steps": [{"order": 1, "text": "step"}]},
    "howToDownloadNotification": {"title": "How to Download ${examName} ${year} Notification", "steps": [{"order": 1, "text": "step"}]},
    "howToFillApplication": {"title": "How to Fill ${examName} ${year} Application Form", "steps": [{"order": 1, "text": "step"}]},
    "howToPayFee": {"title": "How to Pay ${examName} ${year} Application Fee", "steps": [{"order": 1, "text": "step"}]},
    "howToCorrectApplication": {"title": "How to Correct ${examName} ${year} Application Form", "steps": [{"order": 1, "text": "step"}]},
    "howToRecoverLogin": {"title": "How to Recover ${examName} ${year} Login Details", "steps": [{"order": 1, "text": "step"}]},
    "examPattern": {"mode": "...", "duration": "...", "totalMarks": N, "sections": [{"name":"...", "questions": N, "marks": N}], "markingScheme": "..."},
    "selectionProcess": ["step1", "step2"],
    "syllabus": [{"subject": "...", "topics": ["...", "..."]}],
    "eligibility": {"qualification": "...", "ageLimit": "...", "attempts": "...", "nationality": "..."},
    "applicationFee": {"general": N, "obc": N, "sc": N, "st": N, "paymentModes": ["..."]},
    "importantLinks": [{"label": "...", "url": "...", "isOfficial": true, "type": "apply|notification|result|other"}],
    "highlights": ["key point 1", "key point 2"]
  }
}

RULES:
- Extract REAL dates from the raw data. Convert ANY date format to YYYY-MM-DD. This is the MOST IMPORTANT rule.
- Generate 12-15 FAQs based on the raw data. Include both informational ("What is...", "When is...") and how-to ("How to apply...", "How to download...") questions targeting "People Also Ask" featured snippets.
- Fill ALL contentModules step-by-step guides with REAL detailed steps (minimum 4-6 steps each). Use information from the raw data. If specific steps not in raw data, infer logical steps based on the exam type.
- Extract fee structure, eligibility, exam pattern from raw data if present.
- Include ALL dates mentioned in raw data — never skip a date that's clearly stated.
- Set module flags based on what content exists in the raw data.
- Leave fields empty/null ONLY if information is genuinely not available anywhere in the raw data.

Return ONLY the JSON object. No markdown code fences, no explanation.
`;

export async function generateExamDataWithAI(
  examName: string,
  year: number,
  apiKey: string,
  model?: string,
  rawContent?: string
): Promise<AIExamData> {
  const prompt = rawContent
    ? GENERATE_WITH_RAW_PROMPT(examName, year, rawContent)
    : GENERATE_PROMPT(examName, year);
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
      contentModules: data.contentModules ?? {},
    };
  } catch (e) {
    throw new Error("AI returned invalid JSON. Try again.");
  }
}
