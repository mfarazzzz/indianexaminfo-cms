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
You are an expert data extraction system for Indian education portals. Your job is to extract EVERY piece of information from the raw data below and map it into a structured JSON format.

EXAM: "${examName}" for the year ${year}

RAW DATA:
---
${rawContent.slice(0, 12000)}
---

TASK: Extract ALL information and return a comprehensive JSON object. Follow these rules STRICTLY:

═══ DATE EXTRACTION (MOST CRITICAL) ═══
Scan the ENTIRE raw data for ANY mention of dates in ANY format:
- "AUG 03, 2026" → "${year}-08-03"
- "August 3, 2026" → "${year}-08-03"
- "3 Aug 2026" → "${year}-08-03"
- "03-08-2026" → "${year}-08-03"
- "SEP 15, 2026" → "${year}-09-15"
- "November 29, 2026" → "${year}-11-29"
- "NOV 29, 2026" → "${year}-11-29"
- "Nov 04, 2026" → "${year}-11-04"
- "First week of January 2027" → "${year + 1}-01-07"
- "January 2027" → "${year + 1}-01-15"

Map date labels to these STANDARD names:
- Registration Starts/Opens/begins/window opens → "Registration Opens"
- Registration Ends/Closes/deadline/last date → "Registration Closes"  
- Test Day/Exam Date/Exam Day/Date of Exam → "Exam Date"
- Admit Card/Hall Ticket/Download begins → "Admit Card Release"
- Result/Score Card/declared/announced → "Result Declaration"
- Notification/Bulletin/Information released → "Notification Release"
- Correction/Edit/Modify application → "Application Correction Window"
- Answer Key/Objection window → "Answer Key Release"
- Counselling/Counseling/Allotment → "Counselling Starts"

═══ FEE EXTRACTION ═══
Look for: registration fee, application fee, exam fee amounts
- Map to: general (unreserved), obc, sc, st categories
- Extract payment modes mentioned

═══ ELIGIBILITY EXTRACTION ═══
Look for: degree requirements, percentage/CGPA cutoff, age limits, nationality, attempts, category-wise relaxation

═══ CONTENT MODULE GENERATION ═══
For EACH step-by-step guide, generate 5-7 DETAILED steps using information from the raw data:
- howToApply: Use actual registration process described in raw data
- howToDownloadAdmitCard: Use admit card section info
- howToCheckResult: Use result checking process
- howToPayFee: Use fee payment section info

Return ONLY this JSON (no markdown, no explanation):

