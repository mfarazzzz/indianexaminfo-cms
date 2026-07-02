/** All AI prompt templates — loaded from settings table, these are hardcoded defaults */

export interface PromptVars {
  examName?: string;
  contentType?: string;
  year?: string;
  language?: string;
  tone?: string;
  title?: string;
  excerpt?: string;
  content?: string;
}

/**
 * Sanitize a string before interpolating into a prompt.
 * Removes characters that could be used for prompt injection.
 */
function safe(val: string | undefined, maxLen = 120): string {
  if (!val) return "";
  return val
    .replace(/[`"\\]/g, "")        // remove backticks, quotes, backslashes
    .replace(/\n|\r/g, " ")         // collapse newlines
    .replace(/ignore|forget|system|assistant|override/gi, "") // block injection keywords
    .trim()
    .slice(0, maxLen);
}

export const DEFAULT_PROMPTS = {
  seoTitle: (v: PromptVars) =>
    `Generate an SEO title (max 60 characters) for a page about ${safe(v.examName)} ${safe(v.contentType)} ${safe(v.year, 4)}. Language: ${safe(v.language) || "English"}. Tone: ${safe(v.tone) || "informative"}. Include the year and the exam name. Return only the title text, no quotes.`,

  metaDescription: (v: PromptVars) =>
    `Write a meta description (max 160 characters) for a page about ${safe(v.examName)} ${safe(v.contentType)} ${safe(v.year, 4)}. Language: ${safe(v.language) || "English"}. Tone: ${safe(v.tone) || "informative"}. Mention key information students need. Return only the description text, no quotes.`,

  summaryBox: (v: PromptVars) =>
    `Create a quick summary box for ${safe(v.examName)} ${safe(v.contentType)}. Return a JSON array of 4-6 key fact objects: [{"label": "...", "value": "..."}]. Focus on important dates, eligibility, and status. Return only valid JSON.`,

  faqs: (v: PromptVars) =>
    `Generate 6 Frequently Asked Questions and detailed answers for ${safe(v.examName)} ${safe(v.contentType)} ${safe(v.year, 4)}. Language: ${safe(v.language) || "English"}. Return a JSON array: [{"question": "...", "answer": "..."}]. Questions should address what students commonly search for. Return only valid JSON.`,

  fullContent: (v: PromptVars) =>
    `Write a comprehensive, SEO-optimized article (600-800 words) about ${safe(v.examName)} ${safe(v.contentType)} ${safe(v.year, 4)}. Language: ${safe(v.language) || "English"}. Tone: ${safe(v.tone) || "informative"}. Use HTML with proper H2/H3 tags, bullet points where helpful. Include key dates, eligibility, how to apply/download, and important instructions. Return only clean HTML — no markdown, no script tags, no inline styles.`,
} as const;

export type PromptKey = keyof typeof DEFAULT_PROMPTS;
