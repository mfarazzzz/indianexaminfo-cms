/**
 * autofill.ts — AI-powered form auto-fill using Google Gemini.
 *
 * Takes raw text (copied from notification PDFs, websites, etc.)
 * and extracts structured data to fill all form fields automatically.
 */

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
const API_KEY = "AQ.Ab8RN6I9bRCWOFc3I4QD8dchWElKH__mctesC02kt0FDzifi8Q";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} — ${errText}`);
  }

  const data: GeminiResponse = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text;
}

function extractJSON(text: string): Record<string, unknown> {
  // Try to find JSON in the response (might be wrapped in ```json blocks)
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};
  const jsonStr = jsonMatch[1] || jsonMatch[0];
  try {
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAM AUTO-FILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ExamAutoFillResult {
  name?: string;
  shortName?: string;
  slug?: string;
  pillar?: string;
  entityType?: string;
  conductingBody?: string;
  officialWebsite?: string;
  status?: string;
  vacancy?: number;
  eligibility?: { age: string; qualification: string; nationality: string };
  applicationFee?: Record<string, number>;
  selectionProcess?: string[];
  syllabusHighlights?: string[];
  dates?: { label: string; date: string; isUrgent: boolean }[];
  tags?: string[];
  searchKeywords?: string[];
  seoTitle?: string;
  seoDescription?: string;
  faqs?: { question: string; answer: string }[];
}

const EXAM_PROMPT = `You are an expert at extracting structured data from Indian government exam notifications.

Given the following raw text about an exam/recruitment, extract ALL available information into this EXACT JSON format.
Use only information present in the text. Leave fields empty string or null if not found.
Dates must be in YYYY-MM-DD format.
For pillar: use "sarkari-naukri" for govt jobs, "entrance-exam" for entrance exams, "board-university" for board/university.
For entityType: use "recruitment" for govt jobs, "exam" for entrance exams, "board" for board exams, "university" for university.
For status: use "upcoming", "active", "registration-open", "registration-closed", "result-declared", "completed", or "ongoing".
For examMode: use "online", "offline", or "hybrid".

Return ONLY valid JSON, no explanation:

{
  "name": "Full official exam name with year",
  "shortName": "Common abbreviation",
  "slug": "url-safe-slug-lowercase",
  "pillar": "sarkari-naukri or entrance-exam or board-university",
  "entityType": "recruitment or exam or board or university",
  "conductingBody": "Organization conducting the exam",
  "officialWebsite": "https://...",
  "status": "upcoming/active/registration-open/etc",
  "vacancy": null or number,
  "eligibility": { "age": "e.g. 18-30 years", "qualification": "e.g. Graduation", "nationality": "Indian" },
  "applicationFee": { "general": 0, "obc": 0, "sc": 0, "st": 0, "ews": 0, "pwd": 0 },
  "selectionProcess": ["Stage 1", "Stage 2"],
  "syllabusHighlights": ["Subject 1", "Subject 2"],
  "dates": [{ "label": "Event Name", "date": "YYYY-MM-DD", "isUrgent": false }],
  "tags": ["tag1", "tag2"],
  "searchKeywords": ["keyword1", "keyword2"],
  "seoTitle": "SEO optimized title under 60 chars",
  "seoDescription": "Meta description under 160 chars",
  "faqs": [{ "question": "Q?", "answer": "A." }],
  "hasNotification": true,
  "hasApplication": true,
  "hasAdmitCard": true,
  "hasResult": true,
  "hasAnswerKey": true,
  "hasSyllabus": true,
  "hasCutoff": true,

  "typeFields": {
    "examDuration": "e.g. 3 hours 20 minutes",
    "totalMarks": 720,
    "totalQuestions": 200,
    "negativeMarking": "e.g. -1 for each wrong answer",
    "examMode": "online or offline or hybrid",
    "examMedium": "English, Hindi",
    "numberOfAttempts": "e.g. No limit",
    "examFrequency": "annual or biannual or monthly or irregular",
    "registrationOpen": "YYYY-MM-DD",
    "registrationClose": "YYYY-MM-DD",
    "examWindowStart": "YYYY-MM-DD",
    "examWindowEnd": "YYYY-MM-DD",
    "resultExpected": "YYYY-MM-DD",
    "acceptedBy": "e.g. IITs, NITs, IIITs, GFTIs",
    "department": "Ministry/Department (for recruitment)",
    "postName": "Post name(s) (for recruitment)",
    "totalPosts": 4500,
    "jobLocation": "All India / State",
    "payScale": "Pay scale (for recruitment)",
    "groupLevel": "group-a or group-b or group-c or group-d",
    "lastDateApply": "YYYY-MM-DD",
    "feeLastDate": "YYYY-MM-DD",
    "correctionWindow": "YYYY-MM-DD",
    "examDate": "YYYY-MM-DD",
    "notificationDate": "YYYY-MM-DD",
    "reservationPolicy": "OBC 27%, SC 15%, ST 7.5%, EWS 10%",
    "boardName": "e.g. CBSE (for board)",
    "className": "e.g. Class 12 (for board)",
    "stream": "science or commerce or arts or all",
    "examSession": "e.g. March 2026",
    "universityName": "University name (for university)",
    "programName": "e.g. B.Tech (for university)",
    "degreeType": "ug or pg or diploma or phd",
    "courseDuration": "e.g. 4 years",
    "admissionBasis": "e.g. CUET Score",
    "totalSeats": 500,
    "admissionOpen": "YYYY-MM-DD",
    "admissionClose": "YYYY-MM-DD"
  }
}

Include ONLY typeFields relevant to the detected entityType. Leave irrelevant ones as empty string.

RAW TEXT:
`;

export async function autoFillExam(rawText: string): Promise<ExamAutoFillResult> {
  const response = await callGemini(EXAM_PROMPT + rawText);
  return extractJSON(response) as ExamAutoFillResult;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTENT POST AUTO-FILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ContentPostAutoFillResult {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  contentType?: string;
  importantDates?: { label: string; date: string; isUrgent: boolean }[];
  quickLinks?: { label: string; url: string; isPDF: boolean; isOfficial: boolean }[];
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  faqs?: { question: string; answer: string }[];
  contentTypeData?: Record<string, unknown>;
}

const CONTENT_POST_PROMPT = `You are an expert at extracting structured data from Indian exam content (notifications, admit cards, results, etc).

Given the raw text, extract information for a content post. Determine the content type from:
notification, application, admit-card, date-sheet, syllabus, answer-key, result, cutoff, previous-papers, mock-test, study-material, books

Return ONLY valid JSON:

{
  "title": "Post title",
  "slug": "url-safe-slug",
  "excerpt": "Brief summary under 200 chars",
  "content": "HTML formatted content with paragraphs, headings, lists",
  "contentType": "notification/application/admit-card/etc",
  "importantDates": [{ "label": "Event", "date": "YYYY-MM-DD", "isUrgent": false }],
  "quickLinks": [{ "label": "Link text", "url": "https://...", "isPDF": false, "isOfficial": true }],
  "tags": ["tag1", "tag2"],
  "seoTitle": "SEO title under 60 chars",
  "seoDescription": "Meta description under 160 chars",
  "faqs": [{ "question": "Q?", "answer": "A." }],
  "contentTypeData": {}
}

For contentTypeData, include relevant fields based on content type:
- notification: notificationPdfUrl, applyLink, vacancyCount, eligibilitySummary
- application: applicationStartDate, applicationEndDate, applyOnlineUrl, fees, howToApply
- admit-card: admitCardReleaseDate, examDate, admitCardUrl, credentialsRequired
- result: resultDeclaredDate, resultUrl, scoreCardUrl, nextSteps
- answer-key: keyType, answerKeyUrl, challengeStartDate, challengeEndDate
- syllabus: syllabusYear, syllabusUrl, subjects
- cutoff: cutoffYear, cutoffType, categoryWiseCutoff

RAW TEXT:
`;

export async function autoFillContentPost(rawText: string): Promise<ContentPostAutoFillResult> {
  const response = await callGemini(CONTENT_POST_PROMPT + rawText);
  return extractJSON(response) as ContentPostAutoFillResult;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOG POST AUTO-FILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BlogAutoFillResult {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  section?: string;
  postType?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  faqs?: { question: string; answer: string }[];
}

const BLOG_PROMPT = `You are an expert content writer for Indian education news and exam preparation.

Given the raw text, create a complete blog post. Choose section from:
education-news, exam-prep, career-guidance, scholarship, study-abroad, edtech, student-life, opinion

Choose postType from: news, article, guide, listicle, opinion, interview, analysis, how-to

Return ONLY valid JSON:

{
  "title": "Engaging blog title",
  "slug": "url-safe-slug",
  "excerpt": "Brief summary under 200 chars",
  "content": "Full HTML blog content with <h2>, <h3>, <p>, <ul>, <li>, <strong> tags. Write 500+ words.",
  "section": "education-news/exam-prep/career-guidance/etc",
  "postType": "news/article/guide/etc",
  "tags": ["tag1", "tag2", "tag3"],
  "seoTitle": "SEO optimized title under 60 chars",
  "seoDescription": "Meta description under 160 chars for search engines",
  "faqs": [{ "question": "Q?", "answer": "A." }]
}

RAW TEXT:
`;

export async function autoFillBlogPost(rawText: string): Promise<BlogAutoFillResult> {
  const response = await callGemini(BLOG_PROMPT + rawText);
  return extractJSON(response) as BlogAutoFillResult;
}
