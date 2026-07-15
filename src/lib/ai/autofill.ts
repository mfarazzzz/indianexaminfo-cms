/**
 * autofill.ts — AI form auto-fill using Gemini 2.0 Flash Lite.
 * 
 * Model: gemini-2.0-flash-lite — cheapest, fastest, still capable of structured extraction.
 * Optimization: minimal prompts, JSON mode, no redundant instructions.
 */

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const API_KEY = "AQ.Ab8RN6I9bRCWOFc3I4QD8dchWElKH__mctesC02kt0FDzifi8Q";

async function callGemini(prompt: string): Promise<Record<string, unknown>> {
  // Retry once after 3s on rate limit (429)
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.05, maxOutputTokens: 4096, responseMimeType: "application/json" },
      }),
    });

    if (res.status === 429 && attempt === 0) {
      // Rate limited — wait 3 seconds and retry once
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }

    if (!res.ok) {
      const err = await res.text();
      console.error("[AI] API error:", res.status, err.slice(0, 300));
      if (res.status === 429) throw new Error("Rate limited. Please wait 30 seconds and try again.");
      throw new Error(`API error ${res.status}: ${err.slice(0, 150)}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message ?? "Gemini error");

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) throw new Error("Empty AI response");

    try { return JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) try { return JSON.parse(m[0]); } catch {}
      console.error("[AI] Parse failed:", text.slice(0, 300));
      throw new Error("AI response was not valid JSON");
    }
  }
  throw new Error("Rate limited after retry. Wait 30 seconds.");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAM AUTO-FILL — Compact prompt, maximum extraction
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ExamAutoFillResult { [key: string]: unknown }

export async function autoFillExam(rawText: string): Promise<ExamAutoFillResult> {
  return callGemini(`Extract Indian exam/recruitment data from this text into JSON.

Rules: dates=YYYY-MM-DD. pillar: sarkari-naukri|entrance-exam|board-university. entityType: recruitment|exam|board|university. status: upcoming|active|registration-open|registration-closed|result-declared|completed|ongoing. examMode: online|offline|hybrid. Only include fields with actual data found.

JSON schema:
{"name":"","shortName":"","slug":"url-slug","pillar":"","entityType":"","conductingBody":"","officialWebsite":"","status":"","vacancy":0,"eligibility":{"age":"","qualification":"","nationality":""},"applicationFee":{"general":0,"obc":0,"sc":0,"st":0,"ews":0,"pwd":0},"selectionProcess":[],"syllabusHighlights":[],"dates":[{"label":"","date":"","isUrgent":false}],"tags":[],"searchKeywords":[],"seoTitle":"<60chars","seoDescription":"<160chars","faqs":[{"question":"","answer":""}],"hasNotification":false,"hasApplication":false,"hasAdmitCard":false,"hasResult":false,"hasAnswerKey":false,"hasSyllabus":false,"hasCutoff":false,"hasDateSheet":false,"hasMockTest":false,"hasPreviousPapers":false,"hasStudyMaterial":false,"typeFields":{"examDuration":"","totalMarks":0,"totalQuestions":0,"negativeMarking":"","examMode":"","examMedium":"","numberOfAttempts":"","registrationOpen":"","registrationClose":"","examWindowStart":"","examWindowEnd":"","acceptedBy":"","department":"","postName":"","jobLocation":"","payScale":"","groupLevel":"","lastDateApply":"","feeLastDate":"","notificationDate":"","examDate":"","reservationPolicy":"","boardName":"","className":"","stream":"","examSession":"","universityName":"","programName":"","degreeType":"","courseDuration":"","admissionBasis":"","totalSeats":0}}

Text:
${rawText}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTENT POST AUTO-FILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ContentPostAutoFillResult { [key: string]: unknown }

export async function autoFillContentPost(rawText: string): Promise<ContentPostAutoFillResult> {
  return callGemini(`Extract content post data from this Indian exam text into JSON.

Rules: dates=YYYY-MM-DD. contentType: notification|application|admit-card|date-sheet|syllabus|answer-key|result|cutoff|previous-papers|mock-test|study-material|books. Only include fields with actual data.

JSON schema:
{"title":"","slug":"url-slug","excerpt":"<200chars","content":"<p>HTML content</p>","contentType":"","importantDates":[{"label":"","date":"","isUrgent":false}],"quickLinks":[{"label":"","url":"","isPDF":false,"isOfficial":true}],"tags":[],"seoTitle":"<60chars","seoDescription":"<160chars","faqs":[{"question":"","answer":""}],"contentTypeData":{}}

For contentTypeData include relevant fields:
notification: notificationPdfUrl,applyLink,vacancyCount,eligibilitySummary
application: applicationStartDate,applicationEndDate,applyOnlineUrl,fees:{general,obc,sc,st},howToApply
admit-card: admitCardReleaseDate,examDate,admitCardUrl,credentialsRequired
result: resultDeclaredDate,resultUrl,scoreCardUrl,nextSteps
answer-key: keyType(provisional/final),answerKeyUrl,challengeStartDate,challengeEndDate
syllabus: syllabusYear,syllabusUrl,subjects:[{name,url}]
cutoff: cutoffYear,cutoffType,categoryWiseCutoff:[{category,marks}]

Text:
${rawText}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOG POST AUTO-FILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BlogAutoFillResult { [key: string]: unknown }

export async function autoFillBlogPost(rawText: string): Promise<BlogAutoFillResult> {
  return callGemini(`Create a blog post from this text for an Indian education portal. Write 500+ word HTML content.

Rules: section: education-news|exam-prep|career-guidance|scholarship|study-abroad|edtech|student-life|opinion. postType: news|article|guide|listicle|opinion|interview|analysis|how-to.

JSON schema:
{"title":"","slug":"url-slug","excerpt":"<200chars","content":"<h2>...</h2><p>...</p> full HTML article 500+ words","section":"","postType":"","tags":[],"seoTitle":"<60chars","seoDescription":"<160chars","faqs":[{"question":"","answer":""}]}

Text:
${rawText}`);
}
