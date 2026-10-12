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

/** Gemini generationConfig thinking control (S2.13c). Gemini 2.5 "thinking" models
 *  honour thinkingBudget (0 disables); the Gemini 3 family uses thinkingLevel.
 *  Overridable, never silently dropped — index.ts resolves it from env. */
export interface GeminiThinking { thinkingBudget?: number; thinkingLevel?: string }

/** Gemini generationConfig for a text prompt. jsonMode → strict JSON, plus a
 *  thinking config: the DEFAULT is { thinkingBudget: 0 } (a 2.5 "thinking" model
 *  must not spend the small output cap on hidden reasoning and truncate the
 *  extraction answer). Pass `thinking` to override; pass `null` to omit it. */
export function geminiRequestBody(
  prompt: string,
  jsonMode: boolean,
  cap: number,
  thinking?: GeminiThinking | null,
): { contents: { parts: { text: string }[] }[]; generationConfig: Record<string, unknown> } {
  const gc: Record<string, unknown> = {
    temperature: jsonMode ? 0.05 : 0.7,
    maxOutputTokens: cap,
  };
  if (jsonMode) gc.responseMimeType = "application/json";
  if (jsonMode) {
    const t = thinking === undefined ? { thinkingBudget: 0 } : thinking;
    if (t) {
      const tc: GeminiThinking = {};
      if (typeof t.thinkingBudget === "number") tc.thinkingBudget = t.thinkingBudget;
      if (typeof t.thinkingLevel === "string" && t.thinkingLevel) tc.thinkingLevel = t.thinkingLevel;
      if (Object.keys(tc).length) gc.thinkingConfig = tc;
    }
  }
  return { contents: [{ parts: [{ text: prompt }] }], generationConfig: gc };
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

/** One entry of a provider's live model list. Deliberately minimal — an id plus
 *  optional display name / generate-support, never anything secret. */
export interface ModelInfo { id: string; displayName?: string; supportsGenerate?: boolean }

/** The model-list endpoint for a provider kind. Gemini needs the x-goog-api-key
 *  header; the OpenAI-compatible family needs Authorization. Neither key is here
 *  — this only builds the URL. baseUrl already excludes a trailing slash. */
export function modelsEndpoint(baseUrl: string, kind: "gemini" | "openai-compatible"): string {
  return kind === "gemini" ? `${baseUrl}/v1beta/models` : `${baseUrl}/models`
}

/**
 * Normalise a provider's model-list response to ModelInfo[]. Gemini returns
 * { models: [{ name: "models/<id>", displayName, supportedGenerationMethods }] };
 * the "models/" prefix is stripped so the id matches what callOne puts in the URL.
 * OpenAI-compatible returns { data: [{ id }] } (some gateways use { models: [] }).
 * No provider body field other than these is ever surfaced.
 */
export function parseModelList(kind: "gemini" | "openai-compatible", data: unknown): ModelInfo[] {
  const list: unknown[] =
    kind === "gemini"
      ? ((data as any)?.models ?? [])
      : (((data as any)?.data ?? (data as any)?.models) ?? [])
  const out: ModelInfo[] = []
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || typeof m !== "object") continue
    const raw = String((m as any).id ?? (m as any).name ?? "")
    const id = kind === "gemini" ? raw.replace(/^models\//, "") : raw
    if (!id) continue
    const entry: ModelInfo = { id }
    // Gemini's `name` is the "models/<id>" resource path, never a display name —
    // use its `displayName` field only. OpenAI-compatible may carry a `name`.
    const dn = kind === "gemini" ? (m as any).displayName : ((m as any).name ?? (m as any).displayName)
    if (typeof dn === "string" && dn) entry.displayName = dn
    const methods = (m as any).supportedGenerationMethods
    if (Array.isArray(methods)) entry.supportsGenerate = methods.includes("generateContent")
    out.push(entry)
  }
  return out
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
