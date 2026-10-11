/**
 * providerCall.ts — the CANONICAL, pure building blocks the `ai-fill` Edge
 * Function uses when it talks to a provider: the request body for each API
 * shape, the response parser, and the error-body redactor.
 *
 * WHY A SEPARATE PURE MODULE: the Edge Function is a standalone Deno bundle and
 * cannot be imported by vitest, so the logic it depends on lives here and is
 * mirrored INSIDE supabase/functions/ai-fill/index.ts. providerCall.test.ts
 * exercises the behaviour with a mocked fetch; providerCallParity.test.ts reads
 * the function source and fails if the two drift (the same SQL↔TS mirror the
 * repo already uses for normalizeLabel / templates.ts).
 *
 * SECURITY: nothing here touches a key. redactProviderError exists so a
 * provider's error body can be logged WITHOUT leaking the key that may appear in
 * it (the key is sent in a header; some upstreams echo a masked value in the
 * body). The caller stores only the redacted result.
 */

/** Gemini generationConfig for a text prompt. jsonMode → strict JSON, and
 *  thinkingBudget 0 so a 2.5 "thinking" model does not spend the small output
 *  cap on hidden reasoning and truncate the extraction answer. */
export function geminiRequestBody(
  prompt: string,
  jsonMode: boolean,
  cap: number,
): { contents: { parts: { text: string }[] }[]; generationConfig: Record<string, unknown> } {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: jsonMode ? 0.05 : 0.7,
      maxOutputTokens: cap,
      ...(jsonMode
        ? { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
        : {}),
    },
  };
}

/** OpenAI-compatible /chat/completions body (groq, openai, mistral, cerebras,
 *  openrouter all speak this shape). */
export function openaiChatBody(
  prompt: string,
  model: string,
  jsonMode: boolean,
  cap: number,
): Record<string, unknown> {
  return {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: jsonMode ? 0.05 : 0.7,
    max_tokens: cap,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  };
}

/** The assistant text of a Gemini generateContent response ("" when absent). */
export function parseGeminiText(data: unknown): string {
  const parts = (data as any)?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p?.text ?? "").join("")
    : "";
}

/** The assistant text of an OpenAI-compatible chat completion ("" when absent). */
export function parseOpenaiText(data: unknown): string {
  const c = (data as any)?.choices?.[0]?.message?.content ?? "";
  return typeof c === "string" ? c : "";
}

/**
 * Redact anything that looks like a credential from a provider error body before
 * it is logged, then cap at 300 chars. Deliberately aggressive on secret shapes
 * (Bearer tokens, key/token/secret assignments, sk-/gsk_ prefixes, and long
 * high-entropy runs) while leaving ordinary prose ("model_not_found",
 * "quota exceeded") intact so the log stays useful.
 */
export function redactProviderError(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]")
    .replace(/x-goog-api-key[^A-Za-z0-9]*[A-Za-z0-9_\-]{6,}/gi, "x-goog-api-key [redacted]")
    .replace(/(["']?\b(?:api[_-]?key|apiKey|key|token|secret|access[_-]?token|password)\b["']?)\s*[:=]\s*["']?[A-Za-z0-9._\-]{6,}["']?/gi, "$1=[redacted]")
    .replace(/\b(?:sk|gsk|pk)-[A-Za-z0-9_\-]{12,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_\-]{28,}\b/g, "[redacted]")
    .slice(0, 300);
}
