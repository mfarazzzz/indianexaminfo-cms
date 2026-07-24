/**
 * autofill.ts — AI form auto-fill using Gemini.
 * 
 * KEY FEATURE: If you paste JSON directly (from ChatGPT/Perplexity/Claude),
 * it skips the API call entirely and fills forms instantly. No tokens used.
 * 
 * Only calls Gemini when you paste raw text (not JSON).
 * 
 * The API key is passed in from the calling component (via SettingsContext).
 * This avoids separate DB reads and RLS issues with sensitive settings.
 */

/** Module-level API key set by the consuming component before calling autofill */
let _activeKey: string = ''

/** Set the Gemini API key for autofill operations. Call this before using autofill. */
export function setAutofillApiKey(key: string): void {
  _activeKey = (key ?? '').replace(/^["']|["']$/g, '').trim()
}

/** @deprecated Use setAutofillApiKey instead */
export function clearApiKeyCache(): void {
  _activeKey = ''
}

function getApiKey(): string {
  if (!_activeKey) {
    throw new Error('Gemini API key not configured. Go to Settings → AI and enter your key.')
  }
  return _activeKey
}

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

// ── Gemini API call (only for raw text, not JSON) ────────────────────────────

async function callGemini(prompt: string): Promise<Record<string, unknown>> {
  const apiKey = getApiKey()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.05, maxOutputTokens: 4096, responseMimeType: "application/json" },
    }),
  });

  if (res.status === 429) {
    throw new Error("Rate limited by Google. Wait 60 seconds and try again. Or paste JSON directly — it works instantly without API.");
  }

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    _activeKey = '';
    const err = await res.text().catch(() => "");
    console.error("[AI] Auth error:", res.status, err.slice(0, 300));
    throw new Error(`Gemini API key error (${res.status}). Go to Settings → AI and verify your key, then try again.`);
  }

  if (!res.ok) {
    const err = await res.text();
    console.error("[AI] Error:", res.status, err.slice(0, 200));
    throw new Error(`Gemini error ${res.status}. Try pasting JSON directly instead.`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Empty AI response");

  try { return JSON.parse(text); }
  catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch {}
    throw new Error("AI response was not valid JSON. Try pasting JSON directly.");
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAM AUTO-FILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ExamAutoFillResult { [key: string]: unknown }

export async function autoFillExam(rawText: string): Promise<ExamAutoFillResult> {
  // If user pasted JSON directly (from ChatGPT/Perplexity), use it without API call
  const direct = tryDirectParse(rawText);
  if (direct) return direct;

  // Otherwise call Gemini to extract from raw text
  return callGemini(`Extract Indian exam/recruitment data from this text. Return JSON only.
Rules: dates=YYYY-MM-DD. pillar:sarkari-naukri|entrance-exam|board-university. entityType:recruitment|exam|board|university. status:upcoming|active|registration-open|registration-closed|result-declared|completed|ongoing.
Schema:{"name":"","shortName":"","slug":"","pillar":"","entityType":"","conductingBody":"","officialWebsite":"","status":"","vacancy":0,"eligibility":{"age":"","qualification":"","nationality":""},"applicationFee":{"general":0,"obc":0,"sc":0,"st":0,"ews":0,"pwd":0},"selectionProcess":[],"syllabusHighlights":[],"dates":[{"label":"","date":"","isUrgent":false}],"tags":[],"searchKeywords":[],"seoTitle":"","seoDescription":"","faqs":[{"question":"","answer":""}],"hasNotification":false,"hasApplication":false,"hasAdmitCard":false,"hasResult":false,"hasAnswerKey":false,"hasSyllabus":false,"hasCutoff":false,"hasDateSheet":false,"hasMockTest":false,"hasPreviousPapers":false,"hasStudyMaterial":false,"typeFields":{"examDuration":"","totalMarks":0,"totalQuestions":0,"negativeMarking":"","examMode":"","examMedium":"","numberOfAttempts":"","registrationOpen":"","registrationClose":"","examWindowStart":"","examWindowEnd":"","acceptedBy":"","department":"","postName":"","jobLocation":"","payScale":"","groupLevel":"","lastDateApply":"","feeLastDate":"","notificationDate":"","examDate":"","reservationPolicy":"","boardName":"","className":"","stream":"","examSession":"","universityName":"","programName":"","degreeType":"","courseDuration":"","admissionBasis":"","totalSeats":0}}
Text: ${rawText}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTENT POST AUTO-FILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ContentPostAutoFillResult { [key: string]: unknown }

export async function autoFillContentPost(rawText: string): Promise<ContentPostAutoFillResult> {
  const direct = tryDirectParse(rawText);
  if (direct) return direct;

  return callGemini(`Extract content post data from Indian exam text. Return JSON only.
Rules: dates=YYYY-MM-DD. contentType:notification|application|admit-card|date-sheet|syllabus|answer-key|result|cutoff|previous-papers|mock-test|study-material|books.
Schema:{"title":"","slug":"","excerpt":"","content":"<p>HTML</p>","contentType":"","importantDates":[{"label":"","date":"","isUrgent":false}],"quickLinks":[{"label":"","url":"","isPDF":false,"isOfficial":true}],"tags":[],"seoTitle":"","seoDescription":"","faqs":[{"question":"","answer":""}],"contentTypeData":{}}
Text: ${rawText}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOG POST AUTO-FILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BlogAutoFillResult { [key: string]: unknown }

export async function autoFillBlogPost(rawText: string): Promise<BlogAutoFillResult> {
  const direct = tryDirectParse(rawText);
  if (direct) return direct;

  return callGemini(`Create blog post from this text for Indian education portal. Write 500+ word HTML. Return JSON only.
Rules: section:education-news|exam-prep|career-guidance|scholarship|study-abroad|edtech|student-life|opinion. postType:news|article|guide|listicle|opinion.
Schema:{"title":"","slug":"","excerpt":"","content":"<h2>...</h2><p>500+ words HTML</p>","section":"","postType":"","tags":[],"seoTitle":"","seoDescription":"","faqs":[{"question":"","answer":""}]}
Text: ${rawText}`);
}