{
  "shortName": "abbreviation (e.g. CAT, JEE)",
  "conductingBody": "full name of conducting organization from the data",
  "officialWebsite": "URL found in data",
  "importantDates": [
    {"label": "Notification Release", "date": "YYYY-MM-DD", "isUrgent": false},
    {"label": "Registration Opens", "date": "YYYY-MM-DD", "isUrgent": true},
    {"label": "Registration Closes", "date": "YYYY-MM-DD", "isUrgent": true},
    {"label": "Application Correction Window", "date": "", "isUrgent": false},
    {"label": "Admit Card Release", "date": "YYYY-MM-DD", "isUrgent": false},
    {"label": "Exam Date", "date": "YYYY-MM-DD", "isUrgent": true},
    {"label": "Answer Key Release", "date": "", "isUrgent": false},
    {"label": "Result Declaration", "date": "YYYY-MM-DD", "isUrgent": false},
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
  "hasCounselling": true,
  "seoTitle": "under 60 chars, exam name + year + action keyword",
  "seoDescription": "under 160 chars, compelling for Google Discover",
  "tags": ["exam-name", "abbreviation", "year", "category", "conducting-body", "admit-card", "result", "application", "eligibility", "syllabus", "cutoff"],
  "faqs": [
    {"question": "What is ${examName} ${year}?", "answer": "2-3 detailed sentences from the data"},
    {"question": "When is ${examName} ${year} exam date?", "answer": "specific date and details"},
    {"question": "How to apply for ${examName} ${year}?", "answer": "registration process summary"},
    {"question": "What is the eligibility for ${examName} ${year}?", "answer": "qualification + percentage from data"},
    {"question": "What is the application fee for ${examName} ${year}?", "answer": "fee amounts by category"},
    {"question": "What is ${examName} ${year} exam pattern?", "answer": "mode, duration, sections"},
    {"question": "How to download ${examName} ${year} admit card?", "answer": "process from data"},
    {"question": "When will ${examName} ${year} result be declared?", "answer": "expected timeline"},
    {"question": "What is the ${examName} ${year} syllabus?", "answer": "subjects overview"},
    {"question": "How many attempts are allowed in ${examName}?", "answer": "from eligibility section"},
    {"question": "What is the selection process for ${examName}?", "answer": "from data"},
    {"question": "Is there negative marking in ${examName}?", "answer": "marking scheme details"},
    {"question": "Which colleges accept ${examName} score?", "answer": "institutes from data"},
    {"question": "What documents are needed for ${examName} ${year}?", "answer": "from data"},
    {"question": "What is the reservation policy for ${examName} ${year}?", "answer": "SC/ST/OBC/EWS percentages"}
  ],
  "contentModules": {
    "overview": {
      "summary": "1-2 line summary of what this exam is",
      "body": "<h3>About ${examName}</h3><p>paragraph about the exam</p><h3>Key Highlights</h3><ul><li>highlight 1</li></ul>"
    },
    "eligibility": {
      "qualification": "exact qualification requirement from data",
      "ageLimit": "age limit or No age limit",
      "nationality": "nationality requirement",
      "attempts": "attempts info or No limit",
      "additionalCriteria": "<p>Additional criteria, relaxations for categories</p>"
    },
    "application-process": {
      "description": "<p>Overview of application process</p>",
      "steps": [{"title": "Step title", "description": "Detailed description from the data"}],
      "applyLink": "URL",
      "fee": "<p>General: ₹X, SC/ST/PwBD: ₹Y. Payment modes: ...</p>"
    },
    "exam-pattern": {
      "mode": "Online CBT / Offline",
      "duration": "total time",
      "totalMarks": 0,
      "markingScheme": "marking details",
      "sections": [{"name": "Section", "questions": 0, "marks": 0, "duration": ""}],
      "notes": "<p>Additional exam pattern notes</p>"
    },
    "syllabus": {
      "subjects": [{"name": "Subject Name", "topics": "<ul><li>topic 1</li><li>topic 2</li></ul>"}],
      "downloadLink": "",
      "notes": "<p>Preparation tips</p>"
    },
    "admit-card": {
      "releaseDate": "YYYY-MM-DD",
      "downloadLink": "URL",
      "body": "<p>Steps to download admit card, what to verify</p>",
      "documents": "List of documents to carry"
    },
    "result": {
      "declarationDate": "YYYY-MM-DD",
      "checkLink": "URL",
      "body": "<p>How to check result, scorecard details</p>",
      "statistics": ""
    },
    "cut-off": {
      "body": "<p>Cutoff information</p>",
      "categories": [{"category": "General", "cutoff": "", "year": "${year - 1}"}],
      "notes": ""
    },
    "counselling": {
      "body": "<p>Counselling process overview</p>",
      "officialLink": "",
      "rounds": [{"name": "Round 1", "date": "", "description": ""}],
      "documents": "<p>Required documents for counselling</p>"
    },
    "news": {
      "items": [{"title": "News headline", "date": "YYYY-MM-DD", "summary": "brief", "body": "<p>details</p>"}]
    },
    "howToApply": {
      "title": "How to Apply for ${examName} ${year}",
      "steps": [{"order": 1, "text": "detailed step", "link": ""}]
    },
    "howToDownloadAdmitCard": {
      "title": "How to Download ${examName} ${year} Admit Card",
      "steps": [{"order": 1, "text": "detailed step"}]
    },
    "howToCheckResult": {
      "title": "How to Check ${examName} ${year} Result",
      "steps": [{"order": 1, "text": "detailed step"}]
    },
    "howToPayFee": {
      "title": "How to Pay ${examName} ${year} Application Fee",
      "steps": [{"order": 1, "text": "detailed step"}]
    },
    "howToFillApplication": {
      "title": "How to Fill ${examName} ${year} Application Form",
      "steps": [{"order": 1, "text": "detailed step"}]
    },
    "importantLinks": [
      {"label": "Official Website", "url": "", "isOfficial": true, "type": "other"},
      {"label": "Apply Online", "url": "", "isOfficial": true, "type": "apply"},
      {"label": "Information Bulletin", "url": "", "isOfficial": true, "type": "notification"}
    ],
    "highlights": ["key highlight 1", "key highlight 2", "key highlight 3"]
  }
}

CRITICAL RULES:
1. EXTRACT every date from the raw data. If you see "AUG 03, 2026" anywhere, that MUST appear as "${year}-08-03" in importantDates.
2. ALL FAQ answers must contain REAL information from the raw data, not placeholders.
3. ALL content module text must use REAL details from the raw data.
4. Fee amounts must be EXACT numbers from the data (e.g., ₹2700, ₹1350).
5. Eligibility must quote EXACT requirements (e.g., "50% marks", "45% for SC/ST").
6. Steps must be DETAILED (5-7 steps each) using the actual process described in raw data.
7. Extract ALL URLs/links found in the raw data into importantLinks.
8. If the data mentions institutes/colleges, include them in FAQ answers.
9. Generate the overview.body as proper HTML with h3 headings and paragraphs.
10. NEVER use placeholder text like "details", "answer", "step" — always use REAL content.

Return ONLY the JSON object.`;

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
